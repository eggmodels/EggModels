# How to Run the Deployment

The deployment scripts are automated and handle everything: secrets, permissions, function deployment, and scheduler setup.

## Prerequisites

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Authenticate with GCP:
   ```bash
   gcloud auth login
   ```

## On macOS/Linux

```bash
cd functions/
chmod +x deploy.sh
./deploy.sh
```

## On Windows

```bash
cd functions/
deploy.bat
```

## What the script does

1. ✅ Sets the GCP project to `egg-models`
2. ✅ Creates Secret Manager entries for your ProphetX API keys
3. ✅ Grants the Cloud Function permission to access those secrets
4. ✅ Deploys the Cloud Function to `us-central1`
5. ✅ Creates a Cloud Scheduler job that triggers daily at midnight UTC
6. ✅ Runs a test to verify everything works

## After deployment

### Check the logs
```bash
gcloud functions logs read tennis-odds-pipeline --limit 50
```

### Manually trigger the pipeline
```bash
gcloud scheduler jobs run tennis-odds-daily --location us-central1
```

### View results in Firestore
Open [Firebase Console](https://console.firebase.google.com/) → go to `Firestore Database` → find the `tennis_odds` collection → open the `current` document.

You should see:
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

## Next Steps

Your website should read from `tennis_odds/current` in Firestore. The frontend code would look like:

```javascript
import { getFirestore, doc, getDoc } from "firebase/firestore";

const db = getFirestore();
const docRef = doc(db, "tennis_odds", "current");
const docSnap = await getDoc(docRef);

if (docSnap.exists()) {
  const { matches, timestamp } = docSnap.data();
  // Render matches to your page
  console.log("Last updated:", timestamp);
  matches.forEach(match => {
    console.log(`${match['Player 1']} vs ${match['Player 2']}`);
    console.log(`Win probs: ${match['Player 1 Win Probability']} vs ${match['Player 2 Win Probability']}`);
  });
}
```

## Troubleshooting

### "command not found: gcloud"
- Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
- Restart your terminal after installation

### "Unauthorized" error when deploying
- Make sure you ran `gcloud auth login`
- Verify you have Editor role on the `egg-models` project

### Function deployment fails
- Check the error message for details
- Make sure `functions/tennis_odds/` has both `main.py` and `requirements.txt`

### No data in Firestore
- Wait a minute (first run takes time to scrape Elo data)
- Check the function logs: `gcloud functions logs read tennis-odds-pipeline`
- Verify ProphetX API keys are correct

## Scheduling

The function runs every day at **midnight UTC**. To change:

```bash
gcloud scheduler jobs update tennis-odds-daily \
  --location us-central1 \
  --schedule "0 */6 * * *"
```

This would run every 6 hours. Common schedules:
- Every 6 hours: `0 */6 * * *`
- Every 12 hours: `0 0,12 * * *`
- Weekdays only: `0 0 * * 1-5`

## Questions?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for more details, or check the logs for specific errors.
