#!/usr/bin/env bash
# Deploys stop-on-budget/ as a Cloud Function subscribed to the budget's
# Pub/Sub topic, and grants its service account just enough permission to
# stop (not delete, not touch billing on) the factory VM.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
ZONE="${ZONE:-us-central1-a}"
INSTANCE_NAME="${INSTANCE_NAME:-eggmodels-factory-vm}"
TOPIC="eggmodels-factory-budget"
SA_NAME="factory-budget-killswitch"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT_ID" \
  --display-name="Stops the factory VM when the budget is exceeded" || true

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

gcloud functions deploy stop-eggmodels-factory-on-budget \
  --project="$PROJECT_ID" \
  --region="${ZONE%-*}" \
  --runtime=python312 \
  --source="$SCRIPT_DIR/stop-on-budget" \
  --entry-point=stop_vm_on_budget \
  --trigger-topic="$TOPIC" \
  --service-account="$SA_EMAIL" \
  --set-env-vars="PROJECT_ID=${PROJECT_ID},ZONE=${ZONE},INSTANCE_NAME=${INSTANCE_NAME}"

echo "Kill switch deployed: stops ${INSTANCE_NAME} the moment spend reaches the budget."
