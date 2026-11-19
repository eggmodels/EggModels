#!/usr/bin/env bash
# Installs aider (the factory's implementer agent) and the GitHub CLI on a
# fresh Ubuntu/Debian VPS, and clones eggmodels/EggModels for the factory to
# work in.
set -euo pipefail

REPO_SSH="git@github.com:eggmodels/EggModels.git"
WORKDIR="$HOME/eggmodels-factory"

# --- aider ---
if ! command -v pipx >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y pipx python3-venv
  pipx ensurepath
fi
pipx install aider-chat

# --- gh CLI (used by run-factory.sh to open PRs) ---
if ! command -v gh >/dev/null 2>&1; then
  type -p curl >/dev/null || sudo apt-get install -y curl
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y gh
fi

echo "Run 'gh auth login' once, interactively, with your own GitHub token."

# --- clone the repo the factory will work in ---
if [ ! -d "$WORKDIR" ]; then
  git clone "$REPO_SSH" "$WORKDIR"
  echo "Cloned to $WORKDIR. Make sure this box's SSH key is added as a deploy"
  echo "key (with write access) or you're using an HTTPS remote with a token."
fi

echo "Done. Next: put ANTHROPIC_API_KEY in ~/.factory-env (chmod 600), then"
echo "schedule run-factory.sh with cron — see README.md."
