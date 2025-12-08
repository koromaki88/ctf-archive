#!/bin/bash
# Build artifacts for VIP Lounge challenge
# This script builds the Solana program and server binary

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Building VIP Lounge Artifacts ==="
echo "[*] Project root: $PROJECT_ROOT"

# Create bin directory
mkdir -p "$SCRIPT_DIR/bin"

# Build using Docker (multi-stage build)
echo "[*] Building with Docker..."
docker build \
    --platform linux/amd64 \
    -f "$SCRIPT_DIR/Dockerfile.build" \
    -t vip-lounge-builder:latest \
    "$PROJECT_ROOT/.." 2>&1 | tail -20

# Extract artifacts from builder image
echo "[*] Extracting artifacts..."
CONTAINER_ID=$(docker create vip-lounge-builder:latest)
docker cp "$CONTAINER_ID:/build/vip-lounge/server/target/release/vip-lounge-server" "$SCRIPT_DIR/bin/"
docker cp "$CONTAINER_ID:/build/vip-lounge/program/target/deploy/vip_lounge.so" "$SCRIPT_DIR/bin/"
docker rm "$CONTAINER_ID"

echo "[*] Artifacts built successfully:"
ls -la "$SCRIPT_DIR/bin/"

