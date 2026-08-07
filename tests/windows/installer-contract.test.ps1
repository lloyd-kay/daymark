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
$hooksPath = Join-Path $repoRoot "packaging\windows\installer-hooks.nsh"
$layoutPath = Join-Path $repoRoot "packaging\windows\install-layout.json"
$headerPath = Join-Path $repoRoot "packaging\windows\assets\header.bmp"
$sidebarPath = Join-Path $repoRoot "packaging\windows\assets\sidebar.bmp"

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$rootPackage = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
Assert-True ($rootPackage.scripts."windows:installer" -match "build-windows-installer\.ps1") "The installer command must use the safe short-path build wrapper."
Assert-True ($config.bundle.active -eq $true) "Tauri bundling must be active."
Assert-True (@($config.bundle.targets) -contains "nsis") "The Windows bundle target must include NSIS."
Assert-True ($config.bundle.windows.nsis.installMode -eq "perMachine") "The installer must be per-machine."
Assert-True ($config.bundle.windows.nsis.installerHooks -eq "../../../packaging/windows/installer-hooks.nsh") "The installer hooks path is missing."
Assert-True ($config.build.beforeBuildCommand -match "build-windows-launcher\.ps1") "The release launcher must be staged before Tauri validates resources."
$resourceMap = $config.bundle.resources
Assert-True ($resourceMap."../../../artifacts/windows-stage/DaymarkRuntime.exe" -eq "DaymarkRuntime.exe") "The installer must consume the staged release launcher."
Assert-True (Test-Path $hooksPath) "The installer hooks file is missing."
Assert-True (Test-Path $layoutPath) "The install layout manifest is missing."
Assert-True (Test-Path $headerPath) "The branded installer header is missing."
Assert-True (Test-Path $sidebarPath) "The branded installer sidebar is missing."

$hooks = Get-Content $hooksPath -Raw
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

$layout = Get-Content $layoutPath -Raw | ConvertFrom-Json
Assert-True ($layout.installRoot -eq "%ProgramFiles%\Daymark") "Application files must install under Program Files."
Assert-True ($layout.dataRoot -eq "%ProgramData%\Daymark") "Business data must remain under ProgramData."
Assert-True (@($layout.preservedOnUninstall) -contains "data") "Uninstall must preserve Daymark data."
Assert-True (@($layout.preservedOnUninstall) -contains "backups") "Uninstall must preserve Daymark backups."

Write-Output "Daymark installer contract passed."
