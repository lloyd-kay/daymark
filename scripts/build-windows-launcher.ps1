$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stageRoot = Join-Path $repoRoot "artifacts\windows-stage"
$stagedLauncher = Join-Path $stageRoot "DaymarkRuntime.exe"
$manifest = Join-Path $repoRoot "desktop\daymark-control\src-tauri\Cargo.toml"
$releaseLauncher = Join-Path $repoRoot "desktop\daymark-control\src-tauri\target\release\DaymarkRuntime.exe"

if (-not (Test-Path $stageRoot)) {
    throw "The verified Windows runtime must be staged before building the launcher."
}

$createdPlaceholder = -not (Test-Path $stagedLauncher)
if ($createdPlaceholder) {
    [System.IO.File]::WriteAllBytes($stagedLauncher, [byte[]](0))
}

try {
    $cargo = Get-Command cargo.exe -ErrorAction SilentlyContinue
    if (-not $cargo) {
        $fallbackCargo = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
        if (Test-Path $fallbackCargo) { $cargo = Get-Item $fallbackCargo }
    }
    if (-not $cargo) { throw "Rust is required to build the Daymark launcher." }
    $cargoPath = if ($cargo.Path) { $cargo.Path } else { $cargo.FullName }

    & $cargoPath build --release --manifest-path $manifest --bin DaymarkRuntime
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $releaseLauncher)) {
        throw "The Daymark runtime launcher did not build successfully."
    }
    Copy-Item -LiteralPath $releaseLauncher -Destination $stagedLauncher -Force

    $bytes = [System.IO.File]::ReadAllBytes($stagedLauncher)
    if ($bytes.Length -lt 1024 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a) {
        throw "The staged Daymark runtime launcher is not a valid Windows executable."
    }
    Write-Output "Staged the release Daymark runtime launcher."
}
catch {
    if ($createdPlaceholder -and (Test-Path $stagedLauncher)) {
        Remove-Item -LiteralPath $stagedLauncher -Force
    }
    throw
}
