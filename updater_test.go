package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestCompareSemver(t *testing.T) {
	tests := []struct {
		v1, v2 string
		want   int
	}{
		{"1.0.0", "1.0.0", 0},
		{"v1.0.0", "1.0.0", 0},
		{"1.0.0", "1.0.1", -1},
		{"1.2.0", "1.10.0", -1},
		{"2.0.0", "1.9.9", 1},
		{"1.0.0-beta.1", "1.0.0", -1},
		{"1.0.0", "1.0.0-rc.1", 1},
	}

	for _, tc := range tests {
		got := CompareSemver(tc.v1, tc.v2)
		if got != tc.want {
			t.Errorf("CompareSemver(%q, %q) = %d, want %d", tc.v1, tc.v2, got, tc.want)
		}
	}
}

func TestMatchReleaseAsset(t *testing.T) {
	assets := []githubAsset{
		{Name: "astra-darwin-arm64.tar.gz", BrowserDownloadURL: "https://example.com/darwin-arm64.tar.gz"},
		{Name: "astra-darwin-amd64.tar.gz", BrowserDownloadURL: "https://example.com/darwin-amd64.tar.gz"},
		{Name: "astra-linux-amd64.tar.gz", BrowserDownloadURL: "https://example.com/linux-amd64.tar.gz"},
		{Name: "astra-windows-amd64.zip", BrowserDownloadURL: "https://example.com/windows-amd64.zip"},
		{Name: "checksums.txt", BrowserDownloadURL: "https://example.com/checksums.txt"},
	}

	a, canSelf := matchReleaseAsset(assets, "darwin", "arm64")
	if a == nil || a.Name != "astra-darwin-arm64.tar.gz" || !canSelf {
		t.Fatalf("darwin/arm64 mismatch: got %+v, canSelf=%v", a, canSelf)
	}

	a, canSelf = matchReleaseAsset(assets, "linux", "amd64")
	if a == nil || a.Name != "astra-linux-amd64.tar.gz" || !canSelf {
		t.Fatalf("linux/amd64 mismatch: got %+v, canSelf=%v", a, canSelf)
	}

	a, canSelf = matchReleaseAsset(assets, "windows", "amd64")
	if a == nil || a.Name != "astra-windows-amd64.zip" || !canSelf {
		t.Fatalf("windows/amd64 mismatch: got %+v, canSelf=%v", a, canSelf)
	}

	if cs := findChecksumAssetURL(assets); cs != "https://example.com/checksums.txt" {
		t.Fatalf("expected checksums.txt URL, got %q", cs)
	}
}

func TestParseChecksumForAsset(t *testing.T) {
	hash := strings.Repeat("a", 64)
	content := fmt.Sprintf("# comment\n%s  astra-darwin-arm64.tar.gz\n%s *astra-linux-amd64.tar.gz\n", hash, strings.Repeat("b", 64))

	if got := parseChecksumForAsset(content, "astra-darwin-arm64.tar.gz"); got != hash {
		t.Fatalf("expected %q, got %q", hash, got)
	}
	if got := parseChecksumForAsset(content, "astra-windows-amd64.zip"); got != "" {
		t.Fatalf("expected empty hash for missing asset, got %q", got)
	}
}

func TestCheckForUpdateAndDownloadInstall(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a fake tar.gz containing a new binary
	archivePath := filepath.Join(tmpDir, "astra-linux-amd64.tar.gz")
	newContent := []byte("#!/bin/sh\necho astra-v1.1.0\n")
	if err := createTestTarGz(archivePath, "astra", newContent); err != nil {
		t.Fatalf("failed to create test tar.gz: %v", err)
	}
	archiveBytes, err := os.ReadFile(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(archiveBytes)
	checksumLine := fmt.Sprintf("%s  astra-linux-amd64.tar.gz\n", hex.EncodeToString(sum[:]))

	baseURL := "https://mock.github.local"
	client := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			var body []byte
			status := http.StatusOK

			switch r.URL.Path {
			case "/repos/pankaj-kumar34/astra/releases/latest":
				body, _ = json.Marshal(githubRelease{
					TagName:     "v1.1.0",
					Name:        "Astra v1.1.0",
					Body:        "Bug fixes",
					HTMLURL:     "https://github.com/pankaj-kumar34/astra/releases/tag/v1.1.0",
					PublishedAt: "2026-11-18T00:00:00Z",
					Assets: []githubAsset{
						{
							Name:               "astra-linux-amd64.tar.gz",
							Size:               int64(len(archiveBytes)),
							BrowserDownloadURL: baseURL + "/download/astra-linux-amd64.tar.gz",
						},
						{
							Name:               "checksums.txt",
							BrowserDownloadURL: baseURL + "/download/checksums.txt",
						},
					},
				})
			case "/download/astra-linux-amd64.tar.gz":
				body = archiveBytes
			case "/download/checksums.txt":
				body = []byte(checksumLine)
			default:
				status = http.StatusNotFound
			}

			return &http.Response{
				StatusCode:    status,
				Body:          io.NopCloser(bytes.NewReader(body)),
				ContentLength: int64(len(body)),
				Header:        make(http.Header),
				Request:       r,
			}, nil
		}),
	}

	targetExec := filepath.Join(tmpDir, "astra")
	if err := os.WriteFile(targetExec, []byte("old-binary"), 0755); err != nil {
		t.Fatal(err)
	}

	var stages []string
	updater := &UpdaterService{
		HTTPClient:   client,
		APIBaseURL:   baseURL,
		Repo:         "pankaj-kumar34/astra",
		Version:      "1.0.0",
		TargetOS:     "linux",
		TargetArch:   "amd64",
		ExecutableFn: func() (string, error) { return targetExec, nil },
		ProgressEmit: func(p UpdateProgress) { stages = append(stages, p.Stage) },
	}

	res, err := updater.CheckForUpdate()
	if err != nil {
		t.Fatalf("CheckForUpdate failed: %v", err)
	}
	if !res.HasUpdate || res.LatestVersion != "1.1.0" || !res.CanSelfUpdate {
		t.Fatalf("unexpected UpdateCheckResult: %+v", res)
	}

	if err := updater.DownloadAndInstallUpdate(res.AssetUrl, res.AssetName, res.ChecksumUrl); err != nil {
		t.Fatalf("DownloadAndInstallUpdate failed: %v", err)
	}

	gotBytes, err := os.ReadFile(targetExec)
	if err != nil {
		t.Fatal(err)
	}
	if string(gotBytes) != string(newContent) {
		t.Fatalf("updated binary content mismatch: got %q, want %q", string(gotBytes), string(newContent))
	}
	if len(stages) == 0 || stages[len(stages)-1] != "ready" {
		t.Fatalf("expected final progress stage 'ready', got %v", stages)
	}
}

func createTestTarGz(destPath, name string, content []byte) error {
	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()

	gw := gzip.NewWriter(f)
	defer gw.Close()

	tw := tar.NewWriter(gw)
	defer tw.Close()

	if err := tw.WriteHeader(&tar.Header{
		Name: name,
		Mode: 0755,
		Size: int64(len(content)),
	}); err != nil {
		return err
	}
	_, err = tw.Write(content)
	return err
}
