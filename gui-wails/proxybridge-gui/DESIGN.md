# ProxyBridge GUI — Go Patterns & Design

This document explains every non-trivial Go pattern used in this codebase, written as a **Go learning guide** you can read alongside the code.

---

## Table of Contents

1. [Package Layout](#1-package-layout)
2. [Entry Point & Wails Bootstrap](#2-entry-point--wails-bootstrap)
3. [Package-Level Singleton (Global State)](#3-package-level-singleton-global-state)
4. [Thread-Safe State with RWMutex](#4-thread-safe-state-with-rwmutex)
5. [Callback Slot Pattern (Interface Types)](#5-callback-slot-pattern-interface-types)
6. [Goroutine + Stop Channel (Concurrent Producer)](#6-goroutine--stop-channel-concurrent-producer)
7. [Value Receiver vs Pointer Receiver](#7-value-receiver-vs-pointer-receiver)
8. [The Stringer Interface](#8-the-stringer-interface)
9. [Wails Bindings: Exposing Go to JavaScript](#9-wails-bindings-exposing-go-to-javascript)
10. [JSON over Event Channels](#10-json-over-event-channels)
11. [CGO: Calling C from Go](#11-cgo-calling-c-from-go)
12. [Unit Testing Patterns](#12-unit-testing-patterns)
13. [Fixing a Deadlock: Real-World Debug Story](#13-fixing-a-deadlock-real-world-debug-story)

---

## 1. Package Layout

```
proxybridge-gui/
├── main.go              ← package main. Wails entry point. Embeds frontend assets.
├── app.go               ← package main. Wails App struct. All @wailsjs bindings live here.
└── proxybridge/         ← Separate package. Pure Go, no Wails dependency.
    ├── proxybridge.go   ← Domain logic (types, Bridge, exported API)
    └── *_test.go       ← Unit tests
```

**Why separate packages?**

- `proxybridge/` is a **pure Go domain package** with zero Wails imports
- `app.go` is the **Wails presentation layer** that calls proxybridge
- This separation lets you test all domain logic **without running Wails**
- You can reuse `proxybridge/` in a CLI tool or headless service

**Go package naming convention:**
- Package name matches directory name (`proxybridge`, not `pb` or `core`)
- `package main` for executables, named packages for libraries
- Avoid generic names like `util` or `common`

---

## 2. Entry Point & Wails Bootstrap

```go
// main.go
package main

import (
    "embed"
    "github.com/wailsapp/wails/v2"
    "github.com/wailsapp/wails/v2/pkg/options"
    "github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS   // ← Compile-time embedding of the frontend build output

func main() {
    app := NewApp()
    wails.Run(&options.App{
        Title:  "ProxyBridge",
        Width:  1180,
        Height: 720,
        AssetServer: &assetserver.Options{Assets: assets},
        OnStartup: app.startup,
        Bind: []interface{}{app},   // ← Expose app's methods to JS
    })
}
```

**Key concepts:**

### `//go:embed`

```go
//go:embed all:frontend/dist   ← "Embed everything in this directory at compile time"
var assets embed.FS           ← FS is a read-only filesystem interface
```

`embed.FS` satisfies `io/fs.FS`, which Wails uses to serve your React build.

### `wails.Run` Options

```go
&options.App{
    OnStartup: app.startup,   // Called after the window opens
    Bind: []interface{}{app}, // Every exported method on App becomes a JS function
}
```

### `embed.FS` trick: `all:` prefix

```go
// Without all: — embeds the directory itself (need path prefix)
//go:embed frontend/dist
var assets embed.FS
asset, _ := assets.Open("frontend/dist/index.html") // must include "frontend/dist/"

// With all: — embeds contents recursively, no prefix needed
//go:embed all:frontend/dist
var assets embed.FS
asset, _ := assets.Open("index.html") // clean path
```

---

## 3. Package-Level Singleton (Global State)

```go
// proxybridge/proxybridge.go
package proxybridge

// Bridge holds all application state.
type Bridge struct {
    mu       sync.RWMutex
    running  bool
    config   ProxyConfig
    rules    map[uint32]ProxyRule
    nextRuleID uint32
    logCallback       LogCallback
    connectionCallback ConnectionCallback
    stopCh chan struct{}
    totalConn, proxyConn, directConn, blockConn uint64
    startTime time.Time
}

// defaultBridge is the package-level singleton.
// All exported functions operate on this instance.
var defaultBridge = &Bridge{
    rules: make(map[uint32]ProxyRule),
}
```

**Why a package-level variable instead of passing `*Bridge` everywhere?**

```go
// ❌ Without singleton: every function needs the bridge passed in
func AddRule(bridge *Bridge, ...) { ... }
func DeleteRule(bridge *Bridge, ...) { ... }
func EditRule(bridge *Bridge, ...) { ... }

// ✅ With singleton: clean API surface
func AddRule(...) { defaultBridge.mu.Lock(); ... }
func DeleteRule(...) { defaultBridge.mu.Lock(); ... }
```

**Trade-off:** Singleton makes the API simple but harder to test. We solve this in tests with `resetBridge()`:

```go
// In tests only — swap the global with an isolated instance
func resetBridge() (restore func()) {
    orig := defaultBridge
    defaultBridge = &Bridge{rules: make(map[uint32]ProxyRule)}
    return func() { defaultBridge = orig }
}
```

---

## 4. Thread-Safe State with RWMutex

```go
type Bridge struct {
    mu sync.RWMutex   // ← Multiple readers OR one writer, never both
    rules map[uint32]ProxyRule
    running bool
    // ...
}
```

**Read-heavy workloads use RWMutex (not plain Mutex):**

```go
// Many goroutines can read simultaneously — no contention
func GetRules() []ProxyRule {
    defaultBridge.mu.RLock()        // ← Read lock: blocks writers, not readers
    defer defaultBridge.mu.RUnlock()
    rules := make([]ProxyRule, 0, len(defaultBridge.rules))
    for _, r := range defaultBridge.rules {
        rules = append(rules, r)
    }
    return rules
}

// Writers get exclusive access
func AddRule(...) {
    defaultBridge.mu.Lock()        // ← Write lock: blocks ALL readers and writers
    defer defaultBridge.mu.Unlock()
    // ... modify state
}
```

**RWMutex rules:**
- `RLock()` — multiple readers OK; any writer waiting is blocked until all readers release
- `Lock()` — exclusive; all readers and writers are blocked until lock is released
- Never hold a write lock while calling a function that tries to read-lock (→ deadlock)

---

## 5. Callback Slot Pattern (Interface Types)

```go
// Define the callback as a function type
type LogCallback func(msg string)
type ConnectionCallback func(info ConnectionInfo)

// Bridge holds the callback slots
type Bridge struct {
    logCallback       LogCallback
    connectionCallback ConnectionCallback
    // ...
}

// Register a callback — Go closures capture surrounding variables
func SetLogCallback(cb LogCallback) {
    defaultBridge.mu.Lock()
    defaultBridge.logCallback = cb   // ← Stores the function reference
    defaultBridge.mu.Unlock()
}

// Invoke the callback — nil check avoids panic
func (b *Bridge) log(format string, args ...interface{}) {
    text := fmt.Sprintf(format, args...)
    b.mu.RLock()
    cb := b.logCallback   // ← Copy to local var to avoid holding lock during callback
    b.mu.RUnlock()
    if cb != nil {
        cb(text)   // ← Invoke the stored function
    }
}
```

**Why copy the callback to a local variable?**

```go
// ❌ Dangerous: holding a lock while calling user code
b.mu.RLock()
b.logCallback("message")   // ← If callback tries to lock b.mu, DEADLOCK
b.mu.RUnlock()

// ✅ Safe: copy ref, unlock, then call
b.mu.RLock()
cb := b.logCallback
b.mu.RUnlock()
if cb != nil {
    cb("message")   // ← No lock held; user code can safely use the Bridge
}
```

**Interface type with nil safety:**

```go
type LogCallback func(msg string)   // ← This IS an interface type in Go's type system
                                      // nil callback is valid — calling it does nothing
```

---

## 6. Goroutine + Stop Channel (Concurrent Producer)

```go
func Start() bool {
    defaultBridge.mu.Lock()
    if defaultBridge.running { defaultBridge.mu.Unlock(); return true }
    defaultBridge.running = true
    defaultBridge.stopCh = make(chan struct{})   // ← Unbuffered channel
    defaultBridge.startTime = time.Now()
    defaultBridge.mu.Unlock()

    go defaultBridge.trafficSimulator()   // ← Fire and forget
    return true
}

func Stop() bool {
    defaultBridge.mu.Lock()
    if !defaultBridge.running { defaultBridge.mu.Unlock(); return true }
    defaultBridge.running = false
    close(defaultBridge.stopCh)    // ← Signal all receivers
    defaultBridge.mu.Unlock()
    return true
}
```

**The simulator (producer goroutine):**

```go
func (b *Bridge) trafficSimulator() {
    ticker := time.NewTicker(800 * time.Millisecond)
    defer ticker.Stop()

    for {
        select {
        case <-b.stopCh:      // ← Receives from closed channel → unblocks immediately
            return             //    (closed channel never blocks, always returns zero value)
        case <-ticker.C:      // ← Block until next tick
            // produce a connection event
            b.mu.RLock()
            cb := b.connectionCallback
            b.mu.RUnlock()
            if cb != nil { cb(info) }
        }
    }
}
```

**Why `chan struct{}` for the stop channel?**

```go
// struct{} takes 0 bytes — no memory overhead
stopCh chan struct{}

// vs
stopCh chan bool   // bool takes 1 byte (unnecessary)
stopCh chan int    // int takes 8 bytes (wasteful)
```

**Why `close()` not `stopCh <- true`?**

```go
// close() is the canonical Go pattern for "broadcast to N receivers"
// All goroutines waiting on <-stopCh unblock simultaneously

close(stopCh)  // ✅ All simulators stop

// signal <- true   // Only one receiver gets the message, others hang forever
```

**The select statement:**

```go
select {
case <-ch1:     // Block until ch1 has a value
case ch2 <- x:  // Block until ch2 is ready to receive
case <-timer.C: // Block until timer fires
default:        // Run if no channel is ready (non-blocking)
}
```

---

## 7. Value Receiver vs Pointer Receiver

```go
// Value receiver — operates on a COPY of the struct
func (p ProxyType) String() string { ... }

// Pointer receiver — operates on the ACTUAL struct
func (b *Bridge) log(format string, args ...interface{}) { ... }
```

**When to use which?**

| Situation | Use |
|-----------|-----|
| Method needs to mutate the struct | Pointer receiver `(*T)` |
| Method needs to see caller's mutations | Pointer receiver |
| Method doesn't need mutation | Value receiver `*or*` pointer (both work) |
| Struct is large (copying expensive) | Pointer receiver |
| Struct has sync.Mutex or other sync primitive | **Always pointer receiver** |

```go
// Example: mutex MUST be pointer receiver
type Bridge struct {
    mu sync.RWMutex   // If you call b.mu.Lock() on a COPY, you lock nothing
}

func (b *Bridge) DoSomething() {   // Compiler auto-converts &Bridge to *Bridge
    b.mu.Lock()                     // This is actually (*b).mu.Lock()
    defer b.mu.Unlock()
}
```

**Compiler "convenience" in Go:**

```go
// These are IDENTICAL — Go auto-converts & value to pointer for receiver methods
func (b *Bridge) Lock() { ... }
(&myBridge).Lock()  // OK
myBridge.Lock()     // Also OK — auto-converted to &myBridge
```

---

## 8. The Stringer Interface

```go
// Go's fmt package looks for this method when printing with %s
type Stringer interface {
    String() string
}

func (p ProxyType) String() string {
    switch p {
    case ProxyTypeSOCKS5: return "SOCKS5"
    default:             return "HTTP"
    }
}
```

**Usage:**

```go
pt := ProxyTypeHTTP
fmt.Printf("Proxy type: %s", pt)   // → "Proxy type: HTTP"
                                 // fmt calls pt.String() automatically
```

**Without Stringer:**

```go
// Without String() — you'd need a manual switch everywhere
func ProxyTypeName(p ProxyType) string {
    switch p {
    case ProxyTypeSOCKS5: return "SOCKS5"
    default: return "HTTP"
    }
}
fmt.Printf("Proxy type: %s", ProxyTypeName(pt))
```

---

## 9. Wails Bindings: Exposing Go to JavaScript

```go
// app.go
type App struct {
    ctx context.Context   // Wails injects this at startup
}

// Every exported method becomes a JavaScript function automatically.
// Wails scans the Bind slice and generates JS wrappers at build time.

// WAILS:  app.Start()   →   window.go.start()
// WAILS:  app.Stop()    →   window.go.stop()
// WAILS:  app.AddRule() →   window.go.addRule(...)
func (a *App) Start() bool {
    return proxybridge.Start()
}
```

**In JavaScript (generated by Wails):**

```javascript
// frontend/src/go/App.ts (auto-generated)
import { proxybridge } from '../wailsjs/go/main/App';

async function startProxy() {
  const result = await proxybridge.Start();  // Calls Go's app.Start()
  console.log('Started:', result);
}
```

**Why `runtime.EventsEmit` instead of return values?**

```go
// Go → JS return value: one-shot call/response
func (a *App) Stop() bool { return proxybridge.Stop() }

// Go → JS push (live data): event stream
func (a *App) startup(ctx context.Context) {
    proxybridge.SetConnectionCallback(func(info proxybridge.ConnectionInfo) {
        payload, _ := json.Marshal(...)
        runtime.EventsEmit(a.ctx, "connection", string(payload))  // → JS event
    })
}
```

---

## 10. JSON over Event Channels

```go
// app.go — Go side
func (a *App) startup(ctx context.Context) {
    proxybridge.SetConnectionCallback(func(info proxybridge.ConnectionInfo) {
        payload, _ := json.Marshal(map[string]interface{}{
            "id":          info.Timestamp.UnixNano(),
            "timestamp":   info.Timestamp.Format("15:04:05"),
            "processName": info.ProcessName,
            "destIp":      info.DestIP,
            "destPort":    info.DestPort,
            "action":      actionToString(info.Action),
        })
        // Push to JS via Wails event bus
        runtime.EventsEmit(a.ctx, "connection", string(payload))
    })
}
```

```typescript
// Connections.tsx — JS side
useEffect(() => {
  // Subscribe to "connection" event
  const id = window.runtime.EventsOn('connection', (payload: string) => {
    const data = JSON.parse(payload) as ConnectionLog;
    setConnections(prev => [...prev, data]);
  });
  return () => window.runtime.EventsOff(id);   // Unsubscribe on unmount
}, []);
```

**Why JSON string (not raw object)?**

Wails' `EventsEmit` accepts `any` but internally serializes to JSON for cross-process transport. Sending the JSON string explicitly gives us control over the format.

---

## 11. CGO: Calling C from Go

```go
// cgo_bindings.go
package proxybridge

/*
#cgo CFLAGS: -I/home/amadeus/dev/ProxyBridge/Linux/src
#cgo LDFLAGS: -L... -lproxybridge

#include "ProxyBridge.h"
#include <stdint.h>

// CGO NOTE: Go-exported functions passed as C callbacks must be registered
// with cgo using "//export" in a comment above their function signature.
// The C side then calls them as regular C function pointers.
*/
import "C"
```

**The callback registration challenge:**

```go
// ❌ BROKEN: Go closures can't be passed to C as function pointers
cb := func(msg string) { ... }
ProxyBridge_SetLogCallback((void*)(unsafe.Pointer(cb)))  // NO — not a C function pointer

// ✅ WORKS: Dedicated exported function with C linkage
//export goLogCallback
func goLogCallback(msg *C.char) {
    // called from C code
}
```

**The `//export` comment** tells cgo to generate C linkage for the Go function, making it a valid C function pointer.

---

## 12. Unit Testing Patterns

### Table-driven tests (idiomatic Go)

```go
func TestUptimeFormat(t *testing.T) {
    cases := []struct {
        secs int
        want string
    }{
        {0,    "0s"},
        {30,   "30s"},
        {65,   "1m 5s"},
        {3600, "1h 0m"},
    }
    for _, c := range cases {
        got := formatUptime(time.Duration(c.secs) * time.Second)
        if got != c.want {
            t.Errorf("uptime(%d) = %q, want %q", c.secs, got, c.want)
        }
    }
}
```

### Isolating global state with resetBridge()

```go
// Problem: defaultBridge is a package-level singleton
// Fix: swap it with a clean instance for each test

func resetBridge() (restore func()) {
    orig := defaultBridge
    defaultBridge = &Bridge{rules: make(map[uint32]ProxyRule)}
    return func() { defaultBridge = orig }
}

func TestAddRule(t *testing.T) {
    restore := resetBridge()
    defer restore()

    id := AddRule("chrome.exe", "*", "443", RuleProtocolTCP, RuleActionProxy)
    if id != 0 { t.Errorf("expected first ID 0, got %d", id) }
}
```

### Testing concurrent code

```go
func TestGetRulesConcurrency(t *testing.T) {
    restore := resetBridge()
    defer restore()

    var wg sync.WaitGroup
    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for j := 0; j < 50; j++ {
                AddRule(fmt.Sprintf("proc%d_%d", i, j), "*", "443", RuleProtocolTCP, RuleActionProxy)
            }
        }()
    }
    wg.Wait()

    rules := GetRules()
    if len(rules) != 500 {
        t.Errorf("expected 500 rules, got %d", len(rules))
    }
}
```

---

## 13. Fixing a Deadlock: Real-World Debug Story

### The Symptom

```
=== RUN   TestAddRule
panic: test timed out after 30s
goroutine 7 [sync.RWMutex.RLock]:
  proxybridge.AddRule() → proxybridge.(*Bridge).log()
```

`AddRule` timed out. The goroutine was stuck trying to acquire a **read** lock (`RLock`).

### The Root Cause

```go
func AddRule(...) {
    defaultBridge.mu.Lock()           // Acquired WRITE lock
    defer defaultBridge.mu.Unlock()   // Will release on return
    // ...
    defaultBridge.log(...)            // ← Inside AddRule: tries RLock() → DEADLOCK
}
```

`AddRule` held a **write** lock, then called `log()` which tried to acquire a **read** lock on the **same RWMutex**. Go's `sync.RWMutex` is **writer-preferring** — when a writer waits, new readers are blocked. Since `AddRule` already held the write lock, `log()`'s read lock request was queued behind it → **deadlock**.

### The Fix

```go
// ❌ Before: Lock + defer Unlock + method that re-locks (DEADLOCK)
func AddRule(...) {
    defaultBridge.mu.Lock()
    defer defaultBridge.mu.Unlock()
    // ...
    defaultBridge.log(...)   // RLock inside Lock → wait forever
    return id
}

// ✅ After: Manual unlock before calling re-locking methods
func AddRule(...) {
    defaultBridge.mu.Lock()
    // ... mutate state ...
    defaultBridge.mu.Unlock()        // ← Release write lock FIRST
    defaultBridge.log(...)            // ← Then call log() which acquires RLock safely
    return id
}
```

**General rule:** If a function calls another function that may lock the same mutex, release your lock first.

### Detection

Go's race detector (`go test -race`) would have caught this immediately:

```bash
go test -race ./proxybridge/...
# WARNING: DATA RACE
# Read by goroutine:   log()
# Write by goroutine:  AddRule()
```

Always run `-race` on concurrent code.

---

## Appendix: Useful Commands

```bash
# Run tests
make test-verbose

# Build binary
make

# Dev mode (hot reload)
make dev

# Run race detector
go test -race ./proxybridge/...

# Format code
go fmt ./...

# View coverage
make test-cover

# Serve docs locally
make docs
```
