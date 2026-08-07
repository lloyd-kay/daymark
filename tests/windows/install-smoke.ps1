param(
    [string]$Installer,
    [switch]$ConfirmDisposableMachine,
    [switch]$ResumeAfterRestart,
    [switch]$ManualWarningConfirmed,
    [Security.SecureString]$SetupCode,
    [Security.SecureString]$AdminPassword,
    [string]$ResultPath = "$env:ProgramData\Daymark\smoke\install-result.json"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "smoke-common.ps1")
$os = Assert-DaymarkDisposableMachine $ConfirmDisposableMachine.IsPresent
$checkpointPath = "$env:ProgramData\Daymark\smoke\install-checkpoint.json"

if ($ResumeAfterRestart) {
    if (-not (Test-Path -LiteralPath $checkpointPath)) { throw "The pre-restart Daymark checkpoint is missing." }
    $checkpoint = Get-Content -LiteralPath $checkpointPath -Raw | ConvertFrom-Json
    $bootedAt = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime()
    if ($bootedAt -le [datetime]$checkpoint.bootedAt) { throw "Windows has not restarted since the Daymark checkpoint was created." }
    Assert-DaymarkAutomaticService | Out-Null
    Wait-DaymarkHealth | Out-Null
    $request = @{
        employeeId = $checkpoint.employeeId
        startAt = $checkpoint.startAt
        clientName = "Daymark smoke visitor"
        clientAddress = "1 Test Street, London"
        clientEmail = "smoke@example.invalid"
        clientPhone = $null
        clientNote = "Disposable Windows verification"
    }
    if (-not (Test-DaymarkBookingConflict $request)) { throw "The test booking did not persist across the Windows restart." }
    Write-DaymarkSmokeResult @{
        status = "passed"
        phase = "after_restart"
        os = $os.Caption
        osBuild = $os.BuildNumber
        serviceAutomatic = $true
        health = "ok"
        bookingPersistedAcrossMachineRestart = $true
        completedAt = (Get-Date).ToUniversalTime().ToString("o")
    } $ResultPath
    return
}

if (-not $Installer) { throw "Choose the Daymark installer to test." }
if (-not $ManualWarningConfirmed) {
    throw "Open Daymark Control, confirm the exact manual-mode warning is visible, then rerun with -ManualWarningConfirmed."
}
Invoke-DaymarkInstaller $Installer
Assert-DaymarkAutomaticService | Out-Null
Wait-DaymarkHealth | Out-Null

if (-not $SetupCode) { $SetupCode = Read-Host "Paste the protected Daymark setup code" -AsSecureString }
if (-not $AdminPassword) { $AdminPassword = Read-Host "Choose a temporary smoke-test administrator password (12+ characters)" -AsSecureString }
$plainSetup = Convert-DaymarkSecureString $SetupCode
$plainPassword = Convert-DaymarkSecureString $AdminPassword
$workspaceSlug = "smoke-$([guid]::NewGuid().ToString('N').Substring(0, 10))"
try {
    $setupBody = @{
        setupCode = $plainSetup
        workspaceName = "Daymark Smoke Company"
        workspaceSlug = $workspaceSlug
        displayName = "Smoke Administrator"
        email = "admin-$workspaceSlug@example.invalid"
        password = $plainPassword
    }
    $setup = Invoke-RestMethod -Uri "http://127.0.0.1:3210/api/auth/setup" -Method Post `
        -Headers @{ Origin = "http://127.0.0.1:3210" } -ContentType "application/json" `
        -Body ($setupBody | ConvertTo-Json)
    if (-not $setup.ok -or $setup.workspaceSlug -ne $workspaceSlug) { throw "The first company was not created." }
}
finally {
    $plainSetup = $null
    $plainPassword = $null
    $setupBody = $null
}

$employees = Invoke-RestMethod -Uri "http://127.0.0.1:3210/api/public/daymark/employees"
$employee = @($employees.employees)[0]
if (-not $employee.id) { throw "The public booking test team is unavailable." }
$from = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
$slots = Invoke-RestMethod -Uri "http://127.0.0.1:3210/api/public/daymark/slots?employeeId=$($employee.id)&from=$from"
$slot = @($slots.slots)[0]
if (-not $slot.startAt) { throw "No future appointment was available for the booking test." }
$bookingRequest = @{
    employeeId = $employee.id
    startAt = $slot.startAt
    clientName = "Daymark smoke visitor"
    clientAddress = "1 Test Street, London"
    clientEmail = "smoke@example.invalid"
    clientPhone = $null
    clientNote = "Disposable Windows verification"
}
$bookingResponse = Invoke-RestMethod -Uri "http://127.0.0.1:3210/api/public/daymark/bookings" `
    -Method Post -ContentType "application/json" -Body ($bookingRequest | ConvertTo-Json)
if (-not $bookingResponse.booking.reference) { throw "The public appointment was not created." }

Restart-Service -Name "Daymark" -Force
Wait-DaymarkHealth | Out-Null
if (-not (Test-DaymarkBookingConflict $bookingRequest)) { throw "The test booking did not persist across the service restart." }

$cloudflared = "$env:ProgramFiles\Daymark\cloudflared.exe"
$failedTunnel = Start-Process -FilePath $cloudflared `
    -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:1") `
    -WindowStyle Hidden -PassThru
if (-not $failedTunnel.WaitForExit(8000)) { Stop-Process -Id $failedTunnel.Id -Force }
Wait-DaymarkHealth | Out-Null

$bootedAt = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString("o")
Write-DaymarkSmokeResult @{
    status = "pending_restart"
    phase = "before_restart"
    os = $os.Caption
    osBuild = $os.BuildNumber
    installerSha256 = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
    serviceAutomatic = $true
    health = "ok"
    firstCompanyCreated = $true
    manualWarningConfirmed = $true
    quickTunnelFailureIsolated = $true
    bookingPersistedAcrossServiceRestart = $true
    bookingReference = $bookingResponse.booking.reference
    nextStep = "Restart Windows, then rerun this script with -ResumeAfterRestart -ConfirmDisposableMachine."
} $ResultPath
Write-DaymarkSmokeResult @{
    bootedAt = $bootedAt
    employeeId = $bookingRequest.employeeId
    startAt = $bookingRequest.startAt
    bookingReference = $bookingResponse.booking.reference
} $checkpointPath
