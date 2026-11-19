#!/usr/bin/env bash
# Installs Claude Code on a fresh Ubuntu/Debian VPS so it can run headless as
# the factory's implementer, authenticated with your Claude subscription
# (Pro/Max/Team/Enterprise) instead of a pay-per-token API key.
#
# `claude setup-token` opens an interactive browser OAuth flow and does NOT
# save the token anywhere -- you complete it once, by hand, and copy the
# printed token yourself. This script cannot do that step for you.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

npm install -g @anthropic-ai/claude-code

echo
echo "Claude Code installed. Now, interactively:"
echo "  claude setup-token"
echo "Follow the browser flow, then copy the printed token and store it where"
echo "only this box can read it:"
echo "  echo 'export CLAUDE_CODE_OAUTH_TOKEN=...' >> ~/.factory-env"
echo "  chmod 600 ~/.factory-env"
echo
echo "The token is good for a year, authenticates against your subscription's"
echo "usage limits (not per-token API billing), and can only make model"
echo "requests -- no Remote Control or claude.ai connectors."
echo
echo "Make sure ANTHROPIC_API_KEY is NOT set in this environment -- if present"
echo "it takes priority over CLAUDE_CODE_OAUTH_TOKEN in non-interactive mode."
