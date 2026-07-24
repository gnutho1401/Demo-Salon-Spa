@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=start"

if /I "%ACTION%"=="start" goto START
if /I "%ACTION%"=="restart" goto RESTART
if /I "%ACTION%"=="stop" goto STOP
if /I "%ACTION%"=="status" goto STATUS
if /I "%ACTION%"=="public" goto PUBLIC
if /I "%ACTION%"=="help" goto HELP
if /I "%ACTION%"=="--help" goto HELP
if /I "%ACTION%"=="/?" goto HELP

echo [LOI] Lenh khong hop le: %ACTION%
goto HELP_ERROR

:START
echo.
echo ==============================================
echo   LUNA BEAUTY SALON - KHOI DONG HE THONG
echo ==============================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\start-production.ps1" -StartAiWorker
if errorlevel 1 goto FAILED
echo.
echo [OK] Website: http://localhost:5173
echo [OK] AI Worker: http://127.0.0.1:8189/health
if /I not "%~2"=="--no-open" start "" "http://localhost:5173"
exit /b 0

:RESTART
call "%~f0" stop
if errorlevel 1 goto FAILED
call "%~f0" start %~2
exit /b %errorlevel%

:PUBLIC
echo.
echo ==============================================
echo   LUNA BEAUTY SALON - PUBLIC QUA TAILSCALE
echo ==============================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\start-production.ps1" -StartAiWorker -EnableTailscaleFunnel
if errorlevel 1 goto FAILED
echo [OK] Website public da san sang. Xem URL o phia tren.
exit /b 0

:STOP
echo.
echo Dang dung he thong...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\stop-production.ps1"
if errorlevel 1 goto FAILED
echo [OK] Da dung he thong.
exit /b 0

:STATUS
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$frontend = $null; $backend = $null; $ai = $null; try { $frontend = Invoke-WebRequest 'http://localhost:5173' -UseBasicParsing -TimeoutSec 3 } catch {}; try { $backend = Invoke-RestMethod 'http://localhost:5173/api/health' -TimeoutSec 3 } catch {}; try { $ai = Invoke-RestMethod 'http://127.0.0.1:8189/health' -TimeoutSec 3 } catch {}; Write-Host ''; Write-Host 'LUNA Beauty Salon - Trang thai'; Write-Host '--------------------------------'; if ($frontend -and $frontend.StatusCode -eq 200) { Write-Host 'Frontend        : RUNNING - port 5173' -ForegroundColor Green } else { Write-Host 'Frontend        : STOPPED' -ForegroundColor Yellow }; if ($backend -and $backend.status -eq 'ok') { Write-Host ('Backend         : RUNNING - database ' + $backend.database) -ForegroundColor Green } else { Write-Host 'Backend         : STOPPED' -ForegroundColor Yellow }; if ($ai -and $ai.status -eq 'ready') { Write-Host 'AI Worker       : READY' -ForegroundColor Green } else { Write-Host 'AI Worker       : STOPPED/NOT READY' -ForegroundColor Yellow }; Write-Host 'Website         : http://localhost:5173'; if (-not $frontend -or -not $backend) { exit 1 }"
exit /b %errorlevel%

:HELP
echo.
echo Cach dung:
echo   salon.cmd                 Khoi dong backend, website va AI
echo   salon.cmd start           Tuong tu lenh tren
echo   salon.cmd status          Xem trang thai
echo   salon.cmd restart         Khoi dong lai
echo   salon.cmd stop            Dung he thong
echo   salon.cmd public          Chay public qua Tailscale Funnel
echo   salon.cmd start --no-open Khoi dong nhung khong mo trinh duyet
exit /b 0

:HELP_ERROR
call :HELP
exit /b 2

:FAILED
echo.
echo [LOI] Khong the hoan tat. Xem log trong thu muc .runtime
exit /b 1
