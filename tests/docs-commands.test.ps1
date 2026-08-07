$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$windows = Get-Content (Join-Path $repoRoot "docs\install\windows.md") -Raw
$docker = Get-Content (Join-Path $repoRoot "docs\install\docker.md") -Raw
$manual = Get-Content (Join-Path $repoRoot "docs\install\manual.md") -Raw

foreach ($required in @(
    'Get-ChildItem .\Daymark-Setup-x64-*.exe',
    'Get-FileHash $installer.FullName -Algorithm SHA256',
    'Get-Content .\SHA256SUMS.txt'
)) {
    if (-not $windows.Contains($required)) { throw "The Windows guide is missing: $required" }
}

foreach ($guide in @($docker, $manual)) {
    if ($guide -notmatch 'New-Object byte\[\] 20') { throw "A PowerShell guide is missing secure random-byte generation." }
    if ($guide -notmatch 'RandomNumberGenerator') { throw "A PowerShell guide is missing cryptographic random generation." }
    if ($guide -match 'replace-with-a-long-random-one-time-code\s*$') { throw "A guide leaves the example setup code as an instruction." }
}

$package = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
foreach ($name in @("dev", "build", "start")) {
    if ($package.scripts.$name -notmatch 'scripts/with-wrangler-log\.mjs') {
        throw "npm run $name is not cross-platform."
    }
}

Write-Output "Daymark documentation command checks passed."
