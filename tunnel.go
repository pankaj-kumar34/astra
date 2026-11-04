package main

import (
	"bufio"
	"crypto/tls"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode"
)

// TunnelManager manages active SSH tunnel processes
type TunnelManager struct {
	mu      sync.RWMutex
	tunnels map[string]*tunnelProcess
}

type tunnelProcess struct {
	profile      Profile
	cmd          *exec.Cmd
	state        TunnelState
	stopHealth   chan struct{}
	stopRetry    chan struct{}
	manual       bool      // true = user explicitly disconnected, don't auto-reconnect
	notifiedConn bool      // true = "connected" notification already sent for this session
	waitErr      chan error // closed after cmd.Wait() completes
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

	// Terminate any stale SSH process and free local ports before connecting
	killSSHForProfile(profile)
	for _, fwd := range profile.Forwards {
		freePort(fwd.LocalPort)
	}

	return tm.startTunnel(profile, onUpdate, false)
}

func (tm *TunnelManager) startTunnel(profile Profile, onUpdate func(TunnelState), isRetry bool) error {
	tm.mu.Lock()
	if existing, ok := tm.tunnels[profile.ID]; ok {
		if isRetry && existing.manual {
			tm.mu.Unlock()
			return fmt.Errorf("tunnel was manually disconnected")
		}
		if !isRetry && (existing.state.Status == StatusConnected || existing.state.Status == StatusConnecting) {
			tm.mu.Unlock()
			return fmt.Errorf("tunnel already active")
		}
	}
	var prevLogs []LogEntry
	if isRetry {
		if existing, ok := tm.tunnels[profile.ID]; ok {
			prevLogs = existing.state.Logs
		}
	}
	tm.mu.Unlock()

	args := buildSSHArgs(profile)
	cmd := exec.Command("ssh", args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	now := time.Now()

	stopHealth := make(chan struct{})
	stopRetry := make(chan struct{})
	waitErr := make(chan error, 1)

	tp := &tunnelProcess{
		profile:    profile,
		cmd:        cmd,
		stopHealth: stopHealth,
		stopRetry:  stopRetry,
		waitErr:    waitErr,
		state: TunnelState{
			ProfileID:  profile.ID,
			Status:     StatusConnecting,
			StartedAt:  &now,
			Logs:       prevLogs,
			PortHealth: map[string]bool{},
		},
	}
	tm.mu.Lock()
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

	// Read SSH stderr and translate to friendly log lines
	go func() {
		defer stderr.Close()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			tm.appendLog(profile.ID, friendlySSHLog(scanner.Text()), "info", onUpdate)
		}
		if err := scanner.Err(); err != nil {
			tm.appendLog(profile.ID, "stderr read error: "+err.Error(), "error", onUpdate)
		}
	}()

	// Mark connected only after end-to-end probes pass on all forwarded ports.
	go func() {
		const pollInterval = 500 * time.Millisecond
		const timeout = 30 * time.Second
		deadline := time.Now().Add(timeout)
		loggedWaiting := false

		confirm := func() bool {
			if len(profile.Forwards) == 0 {
				tm.appendLog(profile.ID, "SSH handshake in progress…", "info", onUpdate)
				time.Sleep(10 * time.Second)
				return true
			}
			for time.Now().Before(deadline) {
				tm.mu.RLock()
				tp, ok := tm.tunnels[profile.ID]
				if !ok || tp.state.Status != StatusConnecting {
					tm.mu.RUnlock()
					return false
				}
				tm.mu.RUnlock()

				// Probe all ports; collect per-port results
				results := make([]bool, len(profile.Forwards))
				allOK := true
				for i, fwd := range profile.Forwards {
					results[i] = probePort(fwd)
					if !results[i] {
						allOK = false
					}
				}

				if allOK {
					for _, fwd := range profile.Forwards {
						tm.appendLog(profile.ID, fwdLabel(fwd)+" reachable ✓", "info", onUpdate)
					}
					return true
				}

				// Log per-port status once on first failure
				if !loggedWaiting {
					loggedWaiting = true
					for i, fwd := range profile.Forwards {
						if results[i] {
							tm.appendLog(profile.ID, fwdLabel(fwd)+" reachable ✓", "info", onUpdate)
						} else {
							tm.appendLog(profile.ID, fwdLabel(fwd)+" not yet reachable — waiting…", "warn", onUpdate)
						}
					}
				}
				time.Sleep(pollInterval)
			}
			return false
		}

		if confirm() {
			tm.mu.Lock()
			tp, ok := tm.tunnels[profile.ID]
			if ok && tp.state.Status == StatusConnecting && !tp.notifiedConn {
				tp.notifiedConn = true
				tp.state.Status = StatusConnected
				state := tp.state
				tm.mu.Unlock()
				onUpdate(state)
				go tm.runHealthPinger(profile, stopHealth, onUpdate)
			} else {
				tm.mu.Unlock()
			}
		} else {
			tm.appendLog(profile.ID, "Timed out waiting for remote services (30s) — check your forwards", "warn", onUpdate)
		}
	}()

	// Single owner of cmd.Wait()
	go func() {
		waitErr <- cmd.Wait()
		close(waitErr)
	}()

	// Watch for process exit → auto-reconnect
	go func() {
		err := <-waitErr

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
		errMsg := ""
		if err != nil {
			errMsg = friendlySSHError(err.Error(), tp.state.Logs)
		}
		tp.state.Status = StatusError
		tp.state.Error = errMsg
		tp.state.PID = 0
		state := tp.state
		tm.mu.Unlock()
		onUpdate(state)

		go tm.autoReconnect(profile, onUpdate, stopRetry)
	}()

	return nil
}

// autoReconnect tries 3× with backoff, then polls every 60s until success.
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
		if err := tm.startTunnel(profile, onUpdate, true); err == nil {
			return
		}
		tm.appendLog(profile.ID, fmt.Sprintf("Reconnect attempt %d failed", attempt+1), "error", onUpdate)
	}

	tm.appendLog(profile.ID, "Auto-reconnect exhausted — polling every 60s until network recovers…", "warn", onUpdate)

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
		if err := tm.startTunnel(profile, onUpdate, true); err == nil {
			return
		}
	}
}

// runHealthPinger probes all ports every 30s.
// If ALL ports fail, kills SSH to trigger autoReconnect.
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
		allUnreachable := true
		for _, fwd := range profile.Forwards {
			key := fmt.Sprintf("%d", fwd.LocalPort)
			reachable := probePort(fwd)
			if reachable {
				allUnreachable = false
			}
			if prev, exists := tp.state.PortHealth[key]; !exists || prev != reachable {
				tp.state.PortHealth[key] = reachable
				changed = true
				if reachable {
					tp.state.Logs = appendLogEntry(tp.state.Logs, fwdLabel(fwd)+" reachable ✓", "info")
				} else {
					tp.state.Logs = appendLogEntry(tp.state.Logs, fwdLabel(fwd)+" unreachable — remote service may be down", "warn")
				}
			}
		}
		cmd := tp.cmd
		state := tp.state
		tm.mu.Unlock()
		if changed {
			onUpdate(state)
		}
		if allUnreachable && cmd != nil && cmd.Process != nil {
			tm.appendLog(profile.ID, "All ports unreachable — reconnecting…", "warn", onUpdate)
			cmd.Process.Kill()
		}
	}

	// Don't ping immediately — confirm loop already verified all ports on connect.
	// First health check fires after 30s.
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
	select {
	case <-tp.stopRetry:
	default:
		close(tp.stopRetry)
	}
	select {
	case <-tp.stopHealth:
	default:
		close(tp.stopHealth)
	}
	cmd := tp.cmd
	waitErr := tp.waitErr
	tp.state.Status = StatusIdle
	tp.state.PID = 0
	profile := tp.profile
	tm.mu.Unlock()

	if cmd != nil && cmd.Process != nil && cmd.Process.Pid > 0 {
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		_ = cmd.Process.Kill()
		select {
		case <-waitErr:
		case <-time.After(2 * time.Second):
		}
	}

	// Terminate any matching SSH process for this profile
	killSSHForProfile(profile)

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
		args = append(args, "-L", fmt.Sprintf("%d:%s:%d", fwd.LocalPort, fwd.RemoteHost, fwd.RemotePort))
	}
	args = append(args, fmt.Sprintf("%s@%s", profile.User, profile.Host))
	return args
}

// killSSHForProfile kills any active SSH process targeting the profile's bastion host.
func killSSHForProfile(profile Profile) {
	if profile.Host == "" || profile.User == "" {
		return
	}
	target := fmt.Sprintf("%s@%s", profile.User, profile.Host)
	out, err := exec.Command("pgrep", "-f", target).Output()
	if err != nil {
		return
	}
	myPid := os.Getpid()
	for _, pidStr := range strings.Fields(string(out)) {
		pid, err := strconv.Atoi(strings.TrimSpace(pidStr))
		if err != nil || pid == myPid {
			continue
		}
		if p, err := os.FindProcess(pid); err == nil {
			_ = p.Kill()
		}
	}
}

// freePort kills any process holding the given local TCP port.
func freePort(port int) {
	if port <= 0 {
		return
	}
	out, err := exec.Command("lsof", "-ti", fmt.Sprintf("tcp:%d", port)).Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		return
	}
	myPid := os.Getpid()
	for _, pidStr := range strings.Fields(string(out)) {
		pid, err := strconv.Atoi(strings.TrimSpace(pidStr))
		if err != nil || pid == myPid {
			continue
		}
		if p, err := os.FindProcess(pid); err == nil {
			_ = p.Kill()
		}
	}
	time.Sleep(200 * time.Millisecond)
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
	if len(logs) > 0 && logs[len(logs)-1].Line == line {
		return logs // deduplicate consecutive identical lines
	}
	logs = append(logs, LogEntry{Timestamp: time.Now(), Line: line, Level: level})
	if len(logs) > 500 {
		logs = logs[len(logs)-500:]
	}
	return logs
}

// fwdLabel returns a clean display name for a port forward.
func fwdLabel(fwd PortForward) string {
	if fwd.Label != "" {
		return fwd.Label
	}
	if fwd.Service != "" && fwd.Service != ServiceCustom {
		// Capitalise first letter of service name e.g. "postgres" → "Postgres"
		s := string(fwd.Service)
		return strings.ToUpper(s[:1]) + s[1:]
	}
	return fmt.Sprintf(":%d", fwd.LocalPort)
}

// tlsDial opens a TLS connection with SNI set to remoteHost.
func tlsDial(addr, serverName string) (bool, error) {
	conn, err := tls.DialWithDialer(
		&net.Dialer{Timeout: 3 * time.Second},
		"tcp", addr,
		&tls.Config{ServerName: serverName},
	)
	if err != nil {
		return false, err
	}
	conn.Close()
	return true, nil
}

// postgresSSLDial probes a Postgres endpoint by sending the SSLRequest
// startup packet first (per the Postgres wire protocol), then upgrading
// to TLS. A plain tlsDial fails because Postgres closes the connection
// if it receives a TLS ClientHello without the prior SSLRequest.
func postgresSSLDial(addr, serverName string) (bool, error) {
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return false, err
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(5 * time.Second))

	// Postgres SSLRequest packet: 4-byte length (8) + 4-byte code (80877103)
	sslReq := []byte{0, 0, 0, 8, 4, 210, 22, 47}
	if _, err := conn.Write(sslReq); err != nil {
		return false, err
	}

	resp := make([]byte, 1)
	if _, err := conn.Read(resp); err != nil {
		return false, err
	}
	if resp[0] != 'S' {
		// Server doesn't support SSL — but TCP works, so tunnel is up
		return true, nil
	}

	// Upgrade to TLS
	tlsConn := tls.Client(conn, &tls.Config{
		ServerName:         serverName,
		InsecureSkipVerify: true, // just proving tunnel connectivity, not cert validity
	})
	if err := tlsConn.Handshake(); err != nil {
		return false, err
	}
	tlsConn.Close()
	return true, nil
}

// probePort does an end-to-end connectivity check using the best no-auth probe
// available for each service type.
func probePort(fwd PortForward) bool {
	addr := fmt.Sprintf("127.0.0.1:%d", fwd.LocalPort)

	switch fwd.Service {
	case ServiceRedis, ServiceValkey:
		// TLS handshake with SNI proves end-to-end (auth required so no PING)
		ok, _ := tlsDial(addr, fwd.RemoteHost)
		return ok

	case ServicePostgres:
		// Postgres requires a SSLRequest packet before TLS upgrade —
		// plain tlsDial fails because the server closes on a bare ClientHello
		ok, _ := postgresSSLDial(addr, fwd.RemoteHost)
		return ok

	case ServiceElasticsearch:
		// Try TLS first; fall back to plain HTTP
		if ok, _ := tlsDial(addr, fwd.RemoteHost); ok {
			return true
		}
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err != nil {
			return false
		}
		defer conn.Close()
		conn.SetDeadline(time.Now().Add(3 * time.Second))
		conn.Write([]byte("GET / HTTP/1.0\r\nHost: localhost\r\n\r\n"))
		buf := make([]byte, 5)
		n, err := conn.Read(buf)
		return err == nil && n > 0

	case ServiceEventStreams:
		// TLS handshake with SNI proves end-to-end
		ok, _ := tlsDial(addr, fwd.RemoteHost)
		return ok

	default:
		// Custom / unknown — plain TCP connect
		conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
		if err != nil {
			return false
		}
		conn.Close()
		return true
	}
}

// friendlySSHError maps raw SSH exit errors to human-readable messages.
func friendlySSHError(raw string, logs []LogEntry) string {
	recent := ""
	start := len(logs) - 10
	if start < 0 {
		start = 0
	}
	for _, l := range logs[start:] {
		recent += l.Line + "\n"
	}

	switch {
	case strings.Contains(recent, "Permission denied"):
		return "Permission denied — check SSH key and username"
	case strings.Contains(recent, "Connection refused"):
		return "Connection refused — is the host reachable on that port?"
	case strings.Contains(recent, "No route to host"),
		strings.Contains(recent, "Network is unreachable"),
		strings.Contains(recent, "Operation timed out"),
		strings.Contains(recent, "connect to host"):
		return "Network unreachable — check your internet connection"
	case strings.Contains(recent, "Host key verification failed"):
		return "Host key verification failed — remove old entry from known_hosts"
	case strings.Contains(recent, "Bad local forwarding spec"),
		strings.Contains(recent, "bind: Address already in use"):
		return "Port already in use — another process is holding the local port"
	case strings.Contains(recent, "ServerAlive"),
		strings.Contains(raw, "255") && strings.Contains(recent, "Timeout"):
		return "Connection lost — server stopped responding"
	case raw == "exit status 255" || raw == "signal: killed":
		return "Connection lost — SSH exited unexpectedly"
	default:
		if raw != "" {
			return raw
		}
		return "Connection lost"
	}
}

// friendlySSHLog translates raw SSH stderr lines into readable log entries.
func friendlySSHLog(line string) string {
	// Extract "Channel N" prefix from lines like "channel 4: open failed: ..."
	chPrefix := func(l string) string {
		if idx := strings.Index(l, "channel "); idx >= 0 {
			rest := l[idx:]
			if colon := strings.Index(rest, ":"); colon >= 0 {
				ch := rest[:colon]
				// Capitalise first letter without deprecated strings.Title
				r := []rune(ch)
				r[0] = unicode.ToUpper(r[0])
				return string(r)
			}
		}
		return ""
	}

	switch {
	case strings.Contains(line, "open failed: connect failed: Connection timed out"):
		if ch := chPrefix(line); ch != "" {
			return ch + ": remote service timed out"
		}
		return "Tunnel channel timed out — remote service unreachable"
	case strings.Contains(line, "open failed: connect failed: Connection refused"):
		if ch := chPrefix(line); ch != "" {
			return ch + ": remote service refused connection"
		}
		return "Tunnel channel refused — remote service may be down"
	case strings.Contains(line, "open failed: connect failed"):
		if idx := strings.Index(line, "connect failed: "); idx >= 0 {
			return "Tunnel channel failed: " + line[idx+len("connect failed: "):]
		}
		return "Tunnel channel failed — remote service unreachable"
	case strings.Contains(line, "channel") && strings.Contains(line, "open failed"):
		return "Tunnel channel failed — remote service unreachable"
	case strings.Contains(line, "Warning: Permanently added"):
		return "Host key accepted"
	case strings.Contains(line, "Authenticated to"):
		return "Authenticated ✓"
	default:
		return line
	}
}
