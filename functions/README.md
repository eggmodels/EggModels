# Cloud Functions for Tennis Odds

## Overview

This directory contains the automated tennis odds prediction pipeline that runs daily on Google Cloud.

## Structure

```
functions/
├── tennis_odds/
│   ├── main.py           # Cloud Function implementation
│   └── requirements.txt   # Python dependencies
├── DEPLOYMENT.md         # Complete deployment guide
└── README.md            # This file
```

## What It Does

The `tennis_odds` function:

1. **Scrapes Elo ratings** from TennisAbstract (ATP & WTA)
2. **Fetches upcoming matches** from Kalshi API
3. **Calculates win probabilities** using surface-specific Elo ratings
4. **Writes results** to Firestore at `tennis_odds/current`
5. **Runs on schedule** daily at midnight UTC via Cloud Scheduler

## Quick Start

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete setup instructions.

In short:

```bash
# 1. Add Kalshi credentials to Secret Manager
echo -n "YOUR_KALSHI_API_KEY" | gcloud secrets create kalshi-api-key --data-file=-
echo -n "YOUR_KALSHI_PRIVATE_KEY" | gcloud secrets create kalshi-private-key --data-file=-

# 2. Deploy the function
cd tennis_odds
gcloud functions deploy tennis-odds-pipeline \
  --runtime python312 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point run_tennis_odds \
  --timeout 540 \
  --memory 512MB

# 3. Set up daily scheduler
gcloud scheduler jobs create http tennis-odds-daily \
  --location us-central1 \
  --schedule "0 0 * * *" \
  --http-method GET \
  --uri https://us-central1-egg-models.cloudfunctions.net/tennis-odds-pipeline \
  --tz UTC
```

Or just run `./deploy.sh` (Mac/Linux) or `deploy.bat` (Windows) from the `functions/` directory — it handles everything interactively.

## Output

The function writes to Firestore at `tennis_odds/current`:

```json
{
  "timestamp": "2025-07-13T00:15:30.123456Z",
  "matches": [
    {
      "Player 1": "aryna sabalenka",
      "Player 2": "marketa vondrousova",
      "Player 1 Win Probability": 0.838,
      "Player 2 Win Probability": 0.162
    }
  ]
}
```

## Website Integration

The React Tennis component reads from `tennis_odds/current` and displays win probabilities. No computation happens on the client.

## Monitoring

Check Cloud Function logs:

```bash
gcloud functions logs read tennis-odds-pipeline --limit 50
```

Trigger a manual run:

```bash
gcloud scheduler jobs run tennis-odds-daily --location us-central1
```

Check Firestore for the latest results:

```bash
gcloud firestore documents list tennis_odds
```

## API Keys

Kalshi credentials are stored in Google Cloud Secret Manager:
- `kalshi-api-key` — Kalshi API key
- `kalshi-private-key` — Kalshi private key

Do **not** commit keys to git. See DEPLOYMENT.md for how to set them up securely.
