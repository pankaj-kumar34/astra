package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

const hostsFile = "/etc/hosts"
const hostsTag = "# astra:"

// isAstraLine returns true if the line was written by Astra.
func isAstraLine(line, profileID string) bool {
	return strings.Contains(line, hostsTag+profileID)
}

// syncHostsForProfile ensures 127.0.0.1 <remoteHost> entries exist for every
// forward in the profile. It removes stale entries for this profile
// (handles edits), then adds any that are missing — all in ONE write to avoid
// multiple auth prompts.
func syncHostsForProfile(p Profile, allProfiles []Profile) error {
	b, err := os.ReadFile(hostsFile)
	if err != nil {
		return fmt.Errorf("read /etc/hosts: %w", err)
	}
	existing := string(b)

	// Build set of hosts still needed by other profiles (for removal logic)
	stillNeeded := map[string]bool{}
	for _, op := range allProfiles {
		if op.ID == p.ID {
			continue
		}
		for _, fwd := range op.Forwards {
			if fwd.RemoteHost != "" {
				stillNeeded[strings.TrimSpace(fwd.RemoteHost)] = true
			}
		}
	}

	// Parse existing lines, filter out this profile's entries (unless still needed by another profile)
	lines := strings.Split(existing, "\n")
	filtered := make([]string, 0, len(lines))
	for _, line := range lines {
		if isAstraLine(line, p.ID) {
			// Extract the hostname from the line to check if still needed
			fields := strings.Fields(line)
			if len(fields) >= 2 && stillNeeded[fields[1]] {
				// Another profile still needs this host — keep the line
				filtered = append(filtered, line)
			}
			// else: drop it (stale entry for this profile)
			continue
		}
		filtered = append(filtered, line)
	}

	// Now add missing entries for this profile's forwards
	currentContent := strings.Join(filtered, "\n")
	var toAdd []string
	for _, fwd := range p.Forwards {
		host := strings.TrimSpace(fwd.RemoteHost)
		if host == "" {
			continue
		}
		// Skip if already present in the filtered content (any owner)
		if strings.Contains(currentContent, host) {
			continue
		}
		toAdd = append(toAdd, fmt.Sprintf("127.0.0.1\t%s\t%s%s", host, hostsTag, p.ID))
	}

	if len(toAdd) > 0 {
		currentContent = strings.TrimRight(currentContent, "\n") + "\n" + strings.Join(toAdd, "\n") + "\n"
	}

	// Only write if something changed
	if currentContent == existing {
		return nil
	}

	return writeHosts(currentContent)
}

// writeHosts writes content to /etc/hosts via osascript + sudo, which triggers
// the native macOS Touch ID / password dialog.
func writeHosts(content string) error {
	// Escape single quotes in content for the shell script
	escaped := strings.ReplaceAll(content, "'", "'\\''")
	script := fmt.Sprintf(
		`do shell script "printf '%%s' '%s' | sudo tee /etc/hosts > /dev/null" with administrator privileges`,
		escaped,
	)
	out, err := exec.Command("osascript", "-e", script).CombinedOutput()
	if err != nil {
		return fmt.Errorf("update /etc/hosts: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// removeHostsForDeletedProfile removes all lines tagged # astra:<profileID> from
// /etc/hosts for a profile that is being deleted.
func removeHostsForDeletedProfile(profileID string) error {
	b, err := os.ReadFile(hostsFile)
	if err != nil {
		return fmt.Errorf("read /etc/hosts: %w", err)
	}

	lines := strings.Split(string(b), "\n")
	filtered := make([]string, 0, len(lines))
	for _, line := range lines {
		if isAstraLine(line, profileID) {
			continue // drop it
		}
		filtered = append(filtered, line)
	}

	newContent := strings.Join(filtered, "\n")
	if newContent == string(b) {
		return nil // nothing changed, skip the sudo prompt
	}
	return writeHosts(newContent)
}
