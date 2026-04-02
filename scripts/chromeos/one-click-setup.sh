#!/usr/bin/env bash
set -euo pipefail

info() { printf '[INFO] %s\n' "$1"; }
ok() { printf '[OK]   %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STARTER_SCRIPT="$REPO_ROOT/START_LIBRARY.sh"
DESKTOP_FILE="$HOME/.local/share/applications/library-checkout.desktop"
ICON_FILE="$REPO_ROOT/assets/icons/book_2_24dp_EE7B2F_FILL0_wght400_GRAD0_opsz24.ico"

info "Library Checkout one-click setup for ChromeOS (Crostini)"
info "Using app folder: $REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
  warn "Node.js is not installed."
  warn "Install Node.js 18+ in Linux, then run this script again."
  warn "Example: sudo apt update && sudo apt install -y nodejs npm"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  warn "npm is not installed. Install npm, then run this script again."
  exit 1
fi

NODE_VERSION="$(node -v)"
info "Detected Node.js: $NODE_VERSION"

cd "$REPO_ROOT"

info "Installing app dependencies..."
npm install
ok "Dependencies installed"

info "Rebuilding native modules for Electron..."
npm run rebuild:electron
ok "Native modules ready"

chmod +x "$STARTER_SCRIPT"
ok "Single starter ready: $STARTER_SCRIPT"

mkdir -p "$HOME/.local/share/applications"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Library Checkout App
Comment=Launch Library Checkout App
Exec=$STARTER_SCRIPT
Path=$REPO_ROOT
Terminal=true
Icon=$ICON_FILE
Categories=Education;
EOF
ok "Application launcher created: $DESKTOP_FILE"

if [[ -d "$HOME/Desktop" ]]; then
  cp "$DESKTOP_FILE" "$HOME/Desktop/Library Checkout App.desktop" || true
  chmod +x "$HOME/Desktop/Library Checkout App.desktop" || true
  ok "Desktop shortcut created: $HOME/Desktop/Library Checkout App.desktop"
fi

printf '\n'
ok "Setup complete."
info "Launch command: $STARTER_SCRIPT"
