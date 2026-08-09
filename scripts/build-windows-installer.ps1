$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stageRoot = Join-Path $repoRoot "artifacts\windows-stage"
$bundleDirectory = Join-Path $repoRoot "desktop\daymark-control\src-tauri\target\release\bundle\nsis"
if (-not (Test-Path (Join-Path $stageRoot "cloudflared.exe")) -or
    -not (Test-Path (Join-Path $stageRoot "node\node.exe")) -or
    -not (Test-Path (Join-Path $stageRoot "stop-daymark-processes.ps1"))) {
    throw "Run the verified Windows staging step before building the installer."
}

# Tauri keeps installers from earlier versions in the bundle directory. Remove
# only those generated outputs so a version bump always publishes one package.
if (Test-Path -LiteralPath $bundleDirectory) {
    Get-ChildItem -LiteralPath $bundleDirectory -Filter "*.exe" -File | Remove-Item -Force
}

$availableDrive = @("R", "S", "T", "U") | Where-Object { -not (Test-Path ("{0}:\" -f $_)) } | Select-Object -First 1
if (-not $availableDrive) { throw "No temporary build drive is available." }
$drive = "$availableDrive`:"
$originalLocation = Get-Location
$previousNsisStageRoot = $env:DAYMARK_NSIS_STAGE_ROOT

try {
    & subst.exe $drive $repoRoot
    if ($LASTEXITCODE -ne 0) { throw "Windows could not create the temporary short build path." }
    $env:DAYMARK_NSIS_STAGE_ROOT = Join-Path $drive "artifacts\windows-stage"
    Set-Location "$drive\"

    & npm.cmd --prefix desktop/daymark-control run tauri build -- --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw "The Daymark NSIS installer build failed." }
}
finally {
    Set-Location $originalLocation
    if ($null -eq $previousNsisStageRoot) {
        Remove-Item Env:\DAYMARK_NSIS_STAGE_ROOT -ErrorAction SilentlyContinue
    }
    else {
        $env:DAYMARK_NSIS_STAGE_ROOT = $previousNsisStageRoot
    }
    & subst.exe $drive /D | Out-Null
}

$builtInstallers = @(Get-ChildItem $bundleDirectory -Filter "*.exe")
if ($builtInstallers.Count -ne 1) { throw "Expected exactly one NSIS installer output." }

$releaseInstaller = & (Join-Path $PSScriptRoot "write-sha256s.ps1") -Installer $builtInstallers[0].FullName
& (Join-Path $PSScriptRoot "inspect-windows-installer.ps1") -Installer $releaseInstaller

Write-Output "Daymark installer ready: $releaseInstaller"
