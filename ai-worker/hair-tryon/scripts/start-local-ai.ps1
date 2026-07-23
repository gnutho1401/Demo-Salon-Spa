$ErrorActionPreference = "Stop"
$Script = "/mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon/scripts/start-local-ai-wsl.sh"

& wsl.exe -d SalonAI -u root -- bash $Script
if ($LASTEXITCODE -ne 0) {
    throw "Local AI worker stopped with an error."
}
