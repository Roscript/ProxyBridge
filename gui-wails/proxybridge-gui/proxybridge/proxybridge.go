// proxybridge/proxybridge.go
// Stub implementation — GUI builds and runs with this.
// Real CGO binding requires the C core to accept a void* userdata arg in callbacks
// so Go can pass its function pointer through without cgo type restrictions.
//
// To build real binding: revert this to the CGO version once ProxyBridge.h is updated
// to pass void* userdata through callbacks.
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

// ─── Exported API ───────────────────────────────────────────────────────────

func SetLogCallback(cb LogCallback) {
	defaultBridge.mu.Lock()
	defaultBridge.logCallback = cb
	defaultBridge.mu.Unlock()
}

func SetConnectionCallback(cb ConnectionCallback) {
	defaultBridge.mu.Lock()
	defaultBridge.connectionCallback = cb
	defaultBridge.mu.Unlock()
}

func SetProxyConfig(config ProxyConfig) bool {
	defaultBridge.mu.Lock()
	defer defaultBridge.mu.Unlock()
	defaultBridge.config = config
	defaultBridge.log("Proxy config updated: %s://%s:%d", config.Type.String(), config.Host, config.Port)
	return true
}

func AddRule(processName, targetHosts, targetPorts string, protocol RuleProtocol, action RuleAction) uint32 {
	defaultBridge.mu.Lock()
	id := defaultBridge.nextRuleID
	defaultBridge.nextRuleID++
	rule := ProxyRule{
		ID: id, ProcessName: processName,
		TargetHosts: targetHosts, TargetPorts: targetPorts,
		Protocol: protocol, Action: action, Enabled: true,
	}
	defaultBridge.rules[id] = rule
	// Unlock before logging — log() also needs the lock.
	defaultBridge.mu.Unlock()
	defaultBridge.log("Rule added: [%d] %s %s:%s %v → %v",
		id, processName, targetHosts, targetPorts, protocol, action)
	return id
}

func EnableRule(ruleID uint32) bool {
	defaultBridge.mu.Lock()
	defer defaultBridge.mu.Unlock()
	if r, ok := defaultBridge.rules[ruleID]; ok {
		r.Enabled = true
		defaultBridge.rules[ruleID] = r
		return true
	}
	return false
}

func DisableRule(ruleID uint32) bool {
	defaultBridge.mu.Lock()
	defer defaultBridge.mu.Unlock()
	if r, ok := defaultBridge.rules[ruleID]; ok {
		r.Enabled = false
		defaultBridge.rules[ruleID] = r
		return true
	}
	return false
}

func EditRule(ruleID uint32, processName, targetHosts, targetPorts string, protocol RuleProtocol, action RuleAction) bool {
	defaultBridge.mu.Lock()
	if r, ok := defaultBridge.rules[ruleID]; ok {
		r.ProcessName = processName
		r.TargetHosts = targetHosts
		r.TargetPorts = targetPorts
		r.Protocol = protocol
		r.Action = action
		defaultBridge.rules[ruleID] = r
		defaultBridge.mu.Unlock()
		defaultBridge.log("Rule edited: [%d] %s %s:%s %v → %v",
			ruleID, processName, targetHosts, targetPorts, protocol, action)
		return true
	}
	defaultBridge.mu.Unlock()
	return false
}

func DeleteRule(ruleID uint32) bool {
	defaultBridge.mu.Lock()
	_, ok := defaultBridge.rules[ruleID]
	if ok {
		delete(defaultBridge.rules, ruleID)
		defaultBridge.mu.Unlock()
		defaultBridge.log("Rule deleted: [%d]", ruleID)
		return true
	}
	defaultBridge.mu.Unlock()
	return false
}

func GetRules() []ProxyRule {
	defaultBridge.mu.RLock()
	defer defaultBridge.mu.RUnlock()
	rules := make([]ProxyRule, 0, len(defaultBridge.rules))
	for _, r := range defaultBridge.rules {
		rules = append(rules, r)
	}
	return rules
}

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

func IsRunning() bool {
	defaultBridge.mu.RLock()
	defer defaultBridge.mu.RUnlock()
	return defaultBridge.running
}

func GetStats() (total, proxy, direct, blocked uint64) {
	defaultBridge.mu.RLock()
	defer defaultBridge.mu.RUnlock()
	return defaultBridge.totalConn, defaultBridge.proxyConn,
		defaultBridge.directConn, defaultBridge.blockConn
}

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

func TestConnection(targetHost string, targetPort uint16) string {
	defaultBridge.mu.RLock()
	config := defaultBridge.config
	defaultBridge.mu.RUnlock()

	if config.Host == "" {
		return "No proxy configured"
	}
	time.Sleep(200 * time.Millisecond)
	return fmt.Sprintf("OK via %s://%s:%d → %s:%d",
		config.Type.String(), config.Host, config.Port, targetHost, targetPort)
}

// ─── Internal ────────────────────────────────────────────────────────────────

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
