@echo off
setlocal enabledelayedexpansion

set PROJECT_ID=egg-models
set FUNCTION_NAME=tennis-odds-pipeline
set REGION=us-central1
set RUNTIME=python312
set PROPHETX_ACCESS_KEY=09541cadd097cf38fd03c13299e665fe
set PROPHETX_SECRET_KEY=6a12027d340cfecf0051f88553576532

echo ==========================================
echo Tennis Odds Pipeline Deployment
echo ==========================================
echo.

echo Step 1: Setting GCP project...
call gcloud config set project %PROJECT_ID%
echo ✓ Project set to %PROJECT_ID%
echo.

echo Step 2: Creating Secret Manager secrets...

gcloud secrets describe prophetx_access_key --project=%PROJECT_ID% >nul 2>&1
if %errorlevel% equ 0 (
    echo   - prophetx_access_key already exists, updating...
    echo %PROPHETX_ACCESS_KEY%| gcloud secrets versions add prophetx_access_key --data-file=- --project=%PROJECT_ID%
) else (
    echo   - Creating prophetx_access_key...
    echo %PROPHETX_ACCESS_KEY%| gcloud secrets create prophetx_access_key --data-file=- --project=%PROJECT_ID% --replication-policy="automatic"
)

gcloud secrets describe prophetx_secret_key --project=%PROJECT_ID% >nul 2>&1
if %errorlevel% equ 0 (
    echo   - prophetx_secret_key already exists, updating...
    echo %PROPHETX_SECRET_KEY%| gcloud secrets versions add prophetx_secret_key --data-file=- --project=%PROJECT_ID%
) else (
    echo   - Creating prophetx_secret_key...
    echo %PROPHETX_SECRET_KEY%| gcloud secrets create prophetx_secret_key --data-file=- --project=%PROJECT_ID% --replication-policy="automatic"
)

echo ✓ Secrets created/updated
echo.

echo Step 3: Granting Cloud Function permissions...
for /f "tokens=*" %%i in ('gcloud projects describe %PROJECT_ID% --format="value(projectNumber)"') do set PROJECT_NUMBER=%%i
set CLOUD_FUNCTION_SA=%PROJECT_NUMBER%-compute@developer.gserviceaccount.com

gcloud secrets add-iam-policy-binding prophetx_access_key --member="serviceAccount:%CLOUD_FUNCTION_SA%" --role="roles/secretmanager.secretAccessor" --project=%PROJECT_ID% --quiet

gcloud secrets add-iam-policy-binding prophetx_secret_key --member="serviceAccount:%CLOUD_FUNCTION_SA%" --role="roles/secretmanager.secretAccessor" --project=%PROJECT_ID% --quiet

echo ✓ Permissions granted
echo.

echo Step 4: Deploying Cloud Function...
cd tennis_odds

gcloud functions deploy %FUNCTION_NAME% --runtime %RUNTIME% --trigger-http --allow-unauthenticated --entry-point run_tennis_odds --timeout 540 --memory 512MB --region %REGION% --project %PROJECT_ID%

cd ..

echo ✓ Cloud Function deployed
echo.

echo Step 5: Getting Cloud Function URL...
for /f "tokens=*" %%i in ('gcloud functions describe %FUNCTION_NAME% --region %REGION% --format "value(httpsTrigger.url)" --project %PROJECT_ID%') do set FUNCTION_URL=%%i

echo Function URL: %FUNCTION_URL%
echo.

echo Step 6: Setting up Cloud Scheduler...

gcloud scheduler jobs describe %FUNCTION_NAME%-daily --location %REGION% --project=%PROJECT_ID% >nul 2>&1
if %errorlevel% equ 0 (
    echo   - Job exists, updating schedule...
    gcloud scheduler jobs update http %FUNCTION_NAME%-daily --location %REGION% --schedule "0 0 * * *" --http-method GET --uri %FUNCTION_URL% --tz UTC --project %PROJECT_ID% --quiet
) else (
    echo   - Creating new scheduler job...
    gcloud scheduler jobs create http %FUNCTION_NAME%-daily --location %REGION% --schedule "0 0 * * *" --http-method GET --uri %FUNCTION_URL% --tz UTC --project %PROJECT_ID%
)

echo ✓ Cloud Scheduler job created/updated
echo.

echo Step 7: Testing the pipeline...
gcloud scheduler jobs run %FUNCTION_NAME%-daily --location %REGION% --project %PROJECT_ID%

echo ✓ Pipeline triggered
echo.

echo ==========================================
echo Deployment Complete!
echo ==========================================
echo.
echo ✓ Secrets stored in Secret Manager
echo ✓ Cloud Function deployed
echo ✓ Cloud Scheduler configured (runs daily at midnight UTC)
echo ✓ Pipeline tested
echo.
echo Next steps:
echo 1. Check the function logs:
echo    gcloud functions logs read %FUNCTION_NAME% --limit 50 --region %REGION%
echo.
echo 2. View results in Firestore at:
echo    https://console.firebase.google.com/project/%PROJECT_ID%/firestore
echo.
echo 3. Your website reads from: firestore collection 'tennis_odds' document 'current'
echo.
