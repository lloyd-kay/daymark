$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stageScript = Join-Path $repoRoot "scripts\stage-windows-runtime.ps1"
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("daymark-stage-test-" + [guid]::NewGuid().ToString("N"))
$cache = Join-Path $testRoot "cache"
$destination = Join-Path $testRoot "stage"
New-Item -ItemType Directory -Force $cache | Out-Null

try {
    foreach ($fileName in @("node-v22.23.1-win-x64.zip", "WinSW-x64.exe", "cloudflared-windows-amd64.exe")) {
        Set-Content -LiteralPath (Join-Path $cache $fileName) -Value "not the approved runtime" -NoNewline
    }

    $manifest = Get-Content (Join-Path $repoRoot "packaging\runtime-manifest.json") -Raw | ConvertFrom-Json
    $manifest.components[0].sha256 = "0000000000000000000000000000000000000000000000000000000000000000"
    $badHashManifest = Join-Path $testRoot "bad-hash.json"
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $badHashManifest -Encoding UTF8

    $hashFailed = $false
    try {
        & $stageScript -Manifest $badHashManifest -Destination $destination -DownloadCache $cache -RuntimeOnly
    }
    catch {
        $hashFailed = $_.Exception.Message -like "*SHA-256 mismatch*"
    }
    if (-not $hashFailed) { throw "Staging did not reject a mismatched SHA-256." }

    $deepDirectory = $destination
    foreach ($index in 1..6) {
        $deepDirectory = Join-Path $deepDirectory (("nested-{0}-" -f $index) + ("x" * 48))
    }
    [System.IO.Directory]::CreateDirectory("\\?\$deepDirectory") | Out-Null
    [System.IO.File]::WriteAllText("\\?\$(Join-Path $deepDirectory 'payload.txt')", "disposable stage data")

    $longPathCleanReachedManifestCheck = $false
    try {
        & $stageScript -Manifest $badHashManifest -Destination $destination -DownloadCache $cache -RuntimeOnly -Clean
    }
    catch {
        $longPathCleanReachedManifestCheck = $_.Exception.Message -like "*SHA-256 mismatch*"
    }
    if (-not $longPathCleanReachedManifestCheck) {
        throw "Staging could not safely replace a destination containing long paths."
    }

    $manifest.components[0].url = "https://example.com/node.zip"
    $unapprovedManifest = Join-Path $testRoot "unapproved-host.json"
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $unapprovedManifest -Encoding UTF8

    $hostFailed = $false
    try {
        & $stageScript -Manifest $unapprovedManifest -Destination $destination -DownloadCache $cache -RuntimeOnly
    }
    catch {
        $hostFailed = $_.Exception.Message -like "*not approved*"
    }
    if (-not $hostFailed) { throw "Staging did not reject an unapproved download host." }

    Write-Output "Daymark runtime staging safety tests passed."
}
finally {
    if (Test-Path $testRoot) {
        [System.IO.Directory]::Delete("\\?\$testRoot", $true)
    }
}
