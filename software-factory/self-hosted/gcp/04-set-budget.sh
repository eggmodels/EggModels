#!/usr/bin/env bash
# Creates a monthly budget on this project with email alerts at 50/90/100%,
# and a Pub/Sub topic carrying every budget update (used by
# 05-deploy-kill-switch.sh). Alerts alone don't stop spend -- they just
# notify; the kill switch is what actually acts.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${BILLING_ACCOUNT:?Set BILLING_ACCOUNT}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-10}"
TOPIC="eggmodels-factory-budget"

gcloud pubsub topics create "$TOPIC" --project="$PROJECT_ID" || true

gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="eggmodels-factory monthly cap" \
  --budget-amount="${BUDGET_AMOUNT}USD" \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0,basis=current-spend \
  --filter-projects="projects/${PROJECT_ID}" \
  --notifications-rule-pubsub-topic="projects/${PROJECT_ID}/topics/${TOPIC}"
# Email alerts go to billing account admins/users by default -- add
# --notifications-rule-monitoring-notification-channels=<channel-id> for
# other recipients (gcloud alpha monitoring channels list).

echo "Budget created: \$${BUDGET_AMOUNT}/mo cap on ${PROJECT_ID}, alerts at 50/90/100%."
echo "Run 05-deploy-kill-switch.sh to also auto-stop the VM at 100%."
