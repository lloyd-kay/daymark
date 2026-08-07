param(
    [Parameter(Mandatory = $true)]
    [string]$Installer,
    [string]$StageDir,
    [string]$Report
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$installerPath = (Resolve-Path $Installer).Path
if (-not $StageDir) { $StageDir = Join-Path $repoRoot "artifacts\windows-stage" }
$stagePath = (Resolve-Path $StageDir).Path
if (-not $Report) { $Report = Join-Path (Split-Path $installerPath -Parent) "inspection.json" }

if ((Split-Path $installerPath -Leaf) -notmatch '^Daymark-Setup-x64-\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\.exe$') {
    throw "The installer filename is not the normalized x64 Daymark format."
}
$installerInfo = Get-Item $installerPath
if ($installerInfo.Length -lt 50MB) { throw "The installer is too small to contain the complete offline runtime." }
$stream = [System.IO.File]::OpenRead($installerPath)
try {
    $firstByte = $stream.ReadByte()
    $secondByte = $stream.ReadByte()
}
finally {
    $stream.Dispose()
}
if ($firstByte -ne 0x4d -or $secondByte -ne 0x5a) { throw "The installer is not a Windows executable." }

$signature = Get-AuthenticodeSignature -LiteralPath $installerPath
if ($signature.Status -ne "NotSigned") { throw "This preview inspection expects an unsigned installer." }

$allowedTopLevel = @(
    "cloudflared.exe",
    "DaymarkRuntime.exe",
    "DaymarkService.exe",
    "DaymarkService.xml",
    "dist",
    "drizzle",
    "node",
    "node_modules",
    "runtime",
    "third-party-licenses"
)
$actualTopLevel = @(Get-ChildItem -LiteralPath $stagePath -Force | ForEach-Object { $_.Name })
$unexpected = @($actualTopLevel | Where-Object { $allowedTopLevel -notcontains $_ })
$missing = @($allowedTopLevel | Where-Object { $actualTopLevel -notcontains $_ })
if ($unexpected.Count -gt 0) { throw "The installer stage contains unapproved entries: $($unexpected -join ', ')" }
if ($missing.Count -gt 0) { throw "The installer stage is missing required entries: $($missing -join ', ')" }

$forbiddenFiles = @()
foreach ($file in [System.IO.Directory]::EnumerateFiles("\\?\$stagePath", "*", [System.IO.SearchOption]::AllDirectories)) {
    $name = [System.IO.Path]::GetFileName($file)
    $extension = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
    if ($name -in @(".env", ".env.local", "setup-code.dpapi", "tunnel-token.dpapi") -or $extension -in @(".db", ".sqlite", ".sqlite3", ".log")) {
        $forbiddenFiles += $file
    }
}
if ($forbiddenFiles.Count -gt 0) { throw "The installer stage contains private or mutable data." }

$launcher = Join-Path $stagePath "DaymarkRuntime.exe"
$launcherBytes = [System.IO.File]::ReadAllBytes($launcher)
if ($launcherBytes.Length -lt 1024 -or $launcherBytes[0] -ne 0x4d -or $launcherBytes[1] -ne 0x5a) {
    throw "The staged Daymark runtime launcher is invalid."
}

$inspection = [ordered]@{
    artifact = $installerInfo.Name
    architecture = "x64"
    sizeBytes = $installerInfo.Length
    sha256 = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant()
    signature = "Unsigned preview"
    payloadAllowlistPassed = $true
    privateDataAbsent = $true
    inspectedAt = (Get-Date).ToUniversalTime().ToString("o")
}
$inspection | ConvertTo-Json | Set-Content -LiteralPath $Report -Encoding UTF8
Write-Output "Unsigned preview installer inspection passed."
