// proxybridge.go
// Core stub implementation — compiled on non-Linux and non-Windows platforms.
// On Linux with CGO, cgo_bindings.go overrides the API functions.
// On Windows, proxybridge_windows.go overrides the API functions.
// Types are in types.go (shared, no build tag).

//go:build !windows
// +build !windows
package proxybridge

import (
	"fmt"
	"time"
)

// ─── Exported API (stub) ──────────────────────────────────────────────────────

// ActivateRealBridge is a no-op stub. The real implementation (with CGO) is
// in cgo_bindings.go which is only compiled on Linux with CGO enabled.
func ActivateRealBridge() {}

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
