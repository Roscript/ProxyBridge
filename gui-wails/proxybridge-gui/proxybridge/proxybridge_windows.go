// proxybridge_windows.go
// Stub implementation for Windows GUI builds from Linux CI.
// The real WinDivert-based implementation is compiled on Windows
// and loaded at runtime via syscall (not compile-time cgo).
//
//go:build windows
// +build windows

package proxybridge

// Start/Stop are implemented by the Linux/non-Linux stub in proxybridge.go.
// This file exists so the package compiles on Windows (satisfying the
// //go:build windows constraint) without needing cgo link flags.
