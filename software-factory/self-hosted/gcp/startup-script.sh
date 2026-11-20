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

# self-improve-trigger/ (see 06-schedule-self-improvement.sh) sets this
# metadata attribute right before starting the VM for the monthly
# self-improvement run. Read and clear it immediately, before doing any
# work, so a crash mid-run still leaves the VM defaulting to the normal
# weekly flow next time rather than getting stuck in self-improve mode.
FACTORY_MODE="$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/factory-mode" \
  2>/dev/null || echo "weekly")"

if [ "$FACTORY_MODE" = "self-improve" ]; then
  # Reset immediately (the VM's own service account has cloud-platform
  # scope, see 02-create-vm.sh) so a crash mid-run still leaves next boot
  # defaulting to the normal weekly flow instead of stuck in self-improve.
  ZONE_FULL="$(curl -s -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/zone")"
  gcloud compute instances remove-metadata "$(hostname)" \
    --zone="${ZONE_FULL##*/}" --keys=factory-mode \
    || echo "Could not clear factory-mode metadata; next boot may re-run self-improve."

  echo "Running the monthly self-improvement job as $FACTORY_USER."
  su - "$FACTORY_USER" -c "
    [ -f ~/.factory-env ] && . ~/.factory-env
    cd ~/eggmodels-factory && git pull --ff-only origin master
    bash software-factory/self-hosted/self-improve.sh
  " || echo "self-improve.sh exited non-zero; see log above."
else
  # .github/workflows/factory-trigger.yml sets this (base64 JSON:
  # {title, body, issueNumber}) right before starting the VM for an
  # on-demand request. Read and clear it immediately, same reasoning as
  # factory-mode above, then hand it to run-factory.sh as an env var --
  # it takes priority over BACKLOG.md for this one run.
  ON_DEMAND_REQUEST="$(curl -s -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/attributes/on-demand-request" \
    2>/dev/null || true)"
  if [ -n "$ON_DEMAND_REQUEST" ]; then
    ZONE_FULL="$(curl -s -H "Metadata-Flavor: Google" \
      "http://metadata.google.internal/computeMetadata/v1/instance/zone")"
    gcloud compute instances remove-metadata "$(hostname)" \
      --zone="${ZONE_FULL##*/}" --keys=on-demand-request \
      || echo "Could not clear on-demand-request metadata; it may be re-read next boot."
  fi

  echo "Syncing last run's outcome (merge/CI/review status) as $FACTORY_USER."
  su - "$FACTORY_USER" -c "
    [ -f ~/.factory-env ] && . ~/.factory-env
    cd ~/eggmodels-factory && git pull --ff-only origin master
    bash software-factory/self-hosted/sync-run-outcomes.sh
  " || echo "sync-run-outcomes.sh exited non-zero; see log above."

  echo "Running the factory job as $FACTORY_USER."
  su - "$FACTORY_USER" -c "
    [ -f ~/.factory-env ] && . ~/.factory-env
    FACTORY_ON_DEMAND_REQUEST='${ON_DEMAND_REQUEST}' FACTORY_IMPLEMENTER=\"\${FACTORY_IMPLEMENTER:-claude-code}\" bash /opt/factory/run-factory.sh
  " || echo "run-factory.sh exited non-zero; see log above."
fi

echo "Done. Shutting down."
shutdown -h now
