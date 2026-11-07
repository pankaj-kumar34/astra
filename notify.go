package main

import (
	"fmt"
	"os/exec"
)

// notify sends a native macOS notification via osascript.
// subtitle is optional — pass "" to omit it.
func notify(title, subtitle, message string) {
	script := fmt.Sprintf(`display notification %q with title %q`, message, title)
	if subtitle != "" {
		script += fmt.Sprintf(` subtitle %q`, subtitle)
	}
	_ = exec.Command("osascript", "-e", script).Run()
}
