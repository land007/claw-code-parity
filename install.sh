#!/usr/bin/env bash
set -euo pipefail

REPO="${CLAW_REPO:-land007/claw-code-parity}"
VERSION="${CLAW_VERSION:-latest}"
INSTALL_DIR="${CLAW_INSTALL_DIR:-$HOME/.local/bin}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd tar

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux) os_slug="linux" ;;
  Darwin) os_slug="macos" ;;
  *)
    echo "error: unsupported operating system: $OS" >&2
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64) arch_slug="x86_64" ;;
  aarch64|arm64) arch_slug="arm64" ;;
  *)
    echo "error: unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

asset="claw-${VERSION}-${os_slug}-${arch_slug}.tar.gz"
if [ "$VERSION" = "latest" ]; then
  need_cmd sed
  release_json="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"
  VERSION="$(printf '%s' "$release_json" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)"
  if [ -z "$VERSION" ]; then
    echo "error: failed to resolve latest release version from GitHub API" >&2
    exit 1
  fi
fi
asset="claw-${VERSION}-${os_slug}-${arch_slug}.tar.gz"
url="https://github.com/${REPO}/releases/download/${VERSION}/${asset}"

echo "Installing claw from ${url}"
mkdir -p "$INSTALL_DIR"
archive_path="$TMP_DIR/$asset"
curl -fsSL "$url" -o "$archive_path"
tar -xzf "$archive_path" -C "$TMP_DIR"

bundle_dir="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ -z "$bundle_dir" ] || [ ! -f "$bundle_dir/claw" ]; then
  echo "error: downloaded archive did not contain a claw binary" >&2
  exit 1
fi

cp "$bundle_dir/claw" "$INSTALL_DIR/claw"
chmod +x "$INSTALL_DIR/claw"

echo "Installed to $INSTALL_DIR/claw"
if ! printf '%s' "${PATH:-}" | tr ':' '\n' | grep -Fx "$INSTALL_DIR" >/dev/null 2>&1; then
  echo "warning: $INSTALL_DIR is not currently on PATH" >&2
  echo "Add this to your shell profile:" >&2
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\"" >&2
fi

echo "Run: claw --help"
