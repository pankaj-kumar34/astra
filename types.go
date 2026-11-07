package main

import "time"

// ServiceType represents a known service preset
type ServiceType string

const (
	ServicePostgres      ServiceType = "postgres"
	ServiceRedis         ServiceType = "redis"
	ServiceValkey        ServiceType = "valkey"
	ServiceElasticsearch ServiceType = "elasticsearch"
	ServiceEventStreams  ServiceType = "eventstreams"
	ServiceCustom        ServiceType = "custom"
)

// PortForward defines a single local→remote port mapping
type PortForward struct {
	ID         string      `json:"id"`
	Label      string      `json:"label"`
	Service    ServiceType `json:"service"`
	LocalPort  int         `json:"localPort"`
	RemoteHost string      `json:"remoteHost"`
	RemotePort int         `json:"remotePort"`
}

// Profile holds all connection details for a VPC tunnel
type Profile struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Host        string        `json:"host"`
	Port        int           `json:"port"`
	User        string        `json:"user"`
	KeyPath     string        `json:"keyPath"`
	Description string        `json:"description"`
	Forwards    []PortForward `json:"forwards"`
	CreatedAt   string        `json:"createdAt,omitempty"`
	UpdatedAt   string        `json:"updatedAt,omitempty"`
}

// TunnelStatus represents the state of an active tunnel
type TunnelStatus string

const (
	StatusIdle       TunnelStatus = "idle"
	StatusConnecting TunnelStatus = "connecting"
	StatusConnected  TunnelStatus = "connected"
	StatusError      TunnelStatus = "error"
)

// TunnelState holds runtime state for a tunnel
type TunnelState struct {
	ProfileID   string            `json:"profileId"`
	Status      TunnelStatus      `json:"status"`
	PID         int               `json:"pid"`
	StartedAt   *time.Time        `json:"startedAt"`
	Error       string            `json:"error"`
	Logs        []LogEntry        `json:"logs"`
	PortHealth  map[string]bool   `json:"portHealth"` // localPort string → reachable
}

// LogEntry is a single log line from the SSH process
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Line      string    `json:"line"`
	Level     string    `json:"level"` // "info" | "warn" | "error"
}

// AppData is the persisted application data
type AppData struct {
	Profiles []Profile `json:"profiles"`
}
