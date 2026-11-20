#!/usr/bin/env bash
# Creates the factory's VM, stopped, with a minimal footprint: e2-small,
# a 10GB standard (cheap) disk, no reserved/static IP. It starts up only
# when Cloud Scheduler tells it to (see 03-schedule-weekly-run.sh).
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
ZONE="${ZONE:-us-central1-a}"
INSTANCE_NAME="${INSTANCE_NAME:-eggmodels-factory-vm}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gcloud compute instances create "$INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --zone="$ZONE" \
  --machine-type=e2-small \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=10GB \
  --boot-disk-type=pd-standard \
  --network-tier=STANDARD \
  --metadata-from-file=startup-script="$SCRIPT_DIR/startup-script.sh" \
  --scopes=cloud-platform

# run-factory.sh is passed as metadata; the startup script re-reads it from
# here on every boot, so updating it is just re-running this add-metadata
# call (no SSH or disk copy needed) before the next scheduled start.
gcloud compute instances add-metadata "$INSTANCE_NAME" \
  --project="$PROJECT_ID" --zone="$ZONE" \
  --metadata-from-file=run-factory-script="$SCRIPT_DIR/../run-factory.sh"

cat <<'EOF'

VM created. Its first boot ran, installed dependencies, and shut itself
down automatically -- stopped is this VM's normal resting state.

One-time manual step before the weekly schedule can work unattended (the
repo isn't cloned and nothing is authenticated yet). Do this as the
'factory' user, NOT root -- Claude Code refuses to run unattended as root:
  gcloud compute instances start eggmodels-factory-vm --zone=us-central1-a
  gcloud compute ssh eggmodels-factory-vm --zone=us-central1-a
    sudo su - factory
    gh auth login
    git clone https://github.com/eggmodels/EggModels.git ~/eggmodels-factory
    claude setup-token   # if using the default claude-code implementer
  gcloud compute instances stop eggmodels-factory-vm --zone=us-central1-a
EOF
