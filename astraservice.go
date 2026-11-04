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
	})
}

func (s *AstraService) Disconnect(profileID string) error {
	err := s.manager.Disconnect(profileID)
	if err != nil {
		return err
	}
	state := s.manager.GetState(profileID)
	s.emit("tunnel:state", state)
	return nil
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
