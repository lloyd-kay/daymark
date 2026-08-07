param(
    [switch]$ConfirmDisposableMachine,
    [string]$ResultPath = "$env:ProgramData\Daymark\smoke\uninstall-result.json"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "smoke-common.ps1")
$os = Assert-DaymarkDisposableMachine $ConfirmDisposableMachine.IsPresent
$installRoot = "$env:ProgramFiles\Daymark"
$dataRoot = "$env:ProgramData\Daymark"
$uninstaller = Join-Path $installRoot "uninstall.exe"
if (-not (Test-Path -LiteralPath $uninstaller)) { throw "The Daymark uninstall.exe could not be found." }
if (-not (Test-Path -LiteralPath (Join-Path $dataRoot "data"))) { throw "The Daymark ProgramData data folder is missing before uninstall." }
if (-not (Test-Path -LiteralPath (Join-Path $dataRoot "backups"))) { throw "The Daymark ProgramData backups folder is missing before uninstall." }

$process = Start-Process -FilePath $uninstaller -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "The Daymark uninstaller returned exit code $($process.ExitCode)." }
Start-Sleep -Seconds 2
if (Get-CimInstance Win32_Service -Filter "Name='Daymark'") { throw "The Daymark service remains after uninstall." }
if (Test-Path -LiteralPath $installRoot) { throw "Daymark application files remain under Program Files after uninstall." }
if (-not (Test-Path -LiteralPath (Join-Path $dataRoot "data"))) { throw "Uninstall removed the preserved Daymark data folder." }
if (-not (Test-Path -LiteralPath (Join-Path $dataRoot "backups"))) { throw "Uninstall removed the preserved Daymark backups folder." }

Write-DaymarkSmokeResult @{
    status = "passed"
    os = $os.Caption
    osBuild = $os.BuildNumber
    applicationRemoved = $true
    serviceRemoved = $true
    ProgramDataPreserved = $true
    dataPreserved = $true
    backupsPreserved = $true
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
} $ResultPath
