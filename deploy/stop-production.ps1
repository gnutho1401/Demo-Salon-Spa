$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PidFile = Join-Path $Root ".runtime/production-pids.json"

function Get-ListenerProcessId([int]$Port) {
  return @(
    & netstat.exe -ano |
      ForEach-Object {
        $line = [string]$_
        if ($line -like "*:$Port *" -and $line -match "LISTENING\s+(\d+)$") {
          [int]$Matches[1]
        }
      } |
      Sort-Object -Unique
  ) | Select-Object -First 1
}

if (Get-Command "tailscale.exe" -ErrorAction SilentlyContinue) {
  & tailscale.exe funnel reset 2>$null
}

$stoppedProcessIds = @()
if (Test-Path $PidFile) {
  $processes = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
  foreach ($property in $processes.PSObject.Properties) {
    $processId = [int]$property.Value
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $processId
      $stoppedProcessIds += $processId
      Write-Host "Stopped $($property.Name) (PID $processId)"
    }
  }
  Remove-Item -LiteralPath $PidFile
}

# Recover cleanly if the PID file was removed but this project's backend is
# still serving its health endpoint on the standard port.
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 2
} catch {
  $health = $null
}

if ($health -and $health.status -eq "ok") {
  $backendPid = Get-ListenerProcessId -Port 5000
  if ($backendPid -and $stoppedProcessIds -notcontains $backendPid) {
    Stop-Process -Id $backendPid
    Write-Host "Stopped detected backend on port 5000 (PID $backendPid)"
  }
}

# Recover the Vite preview process when the PID file is stale or missing.
try {
  $frontendResponse = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 2
  $frontendIsProject = $frontendResponse.StatusCode -eq 200 -and $frontendResponse.Content -match "LUNA Beauty Salon"
} catch {
  $frontendIsProject = $false
}

if ($frontendIsProject) {
  $frontendPid = Get-ListenerProcessId -Port 5173
  if ($frontendPid -and $stoppedProcessIds -notcontains $frontendPid) {
    Stop-Process -Id $frontendPid
    Write-Host "Stopped detected frontend on port 5173 (PID $frontendPid)"
  }
}

if (-not $health -and -not $stoppedProcessIds.Count) {
  Write-Host "The system is stopped; no backend is running on port 5000."
}
