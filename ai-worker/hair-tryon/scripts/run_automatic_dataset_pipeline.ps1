param(
    [string]$Output = "",
    [int]$PerStyle = 4,
    [int]$MinSide = 512,
    [string]$ApiToken = "",
    [string]$AnalyzerToken = "",
    [string]$ApprovedManifest = "",
    [string]$PreparedOutput = "",
    [switch]$SkipDiscovery,
    [switch]$Train,
    [string]$PythonCommand = "python"
)

$ErrorActionPreference = "Stop"
$WorkerRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ([string]::IsNullOrWhiteSpace($Output)) {
    $Output = Join-Path $WorkerRoot "training\automatic-discovery"
}

$collector = Join-Path $PSScriptRoot "collect_openverse_hair_dataset.py"
$collectorArgs = @(
    $collector,
    "--output", $Output,
    "--per-style", $PerStyle,
    "--min-side", $MinSide
)
if (-not [string]::IsNullOrWhiteSpace($ApiToken)) {
    $collectorArgs += @("--api-token", $ApiToken)
}
if (-not [string]::IsNullOrWhiteSpace($AnalyzerToken)) {
    $collectorArgs += @("--analyzer-token", $AnalyzerToken)
}

if (-not $SkipDiscovery) {
    Write-Host "Discovering openly licensed hairstyle candidates..."
    & $PythonCommand @collectorArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Openverse discovery failed with exit code $LASTEXITCODE"
    }

    $reportPath = Join-Path $Output "report.json"
    if (-not (Test-Path -LiteralPath $reportPath)) {
        throw "Discovery report was not created: $reportPath"
    }
    $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
    Write-Host ("Candidates waiting for rights review: {0}" -f $report.accepted_for_review)
}

if ([string]::IsNullOrWhiteSpace($ApprovedManifest)) {
    if ($SkipDiscovery) {
        throw "-SkipDiscovery requires -ApprovedManifest."
    }
    Write-Host "Stopped before preparation: review attribution and rights, then provide -ApprovedManifest."
    exit 0
}

$approvedPath = (Resolve-Path -LiteralPath $ApprovedManifest).Path
if ([string]::IsNullOrWhiteSpace($PreparedOutput)) {
    $PreparedOutput = Join-Path $WorkerRoot "training\data-approved"
}

function Convert-ToWslPath([string]$Path) {
    $resolved = [System.IO.Path]::GetFullPath($Path)
    if ($resolved -match "^([A-Za-z]):\\(.*)$") {
        $drive = $Matches[1].ToLowerInvariant()
        $tail = $Matches[2] -replace "\\", "/"
        return "/mnt/$drive/$tail"
    }
    throw "Only Windows drive paths can be converted to WSL paths: $resolved"
}

$workerWsl = Convert-ToWslPath $WorkerRoot
$manifestWsl = Convert-ToWslPath $approvedPath
$preparedWsl = Convert-ToWslPath $PreparedOutput
$prepareCommand = @"
set -e
cd '$workerWsl'
source /opt/salon-ai/.venv/bin/activate
python scripts/prepare_lora_dataset.py --manifest '$manifestWsl' --output '$preparedWsl' --size 512
"@

Write-Host "Validating rights flags, frontal pose, face region and hair segmentation..."
wsl.exe -d SalonAI -- bash -lc $prepareCommand
if ($LASTEXITCODE -ne 0) {
    throw "Dataset preparation failed. No training was started."
}

if (-not $Train) {
    Write-Host "Approved dataset prepared. Use -Train only after reviewing the preparation report."
    exit 0
}

$trainOutputWsl = "$workerWsl/models/natural-hair-lora"
$trainCommand = @"
set -e
cd '$workerWsl'
source /opt/salon-ai/.venv/bin/activate
accelerate launch scripts/train_natural_hair_lora.py --dataset '$preparedWsl' --output '$trainOutputWsl' --rank 4 --steps 1800 --gradient-accumulation 4
"@

Write-Host "Starting LoRA training from the approved and validated dataset..."
wsl.exe -d SalonAI -- bash -lc $trainCommand
if ($LASTEXITCODE -ne 0) {
    throw "LoRA training failed with exit code $LASTEXITCODE"
}
Write-Host "Training completed: $trainOutputWsl"
