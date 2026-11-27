package main

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"sort"
	"strings"
	"sync"
)

const hostsFile = "/etc/hosts"
const hostsTag = "# astra:"
const loopbackPlistPath = "/Library/LaunchDaemons/com.astra.loopback.plist"

var hostsMu sync.Mutex

// isAstraLine returns true if the line was written by Astra.
func isAstraLine(line, profileID string) bool {
	return strings.Contains(line, hostsTag+profileID)
}

// assignBindIPs assigns a local loopback IP (127.0.0.1, 127.0.0.2, ...) to each
// forward so multiple forwards sharing the same local port (e.g. Kafka brokers
// on 9093) bind distinct loopback addresses without colliding.
func assignBindIPs(forwards []PortForward) []string {
	ips := make([]string, len(forwards))
	usedAddr := map[string]bool{} // "ip:port"
	hostIP := map[string]string{} // remoteHost -> ip
	for i, fwd := range forwards {
		host := strings.TrimSpace(fwd.RemoteHost)
		if host != "" {
			if ip, ok := hostIP[host]; ok {
				key := fmt.Sprintf("%s:%d", ip, fwd.LocalPort)
				if !usedAddr[key] {
					ips[i] = ip
					usedAddr[key] = true
					continue
				}
			}
		}
		for octet := 1; octet <= 254; octet++ {
			ip := fmt.Sprintf("127.0.0.%d", octet)
			key := fmt.Sprintf("%s:%d", ip, fwd.LocalPort)
			if !usedAddr[key] {
				ips[i] = ip
				usedAddr[key] = true
				if host != "" && hostIP[host] == "" {
					hostIP[host] = ip
				}
				break
			}
		}
	}
	return ips
}

// missingLoopbackAliases returns loopback IPs (other than 127.0.0.1) that are
// not currently configured on a local network interface.
func missingLoopbackAliases(ips []string) []string {
	configured := map[string]bool{"127.0.0.1": true}
	if addrs, err := net.InterfaceAddrs(); err == nil {
		for _, addr := range addrs {
			if ipNet, ok := addr.(*net.IPNet); ok {
				configured[ipNet.IP.String()] = true
			}
		}
	}
	var missing []string
	seen := map[string]bool{}
	for _, ip := range ips {
		if ip == "" || configured[ip] || seen[ip] {
			continue
		}
		seen[ip] = true
		missing = append(missing, ip)
	}
	return missing
}

// computeHostsUpdate updates existing /etc/hosts content for profile p while
// preserving existing matching entries in place so unchanged profiles produce
// identical content and never trigger unnecessary admin prompts.
func computeHostsUpdate(existing string, p Profile, allProfiles []Profile) (string, []string) {
	ips := assignBindIPs(p.Forwards)

	// Desired remoteHost -> bindIP for this profile
	desiredByHost := map[string]string{}
	for i, fwd := range p.Forwards {
		host := strings.TrimSpace(fwd.RemoteHost)
		if host != "" {
			if _, exists := desiredByHost[host]; !exists {
				desiredByHost[host] = ips[i]
			}
		}
	}

	// Build set of hosts still needed by other profiles (for removal logic)
	stillNeeded := map[string]bool{}
	for _, op := range allProfiles {
		if op.ID == p.ID {
			continue
		}
		for _, fwd := range op.Forwards {
			if host := strings.TrimSpace(fwd.RemoteHost); host != "" {
				stillNeeded[host] = true
			}
		}
	}

	lines := strings.Split(existing, "\n")
	filtered := make([]string, 0, len(lines))
	satisfied := map[string]bool{}

	for _, line := range lines {
		if isAstraLine(line, p.ID) {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				ip, host := fields[0], fields[1]
				if desiredIP, wanted := desiredByHost[host]; wanted {
					if ip == desiredIP && !satisfied[host] {
						// Exact matching entry already exists — keep in place
						satisfied[host] = true
						filtered = append(filtered, line)
					}
					// Otherwise drop stale IP or duplicate; re-added below if needed
					continue
				}
				if stillNeeded[host] {
					// Another profile still needs this host — keep the line
					filtered = append(filtered, line)
				}
			}
			// Drop stale entry for this profile
			continue
		}

		filtered = append(filtered, line)

		// Record any desired hosts already mapped by another entry (non-comment)
		bare := line
		if idx := strings.IndexByte(bare, '#'); idx >= 0 {
			bare = bare[:idx]
		}
		fields := strings.Fields(bare)
		if len(fields) >= 2 {
			for _, h := range fields[1:] {
				if _, wanted := desiredByHost[h]; wanted {
					satisfied[h] = true
				}
			}
		}
	}

	var toAdd []string
	for i, fwd := range p.Forwards {
		host := strings.TrimSpace(fwd.RemoteHost)
		if host == "" || satisfied[host] {
			continue
		}
		satisfied[host] = true
		toAdd = append(toAdd, fmt.Sprintf("%s\t%s\t%s%s", ips[i], host, hostsTag, p.ID))
	}

	currentContent := strings.Join(filtered, "\n")
	if len(toAdd) > 0 {
		currentContent = strings.TrimRight(currentContent, "\n") + "\n" + strings.Join(toAdd, "\n") + "\n"
	}
	return currentContent, ips
}

// collectLoopbackAliases returns all unique loopback IPs (other than 127.0.0.1)
// required across the given profiles, sorted for deterministic output.
func collectLoopbackAliases(profiles []Profile) []string {
	seen := map[string]bool{}
	var aliases []string
	for _, p := range profiles {
		for _, ip := range assignBindIPs(p.Forwards) {
			if ip == "" || ip == "127.0.0.1" || seen[ip] {
				continue
			}
			seen[ip] = true
			aliases = append(aliases, ip)
		}
	}
	sort.Strings(aliases)
	return aliases
}

// loopbackLaunchDaemonPlist returns the macOS LaunchDaemon plist content that
// restores Astra's loopback aliases on lo0 at every system boot so Astra never
// has to prompt for an administrator password after a reboot.
func loopbackLaunchDaemonPlist(aliases []string) string {
	cmds := make([]string, 0, len(aliases))
	for _, ip := range aliases {
		cmds = append(cmds, fmt.Sprintf("/sbin/ifconfig lo0 alias %s up", ip))
	}
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.astra.loopback</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/sh</string>
		<string>-c</string>
		<string>%s</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
</dict>
</plist>
`, strings.Join(cmds, "; "))
}

// profileNeedsHostOrAliasSync returns true if profile p currently requires
// changes to /etc/hosts or missing lo0 loopback aliases.
func profileNeedsHostOrAliasSync(p Profile, allProfiles []Profile) bool {
	b, err := os.ReadFile(hostsFile)
	if err != nil {
		return true
	}
	existing := string(b)
	updated, ips := computeHostsUpdate(existing, p, allProfiles)
	if updated != existing {
		return true
	}
	return len(missingLoopbackAliases(ips)) > 0
}

// syncHostsForProfile ensures <bindIP> <remoteHost> entries exist for every
// forward in the profile and that any required loopback aliases (127.0.0.2+)
// are configured on lo0 — all in ONE admin prompt when changes are needed.
func syncHostsForProfile(p Profile, allProfiles []Profile) error {
	return syncHostsForProfiles([]Profile{p}, allProfiles)
}

// syncHostsForProfiles syncs /etc/hosts and loopback aliases for multiple
// profiles in a single serialized pass (at most one admin prompt).
func syncHostsForProfiles(profiles []Profile, allProfiles []Profile) error {
	if len(profiles) == 0 {
		return nil
	}
	hostsMu.Lock()
	defer hostsMu.Unlock()

	b, err := os.ReadFile(hostsFile)
	if err != nil {
		return fmt.Errorf("read /etc/hosts: %w", err)
	}
	existing := string(b)
	current := existing
	var allIPs []string
	for _, p := range profiles {
		var ips []string
		current, ips = computeHostsUpdate(current, p, allProfiles)
		allIPs = append(allIPs, ips...)
	}

	missingAliases := missingLoopbackAliases(allIPs)
	hostsChanged := current != existing
	if !hostsChanged && len(missingAliases) == 0 {
		return nil
	}

	if !hostsChanged {
		current = ""
	}
	persistAliases := collectLoopbackAliases(allProfiles)
	return writeHostsAndAliases(current, missingAliases, persistAliases)
}

// writeHosts writes content to /etc/hosts via osascript + sudo, which triggers
// the native macOS Touch ID / password dialog.
func writeHosts(content string) error {
	return writeHostsAndAliases(content, nil, nil)
}

// buildAdminShellCommands builds the root shell commands to update /etc/hosts,
// configure missing lo0 loopback aliases, and persist loopback aliases across
// macOS reboots via a LaunchDaemon.
func buildAdminShellCommands(content string, aliases []string, persistAliases []string, goos string) []string {
	var cmds []string
	if content != "" {
		escaped := strings.ReplaceAll(content, "'", "'\\''")
		cmds = append(cmds, fmt.Sprintf("printf '%%s' '%s' | tee /etc/hosts > /dev/null", escaped))
	}
	for _, ip := range aliases {
		cmds = append(cmds, fmt.Sprintf("/sbin/ifconfig lo0 alias %s up", ip))
	}
	if len(persistAliases) > 0 && goos == "darwin" {
		plist := loopbackLaunchDaemonPlist(persistAliases)
		escapedPlist := strings.ReplaceAll(plist, "'", "'\\''")
		cmds = append(cmds,
			fmt.Sprintf("printf '%%s' '%s' > %s", escapedPlist, loopbackPlistPath),
			fmt.Sprintf("chown root:wheel %s", loopbackPlistPath),
			fmt.Sprintf("chmod 644 %s", loopbackPlistPath),
		)
	}
	return cmds
}

// writeHostsAndAliases updates /etc/hosts (when content != ""), configures any
// missing lo0 loopback aliases, and installs/updates the macOS LaunchDaemon so
// loopback aliases survive reboots — all in a single macOS administrator prompt.
func writeHostsAndAliases(content string, aliases []string, persistAliases []string) error {
	cmds := buildAdminShellCommands(content, aliases, persistAliases, runtime.GOOS)
	if len(cmds) == 0 {
		return nil
	}
	// Escape backslashes and double quotes for AppleScript string literal
	appleScriptEscaper := strings.NewReplacer(`\`, `\\`, `"`, `\"`)
	shellCmd := appleScriptEscaper.Replace(strings.Join(cmds, " && "))
	script := fmt.Sprintf(`do shell script "%s" with administrator privileges`, shellCmd)
	out, err := exec.Command("osascript", "-e", script).CombinedOutput()
	if err != nil {
		return fmt.Errorf("update hosts/loopback: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// removeHostsForDeletedProfile removes all lines tagged # astra:<profileID> from
// /etc/hosts for a profile that is being deleted.
func removeHostsForDeletedProfile(profileID string) error {
	hostsMu.Lock()
	defer hostsMu.Unlock()

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
