param(
    [Parameter(Mandatory = $true)]
    [string]$Installer,
    [string]$ReleaseDir
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$installerPath = (Resolve-Path $Installer).Path
if (-not $ReleaseDir) { $ReleaseDir = Join-Path $repoRoot "artifacts\release" }
$releasePath = [System.IO.Path]::GetFullPath($ReleaseDir)
if ($releasePath.TrimEnd('\') -eq [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\')) {
    throw "Refusing to write release artifacts into the repository root."
}

$version = (Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$') { throw "The Daymark version is invalid." }
$artifactName = "Daymark-Setup-x64-$version.exe"

New-Item -ItemType Directory -Force $releasePath | Out-Null
Get-ChildItem $releasePath -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "Daymark-Setup-x64-*.exe" -or $_.Name -in @("SHA256SUMS.txt", "inspection.json") } |
    Remove-Item -Force

$artifactPath = Join-Path $releasePath $artifactName
Copy-Item -LiteralPath $installerPath -Destination $artifactPath
$hash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText(
    (Join-Path $releasePath "SHA256SUMS.txt"),
    "$hash  $artifactName`n",
    [System.Text.Encoding]::ASCII
)

Write-Output $artifactPath
