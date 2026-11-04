package main

import (
	"net"
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
