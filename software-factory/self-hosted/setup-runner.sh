#!/usr/bin/env bash
# Installs a GitHub Actions self-hosted runner for eggmodels/EggModels on a
# fresh Ubuntu/Debian VPS and registers it as a systemd service.
#
# Usage: ./setup-runner.sh <registration-token>
#
# Get <registration-token> from:
#   GitHub repo -> Settings -> Actions -> Runners -> New self-hosted runner
# It is short-lived (expires in ~1 hour) and single-use; generate a fresh one
# if this script fails partway and you re-run it.
set -euo pipefail

TOKEN="${1:?Usage: $0 <registration-token>}"
REPO_URL="https://github.com/eggmodels/EggModels"
RUNNER_VERSION="2.321.0"
RUNNER_DIR="$HOME/actions-runner"

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) RUNNER_ARCH="x64" ;;
  aarch64) RUNNER_ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

PKG="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
curl -o "$PKG" -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${PKG}"
tar xzf "./${PKG}"
rm "$PKG"

./config.sh --url "$REPO_URL" --token "$TOKEN" --unattended --name "$(hostname)-eggmodels" --labels self-hosted,eggmodels

sudo ./svc.sh install
sudo ./svc.sh start

echo "Runner installed and started as a systemd service."
echo "Check status with: sudo ./svc.sh status  (from $RUNNER_DIR)"
