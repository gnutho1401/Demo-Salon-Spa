param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$failures = @()

function Read-DotEnvValue([string]$Path, [string]$Name) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $escapedName = [regex]::Escape($Name)
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match "^\s*$escapedName\s*=" } |
    Select-Object -Last 1
  if (-not $line) { return $null }
  return (($line -split "=", 2)[1]).Trim().Trim('"').Trim("'")
}

function Require([bool]$Condition, [string]$Message) {
  if (-not $Condition) { $script:failures += $Message }
}

function Normalize-OriginList([string]$Value) {
  return @(
    [string]$Value -split "," |
      ForEach-Object { $_.Trim().TrimEnd("/") } |
      Where-Object { $_ }
  )
}

$backendEnv = Join-Path $Root "backend/.env"
$frontendEnv = Join-Path $Root "frontend/.env"
$workerRoot = Join-Path $Root "ai-worker/hair-tryon"
$contractPath = Join-Path $Root "config/system.contract.json"

Require (Test-Path -LiteralPath $contractPath) "Missing config/system.contract.json"
Require (Test-Path -LiteralPath $backendEnv) "Missing backend/.env"
Require (Test-Path -LiteralPath $frontendEnv) "Missing frontend/.env"
Require (Test-Path -LiteralPath (Join-Path $Root "backend/package.json")) "Missing backend/package.json"
Require (Test-Path -LiteralPath (Join-Path $Root "frontend/package.json")) "Missing frontend/package.json"
Require (Test-Path -LiteralPath $workerRoot) "Missing ai-worker/hair-tryon"
Require ([bool](Get-Command node.exe -ErrorAction SilentlyContinue)) "node.exe is not available"
Require ([bool](Get-Command npm.cmd -ErrorAction SilentlyContinue)) "npm.cmd is not available"

$contract = if (Test-Path -LiteralPath $contractPath) {
  Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
} else {
  $null
}
$backendPort = if ($contract) { [string]$contract.runtime.backendPort } else { "5000" }
$canonicalOrigin = if ($contract) { [string]$contract.runtime.websiteOrigin } else { "http://localhost:5173" }
$backendOrigin = if ($contract -and $contract.runtime.backendOrigin) {
  [string]$contract.runtime.backendOrigin
} else {
  "http://localhost:$backendPort"
}
$canonicalAiOrigin = if ($contract) { [string]$contract.runtime.aiWorkerOrigin } else { "http://127.0.0.1:8189" }

if (Test-Path -LiteralPath $backendEnv) {
  $port = Read-DotEnvValue $backendEnv "PORT"
  $dbServer = Read-DotEnvValue $backendEnv "DB_SERVER"
  $dbDatabase = Read-DotEnvValue $backendEnv "DB_DATABASE"
  $jwtSecret = Read-DotEnvValue $backendEnv "JWT_SECRET"
  $jwtSecretFile = Read-DotEnvValue $backendEnv "JWT_SECRET_FILE"
  $localAiUrl = Read-DotEnvValue $backendEnv "LOCAL_HAIR_API_URL"
  $legacyPasswords = Read-DotEnvValue $backendEnv "ALLOW_LEGACY_PLAINTEXT_PASSWORDS"
  $devTokens = Read-DotEnvValue $backendEnv "EXPOSE_DEV_AUTH_TOKENS"

  Require (-not $port -or $port -eq $backendPort) "PORT must be $backendPort"
  Require ([bool]$dbServer) "DB_SERVER is missing"
  Require ([bool]$dbDatabase) "DB_DATABASE is missing"
  $hasStrongInlineSecret = [bool]$jwtSecret -and $jwtSecret.Length -ge 32 -and $jwtSecret -ne "dev_secret_key"
  Require ($hasStrongInlineSecret -or [bool]$jwtSecretFile) "Configure a 32+ character JWT_SECRET or JWT_SECRET_FILE"
  Require ($localAiUrl -eq $canonicalAiOrigin) "LOCAL_HAIR_API_URL must be $canonicalAiOrigin"
  Require ($legacyPasswords -ne "true") "ALLOW_LEGACY_PLAINTEXT_PASSWORDS must not be true"
  Require ($devTokens -ne "true") "EXPOSE_DEV_AUTH_TOKENS must not be true"
}

$backendGoogleId = Read-DotEnvValue $backendEnv "GOOGLE_CLIENT_ID"
$frontendGoogleId = Read-DotEnvValue $frontendEnv "VITE_GOOGLE_CLIENT_ID"
$backendGoogleOrigins = Normalize-OriginList (Read-DotEnvValue $backendEnv "GOOGLE_AUTHORIZED_ORIGINS")
$frontendGoogleOrigins = Normalize-OriginList (Read-DotEnvValue $frontendEnv "VITE_GOOGLE_AUTHORIZED_ORIGINS")
$frontendApiUrl = Read-DotEnvValue $frontendEnv "VITE_API_URL"
Require ([bool]$backendGoogleId) "GOOGLE_CLIENT_ID is missing in backend/.env"
Require ([bool]$frontendGoogleId) "VITE_GOOGLE_CLIENT_ID is missing in frontend/.env"
Require ($backendGoogleId -eq $frontendGoogleId) "Google Client ID differs between backend and frontend"
Require ($backendGoogleOrigins -contains $canonicalOrigin) "GOOGLE_AUTHORIZED_ORIGINS must contain $canonicalOrigin"
Require ($frontendGoogleOrigins -contains $canonicalOrigin) "VITE_GOOGLE_AUTHORIZED_ORIGINS must contain $canonicalOrigin"
Require (-not $frontendApiUrl -or $frontendApiUrl -in @($backendOrigin, "http://127.0.0.1:$backendPort")) "VITE_API_URL must be empty or point to $backendOrigin"

if ($failures.Count) {
  Write-Host "System preflight failed:" -ForegroundColor Red
  $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  throw "Fix the configuration errors above before starting the project."
}

Write-Host "System preflight OK: frontend, backend, database, Google OAuth and local AI configuration are synchronized." -ForegroundColor Green
