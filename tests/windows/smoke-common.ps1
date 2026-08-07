$ErrorActionPreference = "Stop"

function Assert-DaymarkDisposableMachine {
    param([bool]$Confirmed)
    if (-not $Confirmed) {
        throw "This test installs or removes Daymark. Run it only on a disposable Windows test machine and pass -ConfirmDisposableMachine."
    }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this smoke test from an elevated Windows PowerShell window."
    }
    if (-not [Environment]::Is64BitOperatingSystem) { throw "Daymark smoke tests require 64-bit Windows." }
    $os = Get-CimInstance Win32_OperatingSystem
    if ([version]$os.Version -lt [version]"10.0") { throw "Daymark smoke tests require Windows 10 or Windows 11." }
    return $os
}

function Wait-DaymarkHealth {
    param([int]$TimeoutSeconds = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:3210/api/health" -TimeoutSec 3
            if ($health.status -eq "ok") { return $health }
        }
        catch {}
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "Daymark did not report a healthy local runtime within $TimeoutSeconds seconds."
}

function Assert-DaymarkAutomaticService {
    $service = Get-CimInstance Win32_Service -Filter "Name='Daymark'"
    if (-not $service) { throw "The Daymark Windows service is not installed." }
    if ($service.StartMode -ne "Auto") { throw "The Daymark Windows service is not set to start automatically." }
    if ($service.State -ne "Running") { throw "The Daymark Windows service is not running." }
    return $service
}

function Invoke-DaymarkInstaller {
    param([string]$Path)
    $resolved = (Resolve-Path -LiteralPath $Path).Path
    $process = Start-Process -FilePath $resolved -ArgumentList "/S" -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "The Daymark installer returned exit code $($process.ExitCode)." }
}

function Convert-DaymarkSecureString {
    param([Security.SecureString]$Value)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Write-DaymarkSmokeResult {
    param([hashtable]$Result, [string]$Path)
    $directory = Split-Path $Path -Parent
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $Result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
    Write-Output "Daymark smoke evidence: $Path"
}

function Test-DaymarkBookingConflict {
    param([hashtable]$BookingRequest)
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:3210/api/public/daymark/bookings" `
            -Method Post -ContentType "application/json" `
            -Body ($BookingRequest | ConvertTo-Json) -UseBasicParsing | Out-Null
    }
    catch {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 409) { return $true }
        throw
    }
    return $false
}

function Test-DaymarkBackupManifest {
    param([string]$ManifestPath)
    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    if ($manifest.formatVersion -ne 1 -or $manifest.integrity -ne "verified") { return $false }
    if ($manifest.sha256 -notmatch '^[a-f0-9]{64}$') { return $false }
    $sqlPath = Join-Path (Split-Path $ManifestPath -Parent) $manifest.sqlFile
    if (-not (Test-Path -LiteralPath $sqlPath)) { return $false }
    return (Get-FileHash -LiteralPath $sqlPath -Algorithm SHA256).Hash.ToLowerInvariant() -eq $manifest.sha256
}
