$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Assert-Contains {
    param([string]$Path, [string[]]$Patterns)
    if (-not (Test-Path -LiteralPath $Path)) { throw "Missing smoke file: $Path" }
    $content = Get-Content -LiteralPath $Path -Raw
    foreach ($pattern in $Patterns) {
        if ($content -notmatch $pattern) { throw "$Path is missing required smoke assertion: $pattern" }
    }
}

function Assert-TextContains {
    param([string]$Name, [string]$Content, [string[]]$Patterns)
    foreach ($pattern in $Patterns) {
        if ($Content -notmatch $pattern) { throw "$Name is missing required smoke assertion: $pattern" }
    }
}

$install = Join-Path $PSScriptRoot "install-smoke.ps1"
$upgrade = Join-Path $PSScriptRoot "upgrade-smoke.ps1"
$uninstall = Join-Path $PSScriptRoot "uninstall-smoke.ps1"
$common = Join-Path $PSScriptRoot "smoke-common.ps1"
$checklist = Join-Path $repoRoot "docs\windows-release-checklist.md"

$installSurface = (Get-Content -LiteralPath $common -Raw) + (Get-Content -LiteralPath $install -Raw)
Assert-TextContains "install smoke surface" $installSurface @(
    "ConfirmDisposableMachine",
    "Win32_Service",
    "StartMode",
    "/api/health",
    "/api/auth/setup",
    "/api/public/daymark/bookings",
    "Restart-Service",
    "ResumeAfterRestart",
    "cloudflared",
    "ManualWarningConfirmed",
    "ConvertTo-Json"
)
$commonContent = Get-Content -LiteralPath $common -Raw
$upgradeSurface = $commonContent + (Get-Content -LiteralPath $upgrade -Raw)
$uninstallSurface = $commonContent + (Get-Content -LiteralPath $uninstall -Raw)
Assert-TextContains "upgrade smoke surface" $upgradeSurface @(
    "ConfirmDisposableMachine",
    "PreviousInstaller",
    "backups",
    "Get-FileHash",
    "booking",
    "ConvertTo-Json"
)
Assert-TextContains "uninstall smoke surface" $uninstallSurface @(
    "ConfirmDisposableMachine",
    "uninstall\.exe",
    "ProgramData",
    "data",
    "backups",
    "ConvertTo-Json"
)
Assert-Contains $checklist @(
    "Windows 10 x64",
    "Windows 11 x64",
    "installer SHA-256",
    "No secrets",
    "Not yet run"
)

Write-Output "Daymark disposable Windows smoke contract passed."
