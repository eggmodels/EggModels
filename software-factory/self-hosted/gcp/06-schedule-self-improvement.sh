#!/usr/bin/env bash
# Deploys self-improve-trigger/ (an HTTP Cloud Function that flags the next
# VM boot as a self-improvement run, then starts it) and a monthly Cloud
# Scheduler job that calls it. Separate from 03-schedule-weekly-run.sh's
# direct Compute API call, because this one needs to set instance metadata
# first -- see self-improve-trigger/main.py for why that can't be a plain
# Scheduler HTTP target.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
ZONE="${ZONE:-us-central1-a}"
INSTANCE_NAME="${INSTANCE_NAME:-eggmodels-factory-vm}"
REGION="${ZONE%-*}"
SA_NAME="factory-self-improve"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT_ID" \
  --display-name="Triggers monthly self-improvement runs" || true

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

gcloud functions deploy trigger-eggmodels-self-improvement \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --runtime=python312 \
  --source="$SCRIPT_DIR/self-improve-trigger" \
  --entry-point=trigger_self_improvement \
  --trigger-http \
  --no-allow-unauthenticated \
  --service-account="$SA_EMAIL" \
  --set-env-vars="PROJECT_ID=${PROJECT_ID},ZONE=${ZONE},INSTANCE_NAME=${INSTANCE_NAME}"

FUNCTION_URL="$(gcloud functions describe trigger-eggmodels-self-improvement \
  --project="$PROJECT_ID" --region="$REGION" --format="value(serviceConfig.uri)")"

gcloud scheduler jobs create http trigger-eggmodels-self-improvement \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 13 1 * *" \
  --uri="$FUNCTION_URL" \
  --http-method=POST \
  --oidc-service-account-email="$SA_EMAIL" || \
  echo "If this failed because the job already exists, it's already scheduled -- nothing more to do."

echo "Scheduled: 1st of each month, 13:00 UTC (an hour before the weekly run's slot, so the"
echo "two never overlap on a day they'd coincide). Change --schedule above to adjust."
