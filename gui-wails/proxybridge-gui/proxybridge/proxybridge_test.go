package proxybridge

import (
	"fmt"
	"testing"
	"time"
)

// resetBridge swaps defaultBridge with a fresh isolated instance whose
// simulator goroutine is not running. This prevents old goroutines from
// interfering with new test cases.
func resetBridge() (restore func()) {
	orig := defaultBridge
	defaultBridge = &Bridge{
		rules:      make(map[uint32]ProxyRule),
		stopCh:     make(chan struct{}),
		running:    false, // ← simulator won't start until Start() is called
		totalConn:  0,
		proxyConn:  0,
		directConn: 0,
		blockConn:  0,
	}
	return func() { defaultBridge = orig }
}

// TestAddRule verifies rule addition and auto-incrementing IDs.
func TestAddRule(t *testing.T) {
	restore := resetBridge()
	defer restore()
	// Note: we intentionally do NOT call Stop() here.
	// The trafficSimulator goroutine (if any) holds its own bridge reference
	// and will be cleaned up when the test process exits. Calling Stop() on a
	// *different* bridge instance than the one the simulator is using causes
	// a deadlock because it closes the wrong stopCh channel.

	id1 := AddRule("chrome.exe", "*.google.com", "443", RuleProtocolTCP, RuleActionProxy)
	id2 := AddRule("curl", "*", "80", RuleProtocolTCP, RuleActionDirect)
	id3 := AddRule("ssh", "*", "22", RuleProtocolTCP, RuleActionDirect)

	if id1 == id2 || id2 == id3 || id1 == id3 {
		t.Fatalf("Rule IDs must be unique: id1=%d id2=%d id3=%d", id1, id2, id3)
	}
	if id1 != 0 || id2 != 1 || id3 != 2 {
		t.Fatalf("Expected IDs 0,1,2 got %d,%d,%d", id1, id2, id3)
	}

	rules := GetRules()
	if len(rules) != 3 {
		t.Fatalf("expected 3 rules, got %d", len(rules))
	}
}

// TestEditRule verifies rule fields are updated correctly.
func TestEditRule(t *testing.T) {
	restore := resetBridge()
	defer restore()

	id := AddRule("chrome.exe", "*.google.com", "443", RuleProtocolTCP, RuleActionProxy)
	ok := EditRule(id, "firefox.exe", "*.github.com", "22", RuleProtocolUDP, RuleActionBlock)
	if !ok {
		t.Fatal("EditRule returned false")
	}

	rules := GetRules()
	if len(rules) != 1 {
		t.Fatalf("expected 1 rule, got %d", len(rules))
	}
	r := rules[0]
	if r.ProcessName != "firefox.exe" {
		t.Errorf("ProcessName = %q, want %q", r.ProcessName, "firefox.exe")
	}
	if r.TargetHosts != "*.github.com" {
		t.Errorf("TargetHosts = %q, want %q", r.TargetHosts, "*.github.com")
	}
	if r.TargetPorts != "22" {
		t.Errorf("TargetPorts = %q, want %q", r.TargetPorts, "22")
	}
	if r.Protocol != RuleProtocolUDP {
		t.Errorf("Protocol = %v, want RuleProtocolUDP", r.Protocol)
	}
	if r.Action != RuleActionBlock {
		t.Errorf("Action = %v, want RuleActionBlock", r.Action)
	}
}

// TestDeleteRule verifies rules are removed.
func TestDeleteRule(t *testing.T) {
	restore := resetBridge()
	defer restore()

	id := AddRule("chrome.exe", "*", "443", RuleProtocolTCP, RuleActionProxy)
	if !DeleteRule(id) {
		t.Fatal("DeleteRule returned false")
	}
	if len(GetRules()) != 0 {
		t.Fatal("expected 0 rules after delete")
	}
	// Deleting non-existent rule should not panic.
	DeleteRule(999)
}

// TestEnableDisableRule toggles rule enabled state.
func TestEnableDisableRule(t *testing.T) {
	restore := resetBridge()
	defer restore()

	id := AddRule("chrome.exe", "*", "443", RuleProtocolTCP, RuleActionProxy)
	if !EnableRule(id) {
		t.Fatal("EnableRule returned false")
	}
	DisableRule(id)
	rules := GetRules()
	if rules[0].Enabled {
		t.Error("rule should be disabled after DisableRule")
	}
}

// TestGetRulesConcurrency tests that GetRules works correctly with concurrent rule operations.
func TestGetRulesConcurrency(t *testing.T) {
	restore := resetBridge()
	defer restore()

	// Add rules concurrently — GetRules should not panic or miss writes.
	for i := 0; i < 10; i++ {
		go func(idx int) {
			for j := 0; j < 50; j++ {
				AddRule(fmt.Sprintf("proc%d_%d", idx, j), "*", "443", RuleProtocolTCP, RuleActionProxy)
			}
		}(i)
		go func() {
			for j := 0; j < 50; j++ {
				_ = GetRules()
			}
		}()
	}
	// Wait for goroutines to finish.
	time.Sleep(500 * time.Millisecond)
	rules := GetRules()
	if len(rules) != 500 {
		t.Errorf("expected 500 rules, got %d", len(rules))
	}
}

// TestStatsCounters verifies connection counter reads return correct values.
func TestStatsCounters(t *testing.T) {
	restore := resetBridge()
	defer restore()

	b := defaultBridge
	// Simulate counters directly on the bridge struct.
	for i := 0; i < 5; i++ {
		b.proxyConn++
		b.totalConn++
	}
	for i := 0; i < 3; i++ {
		b.directConn++
		b.totalConn++
	}
	for i := 0; i < 2; i++ {
		b.blockConn++
		b.totalConn++
	}

	total, proxy, direct, block := GetStats()
	if total != 10 {
		t.Errorf("total = %d, want 10", total)
	}
	if proxy != 5 {
		t.Errorf("proxy = %d, want 5", proxy)
	}
	if direct != 3 {
		t.Errorf("direct = %d, want 3", direct)
	}
	if block != 2 {
		t.Errorf("block = %d, want 2", block)
	}
}

// TestProxyTypeString verifies ProxyType.String() returns correct labels.
func TestProxyTypeString(t *testing.T) {
	if ProxyTypeHTTP.String() != "HTTP" {
		t.Errorf("ProxyTypeHTTP.String() = %q, want %q", ProxyTypeHTTP.String(), "HTTP")
	}
	if ProxyTypeSOCKS5.String() != "SOCKS5" {
		t.Errorf("ProxyTypeSOCKS5.String() = %q, want %q", ProxyTypeSOCKS5.String(), "SOCKS5")
	}
}

// TestProxyTypeDefault verifies the zero value of ProxyType is HTTP.
func TestProxyTypeDefault(t *testing.T) {
	var pt ProxyType
	if pt != ProxyTypeHTTP {
		t.Errorf("zero ProxyType = %v, want ProxyTypeHTTP", pt)
	}
}

// TestRuleActionValues verifies the three action constants have distinct values.
func TestRuleActionValues(t *testing.T) {
	if RuleActionProxy == RuleActionDirect || RuleActionDirect == RuleActionBlock || RuleActionProxy == RuleActionBlock {
		t.Error("RuleAction constants must all be distinct")
	}
}

// TestRuleProtocolValues verifies the three protocol constants have distinct values.
func TestRuleProtocolValues(t *testing.T) {
	if RuleProtocolTCP == RuleProtocolUDP || RuleProtocolUDP == RuleProtocolBoth || RuleProtocolTCP == RuleProtocolBoth {
		t.Error("RuleProtocol constants must all be distinct")
	}
}

// TestEditRuleNotFound verifies EditRule returns false for unknown IDs.
func TestEditRuleNotFound(t *testing.T) {
	restore := resetBridge()
	defer restore()

	ok := EditRule(999, "proc", "*", "*", RuleProtocolTCP, RuleActionProxy)
	if ok {
		t.Error("EditRule(999) should return false for non-existent rule")
	}
}

// TestDeleteRuleNotFound verifies DeleteRule returns false for unknown IDs without panic.
func TestDeleteRuleNotFound(t *testing.T) {
	restore := resetBridge()
	defer restore()

	ok := DeleteRule(999)
	if ok {
		t.Error("DeleteRule(999) should return false for non-existent rule")
	}
}

// TestUptimeWithStartTime verifies GetUptime returns non-zero after startTime is set.
func TestUptimeWithStartTime(t *testing.T) {
	restore := resetBridge()
	defer restore()

	b := defaultBridge
	b.startTime = time.Now().Add(-5 * time.Second)

	uptime := GetUptime()
	if uptime == "0s" {
		t.Error("GetUptime() should not be 0s when startTime is set")
	}
}

// TestConnectionInfoStruct verifies ConnectionInfo fields are correctly set.
func TestConnectionInfoStruct(t *testing.T) {
	info := ConnectionInfo{
		ProcessName: "chrome.exe",
		PID:         1234,
		DestIP:      "142.250.80.46",
		DestPort:    443,
		Action:      RuleActionProxy,
		ProxyInfo:   "HTTP://proxy:8080",
		Timestamp:   time.Now(),
	}

	if info.ProcessName != "chrome.exe" {
		t.Errorf("ProcessName = %q, want %q", info.ProcessName, "chrome.exe")
	}
	if info.PID != 1234 {
		t.Errorf("PID = %d, want 1234", info.PID)
	}
	if info.DestPort != 443 {
		t.Errorf("DestPort = %d, want 443", info.DestPort)
	}
	if info.Action != RuleActionProxy {
		t.Errorf("Action = %v, want RuleActionProxy", info.Action)
	}
}
