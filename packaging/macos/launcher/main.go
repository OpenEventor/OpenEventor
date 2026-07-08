// Double-click launcher — the main executable of OpenEventor.app.
//
// A GUI-less Go server can't show a Terminal window when double-clicked in
// Finder, so this tiny launcher (which IS the app's CFBundleExecutable) hands
// the bundled run.command to `open`; LaunchServices runs it in a visible
// Terminal window. Kept minimal and pure-Go so it code-signs / notarizes cleanly
// as the app's main Mach-O. No AppleEvents, so no "wants to control Terminal"
// consent prompt.
package main

import (
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	exe, err := os.Executable()
	if err != nil {
		os.Exit(1)
	}
	// exe = <App>.app/Contents/MacOS/OpenEventor  →  Resources/run.command
	cmd := filepath.Join(filepath.Dir(exe), "..", "Resources", "run.command")
	if err := exec.Command("open", cmd).Run(); err != nil {
		os.Exit(1)
	}
}
