#!/usr/bin/env bash
# Weekly factory run: picks the next unchecked item from
# software-factory/BACKLOG.md, has aider implement it, and opens a PR.
# Capped at one PR per run, matching the previous Claude-driven trigger.
#
# Expects: $ANTHROPIC_API_KEY set (source ~/.factory-env before this script,
# or export it in the crontab line), `aider`, `gh`, and `git` on PATH, and gh
# already authenticated (`gh auth login`, one-time, interactive).
set -euo pipefail

WORKDIR="${FACTORY_WORKDIR:-$HOME/eggmodels-factory}"
BACKLOG="software-factory/BACKLOG.md"
BASE_BRANCH="master"

cd "$WORKDIR"
git fetch origin "$BASE_BRANCH"
git checkout "$BASE_BRANCH"
git reset --hard "origin/$BASE_BRANCH"

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

git checkout -b "$BRANCH"

aider \
  --yes \
  --no-show-model-warnings \
  --message "Implement this backlog item from software-factory/BACKLOG.md, keeping the change small and low-risk: ${ITEM_LINE#- [ ] }

Do not touch functions/**, .github/workflows/**, firestore.rules, database.rules.json, firebase.json, or .firebaserc — those require manual review and would block auto-merge.

Once done, check this item off in software-factory/BACKLOG.md by changing its '[ ]' to '[x]'."

if git diff --quiet "$BASE_BRANCH"; then
  echo "aider made no changes; skipping PR."
  git checkout "$BASE_BRANCH"
  git branch -D "$BRANCH"
  exit 0
fi

git push -u origin "$BRANCH"

gh pr create \
  --base "$BASE_BRANCH" \
  --head "$BRANCH" \
  --title "${TITLE}" \
  --label "factory-automated" \
  --body "Automated by the self-hosted software factory (see software-factory/self-hosted/README.md).

Backlog item: ${ITEM_LINE#- [ ] }

Auto-merges once required CI checks pass, unless this diff touches a sensitive path (functions/**, workflow files, Firestore/RTDB rules) — see .github/workflows/factory-auto-merge.yml."

echo "Opened PR for: $TITLE"
