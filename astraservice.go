package main

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// AstraService is the main Wails service exposing all backend methods
type AstraService struct {
	manager          *TunnelManager
	notifiedProfiles map[string]bool
	notifiedMu       sync.Mutex
	prevStatus       map[string]TunnelStatus
	prevMu           sync.Mutex
}

func NewAstraService() *AstraService {
	return &AstraService{
		manager:          NewTunnelManager(),
		notifiedProfiles: make(map[string]bool),
		prevStatus:       make(map[string]TunnelStatus),
	}
}

func (s *AstraService) emit(name string, data any) {
	app := application.Get()
	if app != nil {
		app.Event.Emit(name, data)
	}
}

// AutoConnectAll connects all profiles with AutoConnect=true. Called on launch.
func (s *AstraService) AutoConnectAll() {
	data, err := loadData()
	if err != nil {
		return
	}
	for _, p := range data.Profiles {
		if p.AutoConnect {
			cp := p
			go func(profile Profile) {
				_ = s.manager.Connect(profile, func(state TunnelState) {
					s.emit("tunnel:state", state)
					s.checkDisconnectTransition(profile, state)
					if state.Status != StatusConnected && state.Status != StatusConnecting {
						s.clearNotified(profile.ID)
					}
					s.handleNotification(profile, state)
				})
			}(cp)
		}
	}
}

// ── Profiles ────────────────────────────────────────────────────────────────

func (s *AstraService) GetProfiles() ([]Profile, error) {
	data, err := loadData()
	if err != nil {
		return nil, err
	}
	return data.Profiles, nil
}

func (s *AstraService) SaveProfile(p Profile) (Profile, error) {
	data, err := loadData()
	if err != nil {
		return p, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if p.ID == "" {
		p.ID = newID()
		p.CreatedAt = now
		p.UpdatedAt = now
		if p.Port == 0 {
			p.Port = 22
		}
		if p.KeyPath == "" {
			p.KeyPath = "~/.ssh/id_rsa"
		}
		for i := range p.Forwards {
			if p.Forwards[i].ID == "" {
				p.Forwards[i].ID = newID()
			}
		}
		data.Profiles = append(data.Profiles, p)
	} else {
		found := false
		for i, existing := range data.Profiles {
			if existing.ID == p.ID {
				p.CreatedAt = existing.CreatedAt
				p.UpdatedAt = now
				for j := range p.Forwards {
					if p.Forwards[j].ID == "" {
						p.Forwards[j].ID = newID()
					}
				}
				data.Profiles[i] = p
				found = true
				break
			}
		}
		if !found {
			return p, fmt.Errorf("profile not found: %s", p.ID)
		}
	}

	// Update /etc/hosts BEFORE saving the profile.
	// This way if the user cancels the auth prompt, the profile is never persisted.
	if err := syncHostsForProfile(p, data.Profiles); err != nil {
		return p, fmt.Errorf("update /etc/hosts: %w", err)
	}

	if err := saveData(data); err != nil {
		return p, err
	}
	return p, nil
}

func (s *AstraService) DeleteProfile(id string) error {
	_ = s.Disconnect(id)
	data, err := loadData()
	if err != nil {
		return err
	}
	profiles := make([]Profile, 0, len(data.Profiles))
	for _, p := range data.Profiles {
		if p.ID != id {
			profiles = append(profiles, p)
		}
	}
	data.Profiles = profiles
	if err := saveData(data); err != nil {
		return err
	}
	// Best-effort: remove /etc/hosts entries for this profile
	_ = removeHostsForDeletedProfile(id)
	return nil
}

func (s *AstraService) DuplicateProfile(id string) (Profile, error) {
	data, err := loadData()
	if err != nil {
		return Profile{}, err
	}
	var src *Profile
	for _, p := range data.Profiles {
		if p.ID == id {
			cp := p
			src = &cp
			break
		}
	}
	if src == nil {
		return Profile{}, fmt.Errorf("profile not found: %s", id)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	dup := *src
	dup.ID = newID()
	dup.Name = src.Name + " (copy)"
	dup.AutoConnect = false
	dup.CreatedAt = now
	dup.UpdatedAt = now
	for i := range dup.Forwards {
		dup.Forwards[i].ID = newID()
	}
	data.Profiles = append(data.Profiles, dup)

	// Update /etc/hosts BEFORE saving the profile.
	// This way if the user cancels the auth prompt, the profile is never persisted.
	if err := syncHostsForProfile(dup, data.Profiles); err != nil {
		return dup, fmt.Errorf("update /etc/hosts: %w", err)
	}

	if err := saveData(data); err != nil {
		return dup, err
	}
	return dup, nil
}

// ── Tunnels ─────────────────────────────────────────────────────────────────

func (s *AstraService) GetAllTunnelStates() map[string]TunnelState {
	return s.manager.GetAllStates()
}

func (s *AstraService) Connect(profileID string) error {
	data, err := loadData()
	if err != nil {
		return err
	}
	var profile *Profile
	for _, p := range data.Profiles {
		if p.ID == profileID {
			cp := p
			profile = &cp
			break
		}
	}
	if profile == nil {
		return fmt.Errorf("profile not found: %s", profileID)
	}

	return s.manager.Connect(*profile, func(state TunnelState) {
		s.emit("tunnel:state", state)
		s.checkDisconnectTransition(*profile, state)
		if state.Status != StatusConnected && state.Status != StatusConnecting {
			s.clearNotified(profileID)
		}
		s.handleNotification(*profile, state)
	})
}

func (s *AstraService) Disconnect(profileID string) error {
	// Look up profile for name and forwards
	var profile Profile
	if data, err := loadData(); err == nil {
		for _, p := range data.Profiles {
			if p.ID == profileID {
				profile = p
				break
			}
		}
	}

	// Clear prevStatus BEFORE disconnecting so the callback doesn't fire duplicate notification
	s.prevMu.Lock()
	delete(s.prevStatus, profileID)
	s.prevMu.Unlock()

	err := s.manager.Disconnect(profileID)

	// Clean up any remaining SSH processes targeting this profile
	if profile.ID != "" {
		killSSHForProfile(profile)
	}

	state := s.manager.GetState(profileID)
	s.emit("tunnel:state", state)
	if profile.Name != "" {
		notify("Astra", profile.Name, "Tunnel disconnected")
	}

	// If all profiles are now disconnected, clean up all tunnels across all profiles
	if s.AreAllProfilesDisconnected() {
		s.cleanupAllTunnels()
	}

	return err
}

// DisconnectAll stops every tunnel across all profiles.
func (s *AstraService) DisconnectAll() error {
	data, err := loadData()
	if err == nil {
		for _, p := range data.Profiles {
			s.prevMu.Lock()
			delete(s.prevStatus, p.ID)
			s.prevMu.Unlock()
			_ = s.manager.Disconnect(p.ID)
			killSSHForProfile(p)
			state := s.manager.GetState(p.ID)
			s.emit("tunnel:state", state)
		}
	} else {
		s.manager.DisconnectAll()
	}

	s.cleanupAllTunnels()
	notify("Astra", "All Profiles", "All tunnels disconnected")
	return nil
}

// AreAllProfilesDisconnected checks if no tunnels are currently connected or connecting.
func (s *AstraService) AreAllProfilesDisconnected() bool {
	states := s.manager.GetAllStates()
	for _, st := range states {
		if st.Status == StatusConnected || st.Status == StatusConnecting {
			return false
		}
	}
	return true
}

func (s *AstraService) cleanupAllTunnels() {
	s.manager.DisconnectAll()
	if data, err := loadData(); err == nil {
		for _, p := range data.Profiles {
			killSSHForProfile(p)
		}
	}
}

// checkDisconnectTransition detects Connected → Error (network drop) or Connected → Idle (manual edge case)
// and fires a "Tunnel disconnected" notification.
func (s *AstraService) checkDisconnectTransition(profile Profile, state TunnelState) {
	s.prevMu.Lock()
	prev := s.prevStatus[profile.ID]
	s.prevStatus[profile.ID] = state.Status
	s.prevMu.Unlock()

	// Notify on transition from Connected to Error (network drop)
	// or Connected to Idle (manual disconnect edge case not caught by Disconnect())
	if prev == StatusConnected && (state.Status == StatusError || state.Status == StatusIdle) {
		notify("Astra", profile.Name, "Tunnel disconnected")
	}
}

// handleNotification fires a macOS notification on the connected transition only.
func (s *AstraService) handleNotification(profile Profile, state TunnelState) {
	if state.Status != StatusConnected {
		return
	}
	// Only fire on the exact transition: PID is set and no prior notification
	// The connected onUpdate is called exactly once with PID > 0 at transition time.
	// Subsequent onUpdates (log lines) also have StatusConnected but we must ignore them.
	// We use a simple in-memory set to track which profiles have been notified this session.
	s.notifiedMu.Lock()
	defer s.notifiedMu.Unlock()
	if s.notifiedProfiles[profile.ID] {
		return
	}
	s.notifiedProfiles[profile.ID] = true

	wasError := false
	for _, l := range state.Logs {
		if l.Level == "error" {
			wasError = true
			break
		}
	}
	if wasError {
		notify("Astra", profile.Name, "Tunnel reconnected ✓")
	} else {
		notify("Astra", profile.Name, "Tunnel connected ✓")
	}
}

// clearNotified resets the notified flag for a profile (called on disconnect/error).
func (s *AstraService) clearNotified(profileID string) {
	s.notifiedMu.Lock()
	delete(s.notifiedProfiles, profileID)
	s.notifiedMu.Unlock()
	// Also clear prevStatus on manual disconnect / idle
	s.prevMu.Lock()
	state := s.manager.GetState(profileID)
	if state.Status == StatusIdle {
		delete(s.prevStatus, profileID)
	}
	s.prevMu.Unlock()
}

// PickSSHKey opens a native file picker for SSH key files
func (s *AstraService) PickSSHKey() (string, error) {
	app := application.Get()
	if app == nil {
		return "", fmt.Errorf("app not ready")
	}
	path, err := app.Dialog.OpenFile().
		SetTitle("Select SSH Key").
		ShowHiddenFiles(true).
		PromptForSingleSelection()
	if err != nil {
		return "", err
	}
	return path, nil
}

func newID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 12)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}
