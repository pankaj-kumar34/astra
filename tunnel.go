package main

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// TunnelManager manages active SSH tunnel processes
type TunnelManager struct {
	mu      sync.RWMutex
	tunnels map[string]*tunnelProcess
}

type tunnelProcess struct {
	cmd        *exec.Cmd
	state      TunnelState
	profile    Profile
	onUpdate   func(TunnelState)
	stopHealth chan struct{}
	stopRetry  chan struct{}
	manual     bool // true = user explicitly disconnected, don't auto-reconnect
	waitOnce   sync.Once
	waitErr    chan error // closed after cmd.Wait() completes
}

func NewTunnelManager() *TunnelManager {
	return &TunnelManager{
		tunnels: make(map[string]*tunnelProcess),
	}
}

// DisconnectAll kills every active tunnel — called on app quit.
func (tm *TunnelManager) DisconnectAll() {
	tm.mu.RLock()
	ids := make([]string, 0, len(tm.tunnels))
	for id := range tm.tunnels {
		ids = append(ids, id)
	}
	tm.mu.RUnlock()
	for _, id := range ids {
		_ = tm.Disconnect(id)
	}
}

func (tm *TunnelManager) GetState(profileID string) TunnelState {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	if tp, ok := tm.tunnels[profileID]; ok {
		return tp.state
	}
	return TunnelState{ProfileID: profileID, Status: StatusIdle, Logs: []LogEntry{}, PortHealth: map[string]bool{}}
}

func (tm *TunnelManager) GetAllStates() map[string]TunnelState {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	out := make(map[string]TunnelState)
	for id, tp := range tm.tunnels {
		out[id] = tp.state
	}
	return out
}

func (tm *TunnelManager) Connect(profile Profile, onUpdate func(TunnelState)) error {
	tm.mu.Lock()
	if tp, ok := tm.tunnels[profile.ID]; ok {
		if tp.state.Status == StatusConnected || tp.state.Status == StatusConnecting {
			tm.mu.Unlock()
			return fmt.Errorf("tunnel already active")
		}
	}
	tm.mu.Unlock()

	// Free any stale processes still holding our local ports
	for _, fwd := range profile.Forwards {
		freePort(fwd.LocalPort)
	}

	return tm.startTunnel(profile, onUpdate, false)
}

func (tm *TunnelManager) startTunnel(profile Profile, onUpdate func(TunnelState), isRetry bool) error {
	args := buildSSHArgs(profile)
	cmd := exec.Command("ssh", args...)

	now := time.Now()

	tm.mu.Lock()
	// Preserve existing logs on retry
	var prevLogs []LogEntry
	if isRetry {
		if existing, ok := tm.tunnels[profile.ID]; ok {
			prevLogs = existing.state.Logs
		}
	}

	stopHealth := make(chan struct{})
	stopRetry := make(chan struct{})
	waitErr := make(chan error, 1)

	tp := &tunnelProcess{
		cmd:        cmd,
		profile:    profile,
		onUpdate:   onUpdate,
		stopHealth: stopHealth,
		stopRetry:  stopRetry,
		manual:     false,
		waitErr:    waitErr,
		state: TunnelState{
			ProfileID:  profile.ID,
			Status:     StatusConnecting,
			StartedAt:  &now,
			Logs:       prevLogs,
			PortHealth: map[string]bool{},
		},
	}
	tm.tunnels[profile.ID] = tp
	tm.mu.Unlock()

	onUpdate(tp.state)

	stderr, err := cmd.StderrPipe()
	if err != nil {
		tm.setError(profile.ID, err.Error(), onUpdate)
		return err
	}

	if err := cmd.Start(); err != nil {
		stderr.Close()
		tm.setError(profile.ID, err.Error(), onUpdate)
		return err
	}
	tm.mu.Lock()
	tp.state.PID = cmd.Process.Pid
	tm.mu.Unlock()

	// Read logs — pipe is closed when SSH exits, which unblocks the scanner
	go func() {
		defer stderr.Close()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			tm.appendLog(profile.ID, scanner.Text(), "info", onUpdate)
		}
		if err := scanner.Err(); err != nil {
			tm.appendLog(profile.ID, "stderr read error: "+err.Error(), "error", onUpdate)
		}
	}()

	// Mark connected only after confirming ports are reachable.
	// Polls each forwarded local port (up to 30s). If no forwards, waits
	// 10s for the SSH handshake to complete before assuming connected.
	go func() {
		const pollInterval = 500 * time.Millisecond
		const timeout = 30 * time.Second
		deadline := time.Now().Add(timeout)

		confirm := func() bool {
			if len(profile.Forwards) == 0 {
				// No ports to dial — wait 10s for the handshake
				time.Sleep(10 * time.Second)
				return true
			}
			for time.Now().Before(deadline) {
				// Check if process died or user disconnected
				tm.mu.RLock()
				tp, ok := tm.tunnels[profile.ID]
				if !ok || tp.state.Status != StatusConnecting {
					tm.mu.RUnlock()
					return false
				}
				tm.mu.RUnlock()

				// Try all ports — all must be reachable
				allOK := true
				for _, fwd := range profile.Forwards {
					conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", fwd.LocalPort), 1*time.Second)
					if err != nil {
						allOK = false
					} else {
						conn.Close()
					}
				}
				if allOK {
					return true
				}
				time.Sleep(pollInterval)
			}
			return false // timed out
		}

		if confirm() {
			tm.mu.Lock()
			tp, ok := tm.tunnels[profile.ID]
			if ok && tp.state.Status == StatusConnecting {
				tp.state.Status = StatusConnected
				state := tp.state
				tm.mu.Unlock()
				onUpdate(state)
				go tm.runHealthPinger(profile, stopHealth, onUpdate)
			} else {
				tm.mu.Unlock()
			}
		}
	}()

	// Single owner of cmd.Wait() — result sent to waitErr channel
	go func() {
		waitErr <- cmd.Wait()
		close(waitErr)
	}()

	// Watch for process exit → auto-reconnect
	go func() {
		err := <-waitErr

		// Stop health pinger
		select {
		case <-stopHealth:
		default:
			close(stopHealth)
		}

		tm.mu.Lock()
		tp, ok := tm.tunnels[profile.ID]
		if !ok {
			tm.mu.Unlock()
			return
		}
		wasManual := tp.manual
		if wasManual {
			tp.state.Status = StatusIdle
			tp.state.PID = 0
			state := tp.state
			tm.mu.Unlock()
			onUpdate(state)
			return
		}
		// Unexpected exit
		errMsg := ""
		if err != nil {
			errMsg = err.Error()
		}
		tp.state.Status = StatusError
		tp.state.Error = errMsg
		tp.state.PID = 0
		state := tp.state
		tm.mu.Unlock()
		onUpdate(state)

		// Auto-reconnect with back-off: 5s, 15s, 30s
		go tm.autoReconnect(profile, onUpdate, stopRetry)
	}()

	return nil
}

// autoReconnect tries up to 3 times with back-off delays, then falls back to
// a slow background poller (every 60s) until the connection succeeds.
func (tm *TunnelManager) autoReconnect(profile Profile, onUpdate func(TunnelState), stop chan struct{}) {
	delays := []time.Duration{5 * time.Second, 15 * time.Second, 30 * time.Second}
	for attempt, delay := range delays {
		tm.appendLog(profile.ID, fmt.Sprintf("Auto-reconnect attempt %d/3 in %s…", attempt+1, delay), "warn", onUpdate)

		select {
		case <-stop:
			return
		case <-time.After(delay):
		}

		tm.mu.RLock()
		tp, ok := tm.tunnels[profile.ID]
		if ok && tp.manual {
			tm.mu.RUnlock()
			return
		}
		tm.mu.RUnlock()

		tm.appendLog(profile.ID, fmt.Sprintf("Reconnecting… (attempt %d/3)", attempt+1), "info", onUpdate)
		err := tm.startTunnel(profile, onUpdate, true)
		if err == nil {
			return // success
		}
		tm.appendLog(profile.ID, fmt.Sprintf("Reconnect attempt %d failed: %s", attempt+1, err), "error", onUpdate)
	}

	tm.appendLog(profile.ID, "Auto-reconnect exhausted — polling every 60s until network recovers…", "warn", onUpdate)

	// Slow poller — retry every 60s indefinitely until success or manual disconnect
	for {
		select {
		case <-stop:
			return
		case <-time.After(60 * time.Second):
		}

		tm.mu.RLock()
		tp, ok := tm.tunnels[profile.ID]
		if ok && tp.manual {
			tm.mu.RUnlock()
			return
		}
		tm.mu.RUnlock()

		tm.appendLog(profile.ID, "Polling reconnect…", "info", onUpdate)
		err := tm.startTunnel(profile, onUpdate, true)
		if err == nil {
			return // success — handleNotification will fire "Tunnel reconnected"
		}
	}
}

// runHealthPinger dials each forwarded port every 30s and emits per-port health updates
func (tm *TunnelManager) runHealthPinger(profile Profile, stop chan struct{}, onUpdate func(TunnelState)) {
	if len(profile.Forwards) == 0 {
		return
	}
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	ping := func() {
		tm.mu.Lock()
		tp, ok := tm.tunnels[profile.ID]
		if !ok {
			tm.mu.Unlock()
			return
		}
		if tp.state.PortHealth == nil {
			tp.state.PortHealth = map[string]bool{}
		}
		changed := false
		for _, fwd := range profile.Forwards {
			key := fmt.Sprintf("%d", fwd.LocalPort)
			addr := fmt.Sprintf("127.0.0.1:%d", fwd.LocalPort)
			conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
			reachable := err == nil
			if reachable {
				conn.Close()
			}
			if prev, exists := tp.state.PortHealth[key]; !exists || prev != reachable {
				tp.state.PortHealth[key] = reachable
				changed = true
				if !reachable {
					tp.state.Logs = appendLogEntry(tp.state.Logs, fmt.Sprintf("Health: port %d unreachable", fwd.LocalPort), "warn")
				} else {
					tp.state.Logs = appendLogEntry(tp.state.Logs, fmt.Sprintf("Health: port %d reachable ✓", fwd.LocalPort), "info")
				}
			}
		}
		state := tp.state
		tm.mu.Unlock()
		if changed {
			onUpdate(state)
		}
	}

	// Run immediately on connect
	ping()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			ping()
		}
	}
}

func (tm *TunnelManager) Disconnect(profileID string) error {
	tm.mu.Lock()
	tp, ok := tm.tunnels[profileID]
	if !ok {
		tm.mu.Unlock()
		return fmt.Errorf("no active tunnel for profile %s", profileID)
	}
	tp.manual = true
	// Stop auto-reconnect goroutine
	select {
	case <-tp.stopRetry:
	default:
		close(tp.stopRetry)
	}
	// Stop health pinger
	select {
	case <-tp.stopHealth:
	default:
		close(tp.stopHealth)
	}
	cmd := tp.cmd
	waitErr := tp.waitErr
	tp.state.Status = StatusIdle
	tp.state.PID = 0
	tm.mu.Unlock()

	// Kill the process and wait for it to fully exit so the OS releases port bindings.
	// waitErr is owned by the single Wait goroutine — we just drain it here.
	if cmd.Process != nil {
		_ = cmd.Process.Kill()
		<-waitErr // blocks until kernel cleans up; port is free after this
	}
	return nil
}

func buildSSHArgs(profile Profile) []string {
	args := []string{
		"-N",
		"-o", "ServerAliveInterval=10",
		"-o", "ServerAliveCountMax=3",
		"-o", "StrictHostKeyChecking=no",
		"-o", "BatchMode=yes",
		"-i", profile.KeyPath,
		"-p", fmt.Sprintf("%d", profile.Port),
	}
	for _, fwd := range profile.Forwards {
		args = append(args, "-L",
			fmt.Sprintf("%d:%s:%d", fwd.LocalPort, fwd.RemoteHost, fwd.RemotePort),
		)
	}
	args = append(args, fmt.Sprintf("%s@%s", profile.User, profile.Host))
	return args
}

// freePort kills any process holding the given TCP port on localhost.
// Uses lsof to find the PID and sends SIGKILL.
func freePort(port int) {
	out, err := exec.Command("lsof", "-ti", fmt.Sprintf("tcp:%d", port)).Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		return
	}
	for _, pidStr := range strings.Fields(string(out)) {
		pid, err := strconv.Atoi(strings.TrimSpace(pidStr))
		if err != nil {
			continue
		}
		if p, err := os.FindProcess(pid); err == nil {
			_ = p.Kill()
		}
	}
	time.Sleep(200 * time.Millisecond) // give kernel time to release the port
}

func (tm *TunnelManager) setError(profileID, errMsg string, onUpdate func(TunnelState)) {
	tm.mu.Lock()
	tp, ok := tm.tunnels[profileID]
	if ok {
		tp.state.Status = StatusError
		tp.state.Error = errMsg
		state := tp.state
		tm.mu.Unlock()
		onUpdate(state)
	} else {
		tm.mu.Unlock()
	}
}

func (tm *TunnelManager) appendLog(profileID, line, level string, onUpdate func(TunnelState)) {
	tm.mu.Lock()
	tp, ok := tm.tunnels[profileID]
	if !ok {
		tm.mu.Unlock()
		return
	}
	tp.state.Logs = appendLogEntry(tp.state.Logs, line, level)
	state := tp.state
	tm.mu.Unlock()
	onUpdate(state)
}

func appendLogEntry(logs []LogEntry, line, level string) []LogEntry {
	logs = append(logs, LogEntry{Timestamp: time.Now(), Line: line, Level: level})
	if len(logs) > 500 {
		logs = logs[len(logs)-500:]
	}
	return logs
}
