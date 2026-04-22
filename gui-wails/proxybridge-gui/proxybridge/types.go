// types.go
// Shared type definitions for all platforms (Linux + Windows + macOS).
// This file is always compiled; platform-specific logic goes in other files.

package proxybridge

import (
	"fmt"
	"sync"
	"time"
)

// ─── Types ───────────────────────────────────────────────────────────────────

type ProxyType int

const (
	ProxyTypeHTTP   ProxyType = 0
	ProxyTypeSOCKS5 ProxyType = 1
)

func (p ProxyType) String() string {
	switch p {
	case ProxyTypeSOCKS5:
		return "SOCKS5"
	default:
		return "HTTP"
	}
}

type RuleAction int

const (
	RuleActionProxy  RuleAction = 0
	RuleActionDirect RuleAction = 1
	RuleActionBlock  RuleAction = 2
)

type RuleProtocol int

const (
	RuleProtocolTCP  RuleProtocol = 0
	RuleProtocolUDP  RuleProtocol = 1
	RuleProtocolBoth RuleProtocol = 2
)

type ProxyConfig struct {
	Type     ProxyType
	Host     string
	Port     uint16
	Username string
	Password string
}

type ProxyRule struct {
	ID          uint32
	ProcessName string
	TargetHosts string
	TargetPorts string
	Protocol    RuleProtocol
	Action      RuleAction
	Enabled     bool
}

type ConnectionInfo struct {
	ProcessName string
	PID         uint32
	DestIP      string
	DestPort    uint16
	Action      RuleAction
	ProxyInfo   string
	Timestamp   time.Time
}

type LogCallback func(msg string)
type ConnectionCallback func(info ConnectionInfo)

// ─── Bridge ──────────────────────────────────────────────────────────────────

type Bridge struct {
	mu       sync.RWMutex
	running  bool
	config   ProxyConfig
	rules    map[uint32]ProxyRule
	nextRuleID uint32

	logCallback       LogCallback
	connectionCallback ConnectionCallback

	stopCh chan struct{}

	totalConn  uint64
	proxyConn  uint64
	directConn uint64
	blockConn  uint64
	startTime  time.Time
}

var defaultBridge = &Bridge{
	rules: make(map[uint32]ProxyRule),
}

// ─── Internal ───────────────────────────────────────────────────────────────

func (b *Bridge) log(format string, args ...interface{}) {
	text := fmt.Sprintf(format, args...)
	b.mu.RLock()
	cb := b.logCallback
	b.mu.RUnlock()
	if cb != nil {
		cb(text)
	}
}

func (b *Bridge) trafficSimulator() {
	processes := []string{"chrome.exe", "firefox.exe", "slack.exe", "teams.exe", "curl", "wget", "ssh"}
	hosts := []string{"api.stripe.com", "www.google.com", "github.com", "slack.com",
		"teams.microsoft.com", "cloudflare.com", "discord.com", "1.1.1.1"}
	ports := []uint16{443, 80, 8080, 22, 3000, 8443}
	actions := []RuleAction{RuleActionProxy, RuleActionProxy, RuleActionProxy, RuleActionDirect, RuleActionBlock}

	ticker := time.NewTicker(800 * time.Millisecond)
	defer ticker.Stop()

	idx := 0
	for {
		select {
		case <-b.stopCh:
			return
		case <-ticker.C:
			b.mu.Lock()
			running := b.running
			config := b.config
			b.mu.Unlock()
			if !running {
				return
			}

			idx++
			proc := processes[idx%len(processes)]
			host := hosts[idx%len(hosts)]
			port := ports[idx%len(ports)]
			action := actions[idx%len(actions)]
			pid := uint32(1000 + idx*13%30000)

			b.mu.Lock()
			switch action {
			case RuleActionProxy:
				b.proxyConn++
			case RuleActionDirect:
				b.directConn++
			case RuleActionBlock:
				b.blockConn++
			}
			b.totalConn++
			b.mu.Unlock()

			info := ConnectionInfo{
				ProcessName: proc,
				PID:         pid,
				DestIP:      host,
				DestPort:    port,
				Action:      action,
				ProxyInfo:   fmt.Sprintf("%s://%s:%d", config.Type.String(), config.Host, config.Port),
				Timestamp:   time.Now(),
			}
			b.mu.RLock()
			cb := b.connectionCallback
			b.mu.RUnlock()
			if cb != nil {
				cb(info)
			}
		}
	}
}
