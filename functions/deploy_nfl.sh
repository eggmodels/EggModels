#!/bin/bash
set -e

PROJECT_ID="egg-models"
FUNCTION_NAME="nfl-model-pipeline"
REGION="us-central1"
RUNTIME="python312"

echo "=========================================="
echo "NFL Model Pipeline Deployment"
echo "=========================================="
echo ""

# Step 1: Set project
echo "Step 1: Setting GCP project..."
gcloud config set project ${PROJECT_ID}
echo "✓ Project set to ${PROJECT_ID}"
echo ""

# Step 2: Deploy Cloud Function
echo "Step 2: Deploying Cloud Function..."
cd nfl_pipeline

gcloud functions deploy ${FUNCTION_NAME} \
  --runtime ${RUNTIME} \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point run_nfl_pipeline \
  --timeout 540 \
  --memory 512MB \
  --region ${REGION} \
  --project ${PROJECT_ID}

cd ..

echo "✓ Cloud Function deployed"
echo ""

# Step 3: Get function URL
echo "Step 3: Getting Cloud Function URL..."
FUNCTION_URL=$(gcloud functions describe ${FUNCTION_NAME} \
  --region ${REGION} \
  --format 'value(url)' \
  --project ${PROJECT_ID})

echo "Function URL: ${FUNCTION_URL}"
echo ""

# Step 4: Create Cloud Scheduler job (runs daily at midnight UTC)
echo "Step 4: Setting up Cloud Scheduler..."

if gcloud scheduler jobs describe ${FUNCTION_NAME}-daily --location ${REGION} --project=${PROJECT_ID} &>/dev/null; then
    echo "  - Job exists, updating schedule..."
    gcloud scheduler jobs update http ${FUNCTION_NAME}-daily \
      --location ${REGION} \
      --schedule "0 0 * * *" \
      --http-method GET \
      --uri ${FUNCTION_URL} \
      --tz UTC \
      --project ${PROJECT_ID} \
      --quiet
else
    echo "  - Creating new scheduler job..."
    gcloud scheduler jobs create http ${FUNCTION_NAME}-daily \
      --location ${REGION} \
      --schedule "0 0 * * *" \
      --http-method GET \
      --uri ${FUNCTION_URL} \
      --tz UTC \
      --project ${PROJECT_ID}
fi

echo "✓ Cloud Scheduler job created/updated"
echo ""

# Step 5: Test the pipeline
echo "Step 5: Testing the pipeline (this may take a minute)..."
gcloud scheduler jobs run ${FUNCTION_NAME}-daily \
  --location ${REGION} \
  --project ${PROJECT_ID}

echo "✓ Pipeline triggered"
echo ""

echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "✓ Cloud Function deployed"
echo "✓ Cloud Scheduler configured (runs daily at midnight UTC)"
echo "✓ Pipeline tested"
echo ""
echo "Next steps:"
echo "1. Check the function logs to verify it's working:"
echo "   gcloud functions logs read ${FUNCTION_NAME} --limit 50 --region ${REGION}"
echo ""
echo "2. View results in Firestore:"
echo "   https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data/~2Fnfl_2026~2Fcurrent"
echo ""
echo "3. Your website reads from: Firestore collection 'nfl_2026' document 'current'"
echo ""
