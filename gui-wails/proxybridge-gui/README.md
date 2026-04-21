# ProxyBridge GUI

A modern network proxy management desktop application built with **Go**, **Wails v2**, and **React + TypeScript**.

This repository is designed as a **learning resource** for Go desktop development — every non-trivial pattern used here is documented in [DESIGN.md](./DESIGN.md).

---

## Architecture Overview

```
proxybridge-gui/
├── main.go              ← Entry point. Wails app bootstrap.
├── app.go              ← App struct + all Wails bindings (frontend API)
├── proxybridge/
│   ├── proxybridge.go   ← Core domain logic (pure Go, no Wails)
│   ├── cgo_bindings.go ← (Optional) CGO bindings to native .so
│   └── proxybridge_test.go ← Unit tests (14 passing)
├── frontend/
│   └── src/
│       ├── App.tsx      ← Root component + state management
│       ├── pages/
│       │   ├── Dashboard.tsx   ← Stats, donut chart, proxy status
│       │   ├── Connections.tsx ← Live connection table + quick-add
│       │   ├── Rules.tsx       ← Rule editor (slide-in panel)
│       │   └── Settings.tsx
│       └── components/
│           └── layout/   ← Sidebar, Header
├── Makefile             ← Build, test, docs shortcuts
└── DESIGN.md            ← Deep-dive Go patterns explained
```

---

## Quick Start

```bash
# 1. Install dependencies (Go 1.23+, Node 18+, Wails CLI)
go install github.com/wailsapp/wails/v2/cmd/wails@latest
npm install

# 2. Run in dev mode (hot reload)
make dev

# 3. Build release binary
make

# 4. Run tests
make test-verbose
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Animated stat counters, donut chart, proxy status card |
| **Live Connections** | Real-time connection table with sparkline traffic indicator |
| **Quick-Add Rules** | Hover row → click + Proxy / + Direct / + Block |
| **Context Menu** | Right-click any connection → add detailed rule |
| **Rule Editor** | Slide-in form panel with full field editing |
| **Export / Import** | JSON rule file support |

---

## Go Patterns Used (Learning Points)

Each significant pattern is explained in detail in [DESIGN.md](./DESIGN.md):

| Pattern | File | What It Teaches |
|---------|------|----------------|
| **Package-level singleton** | `proxybridge/proxybridge.go` | Global state via `var defaultBridge *Bridge` |
| **Thread-safe counters** | `proxybridge/proxybridge.go` | `sync.RWMutex` for concurrent reads/writes |
| **Callback slot pattern** | `proxybridge/proxybridge.go` | `type LogCallback func(string)` — interface vs closures |
| **Goroutine + channel** | `proxybridge/proxybridge.go` | `trafficSimulator()` — concurrent producer |
| **Stop channel** | `proxybridge/proxybridge.go` | `stopCh chan struct{}` — clean goroutine shutdown |
| **Method set** | `proxybridge/proxybridge.go` | Value receiver vs pointer receiver |
| **Stringer interface** | `proxybridge/proxybridge.go` | `func (p ProxyType) String() string` — Go Stringer |
| **Wails bindings** | `app.go` | Exposing Go methods to JavaScript |
| **JSON over channels** | `app.go` | `runtime.EventsEmit` + `json.Marshal` |
| **CGO (stubbed)** | `proxybridge/cgo_bindings.go` | Calling C libraries from Go |
| **Table-driven tests** | `proxybridge/proxybridge_test.go` | Idiomatic Go testing |
| **Isolation in tests** | `proxybridge/proxybridge_test.go` | `resetBridge()` pattern for unit testing |

---

## Project Layout

```
proxybridge-gui/
├── main.go              # Wails app entry point (embed.FS, wails.Run)
├── app.go               # App struct with all @wailsjs bindings
├── proxybridge/         # Pure-Go domain logic package
│   ├── proxybridge.go   # All business logic
│   └── *_test.go       # Unit tests
├── frontend/            # React + TypeScript + Vite
├── build/               # Wails output
├── Makefile             # Dev commands
└── DESIGN.md            # Pattern documentation
```

See [DESIGN.md](./DESIGN.md) for the detailed Go learning content.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Go 1.23 |
| Desktop | Wails v2 (Chromium via webview) |
| Frontend | React 18 + TypeScript |
| Build | Vite 3 |
| Styling | Vanilla CSS with custom properties |
| Testing | `go test` + stdlib `testing` |

## License

MIT — see root `LICENSE` file.
