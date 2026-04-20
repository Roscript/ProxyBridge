// proxybridge/proxybridge.go
// Pure-Go implementation stubbing the ProxyBridge C core.
// Real CGO binding replaces this file when core is compiled.
package proxybridge

import (
	"fmt"
	"sync"
	"time"
)

// ProxyType matches ProxyBridge.h
type ProxyType int

const (
	ProxyTypeHTTP   ProxyType = 0
	ProxyTypeSOCKS5 ProxyType = 1
)

// RuleAction matches ProxyBridge.h
type RuleAction int

const (
	RuleActionProxy  RuleAction = 0
	RuleActionDirect RuleAction = 1
	RuleActionBlock  RuleAction = 2
)

// RuleProtocol matches ProxyBridge.h
type RuleProtocol int

const (
	RuleProtocolTCP  RuleProtocol = 0
	RuleProtocolUDP  RuleProtocol = 1
	RuleProtocolBoth RuleProtocol = 2
)

// ProxyConfig matches the UI's ProxyConfig type
type ProxyConfig struct {
	Type     ProxyType
	Host     string
	Port     uint16
	Username string
	Password string
}

// ProxyRule matches the UI's ProxyRule type
type ProxyRule struct {
	ID           uint32
	ProcessName  string
	TargetHosts  string
	TargetPorts  string
	Protocol     RuleProtocol
	Action       RuleAction
	Enabled      bool
}

// ConnectionInfo mirrors the real callback data
type ConnectionInfo struct {
	ProcessName string
	PID         uint32
	DestIP      string
	DestPort    uint16
	Action      RuleAction
	ProxyInfo   string
	Timestamp   time.Time
}

// LogCallback is called by the core for log messages
type LogCallback func(msg string)

// ConnectionCallback is called by the core for each connection event
type ConnectionCallback func(info ConnectionInfo)

// Bridge is the main ProxyBridge control interface.
// In production, this delegates to the compiled C core via CGO.
// In this stub, it generates simulated realistic traffic.
type Bridge struct {
	mu      sync.RWMutex
	running bool

	config     ProxyConfig
	rules      map[uint32]ProxyRule
	nextRuleID uint32

	logCallback       LogCallback
	connectionCallback ConnectionCallback

	stopCh chan struct{}

	// stats
	totalConn    uint64
	proxyConn    uint64
	directConn   uint64
	blockConn    uint64
	startTime    time.Time
}

var (
	defaultBridge = &Bridge{}
)

// SetLogCallback registers a callback for log messages
func SetLogCallback(cb LogCallback) {
	defaultBridge.mu.Lock()
	defaultBridge.logCallback = cb
	defaultBridge.mu.Unlock()
}

// SetConnectionCallback registers a callback for connection events
func SetConnectionCallback(cb ConnectionCallback) {
	defaultBridge.mu.Lock()
	defaultBridge.connectionCallback = cb
	defaultBridge.mu.Unlock()
}

// SetProxyConfig configures the upstream proxy
func SetProxyConfig(config ProxyConfig) bool {
	defaultBridge.mu.Lock()
	defaultBridge.config = config
	defaultBridge.mu.Unlock()
	defaultBridge.log("Proxy config updated: %s://%s:%d", config.Type, config.Host, config.Port)
	return true
}

// AddRule adds a routing rule
func AddRule(processName, targetHosts, targetPorts string, protocol RuleProtocol, action RuleAction) uint32 {
	defaultBridge.mu.Lock()
	defer defaultBridge.mu.Unlock()

	id := defaultBridge.nextRuleID
	defaultBridge.nextRuleID++
	defaultBridge.rules[id] = ProxyRule{
		ID:          id,
		ProcessName: processName,
		TargetHosts: targetHosts,
		TargetPorts: targetPorts,
		Protocol:    protocol,
		Action:      action,
		Enabled:     true,
	}
	defaultBridge.log("Rule added: [%d] %s %s:%s %v → %v", id, processName, targetHosts, targetPorts, protocol, action)
	return id
}

// EnableRule enables/disables a rule
func EnableRule(ruleID uint32) bool {
	defaultBridge.mu.Lock()
	defer defaultBridge.mu.Unlock()
	if rule, ok := defaultBridge.rules[ruleID]; ok {
		rule.Enabled = true
		defaultBridge.rules[ruleID] = rule
		return true
	}
	return false
}

// DisableRule disables a rule
func DisableRule(ruleID uint32) bool {
	defaultBridge.mu.Lock()
	defer defaultBridge.mu.Unlock()
	if rule, ok := defaultBridge.rules[ruleID]; ok {
		rule.Enabled = false
		defaultBridge.rules[ruleID] = rule
		return true
	}
	return false
}

// DeleteRule removes a rule
func DeleteRule(ruleID uint32) bool {
	defaultBridge.mu.Lock()
	defer defaultBridge.mu.Unlock()
	if _, ok := defaultBridge.rules[ruleID]; ok {
		delete(defaultBridge.rules, ruleID)
		defaultBridge.log("Rule deleted: [%d]", ruleID)
		return true
	}
	return false
}

// GetRules returns all rules
func GetRules() []ProxyRule {
	defaultBridge.mu.RLock()
	defer defaultBridge.mu.RUnlock()
	rules := make([]ProxyRule, 0, len(defaultBridge.rules))
	for _, r := range defaultBridge.rules {
		rules = append(rules, r)
	}
	return rules
}

// Start begins traffic interception
func Start() bool {
	defaultBridge.mu.Lock()
	if defaultBridge.running {
		defaultBridge.mu.Unlock()
		return true
	}
	defaultBridge.running = true
	defaultBridge.stopCh = make(chan struct{})
	defaultBridge.startTime = time.Now()
	defaultBridge.mu.Unlock()

	defaultBridge.log("ProxyBridge started")
	go defaultBridge.trafficSimulator()
	return true
}

// Stop halts traffic interception
func Stop() bool {
	defaultBridge.mu.Lock()
	if !defaultBridge.running {
		defaultBridge.mu.Unlock()
		return true
	}
	defaultBridge.running = false
	close(defaultBridge.stopCh)
	defaultBridge.mu.Unlock()

	defaultBridge.log("ProxyBridge stopped")
	return true
}

// IsRunning returns the current running state
func IsRunning() bool {
	defaultBridge.mu.RLock()
	defer defaultBridge.mu.RUnlock()
	return defaultBridge.running
}

// GetStats returns connection statistics
func GetStats() (total, proxy, direct, blocked uint64) {
	defaultBridge.mu.RLock()
	defer defaultBridge.mu.RUnlock()
	return defaultBridge.totalConn, defaultBridge.proxyConn, defaultBridge.directConn, defaultBridge.blockConn
}

// GetUptime returns the time since Start() was called
func GetUptime() string {
	defaultBridge.mu.RLock()
	defer defaultBridge.mu.RUnlock()
	if defaultBridge.startTime.IsZero() {
		return "0s"
	}
	d := time.Since(defaultBridge.startTime)
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	s := int(d.Seconds()) % 60
	if h > 0 {
		return fmt.Sprintf("%dh %dm", h, m)
	}
	if m > 0 {
		return fmt.Sprintf("%dm %ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}

// TestConnection attempts a test connection to target
func TestConnection(targetHost string, targetPort uint16) string {
	defaultBridge.mu.RLock()
	config := defaultBridge.config
	defaultBridge.mu.RUnlock()

	if config.Host == "" {
		return "No proxy configured"
	}
	// Simulate test — in real impl this opens a real socket
	time.Sleep(200 * time.Millisecond)
	return fmt.Sprintf("OK via %s://%s:%d → %s:%d", config.Type, config.Host, config.Port, targetHost, targetPort)
}

// --- internal helpers ---

func (b *Bridge) log(format string, args ...interface{}) {
	b.mu.RLock()
	cb := b.logCallback
	b.mu.RUnlock()
	if cb == nil {
		return
	}
	cb(fmt.Sprintf(format, args...))
}

func (b *Bridge) emitConnection(info ConnectionInfo) {
	b.mu.RLock()
	cb := b.connectionCallback
	b.mu.RUnlock()
	if cb == nil {
		return
	}
	cb(info)
}

// trafficSimulator generates realistic mock traffic for demo purposes.
// Replaced by real ProxyBridge core in production.
func (b *Bridge) trafficSimulator() {
	processes := []string{"chrome.exe", "firefox.exe", "slack.exe", "teams.exe", "curl", "wget", "ssh", "curl"}
	hosts := []string{"api.stripe.com", "www.google.com", "github.com", "slack.com", "teams.microsoft.com", "cloudflare.com", "discord.com", "1.1.1.1"}
	ports := []uint16{443, 80, 8080, 22, 3000, 8443}
	actions := []RuleAction{RuleActionProxy, RuleActionProxy, RuleActionProxy, RuleActionDirect, RuleActionBlock}

	ticker := time.NewTicker(400 * time.Millisecond)
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
				ProxyInfo:   fmt.Sprintf("%s://%s:%d", config.Type, config.Host, config.Port),
				Timestamp:   time.Now(),
			}
			b.emitConnection(info)
		}
	}
}
