param(
    [string]$StageDir
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $StageDir) { $StageDir = Join-Path $repoRoot "artifacts\windows-stage" }
$stagePath = (Resolve-Path -LiteralPath $StageDir).Path

$requiredFiles = @(
    "DaymarkRuntime.exe",
    "node\node.exe",
    "runtime\local\cli.ts",
    "lib\runtime-health.ts",
    "drizzle\meta\_journal.json",
    "package.json"
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $stagePath $relativePath) -PathType Leaf)) {
        throw "The staged runtime is missing $relativePath."
    }
}

$temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\') + '\'
$programData = Join-Path $temporaryRoot ("daymark-staged-migration-" + [guid]::NewGuid().ToString("N"))
$programDataPath = [System.IO.Path]::GetFullPath($programData)
if (-not $programDataPath.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The disposable migration path is outside the system temporary directory."
}

$launcher = Join-Path $stagePath "DaymarkRuntime.exe"
$previousProgramData = $env:ProgramData
try {
    $env:ProgramData = $programDataPath

    $prepareOutput = (& $launcher --prepare-install 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "The staged runtime could not prepare protected local data. $prepareOutput"
    }

    $migrationOutput = (& $launcher --migrate 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "The staged runtime could not migrate a clean disposable database. $migrationOutput"
    }
    if ($migrationOutput -notmatch '"status"\s*:\s*"migrated"') {
        throw "The staged runtime did not report a completed migration. $migrationOutput"
    }
}
finally {
    $env:ProgramData = $previousProgramData
    if (Test-Path -LiteralPath $programDataPath) {
        Remove-Item -LiteralPath $programDataPath -Recurse -Force
    }
}

Write-Output "Daymark staged runtime migration passed."
