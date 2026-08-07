$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $repoRoot "artifacts\release"
$installers = @(Get-ChildItem $releaseDir -Filter "Daymark-Setup-x64-*.exe" -ErrorAction SilentlyContinue)
if ($installers.Count -ne 1) { throw "Expected exactly one normalized Daymark installer." }

$checksumFile = Join-Path $releaseDir "SHA256SUMS.txt"
if (-not (Test-Path $checksumFile)) { throw "SHA256SUMS.txt is missing." }
$checksum = Get-Content $checksumFile -Raw
if ($checksum -notmatch '^[a-f0-9]{64}  Daymark-Setup-x64-.+\.exe\r?\n$') {
    throw "SHA256SUMS.txt is not in the expected portable format."
}
$actualHash = (Get-FileHash -LiteralPath $installers[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not $checksum.StartsWith($actualHash + "  ")) { throw "The installer checksum does not match the artifact." }

$inspectionPath = Join-Path $releaseDir "inspection.json"
if (-not (Test-Path $inspectionPath)) { throw "The installer inspection report is missing." }
$inspection = Get-Content $inspectionPath -Raw | ConvertFrom-Json
if ($inspection.signature -ne "Unsigned preview") { throw "The preview must be reported as unsigned." }
if ($inspection.architecture -ne "x64") { throw "The installer must target x64 Windows." }
if (-not $inspection.payloadAllowlistPassed) { throw "The staged payload allowlist did not pass." }

Write-Output "Daymark Windows artifact checks passed."
