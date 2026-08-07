$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stageRoot = Join-Path $repoRoot "artifacts\windows-stage"
if (-not (Test-Path (Join-Path $stageRoot "cloudflared.exe")) -or -not (Test-Path (Join-Path $stageRoot "node\node.exe"))) {
    throw "Run the verified Windows staging step before building the installer."
}

$availableDrive = @("R", "S", "T", "U") | Where-Object { -not (Test-Path ("{0}:\" -f $_)) } | Select-Object -First 1
if (-not $availableDrive) { throw "No temporary build drive is available." }
$drive = "$availableDrive`:"
$originalLocation = Get-Location

try {
    & subst.exe $drive $repoRoot
    if ($LASTEXITCODE -ne 0) { throw "Windows could not create the temporary short build path." }
    Set-Location "$drive\"

    & npm.cmd --prefix desktop/daymark-control run tauri build -- --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw "The Daymark NSIS installer build failed." }
}
finally {
    Set-Location $originalLocation
    & subst.exe $drive /D | Out-Null
}

$bundleDirectory = Join-Path $repoRoot "desktop\daymark-control\src-tauri\target\release\bundle\nsis"
$builtInstallers = @(Get-ChildItem $bundleDirectory -Filter "*.exe")
if ($builtInstallers.Count -ne 1) { throw "Expected exactly one NSIS installer output." }

$releaseInstaller = & (Join-Path $PSScriptRoot "write-sha256s.ps1") -Installer $builtInstallers[0].FullName
& (Join-Path $PSScriptRoot "inspect-windows-installer.ps1") -Installer $releaseInstaller

Write-Output "Daymark installer ready: $releaseInstaller"
