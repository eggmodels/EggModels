#!/usr/bin/env bash
# Fills in the outcome fields that aren't knowable right when a PR opens:
# did CI pass first try, did it get merged, how many times did a human
# comment on it, how long from PR-open to merge. Run this at the start of
# each weekly factory cycle (before run-factory.sh picks the next item) so
# last week's run record gets closed out once GitHub has settled.
#
# Reads factory_runs where status == "completed" and merged is unset, looks
# up each one's PR via `gh`, and patches the record. Best-effort throughout:
# a single PR lookup failing logs a warning and moves on to the next one.
set -euo pipefail

WORKDIR="${FACTORY_WORKDIR:-$HOME/eggmodels-factory}"
RECORD_RUN="$WORKDIR/software-factory/self-hosted/record-run/record-run.mjs"
KEY_PATH="${FACTORY_FIRESTORE_SA_KEY_PATH:-}"

cd "$WORKDIR"

if [ -z "$KEY_PATH" ] || [ ! -f "$KEY_PATH" ]; then
  echo "sync-run-outcomes.sh: FACTORY_FIRESTORE_SA_KEY_PATH not set or missing; nothing to read, skipping."
  exit 0
fi

# Pending runs: fetched via a tiny inline node script using the same
# firebase-admin install as record-run.mjs, since there's no `gh`-equivalent
# for querying Firestore. Run from record-run/, the only place firebase-admin
# is installed.
PENDING_JSON="$(cd "$(dirname "$RECORD_RUN")" && node --input-type=module -e '
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(readFileSync(process.argv[1], "utf8"));
initializeApp({ credential: cert(serviceAccount), projectId: "egg-models" });
const db = getFirestore();

const snap = await db.collection("factory_runs").where("status", "==", "completed").get();
const pending = snap.docs
  .filter((d) => d.data().merged === undefined && d.data().prNumber)
  .map((d) => ({ runId: d.id, prNumber: d.data().prNumber, prOpenedAt: d.data().prOpenedAt?.toDate?.().toISOString() }));
console.log(JSON.stringify(pending));
' "$KEY_PATH")"

echo "$PENDING_JSON" | node -e '
  const pending = JSON.parse(require("fs").readFileSync(0, "utf8"));
  for (const p of pending) console.log(p.runId, p.prNumber);
' | while read -r RUN_ID PR_NUMBER; do
  [ -z "$RUN_ID" ] && continue

  PR_JSON="$(gh pr view "$PR_NUMBER" --json state,mergedAt,reviews,comments,statusCheckRollup 2>/dev/null || echo "{}")"
  if [ "$PR_JSON" = "{}" ]; then
    echo "sync-run-outcomes.sh: couldn't fetch PR #$PR_NUMBER for $RUN_ID, skipping."
    continue
  fi

  PR_OPENED_AT="$(echo "$PENDING_JSON" | node -e "
    const pending = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const match = pending.find((p) => p.runId === process.argv[1]);
    process.stdout.write(match?.prOpenedAt ?? '');
  " "$RUN_ID")"

  PATCH="$(node -e '
    const pr = JSON.parse(process.argv[1]);
    const prOpenedAt = process.argv[2];
    const merged = pr.state === "MERGED";
    const reviewComments = (pr.reviews ?? []).filter((r) => r.body && r.body.trim() !== "").length;
    const issueComments = (pr.comments ?? []).length;
    const humanInteractions = reviewComments + issueComments;
    const checks = pr.statusCheckRollup ?? [];
    const ciPassedFirstTry = checks.length > 0 && checks.every((c) => c.conclusion === "SUCCESS");

    const patch = {
      merged,
      humanInteractions,
      neededHumanReview: humanInteractions > 0,
      scores: { ciPassedFirstTry },
    };
    if (merged && pr.mergedAt) {
      patch.mergedAt = pr.mergedAt;
      if (prOpenedAt) {
        patch.cycleTimePrToMergeMinutes = Math.round(
          (new Date(pr.mergedAt).getTime() - new Date(prOpenedAt).getTime()) / 60000,
        );
      }
    }
    process.stdout.write(JSON.stringify(patch));
  ' "$PR_JSON" "$PR_OPENED_AT")"

  node "$RECORD_RUN" "$RUN_ID" "$PATCH" || true
  echo "sync-run-outcomes.sh: updated $RUN_ID from PR #$PR_NUMBER"
done
