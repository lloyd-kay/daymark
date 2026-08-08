$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

$configPath = Join-Path $repoRoot "desktop\daymark-control\src-tauri\tauri.conf.json"
$stageScriptPath = Join-Path $repoRoot "scripts\stage-windows-runtime.ps1"
$inspectionScriptPath = Join-Path $repoRoot "scripts\inspect-windows-installer.ps1"
$hooksPath = Join-Path $repoRoot "packaging\windows\installer-hooks.nsh"
$layoutPath = Join-Path $repoRoot "packaging\windows\install-layout.json"
$installGuidePath = Join-Path $repoRoot "docs\install\windows.md"
$headerPath = Join-Path $repoRoot "packaging\windows\assets\header.bmp"
$sidebarPath = Join-Path $repoRoot "packaging\windows\assets\sidebar.bmp"

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$rootPackage = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
Assert-True ($rootPackage.scripts."windows:installer" -match "build-windows-installer\.ps1") "The installer command must use the safe short-path build wrapper."
Assert-True ($rootPackage.scripts."windows:test-staged-migration" -match "staged-migration\.test\.ps1") "The packaged runtime migration test must be available as a repeatable command."
Assert-True ($config.bundle.active -eq $true) "Tauri bundling must be active."
Assert-True (@($config.bundle.targets) -contains "nsis") "The Windows bundle target must include NSIS."
Assert-True ($config.bundle.windows.nsis.installMode -eq "perMachine") "The installer must be per-machine."
Assert-True ($config.bundle.windows.nsis.installerHooks -eq "../../../packaging/windows/installer-hooks.nsh") "The installer hooks path is missing."
Assert-True ($config.build.beforeBuildCommand -match "build-windows-launcher\.ps1") "The release launcher must be staged before Tauri validates resources."
$resourceMap = $config.bundle.resources
Assert-True ($resourceMap."../../../artifacts/windows-stage/DaymarkRuntime.exe" -eq "DaymarkRuntime.exe") "The installer must consume the staged release launcher."
Assert-True ($resourceMap."../../../artifacts/windows-stage/lib/" -eq "lib") "The installer must bundle the shared runtime library."
Assert-True ($resourceMap."../../../artifacts/windows-stage/package.json" -eq "package.json") "The installer must bundle the version metadata used by runtime health."
Assert-True ($resourceMap."../../../artifacts/windows-stage/vc_redist.x64.exe" -eq "vc_redist.x64.exe") "The installer must bundle the Visual C++ prerequisite."
Assert-True (Test-Path $stageScriptPath) "The Windows staging script is missing."
Assert-True (Test-Path $inspectionScriptPath) "The Windows installer inspection script is missing."
Assert-True (Test-Path $hooksPath) "The installer hooks file is missing."
Assert-True (Test-Path $layoutPath) "The install layout manifest is missing."
Assert-True (Test-Path $installGuidePath) "The Windows installation guide is missing."
Assert-True (Test-Path $headerPath) "The branded installer header is missing."
Assert-True (Test-Path $sidebarPath) "The branded installer sidebar is missing."

$hooks = Get-Content $hooksPath -Raw
$stageScript = Get-Content $stageScriptPath -Raw
$inspectionScript = Get-Content $inspectionScriptPath -Raw
Assert-True ($stageScript -match 'foreach \(\$directory in @\("dist", "drizzle", "runtime", "lib"\)\)') "The Windows stage must copy the shared runtime library."
Assert-True ($stageScript -match 'Join-Path \$repoRoot "package\.json"\) -Destination \(Join-Path \$workingPath "package\.json"') "The Windows stage must copy runtime version metadata."
Assert-True ($inspectionScript -match '"lib"') "The installer payload inspector must allow the shared runtime library."
Assert-True ($inspectionScript -match '"package\.json"') "The installer payload inspector must allow runtime version metadata."
Assert-True ($inspectionScript -match 'Get-AuthenticodeSignature\s+-LiteralPath\s+\$vcRedist') "Inspection must verify the prerequisite signature."
Assert-True ($hooks -match 'MessageBox MB_OK\|MB_ICONINFORMATION "Unsigned preview[^\r\n]+" /SD IDOK') "Silent installs must not wait on the unsigned-preview information dialog."
Assert-True ($hooks -match 'MessageBox MB_YESNO\|MB_ICONEXCLAMATION\|MB_DEFBUTTON2 "Daymark could not create the pre-upgrade backup[^\r\n]+" /SD IDNO') "Silent upgrades must abort safely instead of waiting on a failed-backup dialog."
$preinstallStart = $hooks.IndexOf('!macro NSIS_HOOK_PREINSTALL')
$preinstallEnd = $hooks.IndexOf('!macroend', $preinstallStart)
$preinstall = $hooks.Substring($preinstallStart, $preinstallEnd - $preinstallStart)
$upgradeBackupIndex = $preinstall.IndexOf('--backup')
$upgradeStopIndex = $preinstall.IndexOf('DaymarkService.exe" stop')
$upgradeUninstallIndex = $preinstall.IndexOf('DaymarkService.exe" uninstall')
Assert-True ($upgradeBackupIndex -ge 0 -and $upgradeBackupIndex -lt $upgradeStopIndex) "An upgrade must preserve a verified backup before stopping a healthy service."
Assert-True ($upgradeStopIndex -lt $upgradeUninstallIndex) "An upgrade must unregister the old service before installing the replacement."
foreach ($requiredPattern in @(
    "Unsigned preview",
    "Preserve Daymark data",
    "NSIS_HOOK_PREINSTALL",
    "NSIS_HOOK_POSTINSTALL",
    "NSIS_HOOK_PREUNINSTALL",
    "DaymarkService\.exe.*install",
    "DaymarkRuntime\.exe.*--ensure-setup-code",
    "DaymarkRuntime\.exe.*--migrate",
    "DaymarkRuntime\.exe.*--wait-for-health"
)) {
    Assert-True ($hooks -match $requiredPattern) "Installer hooks are missing pattern: $requiredPattern"
}

$vcIndex = $hooks.IndexOf('vc_redist.x64.exe')
$prepareIndex = $hooks.IndexOf('--prepare-install')
$migrateIndex = $hooks.IndexOf('--migrate')
Assert-True ($vcIndex -ge 0 -and $vcIndex -lt $prepareIndex -and $prepareIndex -lt $migrateIndex) "The Visual C++ prerequisite must run before Daymark preparation and migration."
foreach ($acceptedCode in @("1638", "3010")) {
    Assert-True ($hooks -match $acceptedCode) "The prerequisite policy must accept exit code $acceptedCode."
}

$layout = Get-Content $layoutPath -Raw | ConvertFrom-Json
Assert-True ($layout.installRoot -eq "%ProgramFiles%\Daymark Control") "The install layout must match Tauri's product directory."
Assert-True ($layout.dataRoot -eq "%ProgramData%\Daymark") "Business data must remain under ProgramData."
Assert-True (@($layout.immutable) -contains "lib") "The immutable install layout must include the shared runtime library."
Assert-True (@($layout.immutable) -contains "package.json") "The immutable install layout must include runtime version metadata."
Assert-True (@($layout.immutable) -contains "vc_redist.x64.exe") "The prerequisite must be part of the immutable payload."
Assert-True (@($layout.preservedOnUninstall) -contains "data") "Uninstall must preserve Daymark data."
Assert-True (@($layout.preservedOnUninstall) -contains "backups") "Uninstall must preserve Daymark backups."

$installGuide = Get-Content $installGuidePath -Raw
Assert-True ($installGuide -match '%ProgramFiles%\\Daymark Control') "The Windows guide must name the actual Tauri install directory."

Write-Output "Daymark installer contract passed."
