#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."
IMAGE_TAG="dragons-hoard-builder:latest"
CONTAINER_NAME="dragons-hoard-builder-tmp"

echo "[*] Building builder image ($IMAGE_TAG) for linux/amd64..."
# Build context is project root (Blockchain/) to include sol-ctf-framework
docker build \
  --platform linux/amd64 \
  -f "$SCRIPT_DIR/Dockerfile.build" \
  -t "$IMAGE_TAG" \
  "$PROJECT_ROOT"

echo "[*] Creating container to extract artifacts..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker create --name "$CONTAINER_NAME" "$IMAGE_TAG"

echo "[*] Preparing bin directory..."
rm -rf "$SCRIPT_DIR/bin"
mkdir -p "$SCRIPT_DIR/bin"

echo "[*] Copying artifacts..."
docker cp "$CONTAINER_NAME":/build/DragonsHoard/server/target/release/dragons-hoard-server "$SCRIPT_DIR/bin/dragons-hoard-server"
docker cp "$CONTAINER_NAME":/build/DragonsHoard/program/target/deploy/dragons_hoard.so "$SCRIPT_DIR/bin/dragons_hoard.so"

echo "[*] Cleaning up container..."
docker rm "$CONTAINER_NAME" >/dev/null

echo "[+] Artifacts ready in $SCRIPT_DIR/bin"
ls -lh "$SCRIPT_DIR/bin"
