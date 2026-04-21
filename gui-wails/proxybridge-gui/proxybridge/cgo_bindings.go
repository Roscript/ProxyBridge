// cgo_bindings.go
// CGO bindings to the native ProxyBridge core (.so)
// Build the .so first: cd ~/dev/ProxyBridge/Linux/src && make

//go:build linux
// +build linux

package proxybridge

/*
#cgo CFLAGS: -I/home/amadeus/dev/ProxyBridge/Linux/src
#cgo LDFLAGS: -L/home/amadeus/dev/ProxyBridge/Linux/src -lproxybridge -lpthread -lnetfilter_queue -lnfnetlink

#include <stdint.h>
#include <stdbool.h>
#include "ProxyBridge.h"

// Log callback dispatcher
static void logCallbackDispatcher(const char* msg) {
    // ProxyBridge_logCallback is set by Go via setLogCallback
    extern void goLogCallback(const char* msg);
    goLogCallback(msg);
}

// Connection callback dispatcher
static void connCallbackDispatcher(const char* process_name, uint32_t pid,
                                   const char* dest_ip, uint16_t dest_port,
                                   const char* proxy_info) {
    // ProxyBridge_connectionCallback is set by Go via setConnectionCallback
    extern void goConnectionCallback(const char* process_name, uint32_t pid,
                                    const char* dest_ip, uint16_t dest_port,
                                    const char* proxy_info);
    goConnectionCallback(process_name, pid, dest_ip, dest_port, proxy_info);
}
*/
import "C"
