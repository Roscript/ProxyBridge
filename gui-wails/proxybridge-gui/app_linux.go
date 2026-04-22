//go:build linux
// +build linux

package main

import "proxybridge-gui/proxybridge"

func init() {
	// Activate real CGO binding — no changes to C core needed.
	// This makes SetConnectionCallback/SetLogCallback in app.go
	// dispatch to the real ProxyBridge .so callbacks instead of the stub.
	proxybridge.ActivateRealBridge()
}
