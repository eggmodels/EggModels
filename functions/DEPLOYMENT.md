# Tennis Odds Pipeline Deployment Guide

This guide walks through deploying the automated tennis odds prediction pipeline to Google Cloud. The pipeline scrapes tennis player Elo ratings, fetches upcoming matches from Kalshi, calculates win probabilities, and writes the results to Firestore for the website to display.

## Prerequisites

- GCP project: `egg-models`
- Firebase with Firestore enabled
- gcloud CLI installed and authenticated
- Kalshi API credentials (API key + private key)

## Step 1: Store API Keys in Secret Manager

```bash
# Store Kalshi API key
echo -n "YOUR_KALSHI_API_KEY" | gcloud secrets create kalshi-api-key --data-file=-

# Store Kalshi private key
echo -n "YOUR_KALSHI_PRIVATE_KEY" | gcloud secrets create kalshi-private-key --data-file=-
```

### Verify secrets were created:

```bash
gcloud secrets list
```

You should see both `kalshi-api-key` and `kalshi-private-key` listed.

## Step 2: Grant Cloud Function Permissions to Secrets

Get the Cloud Function's default service account:

```bash
PROJECT_NUMBER=$(gcloud projects describe egg-models --format='value(projectNumber)')
CLOUD_FUNCTION_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

Grant the service account access to the secrets:

```bash
gcloud secrets add-iam-policy-binding kalshi-api-key \
  --member="serviceAccount:${CLOUD_FUNCTION_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding kalshi-private-key \
  --member="serviceAccount:${CLOUD_FUNCTION_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 3: Deploy Cloud Function

```bash
cd functions/tennis_odds

gcloud functions deploy tennis-odds-pipeline \
  --runtime python312 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point run_tennis_odds \
  --timeout 540 \
  --memory 512MB \
  --project egg-models
```

Note the function URL returned — you'll need it for Cloud Scheduler.

## Step 4: Set Up Cloud Scheduler

Create a Cloud Scheduler job to trigger the function daily at midnight UTC:

```bash
gcloud scheduler jobs create http tennis-odds-daily \
  --location us-central1 \
  --schedule "0 0 * * *" \
  --http-method GET \
  --uri https://us-central1-egg-models.cloudfunctions.net/tennis-odds-pipeline \
  --tz UTC \
  --project egg-models
```

### Find your Cloud Function URL:

```bash
gcloud functions describe tennis-odds-pipeline --project egg-models
```

Look for the `httpsTrigger.url` field.

### Verify the job was created:

```bash
gcloud scheduler jobs list --location us-central1 --project egg-models
```

## Step 5: Test the Pipeline

### Option A: Manual trigger via Cloud Scheduler

```bash
gcloud scheduler jobs run tennis-odds-daily --location us-central1 --project egg-models
```

### Option B: Direct HTTP call

```bash
curl -X GET https://us-central1-egg-models.cloudfunctions.net/tennis-odds-pipeline
```

### Check logs:

```bash
gcloud functions logs read tennis-odds-pipeline --limit 50 --project egg-models
```

## Step 6: Verify Firestore Output

Go to the [Firebase Console](https://console.firebase.google.com/) → **Firestore Database** and look for the collection `tennis_odds` with a document `current`. The structure will be:

```
tennis_odds/
  current/
    timestamp: <ISO datetime>
    matches: [
      {
        "Player 1": "aryna sabalenka",
        "Player 2": "marketa vondrousova",
        "Player 1 Win Probability": 0.838,
        "Player 2 Win Probability": 0.162
      },
      ...
    ]
```

## Troubleshooting

### Function times out
- Increase the `--timeout` flag (max 540 seconds)
- Check Cloud Function logs for detailed error messages

### "Secret not found" error
- Verify secrets exist: `gcloud secrets list`
- Verify permissions: `gcloud secrets get-iam-policy kalshi-api-key`

### No matches in output
- Check if Kalshi has active tennis markets for today or tomorrow
- The output is filtered to today and tomorrow only
- Check Cloud Function logs for the Kalshi API response

### Firestore write fails
- Verify the service account has `Firestore User` role
- Check Firestore security rules allow writes
- Ensure the `tennis_odds` collection exists in Firestore

### No data in Firestore
- Check the function logs: `gcloud functions logs read tennis-odds-pipeline --limit 50`
- Verify the timestamp shows a recent run
- Confirm Kalshi API credentials are valid and stored correctly in Secret Manager

## Scheduling Options

The current setup runs at **midnight UTC daily**. To change:

- **Every 6 hours**: `0 0,6,12,18 * * *`
- **Every 12 hours**: `0 0,12 * * *`
- **On weekdays only**: `0 0 * * 1-5`

Update with:
```bash
gcloud scheduler jobs update tennis-odds-daily \
  --schedule "NEW_SCHEDULE" \
  --location us-central1 \
  --project egg-models
```

## Cleanup

To remove the pipeline:

```bash
# Delete the Cloud Function
gcloud functions delete tennis-odds-pipeline --project egg-models

# Delete the scheduler job
gcloud scheduler jobs delete tennis-odds-daily --location us-central1 --project egg-models

# Delete secrets (optional)
gcloud secrets delete kalshi-api-key --project egg-models
gcloud secrets delete kalshi-private-key --project egg-models
```
