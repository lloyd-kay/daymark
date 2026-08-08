param(
    [Parameter(Mandatory = $true)]
    [string]$InstallDir
)

$ErrorActionPreference = "Stop"
$comparison = [System.StringComparer]::OrdinalIgnoreCase
$targets = [System.Collections.Generic.HashSet[string]]::new($comparison)
foreach ($relativePath in @(
    "DaymarkRuntime.exe",
    "node\node.exe",
    "node_modules\@cloudflare\workerd-windows-64\bin\workerd.exe",
    "cloudflared.exe"
)) {
    [void]$targets.Add([System.IO.Path]::GetFullPath((Join-Path $InstallDir $relativePath)))
}

function Get-DaymarkProcess {
    @(Get-CimInstance Win32_Process | Where-Object {
        $_.ExecutablePath -and $targets.Contains([System.IO.Path]::GetFullPath($_.ExecutablePath))
    })
}

$deadline = [DateTime]::UtcNow.AddSeconds(10)
do {
    $processes = @(Get-DaymarkProcess)
    if ($processes.Count -eq 0) {
        exit 0
    }
    foreach ($process in $processes) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $deadline)

if (@(Get-DaymarkProcess).Count -gt 0) {
    Write-Error "Daymark could not stop its installed runtime processes."
    exit 1
}

exit 0
