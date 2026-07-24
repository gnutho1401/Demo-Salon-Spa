param(
  [switch]$StartAiWorker,
  [switch]$EnableTailscaleFunnel
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Runtime = Join-Path $Root ".runtime"
$BackendLog = Join-Path $Runtime "backend-production.log"
$FrontendLog = Join-Path $Runtime "frontend-production.log"
$AiLog = Join-Path $Runtime "ai-worker-production.log"
$PidFile = Join-Path $Runtime "production-pids.json"

# Some hosts inject both "Path" and "PATH". Windows PowerShell 5.1 then
# crashes inside Start-Process because its environment dictionary is
# case-insensitive. Collapse the duplicate before starting child processes.
$processPath = [Environment]::GetEnvironmentVariable("Path", "Process")
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", $processPath, "Process")

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

if (-not (Test-Path (Join-Path $Root "backend/.env"))) {
  throw "Missing backend/.env. Create it from backend/.env.example before deployment."
}

& (Join-Path $PSScriptRoot "preflight.ps1") -Root $Root

$env:NODE_ENV = "production"
$env:VITE_API_URL = ""
$env:TRUST_PROXY = "true"
$env:ALLOW_LEGACY_PLAINTEXT_PASSWORDS = "false"
$env:EXPOSE_DEV_AUTH_TOKENS = "false"

function Get-ListenerProcessId([int]$Port) {
  $listenerPids = @(
    & netstat.exe -ano |
      ForEach-Object {
        $line = [string]$_
        if ($line -like "*:$Port *" -and $line -match "LISTENING\s+(\d+)$") {
          [int]$Matches[1]
        }
      } |
      Sort-Object -Unique
  )
  return $listenerPids | Select-Object -First 1
}

function Get-BackendHealth {
  try {
    return Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 3
  } catch {
    return $null
  }
}

function Get-FrontendHealth {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200 -and $response.Content -match "LUNA Beauty Salon"
  } catch {
    return $false
  }
}

if ($EnableTailscaleFunnel) {
  $tailscale = Get-Command "tailscale.exe" -ErrorAction SilentlyContinue
  if (-not $tailscale) {
    throw "Tailscale CLI is not installed. Install it and sign in first."
  }
  $status = (& $tailscale.Source status --json | ConvertFrom-Json)
  $dnsName = [string]$status.Self.DNSName
  if (-not $dnsName) {
    throw "Tailscale is not signed in or MagicDNS is not ready."
  }
  $publicOrigin = "https://$($dnsName.TrimEnd('.'))"
  $googleOrigins = @(
    [string](Get-Content (Join-Path $Root "backend/.env") |
      Where-Object { $_ -match "^\s*GOOGLE_AUTHORIZED_ORIGINS\s*=" } |
      Select-Object -Last 1) -split "=", 2 |
      Select-Object -Last 1
  ) -split "," | ForEach-Object { $_.Trim().TrimEnd("/") }
  if ($googleOrigins -notcontains $publicOrigin) {
    throw "Google OAuth public origin is not synchronized. Add $publicOrigin to GOOGLE_AUTHORIZED_ORIGINS, VITE_GOOGLE_AUTHORIZED_ORIGINS and Google Cloud Authorized JavaScript origins."
  }
  $env:CORS_ORIGINS = $publicOrigin
  $env:FRONTEND_URL = $publicOrigin
  $env:BACKEND_URL = $publicOrigin
  $env:VITE_GOOGLE_AUTHORIZED_ORIGINS = $publicOrigin
}

Push-Location (Join-Path $Root "frontend")
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
} finally {
  Pop-Location
}

$processes = @{}
$backendHealth = Get-BackendHealth
$backend = $null

if ($backendHealth -and $backendHealth.status -eq "ok") {
  $backendPid = Get-ListenerProcessId -Port 5000
  if (-not $backendPid) {
    throw "Backend health succeeded but the listener PID on port 5000 was not found."
  }
  $processes.backend = [int]$backendPid
  Write-Host "Backend is already running at http://127.0.0.1:5000 (PID $backendPid)." -ForegroundColor Green
} else {
  $occupiedPid = Get-ListenerProcessId -Port 5000
  if ($occupiedPid) {
    $occupiedProcess = Get-Process -Id $occupiedPid -ErrorAction SilentlyContinue
    $occupiedName = if ($occupiedProcess) { $occupiedProcess.ProcessName } else { "unknown" }
    throw "Port 5000 is occupied by PID $occupiedPid ($occupiedName), but the backend is not healthy. Run salon.cmd stop or resolve that process."
  }

  $backend = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList "src/server.js" `
    -WorkingDirectory (Join-Path $Root "backend") `
    -RedirectStandardOutput $BackendLog `
    -RedirectStandardError $BackendLog.Replace(".log", ".err.log") `
    -WindowStyle Hidden `
    -PassThru

  $processes.backend = $backend.Id
}

if ($StartAiWorker) {
  $aiAlreadyReady = $false
  try {
    $aiHealth = Invoke-RestMethod -Uri "http://127.0.0.1:8189/health" -TimeoutSec 3
    $aiAlreadyReady = $aiHealth.status -eq "ready"
  } catch {}

  if ($aiAlreadyReady) {
    Write-Host "AI Worker is already running at http://127.0.0.1:8189." -ForegroundColor Green
  } else {
    $venvPython = Join-Path $Root "ai-worker/hair-tryon/.venv/Scripts/python.exe"
    $python = if (Test-Path $venvPython) { $venvPython } else {
      (Get-Command "python.exe" -ErrorAction Stop).Source
    }
    $ai = Start-Process `
      -FilePath $python `
      -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8189" `
      -WorkingDirectory (Join-Path $Root "ai-worker/hair-tryon") `
      -RedirectStandardOutput $AiLog `
      -RedirectStandardError $AiLog.Replace(".log", ".err.log") `
      -WindowStyle Hidden `
      -PassThru
    $processes.aiWorker = $ai.Id
  }
}

$health = $null
for ($attempt = 1; $attempt -le 20; $attempt++) {
  $health = Get-BackendHealth
  if ($health -and $health.status -eq "ok") { break }
  Start-Sleep -Milliseconds 500
}
if ($health.status -ne "ok") {
  if ($backend -and -not $backend.HasExited) {
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
  }
  throw "Backend is not ready. See $BackendLog"
}

$frontendReady = Get-FrontendHealth
$frontendLauncher = $null
if ($frontendReady) {
  $frontendPid = Get-ListenerProcessId -Port 5173
  if (-not $frontendPid) {
    throw "Frontend responded successfully but the listener PID on port 5173 was not found."
  }
  $processes.frontend = [int]$frontendPid
  Write-Host "Frontend is already running at http://127.0.0.1:5173 (PID $frontendPid)." -ForegroundColor Green
} else {
  $occupiedFrontendPid = Get-ListenerProcessId -Port 5173
  if ($occupiedFrontendPid) {
    $occupiedFrontendProcess = Get-Process -Id $occupiedFrontendPid -ErrorAction SilentlyContinue
    $occupiedFrontendName = if ($occupiedFrontendProcess) { $occupiedFrontendProcess.ProcessName } else { "unknown" }
    throw "Port 5173 is occupied by PID $occupiedFrontendPid ($occupiedFrontendName), but it is not this project's frontend."
  }

  $frontendLauncher = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run", "preview", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort" `
    -WorkingDirectory (Join-Path $Root "frontend") `
    -RedirectStandardOutput $FrontendLog `
    -RedirectStandardError $FrontendLog.Replace(".log", ".err.log") `
    -WindowStyle Hidden `
    -PassThru

  for ($attempt = 1; $attempt -le 20; $attempt++) {
    if (Get-FrontendHealth) { break }
    if ($frontendLauncher.HasExited) { break }
    Start-Sleep -Milliseconds 500
  }
  if (-not (Get-FrontendHealth)) {
    throw "Frontend is not ready. See $FrontendLog"
  }
  $frontendPid = Get-ListenerProcessId -Port 5173
  if (-not $frontendPid) {
    throw "Frontend responded but the listener PID on port 5173 was not found."
  }
  $processes.frontend = [int]$frontendPid
}

if ($EnableTailscaleFunnel) {
  & tailscale.exe funnel --bg http://127.0.0.1:5173
  if ($LASTEXITCODE -ne 0) { throw "Could not enable Tailscale Funnel." }
  Write-Host "Public URL: $publicOrigin" -ForegroundColor Green
}

$processes | ConvertTo-Json | Set-Content -LiteralPath $PidFile -Encoding utf8
Write-Host "Production server is running. Health: http://127.0.0.1:5000/api/health" -ForegroundColor Green
Write-Host "Website: http://localhost:5173" -ForegroundColor Green
Write-Host "PID file: $PidFile"
