# One-shot GCP / Firebase setup + deploy for Khendeq Medresah.
#
# Prerequisites (done once by the account owner, interactively):
#   gcloud auth login
#   gcloud auth application-default login
#   firebase login
#   .env.local present in the project root (NEXT_PUBLIC_FIREBASE_* values)
#   Firebase project on the Blaze plan
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\gcp-setup.ps1 -ProjectId <firebase-project-id>
#
# Safe to re-run: every step checks before creating.

param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [string]$Region = 'europe-west4',          # App Hosting region (closest to Ethiopia)
  [string]$SchedulerRegion = 'europe-west1', # Cloud Scheduler region
  [string]$BackendId = 'khendeq-medresah',
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Run([string]$cmd) {
  Write-Host "  $ $cmd" -ForegroundColor DarkGray
  Invoke-Expression $cmd
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $cmd" }
}

# --- 1. Checks -------------------------------------------------------------
Step 'Checking sign-in and .env.local'
$account = (gcloud auth list --filter=status:ACTIVE --format='value(account)') 2>$null
if (-not $account) { throw 'Not signed in to gcloud. Run: gcloud auth login' }
Write-Host "  gcloud account: $account"
firebase projects:list --json *> $null
if ($LASTEXITCODE -ne 0) { throw 'Not signed in to Firebase CLI. Run: firebase login' }
$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) { throw '.env.local not found in the project root.' }

$envVars = @{}
foreach ($line in Get-Content $envFile) {
  $t = $line.Trim()
  if (-not $t -or $t.StartsWith('#') -or -not $t.Contains('=')) { continue }
  $k, $v = $t.Split('=', 2)
  $envVars[$k.Trim()] = $v.Trim().Trim('"')
}
if ($envVars['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] -and $envVars['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] -ne $ProjectId) {
  throw ".env.local project ($($envVars['NEXT_PUBLIC_FIREBASE_PROJECT_ID'])) does not match -ProjectId $ProjectId"
}

# --- 2. Project selection + config files ----------------------------------
Step "Selecting project $ProjectId"
Run "gcloud config set project $ProjectId"
@{ projects = @{ default = $ProjectId } } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $root '.firebaserc')

Step 'Filling apphosting.yaml from .env.local'
$yamlPath = Join-Path $root 'apphosting.yaml'
$yaml = Get-Content $yamlPath -Raw
foreach ($key in @(
    'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_DATABASE_URL')) {
  $val = $envVars[$key]
  if (-not $val) { throw "$key missing from .env.local" }
  $pattern = "(?m)(- variable: $key\r?\n\s+value: ).*$"
  $yaml = [regex]::Replace($yaml, $pattern, { param($m) $m.Groups[1].Value + '"' + $val + '"' })
}
[IO.File]::WriteAllText($yamlPath, $yaml)

# --- 3. APIs ---------------------------------------------------------------
Step 'Enabling Google Cloud APIs'
Run ("gcloud services enable firebaseapphosting.googleapis.com cloudbuild.googleapis.com run.googleapis.com " +
  "artifactregistry.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com " +
  "firebasedatabase.googleapis.com identitytoolkit.googleapis.com firebasestorage.googleapis.com")

# --- 4. App Hosting backend ------------------------------------------------
Step "Ensuring App Hosting backend '$BackendId'"
$backendsJson = firebase apphosting:backends:list --project $ProjectId --json | Out-String
$backends = ($backendsJson | ConvertFrom-Json).result
$backend = $backends | Where-Object { $_.name -like "*/backends/$BackendId" } | Select-Object -First 1
if (-not $backend) {
  $appId = $envVars['NEXT_PUBLIC_FIREBASE_APP_ID']
  Run "firebase apphosting:backends:create --project $ProjectId --backend $BackendId --primary-region $Region --app $appId --root-dir / --non-interactive"
} else {
  Write-Host '  already exists'
}

# --- 5. Runtime service account permissions --------------------------------
$computeSa = "firebase-app-hosting-compute@$ProjectId.iam.gserviceaccount.com"
Step "Granting roles to $computeSa"
foreach ($role in @('roles/firebasedatabase.admin', 'roles/firebaseauth.admin')) {
  Run "gcloud projects add-iam-policy-binding $ProjectId --member=serviceAccount:$computeSa --role=$role --condition=None --quiet --format=none"
}

# --- 6. CRON_SECRET in Secret Manager --------------------------------------
Step 'Ensuring secret cron-secret'
gcloud secrets describe cron-secret --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $newSecret = ([BitConverter]::ToString($bytes) -replace '-', '').ToLower()
  $tmp = New-TemporaryFile
  [IO.File]::WriteAllText($tmp, $newSecret)
  try {
    Run "gcloud secrets create cron-secret --project $ProjectId --replication-policy=automatic --data-file=`"$tmp`""
  } finally { Remove-Item $tmp -Force }
} else {
  Write-Host '  already exists'
}
Run "gcloud secrets add-iam-policy-binding cron-secret --project $ProjectId --member=serviceAccount:$computeSa --role=roles/secretmanager.secretAccessor --format=none"

if ($SkipDeploy) { Write-Host "`nSetup done (deploy skipped)."; exit 0 }

# --- 7. Deploy rules + app -------------------------------------------------
Step 'Deploying Realtime Database + Storage rules'
Run "firebase deploy --only database,storage --project $ProjectId --non-interactive"

Step 'Deploying the app to App Hosting (builds in Cloud Build, ~5-10 min)'
Run "firebase deploy --only apphosting --project $ProjectId --non-interactive"

# --- 8. Cloud Scheduler job for the missing-attendance reminder ------------
Step 'Ensuring Cloud Scheduler job'
$backendsJson = firebase apphosting:backends:list --project $ProjectId --json | Out-String
$backend = (($backendsJson | ConvertFrom-Json).result) | Where-Object { $_.name -like "*/backends/$BackendId" } | Select-Object -First 1
$url = $backend.uri
if (-not $url) { throw 'Could not determine the backend URL.' }
if (-not $url.StartsWith('http')) { $url = "https://$url" }
$cronUrl = "$url/api/cron/missing-attendance"
$secretValue = (gcloud secrets versions access latest --secret=cron-secret --project $ProjectId).Trim()

$verb = 'create'
gcloud scheduler jobs describe missing-attendance --location $SchedulerRegion --project $ProjectId *> $null
if ($LASTEXITCODE -eq 0) { $verb = 'update' }
$headerFlag = if ($verb -eq 'create') { '--headers' } else { '--update-headers' }
# 18:30 Addis Ababa every day (the route itself skips Sundays).
& gcloud scheduler jobs $verb http missing-attendance `
  --project $ProjectId --location $SchedulerRegion `
  --schedule '30 18 * * *' --time-zone 'Africa/Addis_Ababa' `
  --uri $cronUrl --http-method GET `
  $headerFlag "Authorization=Bearer $secretValue" `
  --attempt-deadline 300s --format=none
if ($LASTEXITCODE -ne 0) { throw 'Failed to create/update the Cloud Scheduler job' }

Write-Host "`nAll done." -ForegroundColor Green
Write-Host "  App:  $url"
Write-Host "  Cron: $cronUrl (daily 18:30 Africa/Addis_Ababa)"
Write-Host "  Test the cron now with: gcloud scheduler jobs run missing-attendance --location $SchedulerRegion"
