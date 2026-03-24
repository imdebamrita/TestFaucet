#!/bin/bash
# ── Build Soroban Faucet Contract ──────────────────────────────────────────────
# This script builds the smart contract WASM artifact.
# Prerequisites: Rust toolchain with wasm32-unknown-unknown target
#                stellar-cli installed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "══════════════════════════════════════════════════════"
echo "  Building Soroban Faucet Contract"
echo "══════════════════════════════════════════════════════"

cd "$PROJECT_DIR"

# Ensure wasm32 target is installed
echo "→ Checking wasm32-unknown-unknown target..."
rustup target add wasm32-unknown-unknown 2>/dev/null || true

# Build the contract
echo "→ Building contract..."
stellar contract build

# Find the output WASM
WASM_PATH="target/wasm32-unknown-unknown/release/soroban_faucet_contract.wasm"

if [ -f "$WASM_PATH" ]; then
  SIZE=$(wc -c < "$WASM_PATH" | tr -d ' ')
  echo ""
  echo "✅ Contract built successfully!"
  echo "   Output: $WASM_PATH"
  echo "   Size:   ${SIZE} bytes"
else
  echo "❌ Build failed — WASM not found at $WASM_PATH"
  exit 1
fi
