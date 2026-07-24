<#
.SYNOPSIS
Khởi động toàn bộ hệ thống Demo-Salon-Spa và lấy tên miền Internet bằng Cloudflare Tunnels.
#>

$ErrorActionPreference = "Stop"

# Prevent Windows PowerShell 5.1 Start-Process from failing when the parent
# environment contains both "Path" and "PATH".
$processPath = [Environment]::GetEnvironmentVariable("Path", "Process")
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", $processPath, "Process")

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   KHOI DONG HE THONG DEMO-SALON-SPA          " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# 0. Don dep cac tien trinh cloudflared/node bi ket (Neu co)
Write-Host "[0/5] Don dep moi truong..." -ForegroundColor Yellow
Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 1. Kiem tra va cai dat dependencies cho Backend
Write-Host "[1/5] Kiem tra Backend..." -ForegroundColor Yellow
if (-not (Test-Path "backend/node_modules")) {
    Write-Host "Dang cai dat thu vien cho Backend..." -ForegroundColor Gray
    Start-Process "cmd.exe" -ArgumentList "/c cd backend && npm install" -Wait
}


Write-Host "Khoi dong Backend (Port 5000)..." -ForegroundColor Green
$backendProcess = Start-Process "cmd.exe" -ArgumentList "/c title [BACKEND] && cd backend && npm start" -PassThru


# 2. Expose Backend ra Internet qua Cloudflare
Write-Host "[2/5] Khoi tao ten mien Internet cho Backend..." -ForegroundColor Yellow
if (Test-Path "backend-tunnel.log") { Remove-Item "backend-tunnel.log" -Force }

# Chay cloudflared an danh (hidden) de lay URL
$cfBackendProcess = Start-Process "cmd.exe" -ArgumentList "/c .\cloudflared.exe tunnel --url http://localhost:5000 > backend-tunnel.log 2>&1" -WindowStyle Hidden -PassThru

# Doi Cloudflare cap URL (toi da 30 giay)
$backendUrl = ""
Write-Host "Dang cho Cloudflare cap phat URL Backend" -NoNewline
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
    if (Test-Path "backend-tunnel.log") {
        $match = Select-String -Path "backend-tunnel.log" -Pattern "https://[a-zA-Z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue
        if ($match) {
            # Handle both MatchInfo array and single MatchInfo safely
            $backendUrl = ($match | Select-Object -First 1).Matches[0].Value
            break
        }
    }
}
Write-Host ""

if ($backendUrl) {
    Write-Host "-> Backend URL: $backendUrl" -ForegroundColor Cyan
    
    # Cap nhat file .env cua frontend
    $envPath = "frontend/.env"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath
        # Xoa dong VITE_API_URL cu
        $envContent = $envContent | Where-Object { $_ -notmatch "^VITE_API_URL=" }
        # Them VITE_API_URL moi
        $envContent += "VITE_API_URL=$backendUrl"
        $envContent | Set-Content $envPath
        Write-Host "Da cap nhat frontend/.env thanh cong!" -ForegroundColor Green
    } else {
        "VITE_API_URL=$backendUrl" | Set-Content $envPath
        Write-Host "Da tao frontend/.env moi!" -ForegroundColor Green
    }
} else {
    Write-Host "Khong lay duoc Backend URL. Vui long kiem tra lai cloudflared." -ForegroundColor Red
}


# 3. Kiem tra AI Worker (Optional)
Write-Host "[3/5] Kiem tra AI Worker..." -ForegroundColor Yellow
$aiProcess = $null
$aiHealthUrl = "http://127.0.0.1:8189/health"
$aiReady = $false
try {
    $aiHealth = Invoke-RestMethod -Uri $aiHealthUrl -TimeoutSec 3
    $aiReady = $aiHealth.status -eq "ready"
} catch {}

if ($aiReady) {
    Write-Host "AI Worker da san sang tai $aiHealthUrl. Tai su dung tien trinh hien co." -ForegroundColor Green
} else {
    $aiStartScript = Join-Path $PSScriptRoot "ai-worker/hair-tryon/scripts/start-local-ai.ps1"
    Write-Host "Khoi dong AI Worker bang trinh quan ly cong thong nhat (Port 8189)..." -ForegroundColor Green
    $aiProcess = Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$aiStartScript`"" `
        -WorkingDirectory $PSScriptRoot `
        -PassThru
}


# 4. Kiem tra va cai dat dependencies cho Frontend
Write-Host "[4/5] Kiem tra Frontend..." -ForegroundColor Yellow
if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "Dang cai dat thu vien cho Frontend..." -ForegroundColor Gray
    Start-Process "cmd.exe" -ArgumentList "/c cd frontend && npm install" -Wait
}
Write-Host "Khoi dong Frontend (Port 5173)..." -ForegroundColor Green
$frontendProcess = Start-Process "cmd.exe" -ArgumentList "/c title [FRONTEND] && cd frontend && npm run dev" -PassThru


# 5. Expose Frontend ra Internet
Write-Host "[5/5] Khoi tao ten mien Internet cho Frontend..." -ForegroundColor Yellow
if (Test-Path "frontend-tunnel.log") { Remove-Item "frontend-tunnel.log" -Force }

$cfFrontendProcess = Start-Process "cmd.exe" -ArgumentList "/c .\cloudflared.exe tunnel --url http://localhost:5173 > frontend-tunnel.log 2>&1" -WindowStyle Hidden -PassThru

# Doi Cloudflare cap URL (toi da 30 giay)
$frontendUrl = ""
Write-Host "Dang cho Cloudflare cap phat URL Frontend" -NoNewline
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
    if (Test-Path "frontend-tunnel.log") {
        $match = Select-String -Path "frontend-tunnel.log" -Pattern "https://[a-zA-Z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue
        if ($match) {
            # Handle both MatchInfo array and single MatchInfo safely
            $frontendUrl = ($match | Select-Object -First 1).Matches[0].Value
            break
        }
    }
}
Write-Host ""

if ($frontendUrl) {
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host " HE THONG DA KHOI DONG THANH CONG!            " -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "LINK CHO KHACH HANG TRUY CAP: $frontendUrl" -ForegroundColor Yellow
    Write-Host "API Backend: $backendUrl" -ForegroundColor Gray
    Write-Host "==============================================" -ForegroundColor Cyan
}

# Luu lai cac tien trinh de dung script stop
$pids = @($backendProcess.Id, $cfBackendProcess.Id, $frontendProcess.Id, $cfFrontendProcess.Id)
if ($aiProcess) {
    $pids += $aiProcess.Id
}
$pids -join "," | Set-Content "server.pid"

Write-Host ""
Write-Host "Ban co the de nguyen cua so nay de xem ten mien." -ForegroundColor Cyan
Read-Host -Prompt "Nhan Enter de thoat cua so nay (Cac may chu van se chay ngam)"

Write-Host "Ghi chu: De tat server, hay chay file stop-server.ps1 hoac tat thu cong cac cua so cmd vua hien len." -ForegroundColor Gray
