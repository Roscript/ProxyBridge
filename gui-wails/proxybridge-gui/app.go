package main

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"proxybridge-gui/proxybridge"
)

// App is the Wails application struct.
// All methods here are exposed to the frontend via Wails bindings.
type App struct {
	ctx          context.Context
	mu           sync.Mutex
	running      bool
	statsRefresh chan struct{}
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.statsRefresh = make(chan struct{}, 1)

	// Register connection callback — push events to frontend
	proxybridge.SetConnectionCallback(func(info proxybridge.ConnectionInfo) {
		payload, _ := json.Marshal(map[string]interface{}{
			"id":           info.Timestamp.UnixNano(),
			"timestamp":     info.Timestamp.Format("15:04:05"),
			"processName":  info.ProcessName,
			"pid":          info.PID,
			"destIp":       info.DestIP,
			"destPort":     info.DestPort,
			"action":       actionToString(info.Action),
			"proxyInfo":    info.ProxyInfo,
		})
		runtime.EventsEmit(a.ctx, "connection", string(payload))
	})

	// Register log callback
	proxybridge.SetLogCallback(func(msg string) {
		runtime.EventsEmit(a.ctx, "log", msg)
	})
}

// --- Exported API methods (called from frontend) ---

func (a *App) Start() bool {
	a.mu.Lock()
	a.running = true
	a.mu.Unlock()
	return proxybridge.Start()
}

func (a *App) Stop() bool {
	a.mu.Lock()
	a.running = false
	a.mu.Unlock()
	return proxybridge.Stop()
}

func (a *App) IsRunning() bool {
	return proxybridge.IsRunning()
}

func (a *App) SetProxyConfig(configType, host string, port uint16, username, password string) bool {
	pt := proxybridge.ProxyTypeHTTP
	if configType == "SOCKS5" {
		pt = proxybridge.ProxyTypeSOCKS5
	}
	return proxybridge.SetProxyConfig(proxybridge.ProxyConfig{
		Type:     pt,
		Host:     host,
		Port:     port,
		Username: username,
		Password: password,
	})
}

func (a *App) GetProxyConfig() map[string]interface{} {
	// Returns current proxy config — stub always returns empty
	return map[string]interface{}{}
}

func (a *App) AddRule(processName, targetHosts, targetPorts, protocol, action string) uint32 {
	p := parseProtocol(protocol)
	act := parseAction(action)
	return proxybridge.AddRule(processName, targetHosts, targetPorts, p, act)
}

func (a *App) EnableRule(ruleID uint32) bool {
	return proxybridge.EnableRule(ruleID)
}

func (a *App) DisableRule(ruleID uint32) bool {
	return proxybridge.DisableRule(ruleID)
}

func (a *App) DeleteRule(ruleID uint32) bool {
	return proxybridge.DeleteRule(ruleID)
}

func (a *App) GetRules() []map[string]interface{} {
	rules := proxybridge.GetRules()
	result := make([]map[string]interface{}, len(rules))
	for i, r := range rules {
		result[i] = map[string]interface{}{
			"id":           r.ID,
			"processName":  r.ProcessName,
			"targetHosts":  r.TargetHosts,
			"targetPorts":  r.TargetPorts,
			"protocol":     protocolToString(r.Protocol),
			"action":       actionToString(r.Action),
			"enabled":      r.Enabled,
		}
	}
	return result
}

func (a *App) GetStats() map[string]interface{} {
	total, proxy, direct, block := proxybridge.GetStats()
	activeRules := 0
	for _, r := range proxybridge.GetRules() {
		if r.Enabled {
			activeRules++
		}
	}
	return map[string]interface{}{
		"totalConnections":   total,
		"proxyConnections":  proxy,
		"directConnections": direct,
		"blockedConnections": block,
		"activeRules":       activeRules,
		"uptime":            proxybridge.GetUptime(),
	}
}

func (a *App) TestConnection(targetHost string, targetPort uint16) string {
	return proxybridge.TestConnection(targetHost, targetPort)
}

func (a *App) SetDnsViaProxy(enable bool) {
	// Stub — real impl calls ProxyBridge_SetDnsViaProxy
}

func (a *App) SetLocalhostViaProxy(enable bool) {
	// Stub — real impl calls ProxyBridge_SetLocalhostViaProxy
}

func (a *App) SetTrafficLogging(enable bool) {
	// Stub
}

func (a *App) ClearConnectionLogs() {
	// Stub
}


func parseProtocol(s string) proxybridge.RuleProtocol {
	switch s {
	case "UDP":
		return proxybridge.RuleProtocolUDP
	case "BOTH":
		return proxybridge.RuleProtocolBoth
	default:
		return proxybridge.RuleProtocolTCP
	}
}

func protocolToString(p proxybridge.RuleProtocol) string {
	switch p {
	case proxybridge.RuleProtocolUDP:
		return "UDP"
	case proxybridge.RuleProtocolBoth:
		return "BOTH"
	default:
		return "TCP"
	}
}

func parseAction(s string) proxybridge.RuleAction {
	switch s {
	case "DIRECT":
		return proxybridge.RuleActionDirect
	case "BLOCK":
		return proxybridge.RuleActionBlock
	default:
		return proxybridge.RuleActionProxy
	}
}

func actionToString(a proxybridge.RuleAction) string {
	switch a {
	case proxybridge.RuleActionDirect:
		return "DIRECT"
	case proxybridge.RuleActionBlock:
		return "BLOCK"
	default:
		return "PROXY"
	}
}
