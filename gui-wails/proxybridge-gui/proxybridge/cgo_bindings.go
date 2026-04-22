// cgo_bindings.go
// CGO binding to the native ProxyBridge core (.so).
// No changes to C core required. Callbacks from ProxyBridge are received via
// a C shim (cgo_callbacks.c) which calls back into Go-exported functions.
//
// Build the .so first: cd ~/dev/ProxyBridge/Linux/src && make
// Then build GUI: cd ../gui-wails/proxybridge-gui && wails build

//go:build linux && cgo
// +build linux,cgo

package proxybridge

/*
#cgo CFLAGS: -I/home/amadeus/dev/ProxyBridge/Linux/src
#cgo LDFLAGS: -L/home/amadeus/dev/ProxyBridge/Linux/src -lproxybridge -lpthread -lnetfilter_queue -lnfnetlink

#include <stdlib.h>
#include "ProxyBridge.h"

// C dispatchers are implemented in cgo_callbacks.c.
// These extern declarations let the Go side call them.
extern void logCallbackBridge(const char* msg);
extern void connCallbackBridge(const char* pn, uint32_t pid,
                               const char* dip, uint16_t dp, const char* pi);

// Go-exported functions (//export) are declared automatically by cgo
// in the generated _cgo_export.c and are callable from cgo_callbacks.c.
*/
import "C"
import "unsafe"

var _cLogCallback func(string)
var _cConnCallback func(ConnectionInfo)

// ── Go-exported callbacks (called from cgo_callbacks.c via cgo) ─────────────────

// goLogCallbackC receives a strdup'd log string and forwards it to the Go callback.
//export goLogCallbackC
func goLogCallbackC(msgCopy *C.char) {
	if msgCopy == nil {
		return
	}
	text := C.GoString(msgCopy)
	C.free(unsafe.Pointer(msgCopy))
	if _cLogCallback != nil {
		_cLogCallback(text)
	}
}

// goConnectionCallbackC receives strdup'd connection info strings and forwards
// to the Go callback. All C strings are freed immediately after copying.
//export goConnectionCallbackC
func goConnectionCallbackC(pn *C.char, pid C.uint32_t,
	dip *C.char, dp C.uint16_t, pi *C.char) {
	if pn == nil || dip == nil || pi == nil {
		return
	}
	info := ConnectionInfo{
		ProcessName: C.GoString(pn),
		PID:         uint32(pid),
		DestIP:      C.GoString(dip),
		DestPort:    uint16(dp),
		ProxyInfo:   C.GoString(pi),
	}
	C.free(unsafe.Pointer(pn))
	C.free(unsafe.Pointer(dip))
	C.free(unsafe.Pointer(pi))
	if _cConnCallback != nil {
		_cConnCallback(info)
	}
}

// ── Public API ─────────────────────────────────────────────────────────────────

// registerCCallbacks wires up the C dispatchers to ProxyBridge.
// Must be called exactly once, before any other ProxyBridge calls.
func registerCCallbacks() {
	C.ProxyBridge_SetLogCallback((C.LogCallback)(C.logCallbackBridge))
	C.ProxyBridge_SetConnectionCallback((C.ConnectionCallback)(C.connCallbackBridge))
}
