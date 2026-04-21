# ProxyBridge GUI — Makefile
#
# Targets:
#   make          — build release binary
#   make dev      — run wails dev mode (hot reload)
#   make test     — run unit tests
#   make test-verbose  — run tests with -v
#   make clean    — remove build artifacts
#   make docs     — serve godoc locally
#   make lint     — run go vet
#   make build    — alias for default target
#
# Required tools:
#   Go 1.23+       — https://go.dev/dl/
#   Node.js 18+    — https://nodejs.org/
#   Wails CLI v2   — go install github.com/wailsapp/wails/v2/cmd/wails@latest
#
# Environment:
#   GO_PATH  — path to Go binary (default: auto-detected via mise or /usr/local/go)
#   GO        — same as GO_PATH (optional)

GO          ?= $(shell which go 2>/dev/null || echo "/usr/local/go/bin/go")
WAILS       ?= $(shell which wails 2>/dev/null || echo "$(HOME)/go/bin/wails")
NPM         ?= $(shell which npm 2>/dev/null)
FRONTEND    := $(CURDIR)/frontend
BUILD_DIR   := $(CURDIR)/build/bin
BINARY_NAME := proxybridge-gui

# ── Go path for this project ────────────────────────────────────────────────────
# Uses mise (rtx) if available, otherwise falls back to the system go.
PROJECT_GO := $(shell \
    if [ -f "$(HOME)/.local/share/mise/installs/go/1.23.12/bin/go" ]; then \
        echo "$(HOME)/.local/share/mise/installs/go/1.23.12/bin/go"; \
    else \
        echo "$(GO)"; \
    fi)

.PHONY: all build dev test test-verbose clean docs lint rebuild frontend-install

all: build

## build: compile the Wails application
build: frontend-build
	@echo "Building $(BINARY_NAME)..."
	@PATH="$(PROJECT_GO):$(PATH)" $(WAILS) build
	@echo "✓ Built: $(BUILD_DIR)/$(BINARY_NAME)"

## rebuild: clean build dir then build
rebuild: clean build

## dev: run in development mode with hot reload
dev:
	@PATH="$(PROJECT_GO):$(PATH)" $(WAILS) dev

## frontend-install: install frontend dependencies
frontend-install:
	@cd $(FRONTEND) && $(NPM) install

## frontend-build: build the React frontend
frontend-build: frontend-install
	@cd $(FRONTEND) && npm run build
	@echo "✓ Frontend built"

## test: run unit tests (short)
test:
	@PATH="$(PROJECT_GO):$(PATH)" go test ./proxybridge/... -timeout 30s

## test-verbose: run tests with verbose output
test-verbose:
	@PATH="$(PROJECT_GO):$(PATH)" go test ./proxybridge/... -v -timeout 30s

## test-cover: run tests with coverage
test-cover:
	@PATH="$(PROJECT_GO):$(PATH)" go test ./proxybridge/... -cover -coverprofile=cover.out
	@PATH="$(PROJECT_GO):$(PATH)" go tool cover -html=cover.out -o cover.html
	@echo "✓ Coverage report: cover.html"

## lint: run go vet
lint:
	@PATH="$(PROJECT_GO):$(PATH)" go vet ./...

## clean: remove build artifacts and test cache
clean:
	@rm -rf $(BUILD_DIR)
	@rm -f cover.out cover.html
	@PATH="$(PROJECT_GO):$(PATH)" go clean -testcache

## docs: serve godoc documentation locally at http://localhost:6060
docs:
	@echo "Serving godoc at http://localhost:6060/pkg/proxybridge-gui/..."
	@PATH="$(PROJECT_GO):$(PATH)" go run golang.org/x/tools/cmd/godoc@latest -http=:6060

## run: build and run the binary
run: build
	@$(BUILD_DIR)/$(BINARY_NAME)

## help: print this help message
help:
	@grep -E '^## |^[a-zA-Z_-]+:' $(MAKEFILE_LIST) | \
	  awk 'BEGIN { FS = ":.*?## " } \
	       /^## / { printf "\033[1m%s\033[0m\n", substr($$0, 4) } \
	       /^[a-zA-Z_-]+:/ { printf "  \033[32m%-12s\033[0m %s\n", $$1, $$2 }'
