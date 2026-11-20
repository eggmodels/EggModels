# Running the factory on Google Cloud (cost-capped)

This replaces "any VPS" from the main `../README.md` with a concrete, cheap,
mostly-off GCP setup: an **e2-small VM that is stopped except for ~1 hour a
week**, started by Cloud Scheduler, running the factory job once, then
shutting itself down. No self-hosted GitHub Actions runner is used — CI and
`factory-auto-merge.yml` keep running on GitHub's free-tier hosted runners,
since those are lightweight and free, and avoiding an always-on runner is
most of the cost savings here.

## Estimated cost

With the VM stopped ~167 hours/week and running ~1 hour/week:
- Compute (e2-small, us-central1, ~4 hrs/mo running): **< $0.25/mo**
- Boot disk (10GB pd-standard, billed whether running or stopped): **~$0.40/mo**
- Ephemeral external IP (only billed while running): **~$0.01/mo**
- **Total: well under $1/mo** in steady state, before any LLM usage.

A budget + alert (below) is a safety net against a bug that leaves the VM
running, not the main cost control — the schedule itself is.

## Which GCP project

Recommend a **new, dedicated project** (`eggmodels-factory` below) rather
than reusing the existing `egg-models` Firebase project:
- A budget alert on a dedicated project means 100% = this VM, unambiguous.
- On `egg-models`, the same budget would also include Firebase/Functions/
  Firestore spend, making alerts noisy and the "stop the VM" kill switch
  below pointless (it can't touch Firebase costs anyway).
- Costs one extra `gcloud projects create`, linked to the same billing
  account you already use for `egg-models`.

If you'd rather keep everything in one project, every script below still
works against `egg-models` — just skip `01-create-project.sh` and pass
`egg-models` as `PROJECT_ID` to the rest.

## What only you can do

- Have (or create) a GCP **billing account**, and know its ID
  (`gcloud billing accounts list`).
- Run `gcloud auth login` once, interactively, with your own Google account
  that has permission to create projects/billing budgets on that account.
- Decide the budget cap (default below: $10/mo) and who gets the alert
  emails (defaults to project owners/billing admins).
- Generate the one-time tokens these scripts can't: a GitHub token for `gh`,
  and (if using the default `claude-code` implementer) run `claude
  setup-token` interactively on the VM once.

## Setup

```bash
cd gcp
export PROJECT_ID=eggmodels-factory
export BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX   # gcloud billing accounts list
export BUDGET_AMOUNT=10                       # USD/month cap

./01-create-project.sh
./02-create-vm.sh
./03-schedule-weekly-run.sh
./04-set-budget.sh
./05-deploy-kill-switch.sh   # optional but recommended: auto-stops the VM
                              # if spend ever exceeds the budget
```

`02-create-vm.sh` creates the VM, with `startup-script.sh` and `run-factory.sh`
passed in as instance metadata (no disk image baking needed). Creation briefly
starts it once to install dependencies and create a non-root `factory` user,
then it shuts itself back down.

### One-time manual step, as the `factory` user

Claude Code refuses to run `--dangerously-skip-permissions` as root, so the
job runs as a dedicated `factory` user, not root -- do the one-time
interactive setup as that user too:

```bash
gcloud compute instances start eggmodels-factory-vm --zone=us-central1-a
gcloud compute ssh eggmodels-factory-vm --zone=us-central1-a
  sudo su - factory
  gh auth login
  git clone https://github.com/eggmodels/EggModels.git ~/eggmodels-factory
  claude setup-token   # if using the default claude-code implementer
```

`claude setup-token` prints a token on its last line. The startup script
sources `~/.factory-env` (i.e. `/home/factory/.factory-env`) as the `factory`
user right before running the job, so save it there, still as `factory`:

```bash
echo 'export CLAUDE_CODE_OAUTH_TOKEN=paste-the-printed-token-here' >> ~/.factory-env
chmod 600 ~/.factory-env
```

If you're using the `aider` implementer instead (`FACTORY_IMPLEMENTER=aider`),
put your Anthropic/OpenAI API key in the same file the same way:
`export ANTHROPIC_API_KEY=...`.

Then exit back out and stop the VM:

```bash
exit        # back to root
exit        # back to Cloud Shell
gcloud compute instances stop eggmodels-factory-vm --zone=us-central1-a
```

After that, `03-schedule-weekly-run.sh`'s Cloud Scheduler job starts the VM
unattended every week; the startup script runs the factory job as `factory`
non-interactively and shuts the VM down when it's done (success or failure),
so it never runs longer than one job takes.

## Kill switch

`04-set-budget.sh` creates a budget with email alerts at 50/90/100% of
`BUDGET_AMOUNT` — informational, sent to billing admins. `05-deploy-kill-switch.sh`
additionally wires that budget's Pub/Sub notifications to a small Cloud
Function (`stop-on-budget/`) that stops the VM (not your billing account or
GitHub/Anthropic access) the moment actual spend reaches 100% of the cap. It
only ever stops *this* project's VM, so it can't affect `egg-models` or
anything else on the same billing account.
