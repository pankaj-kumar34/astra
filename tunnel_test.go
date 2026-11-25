package main

import (
	"net"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestTunnelManager_DisconnectFreesPorts(t *testing.T) {
	// Pick an available port for testing
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()

	tm := NewTunnelManager()

	profile := Profile{
		ID:   "test-profile",
		Name: "Test Profile",
		Host: "127.0.0.1",
		Port: 22,
		User: "testuser",
		Forwards: []PortForward{
			{
				ID:         "fwd-1",
				Label:      "TestPort",
				Service:    ServiceCustom,
				LocalPort:  port,
				RemoteHost: "127.0.0.1",
				RemotePort: port,
			},
		},
	}

	// Fake an active tunnelProcess with the profile and dummy state
	now := time.Now()
	stopHealth := make(chan struct{})
	stopRetry := make(chan struct{})
	waitErr := make(chan error, 1)
	close(waitErr)

	tm.mu.Lock()
	tm.tunnels[profile.ID] = &tunnelProcess{
		profile:    profile,
		stopHealth: stopHealth,
		stopRetry:  stopRetry,
		waitErr:    waitErr,
		state: TunnelState{
			ProfileID: profile.ID,
			Status:    StatusConnected,
			StartedAt: &now,
		},
	}
	tm.mu.Unlock()

	// Disconnect should mark idle and clean up without error
	if err := tm.Disconnect(profile.ID); err != nil {
		t.Fatalf("Disconnect failed: %v", err)
	}

	st := tm.GetState(profile.ID)
	if st.Status != StatusIdle {
		t.Fatalf("expected StatusIdle, got %v", st.Status)
	}

	// Verify DisconnectAll also runs cleanly
	tm.DisconnectAll()
}

func TestAstraService_AreAllProfilesDisconnected(t *testing.T) {
	svc := NewAstraService()
	if !svc.AreAllProfilesDisconnected() {
		t.Fatalf("expected all profiles to be disconnected initially")
	}

	now := time.Now()
	svc.manager.mu.Lock()
	svc.manager.tunnels["p1"] = &tunnelProcess{
		state: TunnelState{
			ProfileID: "p1",
			Status:    StatusConnected,
			StartedAt: &now,
		},
	}
	svc.manager.mu.Unlock()

	if svc.AreAllProfilesDisconnected() {
		t.Fatalf("expected AreAllProfilesDisconnected to be false when p1 is connected")
	}

	svc.manager.mu.Lock()
	svc.manager.tunnels["p1"].state.Status = StatusIdle
	svc.manager.mu.Unlock()

	if !svc.AreAllProfilesDisconnected() {
		t.Fatalf("expected AreAllProfilesDisconnected to be true when p1 is idle")
	}
}

func TestForwardBindFailureHandling(t *testing.T) {
	multiBroker := Profile{
		ID:      "p-kafka",
		Host:    "bastion.example.com",
		Port:    22,
		User:    "ubuntu",
		KeyPath: "~/.ssh/id_rsa",
		Forwards: []PortForward{
			{LocalPort: 5432, RemoteHost: "pg.internal", RemotePort: 5432},
			{LocalPort: 9093, RemoteHost: "broker-0.internal", RemotePort: 9093},
			{LocalPort: 9093, RemoteHost: "broker-1.internal", RemotePort: 9093},
			{LocalPort: 9093, RemoteHost: "broker-2.internal", RemotePort: 9093},
		},
	}

	ips := assignBindIPs(multiBroker.Forwards)
	wantIPs := []string{"127.0.0.1", "127.0.0.1", "127.0.0.2", "127.0.0.3"}
	if !slices.Equal(ips, wantIPs) {
		t.Fatalf("assignBindIPs = %v, want %v", ips, wantIPs)
	}

	args := buildSSHArgs(multiBroker)
	if !slices.Contains(args, "ExitOnForwardFailure=yes") {
		t.Fatalf("expected ExitOnForwardFailure=yes in ssh args, got %v", args)
	}
	for _, want := range []string{
		"127.0.0.1:9093:broker-0.internal:9093",
		"127.0.0.2:9093:broker-1.internal:9093",
		"127.0.0.3:9093:broker-2.internal:9093",
	} {
		if !slices.Contains(args, want) {
			t.Fatalf("expected forward %q in ssh args, got %v", want, args)
		}
	}

	// Same local port AND same remote host is still rejected as a true duplicate.
	dup := Profile{
		ID: "p-dup",
		Forwards: []PortForward{
			{LocalPort: 9093, RemoteHost: "broker-0.internal", RemotePort: 9093},
			{LocalPort: 9093, RemoteHost: "broker-0.internal", RemotePort: 9093},
		},
	}
	tm := NewTunnelManager()
	err := tm.Connect(dup, func(TunnelState) {})
	if err == nil || !strings.Contains(err.Error(), "duplicate forward") {
		t.Fatalf("expected duplicate forward error, got %v", err)
	}

	msg := friendlySSHError("exit status 255", []LogEntry{
		{Line: "bind [::1]:9093: Address already in use"},
		{Line: "channel_setup_fwd_listener_tcpip: cannot listen to port: 9093"},
	})
	if !strings.Contains(msg, "Port already in use") {
		t.Fatalf("expected port-in-use message, got %q", msg)
	}
}

func TestConnectPreservesOtherActiveProfiles(t *testing.T) {
	tm := NewTunnelManager()
	tm.mu.Lock()
	tm.tunnels["p1"] = &tunnelProcess{
		profile: Profile{
			ID:   "p1",
			Name: "Prod DB",
			Forwards: []PortForward{
				{LocalPort: 5432, RemoteHost: "pg-prod.internal", RemotePort: 5432},
			},
		},
		state: TunnelState{
			ProfileID: "p1",
			Status:    StatusConnected,
			PID:       42424,
		},
	}
	tm.mu.Unlock()

	pids := tm.otherActivePIDs("p2")
	if !pids[42424] {
		t.Fatalf("expected active PID 42424 in skip set, got %v", pids)
	}
	if len(tm.otherActivePIDs("p1")) != 0 {
		t.Fatalf("expected p1's own PID to be excluded from its skip set")
	}

	p2 := Profile{
		ID:   "p2",
		Name: "Staging DB",
		Forwards: []PortForward{
			{LocalPort: 5432, RemoteHost: "pg-stage.internal", RemotePort: 5432},
		},
	}
	err := tm.Connect(p2, func(TunnelState) {})
	if err == nil || !strings.Contains(err.Error(), "already in use by active profile") {
		t.Fatalf("expected active profile port conflict error, got %v", err)
	}
	if st := tm.GetState("p1"); st.Status != StatusConnected {
		t.Fatalf("expected p1 to remain connected, got %v", st.Status)
	}
}

func TestProbePortCustomDetectsImmediateEOF(t *testing.T) {
	// Simulates an SSH forward listener that accepts TCP locally, then immediately
	// closes the socket when the bastion fails remote DNS/connect.
	eofLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer eofLn.Close()
	go func() {
		for {
			c, err := eofLn.Accept()
			if err != nil {
				return
			}
			c.Close()
		}
	}()

	eofFwd := PortForward{Service: ServiceCustom, LocalPort: eofLn.Addr().(*net.TCPAddr).Port}
	if probePort("127.0.0.1", eofFwd) {
		t.Fatalf("expected probePort to return false when tunnel immediately closes with EOF")
	}

	// Simulates a live banner-sending service (e.g. SMTP 220).
	bannerLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer bannerLn.Close()
	go func() {
		for {
			c, err := bannerLn.Accept()
			if err != nil {
				return
			}
			_, _ = c.Write([]byte("220 smtp ready\r\n"))
			c.Close()
		}
	}()

	bannerFwd := PortForward{Service: ServiceCustom, LocalPort: bannerLn.Addr().(*net.TCPAddr).Port}
	if !probePort("127.0.0.1", bannerFwd) {
		t.Fatalf("expected probePort to return true for live service sending banner")
	}
}
