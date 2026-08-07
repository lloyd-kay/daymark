param(
    [Parameter(Mandatory = $true)][string]$PreviousInstaller,
    [Parameter(Mandatory = $true)][string]$Installer,
    [switch]$ConfirmDisposableMachine,
    [string]$ResultPath = "$env:ProgramData\Daymark\smoke\upgrade-result.json"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "smoke-common.ps1")
$os = Assert-DaymarkDisposableMachine $ConfirmDisposableMachine.IsPresent
$previousPath = (Resolve-Path -LiteralPath $PreviousInstaller).Path
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$checkpointPath = "$env:ProgramData\Daymark\smoke\install-checkpoint.json"
if (-not (Test-Path -LiteralPath $checkpointPath)) {
    throw "Run install-smoke.ps1 with the previous installer and complete its restart phase before the upgrade test."
}
$checkpoint = Get-Content -LiteralPath $checkpointPath -Raw | ConvertFrom-Json
$backupRoot = "$env:ProgramData\Daymark\backups"
$before = @(Get-ChildItem -LiteralPath $backupRoot -Filter "*.json" -ErrorAction SilentlyContinue | ForEach-Object FullName)

Invoke-DaymarkInstaller $installerPath
Assert-DaymarkAutomaticService | Out-Null
Wait-DaymarkHealth | Out-Null
$after = @(Get-ChildItem -LiteralPath $backupRoot -Filter "*.json" -ErrorAction Stop | ForEach-Object FullName)
$newManifests = @($after | Where-Object { $before -notcontains $_ })
if ($newManifests.Count -lt 1) { throw "The upgrade did not create a pre-upgrade backup." }
foreach ($manifest in $newManifests) {
    if (-not (Test-DaymarkBackupManifest $manifest)) { throw "The upgrade backup failed its SHA-256 verification." }
}
$booking = @{
    employeeId = $checkpoint.employeeId
    startAt = $checkpoint.startAt
    clientName = "Daymark smoke visitor"
    clientAddress = "1 Test Street, London"
    clientEmail = "smoke@example.invalid"
    clientPhone = $null
    clientNote = "Disposable Windows verification"
}
if (-not (Test-DaymarkBookingConflict $booking)) { throw "The test booking was not preserved by the upgrade." }

Write-DaymarkSmokeResult @{
    status = "passed"
    os = $os.Caption
    osBuild = $os.BuildNumber
    previousInstallerSha256 = (Get-FileHash -LiteralPath $previousPath -Algorithm SHA256).Hash.ToLowerInvariant()
    installerSha256 = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant()
    verifiedBackupCount = $newManifests.Count
    bookingPreserved = $true
    health = "ok"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
} $ResultPath
