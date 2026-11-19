#!/usr/bin/env bash
# Creates a service account + Cloud Scheduler job that starts the factory VM
# once a week. The VM's own startup script runs the job and shuts it back
# down, so this is the only thing that needs to fire on a schedule.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
ZONE="${ZONE:-us-central1-a}"
INSTANCE_NAME="${INSTANCE_NAME:-eggmodels-factory-vm}"
SA_NAME="factory-scheduler"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
REGION="${ZONE%-*}"   # e.g. us-central1-a -> us-central1 (Cloud Scheduler needs a region)

gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT_ID" \
  --display-name="Starts the factory VM on a schedule" || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/compute.instanceAdmin.v1" \
  --condition=None

gcloud scheduler jobs create http start-eggmodels-factory-vm \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 14 * * 1" \
  --uri="https://compute.googleapis.com/compute/v1/projects/${PROJECT_ID}/zones/${ZONE}/instances/${INSTANCE_NAME}/start" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL"

echo "Scheduled: Mondays 14:00 UTC, matching the previous weekly trigger's cadence."
echo "Change --schedule above (cron syntax, UTC) to adjust."
