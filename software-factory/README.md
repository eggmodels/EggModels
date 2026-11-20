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
[`factory-self-improver.md`](../.claude/agents/factory-self-improver.md) is
a fourth role, used only by the monthly self-improvement loop below.

## Metrics

Every run of `software-factory/self-hosted/run-factory.sh` writes a document
to the `factory_runs` Firestore collection in `egg-models`
(`software-factory/self-hosted/record-run/record-run.mjs`), and
`sync-run-outcomes.sh` fills in what isn't known yet when the PR opens (CI
pass/fail, merged, human review comments, PR→merge time) a few days later,
once GitHub has settled. See [`src/types/factory.ts`](../src/types/factory.ts)
for the full shape of a run record.

Each run's diff also gets a quick LLM-as-judge pass before the PR opens
(stayed in scope / no redundant tests / followed repo conventions), stored
under `scores` on the same record.

The `/factory` page (unlisted, like `/performance`) reads this collection
directly and shows Productivity, Spending, and Scorers tabs. Spending is
compute cost only (`FACTORY_VM_HOURLY_USD` × run duration) against the
$10/mo cap in `gcp/README.md` — per-run token cost isn't obtainable from a
Claude subscription the way it would be from a metered API key, so that
field stays absent rather than showing a fabricated number.

Writes to `factory_runs` require a dedicated Firestore-scoped service
account on the VM — see `gcp/README.md`, "Factory run-logging service
account". Nothing about picking, implementing, or opening PRs depends on
it; a missing key just means the run isn't recorded.

## Self-improvement loop

Separately from the weekly backlog cycle, a monthly job
(`software-factory/self-hosted/self-improve.sh`, scheduled by
`gcp/06-schedule-self-improvement.sh`) reads recent `factory_runs` for a
repeated scorer failure or recurring review friction (the same kind of
mistake showing up 3+ times, not a handful of unrelated one-offs), and —
only if it finds one — opens a PR editing the factory's own definition: an
agent prompt in `.claude/agents/`, `BACKLOG.md`'s guidance text, or this
README, following the `factory-self-improver` role.

That PR is labeled `factory-self-improvement`, which
`.github/workflows/factory-auto-merge.yml` doesn't listen for (it only
watches `factory-automated`) — so it **always** waits for Eugenio's review,
by construction, not just by policy. If no clear pattern exists yet, the
job makes no change and does nothing further that cycle.

## Changing the factory

- **Backlog**: edit `BACKLOG.md` directly, or ask the project thread to add
  an idea.
- **Cadence / autonomy**: ask the project thread to update the scheduled
  trigger; this README is the source of truth it should stay in sync with.
- **Sensitive-path list**: edit the `PATTERN` in `factory-auto-merge.yml`.
- **Pause everything**: disable the scheduled trigger; the auto-merge
  workflow is harmless with nothing feeding it `factory-automated` PRs.
