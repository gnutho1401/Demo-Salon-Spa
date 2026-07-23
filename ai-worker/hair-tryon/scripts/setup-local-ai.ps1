param(
    [switch]$SkipDiffusionModel
)

$ErrorActionPreference = "Stop"
$Script = "/mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon/scripts/setup-local-ai-wsl.sh"
$Arguments = @("-d", "SalonAI", "-u", "root", "--", "bash", $Script)
if ($SkipDiffusionModel) {
    $Arguments += "--skip-model"
}

& wsl.exe @Arguments
if ($LASTEXITCODE -ne 0) {
    throw "Local AI setup in WSL failed."
}

Write-Host "Local AI setup is complete. Run scripts\start-local-ai.ps1 to start it."
