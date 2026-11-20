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

# New service accounts can take a few seconds to propagate; retry both the
# existence check and the binding itself rather than failing on the first try.
echo "Waiting for $SA_EMAIL to propagate..."
for i in $(seq 1 10); do
  if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

for i in $(seq 1 5); do
  if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="roles/compute.instanceAdmin.v1" \
      --condition=None >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 5 ]; then
    echo "Still failing to bind IAM policy after retries. Wait ~30s and re-run:" >&2
    echo "  gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA_EMAIL --role=roles/compute.instanceAdmin.v1 --condition=None" >&2
    exit 1
  fi
  echo "Retrying IAM binding ($i/5)..."
  sleep 5
done

gcloud scheduler jobs create http start-eggmodels-factory-vm \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 14 * * 1" \
  --uri="https://compute.googleapis.com/compute/v1/projects/${PROJECT_ID}/zones/${ZONE}/instances/${INSTANCE_NAME}/start" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL" || \
  echo "If this failed because the job already exists, it's already scheduled -- nothing more to do."

echo "Scheduled: Mondays 14:00 UTC, matching the previous weekly trigger's cadence."
echo "Change --schedule above (cron syntax, UTC) to adjust."
