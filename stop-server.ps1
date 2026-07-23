<#
.SYNOPSIS
Dung tat ca cac tien trinh cua he thong Demo-Salon-Spa.
#>

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   DANG TAT HE THONG DEMO-SALON-SPA           " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Tat cac process duoc ghi lai trong server.pid
if (Test-Path "server.pid") {
    $pids = (Get-Content "server.pid" -Raw) -split ","
    foreach ($pid_str in $pids) {
        if ([int]::TryParse($pid_str, [ref]$null)) {
            $processId = [int]$pid_str
            # Dung Taskkill de kill process va cac children cua no
            Write-Host "Tat tien trinh PID $processId..." -ForegroundColor Gray
            Start-Process "taskkill.exe" -ArgumentList "/PID $processId /T /F" -WindowStyle Hidden -ErrorAction SilentlyContinue
        }
    }
    Remove-Item "server.pid" -Force
    Write-Host "Da tat cac tien trinh khoi dong tu script." -ForegroundColor Green
} else {
    Write-Host "Khong tim thay file server.pid." -ForegroundColor Yellow
}

# 2. Tat cac tien trinh cloudflared an danh (chac chan)
Write-Host "Tat cac tien trinh Cloudflare Tunnel..." -ForegroundColor Gray
Start-Process "taskkill.exe" -ArgumentList "/IM cloudflared.exe /F" -WindowStyle Hidden -ErrorAction SilentlyContinue

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " HE THONG DA DUOC TAT THANH CONG!             " -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Start-Sleep -Seconds 3
