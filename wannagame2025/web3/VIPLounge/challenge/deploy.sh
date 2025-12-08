#!/bin/bash
# Deploy the VIP Lounge challenge using pre-built artifacts
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if artifacts exist
if [ ! -f "$SCRIPT_DIR/bin/vip-lounge-server" ] || [ ! -f "$SCRIPT_DIR/bin/vip_lounge.so" ]; then
    echo "[!] Artifacts not found. Running build_artifacts.sh first..."
    "$SCRIPT_DIR/build_artifacts.sh"
fi

echo "[*] Building runtime Docker image..."
docker build -t vip-lounge:latest "$SCRIPT_DIR"

echo "[*] Starting container..."
docker run -d \
    --name vip-lounge \
    -p 31337:31337 \
    -e FLAG="${FLAG:-W1{vip_l0unge_0wn3r_ch3ck_byp4ss}}" \
    vip-lounge:latest

echo "[+] VIP Lounge is running on port 31337"
echo "[*] Test with: nc localhost 31337"

