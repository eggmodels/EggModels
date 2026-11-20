#!/usr/bin/env bash
# Monthly self-improvement run: looks at recent factory_runs for a repeated
# scorer failure or recurring review friction, and opens a PR editing the
# factory's OWN definition (an agent prompt, BACKLOG.md's guidance, or
# software-factory/README.md) -- never the backlog item work itself.
#
# Labeled factory-self-improvement, not factory-automated, so
# .github/workflows/factory-auto-merge.yml never touches it -- this always
# waits for Eugenio's review, by construction, not just by convention.
#
# Needs the same FACTORY_FIRESTORE_SA_KEY_PATH as run-factory.sh to read run
# history; with no key (or no evidence of a repeated pattern), it does
# nothing rather than inventing a change to justify running.
set -euo pipefail

WORKDIR="${FACTORY_WORKDIR:-$HOME/eggmodels-factory}"
RECORD_RUN_DIR="$WORKDIR/software-factory/self-hosted/record-run"
KEY_PATH="${FACTORY_FIRESTORE_SA_KEY_PATH:-}"
BASE_BRANCH="master"

cd "$WORKDIR"
git fetch origin "$BASE_BRANCH"
git checkout "$BASE_BRANCH"
git reset --hard "origin/$BASE_BRANCH"

if [ -z "$KEY_PATH" ] || [ ! -f "$KEY_PATH" ]; then
  echo "self-improve.sh: FACTORY_FIRESTORE_SA_KEY_PATH not set or missing; no run history to learn from, skipping."
  exit 0
fi

# Same on-demand install as run-factory.sh -- see its comment for why.
if [ ! -d "$RECORD_RUN_DIR/node_modules" ]; then
  (cd "$RECORD_RUN_DIR" && npm install --omit=dev) || \
    echo "self-improve.sh: couldn't install record-run's dependencies; skipping."
fi

EVIDENCE_FILE="$(mktemp)"
# Run from record-run/, the only place firebase-admin is installed (its own
# package.json, kept separate from the app/functions dependency trees).
(cd "$RECORD_RUN_DIR" && node --input-type=module -e '
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(readFileSync(process.argv[1], "utf8"));
initializeApp({ credential: cert(serviceAccount), projectId: "egg-models" });
const db = getFirestore();

const snap = await db.collection("factory_runs").orderBy("startedAt", "desc").limit(50).get();
const runs = snap.docs.map((d) => {
  const data = d.data();
  return {
    runId: d.id,
    backlogItem: data.backlogItem,
    prNumber: data.prNumber,
    prUrl: data.prUrl,
    merged: data.merged,
    neededHumanReview: data.neededHumanReview,
    humanInteractions: data.humanInteractions,
    scores: data.scores,
    scoresRaw: data.scoresRaw,
  };
});

const withFriction = runs.filter(
  (r) => r.neededHumanReview === true || (r.scores && Object.values(r.scores).some((v) => v === false)),
);

console.log(JSON.stringify({ totalRuns: runs.length, runsWithFriction: withFriction }, null, 2));
' "$KEY_PATH") > "$EVIDENCE_FILE"

RUNS_WITH_FRICTION="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runsWithFriction.length)' "$EVIDENCE_FILE")"

if [ "$RUNS_WITH_FRICTION" -lt 3 ]; then
  echo "self-improve.sh: only $RUNS_WITH_FRICTION run(s) with scorer failures or review friction -- too little evidence for a reliable pattern, skipping this cycle."
  rm -f "$EVIDENCE_FILE"
  exit 0
fi

BRANCH="factory/self-improve-$(date +%Y%m%d)"
git checkout -b "$BRANCH"

PROMPT="You are reviewing the software factory's own track record to find ONE repeated
pattern and fix it. Evidence (recent runs with a scorer failure or that needed human
review) is in this JSON file: $EVIDENCE_FILE

1. Look for a pattern that shows up at least 3 times (e.g. the same scorer failing
   repeatedly, or review comments pointing at the same kind of mistake -- check the
   linked PRs with 'gh pr view <number> --json comments,reviews' for detail on WHY a
   human had to step in).
2. If you find one clear, specific pattern, make the smallest possible edit to fix it
   at the source: a .claude/agents/factory-*.md prompt, software-factory/BACKLOG.md's
   guidance text, or software-factory/README.md. Do not touch backlog items themselves,
   functions/**, .github/workflows/**, or any rules/config file.
3. If nothing is clear and repeated enough to act on, make NO changes and say why.
4. If you do make a change, commit it with a message citing the run IDs and/or PR
   numbers that showed the pattern."

claude -p "$PROMPT" --dangerously-skip-permissions
rm -f "$EVIDENCE_FILE"

if git diff --quiet "$BASE_BRANCH"; then
  echo "self-improve.sh: no change made this cycle."
  git checkout "$BASE_BRANCH"
  git branch -D "$BRANCH"
  exit 0
fi

git push -u origin "$BRANCH"

gh pr create \
  --base "$BASE_BRANCH" \
  --head "$BRANCH" \
  --title "Self-improvement: factory definition update" \
  --label "factory-self-improvement" \
  --body "Opened by the monthly self-improvement run (software-factory/self-hosted/self-improve.sh) after finding a repeated pattern across recent factory_runs.

This is a change to the factory's OWN definition (an agent prompt, backlog guidance, or README), not a site change. Labeled factory-self-improvement, not factory-automated, so it will NOT auto-merge -- see software-factory/README.md#self-improvement-loop. Please review."

echo "Opened self-improvement PR."
