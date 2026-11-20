#!/usr/bin/env bash
# One-time setup for run logging: installs record-run.mjs's dependencies,
# and tells you what to do about its service-account key (that part has to
# be you -- see software-factory/self-hosted/gcp/README.md, "Factory
# run-logging service account").
set -euo pipefail

WORKDIR="${FACTORY_WORKDIR:-$HOME/eggmodels-factory}"

cd "$WORKDIR/software-factory/self-hosted/record-run"
npm install --omit=dev

echo
echo "record-run.mjs dependencies installed."
echo "Still needed, once per VM, by hand:"
echo "  1. Create a service account in the egg-models GCP project scoped to"
echo "     Firestore only (roles/datastore.user), download its JSON key."
echo "  2. Copy the key onto this VM, e.g. ~/factory-firestore-key.json,"
echo "     readable only by the factory user: chmod 600"
echo "  3. echo 'export FACTORY_FIRESTORE_SA_KEY_PATH=/home/factory/factory-firestore-key.json' >> ~/.factory-env"
echo
echo "Without that, run-factory.sh still works -- it just logs a warning and"
echo "skips writing to factory_runs each time."
