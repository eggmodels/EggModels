# Tennis Odds Pipeline Deployment Guide

This guide walks through deploying the automated tennis odds prediction pipeline to Google Cloud. The pipeline scrapes tennis player Elo ratings, fetches upcoming matches, calculates win probabilities, and writes the results to Firestore for your website to display.

## Prerequisites

- GCP project: `egg-models`
- Firebase with Firestore enabled
- gcloud CLI installed

## Step 1: Store API Keys in Secret Manager

### Create secrets for ProphetX credentials:

```bash
# Store ProphetX access key
echo -n "YOUR_PROPHETX_ACCESS_KEY" | gcloud secrets create prophetx_access_key --data-file=-

# Store ProphetX secret key
echo -n "YOUR_PROPHETX_SECRET_KEY" | gcloud secrets create prophetx_secret_key --data-file=-
```

Replace:
- `YOUR_PROPHETX_ACCESS_KEY` with your actual ProphetX access key (from the notebook: `09541cadd097cf38fd03c13299e665fe`)
- `YOUR_PROPHETX_SECRET_KEY` with your actual ProphetX secret key (from the notebook: `6a12027d340cfecf0051f88553576532`)

### Verify secrets were created:

```bash
gcloud secrets list
```

You should see both `prophetx_access_key` and `prophetx_secret_key` listed.

## Step 2: Grant Cloud Function Permissions to Secrets

Get the Cloud Function's default service account:

```bash
PROJECT_NUMBER=$(gcloud projects describe egg-models --format='value(projectNumber)')
CLOUD_FUNCTION_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

Grant the service account access to the secrets:

```bash
gcloud secrets add-iam-policy-binding prophetx_access_key \
  --member="serviceAccount:${CLOUD_FUNCTION_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding prophetx_secret_key \
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

This creates an HTTP-triggered Cloud Function. Note the function URL that's returned—you'll need it for Cloud Scheduler.

## Step 4: Set Up Cloud Scheduler

Create a Cloud Scheduler job to trigger the function daily at midnight UTC:

```bash
gcloud scheduler jobs create http tennis-odds-daily \
  --location us-central1 \
  --schedule "0 0 * * *" \
  --http-method GET \
  --uri https://REGION-egg-models.cloudfunctions.net/tennis-odds-pipeline \
  --tz UTC \
  --project egg-models
```

Replace `REGION` with your Cloud Function region (e.g., `us-central1`, `europe-west1`).

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
curl -X POST https://REGION-egg-models.cloudfunctions.net/tennis-odds-pipeline
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

## Step 7: Update Your Website

Your website should now read from Firestore's `tennis_odds/current` document instead of running the computation. Example JavaScript:

```javascript
import { getFirestore, doc, getDoc } from "firebase/firestore";

const db = getFirestore();
const docRef = doc(db, "tennis_odds", "current");
const docSnap = await getDoc(docRef);

if (docSnap.exists()) {
  const matches = docSnap.data().matches;
  // Render matches to your page
}
```

## Troubleshooting

### Function times out
- Increase the `--timeout` flag (max 540 seconds)
- The function is lightweight — timeouts are rare
- Check Cloud Function logs for detailed error messages

### "Secret not found" error
- Verify secrets exist: `gcloud secrets list`
- Verify permissions: `gcloud secrets get-iam-policy prophetx_access_key`

### No matches in output
- Check if there are active/upcoming matches on that day
- The output is filtered to today and tomorrow only
- Verify tournament codes are correct in ProphetX API
- Check that there are tournaments with status `not_started`

### Firestore write fails
- Verify the service account has `Firestore User` role
- Check Firestore security rules allow writes
- Ensure the `tennis_odds` collection exists in Firestore

### No data in Firestore
- Check the function logs: `gcloud functions logs read tennis-odds-pipeline --limit 50`
- Verify the timestamp shows a recent run
- Check that ProphetX API keys are valid

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
gcloud secrets delete prophetx_access_key --project egg-models
gcloud secrets delete prophetx_secret_key --project egg-models
```
