#!/usr/bin/env bash
# Weekly factory run: picks the next unchecked item from
# software-factory/BACKLOG.md, has an agent implement it, and opens a PR.
# Capped at one PR per run, matching the previous Claude-driven trigger.
#
# Implementer backend is chosen by $FACTORY_IMPLEMENTER:
#   claude-code (default) -- headless Claude Code, billed against your
#     Claude subscription via CLAUDE_CODE_OAUTH_TOKEN (see
#     setup-claude-code.sh). Subject to your plan's usage limits.
#   aider -- open source, billed per-token against $ANTHROPIC_API_KEY (see
#     setup-aider.sh).
#
# Either way, expects `gh` and `git` on PATH, and gh already authenticated
# (`gh auth login`, one-time, interactive).
#
# Every run is recorded to the `factory_runs` Firestore collection via
# record-run/record-run.mjs -- see software-factory/README.md#metrics. That
# write is best-effort: a missing/misconfigured FACTORY_FIRESTORE_SA_KEY_PATH
# logs a warning but never fails the run.
set -euo pipefail

WORKDIR="${FACTORY_WORKDIR:-$HOME/eggmodels-factory}"
IMPLEMENTER="${FACTORY_IMPLEMENTER:-claude-code}"
BACKLOG="software-factory/BACKLOG.md"
BASE_BRANCH="master"
RECORD_RUN_DIR="$WORKDIR/software-factory/self-hosted/record-run"
RECORD_RUN="$RECORD_RUN_DIR/record-run.mjs"
# Rough e2-small on-demand us-central1 rate, per gcp/README.md's cost
# estimate -- not metered per-run, just (run duration) x (this constant), so
# treat the resulting computeCostUsd as approximate. Override if your region
# or machine type differs.
VM_HOURLY_USD="${FACTORY_VM_HOURLY_USD:-0.021}"

# record-run.mjs needs firebase-admin installed in its own directory (see
# setup-record-run.sh); a fresh git pull of this repo won't have run that,
# so install on demand rather than relying on someone remembering the
# one-time step. Cheap no-op once node_modules already exists.
if [ ! -d "$RECORD_RUN_DIR/node_modules" ]; then
  (cd "$RECORD_RUN_DIR" && npm install --omit=dev) || \
    echo "run-factory.sh: couldn't install record-run's dependencies; run logging will be skipped this run."
fi

record() {
  # record <run-id> <json-merge-patch>
  node "$RECORD_RUN" "$1" "$2" || true
}

iso_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

cd "$WORKDIR"
git fetch origin "$BASE_BRANCH"
git checkout "$BASE_BRANCH"
git reset --hard "origin/$BASE_BRANCH"

RUN_ID="run-$(date +%Y%m%d-%H%M%S)"
STARTED_AT="$(iso_now)"

# First unchecked backlog item, e.g.:
#   - [ ] Centralize Cloud Functions URLs — Dashboard.js calls ...
ITEM_LINE="$(grep -m1 '^- \[ \]' "$BACKLOG" || true)"
if [ -z "$ITEM_LINE" ]; then
  echo "No unchecked backlog items in $BACKLOG. Add one before the next run."
  exit 0
fi

TITLE="$(echo "$ITEM_LINE" | sed -E 's/^- \[ \] ([^—]+)—.*/\1/' | sed -E 's/[[:space:]]+$//')"
SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed -E 's/^-+|-+$//g' | cut -c1-40)"
BRANCH="factory/${SLUG}-$(date +%Y%m%d)"

# Built with node rather than a shell heredoc so an arbitrary backlog line
# (quotes, em-dashes, etc.) gets properly JSON-escaped -- node is already a
# dependency of the recorder itself, so this adds nothing new.
record "$RUN_ID" "$(node -e '
  const item = process.argv[1];
  console.log(JSON.stringify({
    status: "running",
    backlogItem: item,
    branch: process.argv[2],
    implementer: process.argv[3],
    startedAt: process.argv[4],
  }));
' "${ITEM_LINE#- [ ] }" "$BRANCH" "$IMPLEMENTER" "$STARTED_AT")"

git checkout -b "$BRANCH"

PROMPT="Implement this backlog item from software-factory/BACKLOG.md, keeping the change small and low-risk: ${ITEM_LINE#- [ ] }

Do not touch functions/**, .github/workflows/**, firestore.rules, database.rules.json, firebase.json, or .firebaserc — those require manual review and would block auto-merge.

Once done, check this item off in software-factory/BACKLOG.md by changing its '[ ]' to '[x]', and commit your changes."

case "$IMPLEMENTER" in
  claude-code)
    # --dangerously-skip-permissions is only reasonable because this runs
    # unattended on a box you own, scoped to this one repo checkout.
    claude -p "$PROMPT" --dangerously-skip-permissions
    ;;
  aider)
    aider --yes --no-show-model-warnings --message "$PROMPT"
    ;;
  *)
    echo "Unknown FACTORY_IMPLEMENTER: $IMPLEMENTER (expected claude-code or aider)" >&2
    record "$RUN_ID" "{\"status\":\"failed\",\"endedAt\":\"$(iso_now)\"}"
    exit 1
    ;;
esac

if git diff --quiet "$BASE_BRANCH"; then
  echo "No changes made; skipping PR."
  record "$RUN_ID" "{\"status\":\"skipped_no_changes\",\"endedAt\":\"$(iso_now)\"}"
  git checkout "$BASE_BRANCH"
  git branch -D "$BRANCH"
  exit 0
fi

FILES_TOUCHED_JSON="$(git diff --name-only "$BASE_BRANCH" | node -e '
  const fs = require("fs");
  const files = fs.readFileSync(0, "utf8").trim().split("\n").filter(Boolean);
  process.stdout.write(JSON.stringify(files));
')"

# Scorer pass: a quick LLM-as-judge read of this run's own diff, before the
# PR opens. Best-effort like everything else here -- a judging failure
# shouldn't block the PR that's actually the point of the run.
SCORE_PROMPT="Look at this git branch's diff against $BASE_BRANCH (run git diff $BASE_BRANCH yourself). The backlog item being implemented was: ${ITEM_LINE#- [ ] }

Answer with ONLY a single-line compact JSON object, no other text, no markdown fences:
{\"stayedInScope\":bool,\"noRedundantTests\":bool,\"followedConventions\":bool}
- stayedInScope: false if the diff touches files/concerns unrelated to the backlog item.
- noRedundantTests: false if it added tests that duplicate existing coverage instead of covering new behavior.
- followedConventions: false if it ignored this repo's CLAUDE.md conventions (e.g. wrong state-management pattern, RTDB instead of Firestore, inline styles where a stylesheet convention exists)."

SCORE_OUTPUT="$(claude -p "$SCORE_PROMPT" --dangerously-skip-permissions 2>/dev/null | tail -n1 || true)"
if echo "$SCORE_OUTPUT" | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' >/dev/null 2>&1; then
  record "$RUN_ID" "{\"scores\":$SCORE_OUTPUT}"
else
  record "$RUN_ID" "$(node -e 'console.log(JSON.stringify({scoresRaw: process.argv[1]}))' "$SCORE_OUTPUT")"
fi

git push -u origin "$BRANCH"

PR_URL="$(gh pr create \
  --base "$BASE_BRANCH" \
  --head "$BRANCH" \
  --title "${TITLE}" \
  --label "factory-automated" \
  --body "Automated by the self-hosted software factory (implementer: ${IMPLEMENTER}; see software-factory/self-hosted/README.md).

Backlog item: ${ITEM_LINE#- [ ] }

Auto-merges once required CI checks pass, unless this diff touches a sensitive path (functions/**, workflow files, Firestore/RTDB rules) — see .github/workflows/factory-auto-merge.yml.

Run record: factory_runs/${RUN_ID} (see the /factory dashboard).")"

PR_NUMBER="$(echo "$PR_URL" | grep -oE '[0-9]+$')"
PR_OPENED_AT="$(iso_now)"
KICKOFF_TO_PR_MINUTES="$(( ( $(date -d "$PR_OPENED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$PR_OPENED_AT" +%s) - $(date -d "$STARTED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$STARTED_AT" +%s) ) / 60 ))"

record "$RUN_ID" "$(node -e '
  const minutes = Number(process.argv[5]);
  console.log(JSON.stringify({
    status: "completed",
    prNumber: Number(process.argv[1]),
    prUrl: process.argv[2],
    prOpenedAt: process.argv[3],
    endedAt: process.argv[3],
    filesTouched: JSON.parse(process.argv[4]),
    cycleTimeKickoffToPrMinutes: minutes,
    computeCostUsd: Math.round((minutes / 60) * Number(process.argv[6]) * 10000) / 10000,
  }));
' "$PR_NUMBER" "$PR_URL" "$PR_OPENED_AT" "$FILES_TOUCHED_JSON" "$KICKOFF_TO_PR_MINUTES" "$VM_HOURLY_USD")"

echo "Opened PR for: $TITLE ($PR_URL), run record factory_runs/${RUN_ID}"
