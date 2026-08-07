$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "smoke-common.ps1")

$guarded = $false
try {
    Assert-DaymarkDisposableMachine $false | Out-Null
}
catch {
    $guarded = $_.Exception.Message -match "disposable Windows test machine"
}
if (-not $guarded) { throw "Smoke tests must refuse to run without disposable-machine confirmation." }

$fixture = Join-Path ([System.IO.Path]::GetTempPath()) "daymark-smoke-helper-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $fixture | Out-Null
try {
    $sqlPath = Join-Path $fixture "verified.sql"
    [System.IO.File]::WriteAllText($sqlPath, "select 1;`n", [Text.Encoding]::UTF8)
    $sha256 = (Get-FileHash -LiteralPath $sqlPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifestPath = Join-Path $fixture "verified.json"
    @{
        formatVersion = 1
        integrity = "verified"
        sqlFile = "verified.sql"
        sha256 = $sha256
    } | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    if (-not (Test-DaymarkBackupManifest $manifestPath)) { throw "A valid backup manifest was rejected." }

    Add-Content -LiteralPath $sqlPath -Value "-- changed"
    if (Test-DaymarkBackupManifest $manifestPath) { throw "A changed backup SQL file passed verification." }
}
finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force
}

Write-Output "Daymark smoke helper behavior passed."
