package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func dataFilePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, "Library", "Application Support", "Astra")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "data.json"), nil
}

func loadData() (*AppData, error) {
	path, err := dataFilePath()
	if err != nil {
		return &AppData{Profiles: []Profile{}}, nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &AppData{Profiles: []Profile{}}, nil
		}
		return nil, err
	}
	var data AppData
	if err := json.Unmarshal(b, &data); err != nil {
		return &AppData{Profiles: []Profile{}}, nil
	}
	if data.Profiles == nil {
		data.Profiles = []Profile{}
	}
	return &data, nil
}

func saveData(data *AppData) error {
	path, err := dataFilePath()
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
