package main

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// AstraService is the main Wails service exposing all backend methods
type AstraService struct {
	manager *TunnelManager
}

func NewAstraService() *AstraService {
	return &AstraService{
		manager: NewTunnelManager(),
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

	return p, saveData(data)
}

func (s *AstraService) DeleteProfile(id string) error {
	_ = s.manager.Disconnect(id)
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
	return saveData(data)
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
	return dup, saveData(data)
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
		s.handleNotification(*profile, state)
	})
}

func (s *AstraService) Disconnect(profileID string) error {
	// Look up profile name for the notification
	var profileName string
	if data, err := loadData(); err == nil {
		for _, p := range data.Profiles {
			if p.ID == profileID {
				profileName = p.Name
				break
			}
		}
	}

	err := s.manager.Disconnect(profileID)
	if err != nil {
		return err
	}
	state := s.manager.GetState(profileID)
	s.emit("tunnel:state", state)
	if profileName != "" {
		notify("Astra", profileName, "Tunnel disconnected")
	}
	return nil
}

// handleNotification fires a macOS notification on meaningful state transitions.
func (s *AstraService) handleNotification(profile Profile, state TunnelState) {
	switch state.Status {
	case StatusConnected:
		notify("Astra", profile.Name, "Tunnel connected ✓")
	case StatusError:
		// Only notify when auto-reconnect is exhausted, not on every retry
		if len(state.Logs) > 0 {
			last := state.Logs[len(state.Logs)-1].Line
			if last == "Auto-reconnect exhausted — giving up" {
				notify("Astra", profile.Name, "Tunnel lost — reconnect failed")
			}
		}
	}
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
