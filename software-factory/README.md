# Software factory

How EggModels keeps getting small improvements between asks, defined as code
instead of only as settings tucked away in a Claude project.

## What runs, and where

- **Cadence and picking logic** live in a Claude Code scheduled trigger
  (weekly, Mondays ~14:47 UTC) that wakes this project's "Set up recurring
  site improvement automation" thread with full project context. The
  trigger itself isn't a file in this repo — Claude Code's scheduler is
  project infrastructure, not a GitHub Action — but everything it decides
  against is defined here instead, so the policy survives even if that
  specific trigger or thread is deleted.
- Each run:
  1. Picks exactly one unchecked item from [`BACKLOG.md`](./BACKLOG.md) (or
     adds a similarly scoped idea if the backlog is empty), following the
     `factory-picker` role in [`.claude/agents/`](../.claude/agents/).
  2. Implements it with `factory-implementer`, and verifies build/tests.
  3. Opens one PR labeled `factory-automated`, with the required
     attribution, Eugenio assigned and requested as reviewer.
  4. Checks off the backlog item with a link to the PR once it's open.
- Capped at **one PR per run** — this is about steady, reviewable
  improvement, not a flood of changes.

## Auto-merge policy

[`.github/workflows/factory-auto-merge.yml`](../.github/workflows/factory-auto-merge.yml)
enforces this as code instead of leaving it as a verbal policy:

- A PR labeled `factory-automated` auto-merges once the required CI checks
  (`dependency-audit`, `unit-tests`, `smoke-test` from `ci.yml`) pass —
  **unless** it touches:
  - `functions/**` (Cloud Functions, secrets, auth)
  - `.github/workflows/**` (CI/CD config)
  - `firestore.rules`, `database.rules.json`, `firebase.json`, `.firebaserc`
    (security rules / deploy config)
- If it touches any of those, the workflow comments on the PR instead of
  enabling auto-merge, and it waits for Eugenio's review like any other PR.
- This repo needs **"Allow auto-merge"** turned on under Settings → General
  for the workflow's `gh pr merge --auto` to take effect; branch protection
  on `master` still gates the actual merge on the required status checks.

## Roles

[`.claude/agents/factory-picker.md`](../.claude/agents/factory-picker.md),
[`factory-implementer.md`](../.claude/agents/factory-implementer.md), and
[`factory-reviewer.md`](../.claude/agents/factory-reviewer.md) define the
three steps above as reusable Claude Code subagents. They're the same shape
as the 2026-09-17 batch of 7 parallel-agent PRs, so a thread can spin up
several of these at once for a larger backlog push instead of one at a time.

## Changing the factory

- **Backlog**: edit `BACKLOG.md` directly, or ask the project thread to add
  an idea.
- **Cadence / autonomy**: ask the project thread to update the scheduled
  trigger; this README is the source of truth it should stay in sync with.
- **Sensitive-path list**: edit the `PATTERN` in `factory-auto-merge.yml`.
- **Pause everything**: disable the scheduled trigger; the auto-merge
  workflow is harmless with nothing feeding it `factory-automated` PRs.
