#!/usr/bin/env bash
# Creates a service account scoped to just "start this one VM", and a key
# for it, so the on-demand GitHub Action (.github/workflows/factory-trigger.yml)
# can start the factory VM without any broader GCP access. Unlike the other
# service accounts in this directory (which authenticate as themselves via
# OIDC/Scheduler), this one needs an exported key because GitHub Actions
# authenticates with google-github-actions/auth, which takes a key directly.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
SA_NAME="factory-github-trigger"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="${KEY_FILE:-factory-github-trigger-key.json}"

gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT_ID" \
  --display-name="Starts the factory VM from a GitHub Actions trigger" || true

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

gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT_ID"

echo
echo "Key written to $KEY_FILE -- it's a credential, don't paste its contents anywhere."
echo "Add it as a GitHub Actions secret named GCP_FACTORY_TRIGGER_SA_KEY:"
echo
echo "  gh secret set GCP_FACTORY_TRIGGER_SA_KEY --repo eggmodels/EggModels < $KEY_FILE"
echo
echo "Then delete the local copy:"
echo "  shred -u $KEY_FILE   # or: rm -f $KEY_FILE"
