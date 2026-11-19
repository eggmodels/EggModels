#!/usr/bin/env bash
# Creates a dedicated GCP project for the factory and links it to your
# existing billing account, so its spend (and budget) is isolated from
# egg-models. Skip this and reuse egg-models if you'd rather not.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID, e.g. eggmodels-factory}"
: "${BILLING_ACCOUNT:?Set BILLING_ACCOUNT to your billing account ID (gcloud billing accounts list)}"

gcloud projects create "$PROJECT_ID" --name="EggModels factory"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"

gcloud services enable \
  compute.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbilling.googleapis.com \
  cloudfunctions.googleapis.com \
  pubsub.googleapis.com \
  --project="$PROJECT_ID"

echo "Project $PROJECT_ID created and linked to billing account $BILLING_ACCOUNT."
