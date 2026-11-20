#!/usr/bin/env bash
# GCE metadata startup-script: runs on every boot. First boot only installs
# dependencies; every boot (including the first) runs the factory job once,
# then shuts the VM down -- so it only ever runs as long as one job takes.
set -euo pipefail
exec > >(tee -a /var/log/factory-startup.log) 2>&1
echo "=== startup-script run at $(date) ==="

MARKER=/opt/factory/.provisioned
mkdir -p /opt/factory

# Always refresh run-factory.sh from instance metadata, so updating it is
# just `gcloud compute instances add-metadata ... --metadata-from-file=run-factory-script=...`
# with no SSH/copy step needed.
curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/run-factory-script" \
  -o /opt/factory/run-factory.sh
chmod +x /opt/factory/run-factory.sh

if [ ! -f "$MARKER" ]; then
  echo "First boot: installing dependencies."
  apt-get update
  apt-get install -y git curl

  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  npm install -g @anthropic-ai/claude-code

  apt-get install -y pipx python3-venv
  pipx ensurepath
  pipx install aider-chat

  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update
  apt-get install -y gh

  touch "$MARKER"
  echo "First-boot install done. SSH in now to run 'gh auth login' and"
  echo "'claude setup-token' before relying on the weekly schedule -- see"
  echo "gcp/README.md. Skipping the factory run and shutting down."
  shutdown -h now
  exit 0
fi

if [ ! -d "$HOME/eggmodels-factory" ]; then
  echo "Repo not cloned yet -- finish the one-time manual setup (gh auth," \
       "git clone, claude setup-token) described in gcp/README.md first."
  shutdown -h now
  exit 0
fi

if [ -f "$HOME/.factory-env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.factory-env"
fi

echo "Running the factory job."
FACTORY_IMPLEMENTER="${FACTORY_IMPLEMENTER:-claude-code}" \
  bash /opt/factory/run-factory.sh || echo "run-factory.sh exited non-zero; see log above."

echo "Done. Shutting down."
shutdown -h now
