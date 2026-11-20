#!/usr/bin/env bash
# GCE metadata startup-script: runs on every boot, as root (GCE default).
# First boot installs dependencies and creates a dedicated non-root user,
# since Claude Code refuses --dangerously-skip-permissions when run as
# root. Every boot (including the first) runs the factory job as that
# user, then shuts the VM down -- so it only ever runs as long as one job
# takes.
set -euo pipefail
exec > >(tee -a /var/log/factory-startup.log) 2>&1
echo "=== startup-script run at $(date) ==="

FACTORY_USER=factory
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
  apt-get install -y git curl sudo

  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  npm install -g @anthropic-ai/claude-code   # system-wide; usable by any user

  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update
  apt-get install -y gh pipx

  id -u "$FACTORY_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$FACTORY_USER"
  su - "$FACTORY_USER" -c "pipx ensurepath && pipx install aider-chat" || true

  touch "$MARKER"
  echo "First-boot install done. SSH in now as root, then 'su - $FACTORY_USER',"
  echo "and run 'gh auth login' and 'claude setup-token' as that user before"
  echo "relying on the weekly schedule -- see gcp/README.md. Skipping the"
  echo "factory run and shutting down."
  shutdown -h now
  exit 0
fi

FACTORY_HOME="/home/$FACTORY_USER"
if [ ! -d "$FACTORY_HOME/eggmodels-factory" ]; then
  echo "Repo not cloned yet -- finish the one-time manual setup (gh auth," \
       "git clone, claude setup-token, as the '$FACTORY_USER' user)" \
       "described in gcp/README.md first."
  shutdown -h now
  exit 0
fi

echo "Running the factory job as $FACTORY_USER."
su - "$FACTORY_USER" -c "
  [ -f ~/.factory-env ] && . ~/.factory-env
  FACTORY_IMPLEMENTER=\"\${FACTORY_IMPLEMENTER:-claude-code}\" bash /opt/factory/run-factory.sh
" || echo "run-factory.sh exited non-zero; see log above."

echo "Done. Shutting down."
shutdown -h now
