//go:build !darwin

package main

// InitNotifications is a no-op on non-macOS platforms.
func InitNotifications() {}

// notify is a no-op on non-macOS platforms.
func notify(title, subtitle, message string) {}
