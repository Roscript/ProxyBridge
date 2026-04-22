// proxybridge_windows.go
// P/Invoke binding to ProxyBridgeCore.dll on Windows via cgo.
// Uses WinDivert for packet interception on Windows.
//
//go:build windows
// +build windows

package proxybridge

/*
#cgo LDFLAGS: -lProxyBridgeCore -lWinDivert -lws2_32 -liphlpapi
#cgo CFLAGS: -I${SRCDIR}/../WinDivert/include
#include <ProxyBridge.h>
*/
import "C"
