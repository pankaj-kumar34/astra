# Astra

A macOS desktop app for managing SSH tunnels into IBM Cloud VPC. Create profiles, connect with one click, and access private VPC services (Postgres, Redis, Elasticsearch, etc.) as if they were local.

## Features

- **Profile-based** — save bastion host details and port-forward rules per environment
- **One-click connect/disconnect** — spawns `ssh -N -L` in the background, no terminal needed
- **Auto-reconnect** — if the tunnel drops unexpectedly, retries 3× with 5s → 15s → 30s backoff
- **Health checks** — TCP-dials each forwarded port every 30s to confirm it's alive
- **Live logs** — SSH stderr streamed in real-time, last 500 lines kept
- **Port freeing** — kills whatever process holds your local port before connecting
- **Service presets** — Postgres, Redis, Valkey, Elasticsearch, Event Streams, or custom

## Usage

1. Click **New Profile** and fill in your bastion host details (host, port, user, SSH key path)
2. Add one or more port forwards — pick a service preset or enter custom host:port
3. Hit **Connect** — Astra starts the SSH tunnel and shows live status
4. Your local ports are now forwarded through the bastion into VPC

Astra lives in your dock. Closing the window hides it; it keeps running until you quit from the dock menu.

## Building

Requires Go 1.26+, Node.js, and [Wails v3](https://v3.wails.io/).

```bash
# Dev mode (hot-reload)
wails3 task darwin:run

# Production build (.app)
wails3 task darwin:package

# Universal DMG (arm64 + amd64, shareable)
wails3 task darwin:package:universal && wails3 task darwin:create:dmg
```

Output lands in `bin/`.

## Project Structure

```
astra/
├── main.go           # App bootstrap, window config, quit handler
├── astraservice.go   # Wails service: profile CRUD + tunnel connect/disconnect
├── tunnel.go         # TunnelManager: SSH process lifecycle, health pinger, auto-reconnect
├── types.go          # Profile, PortForward, TunnelState, LogEntry
├── storage.go        # JSON persistence → ~/Library/Application Support/Astra/data.json
└── frontend/
    └── src/
        ├── App.tsx           # Two-panel layout (dark sidebar + light content)
        ├── useAstra.ts       # React hook wiring all backend calls + tunnel:state events
        ├── components/
        │   ├── ProfileList.tsx    # Sidebar with profiles + status dots
        │   ├── ProfileDetail.tsx  # Detail view: connect button, port forward list, logs
        │   └── ProfileForm.tsx    # Create/edit profile form
        └── types.ts          # TypeScript types mirroring Go models
```

## Data

Profiles are stored at `~/Library/Application Support/Astra/data.json`. Tunnels are runtime-only — they are not auto-started on launch.
