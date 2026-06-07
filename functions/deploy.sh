#!/bin/bash
set -e

PROJECT_ID="egg-models"
FUNCTION_NAME="tennis-odds-pipeline"
REGION="us-central1"
RUNTIME="python312"

# API Keys from ProphetX
PROPHETX_ACCESS_KEY="09541cadd097cf38fd03c13299e665fe"
PROPHETX_SECRET_KEY="6a12027d340cfecf0051f88553576532"

echo "=========================================="
echo "Tennis Odds Pipeline Deployment"
echo "=========================================="
echo ""

# Step 1: Set project
echo "Step 1: Setting GCP project..."
gcloud config set project ${PROJECT_ID}
echo "✓ Project set to ${PROJECT_ID}"
echo ""

# Step 2: Create secrets
echo "Step 2: Creating Secret Manager secrets..."

# Check if secrets already exist
if gcloud secrets describe prophetx_access_key --project=${PROJECT_ID} &>/dev/null; then
    echo "  - prophetx_access_key already exists, updating..."
    echo -n "${PROPHETX_ACCESS_KEY}" | gcloud secrets versions add prophetx_access_key --data-file=- --project=${PROJECT_ID}
else
    echo "  - Creating prophetx_access_key..."
    echo -n "${PROPHETX_ACCESS_KEY}" | gcloud secrets create prophetx_access_key --data-file=- --project=${PROJECT_ID} --replication-policy="automatic"
fi

if gcloud secrets describe prophetx_secret_key --project=${PROJECT_ID} &>/dev/null; then
    echo "  - prophetx_secret_key already exists, updating..."
    echo -n "${PROPHETX_SECRET_KEY}" | gcloud secrets versions add prophetx_secret_key --data-file=- --project=${PROJECT_ID}
else
    echo "  - Creating prophetx_secret_key..."
    echo -n "${PROPHETX_SECRET_KEY}" | gcloud secrets create prophetx_secret_key --data-file=- --project=${PROJECT_ID} --replication-policy="automatic"
fi

echo "✓ Secrets created/updated"
echo ""

# Step 3: Get project number and grant permissions
echo "Step 3: Granting Cloud Function permissions to access secrets..."
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
CLOUD_FUNCTION_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding prophetx_access_key \
  --member="serviceAccount:${CLOUD_FUNCTION_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=${PROJECT_ID} \
  --quiet

gcloud secrets add-iam-policy-binding prophetx_secret_key \
  --member="serviceAccount:${CLOUD_FUNCTION_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=${PROJECT_ID} \
  --quiet

echo "✓ Permissions granted"
echo ""

# Step 4: Deploy Cloud Function
echo "Step 4: Deploying Cloud Function..."
cd tennis_odds

gcloud functions deploy ${FUNCTION_NAME} \
  --runtime ${RUNTIME} \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point run_tennis_odds \
  --timeout 540 \
  --memory 512MB \
  --region ${REGION} \
  --project ${PROJECT_ID}

cd ..

echo "✓ Cloud Function deployed"
echo ""

# Step 5: Get function URL
echo "Step 5: Getting Cloud Function URL..."
FUNCTION_URL=$(gcloud functions describe ${FUNCTION_NAME} \
  --region ${REGION} \
  --format 'value(httpsTrigger.url)' \
  --project ${PROJECT_ID})

echo "Function URL: ${FUNCTION_URL}"
echo ""

# Step 6: Create Cloud Scheduler job
echo "Step 6: Setting up Cloud Scheduler (runs daily at midnight UTC)..."

# Check if job exists
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

# Step 7: Test the pipeline
echo "Step 7: Testing the pipeline (this may take a minute)..."
gcloud scheduler jobs run ${FUNCTION_NAME}-daily \
  --location ${REGION} \
  --project ${PROJECT_ID}

echo "✓ Pipeline triggered"
echo ""

echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "✓ Secrets stored in Secret Manager"
echo "✓ Cloud Function deployed"
echo "✓ Cloud Scheduler configured (runs daily at midnight UTC)"
echo "✓ Pipeline tested"
echo ""
echo "Next steps:"
echo "1. Check the function logs to verify it's working:"
echo "   gcloud functions logs read ${FUNCTION_NAME} --limit 50 --region ${REGION}"
echo ""
echo "2. View results in Firestore:"
echo "   Go to: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data/~2Ftennis_odds~2Fcurrent"
echo ""
echo "3. Your website can now read from: firestore collection 'tennis_odds' document 'current'"
echo ""
