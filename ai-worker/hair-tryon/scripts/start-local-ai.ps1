[CmdletBinding()]
param(
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 8189
)

$ErrorActionPreference = "Stop"
$HealthUrl = "http://${HostAddress}:${Port}/health"
$WorkerRoot = Split-Path -Parent $PSScriptRoot
$WslScript = "/mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon/scripts/start-local-ai-wsl.sh"

function Test-AiWorkerReady {
    try {
        $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 3
        return $health.status -eq "ready"
    }
    catch {
        return $false
    }
}

if (Test-AiWorkerReady) {
    Write-Host "AI Worker is already ready at $HealthUrl. Reusing the existing process." -ForegroundColor Green
    exit 0
}

$listener = Get-NetTCPConnection -LocalAddress $HostAddress -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listener) {
    $processName = (Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue).ProcessName
    if (-not $processName) { $processName = "unknown" }
    throw "Port $Port is occupied by PID $($listener.OwningProcess) ($processName), but $HealthUrl is not a ready AI Worker. Stop that process or choose another configured port."
}

$distroNames = @(
    & wsl.exe --list --quiet 2>$null |
        ForEach-Object { ($_ -replace "`0", "").Trim() } |
        Where-Object { $_ }
)

if ($distroNames -contains "SalonAI") {
    Write-Host "Starting AI Worker in WSL distribution SalonAI on port $Port..." -ForegroundColor Cyan
    & wsl.exe -d SalonAI -u root -- bash $WslScript
    if ($LASTEXITCODE -ne 0) {
        throw "Local AI Worker stopped with an error."
    }
    exit 0
}

$venvPython = Join-Path $WorkerRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $venvPython)) {
    throw "Neither WSL distribution SalonAI nor $venvPython is available. Run setup-local-ai.ps1 or create the Windows virtual environment first."
}

Write-Host "Starting AI Worker from the Windows virtual environment on port $Port..." -ForegroundColor Cyan
Push-Location $WorkerRoot
try {
    $env:PYTHONIOENCODING = "utf-8"
    & $venvPython -m uvicorn app.main:app --host $HostAddress --port $Port
}
finally {
    Pop-Location
}
