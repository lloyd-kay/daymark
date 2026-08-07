param(
    [string]$Manifest,
    [string]$Destination,
    [string]$DownloadCache,
    [switch]$RuntimeOnly,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $Manifest) { $Manifest = Join-Path $repoRoot "packaging\runtime-manifest.json" }
if (-not $Destination) { $Destination = Join-Path $repoRoot "artifacts\windows-stage" }
$manifestPath = (Resolve-Path $Manifest).Path
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
$repoPath = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\')

if ($destinationPath.TrimEnd('\') -eq $repoPath -or $destinationPath.Length -le 3) {
    throw "Refusing to stage into a broad or unsafe destination."
}
if ($env:CI -and -not $destinationPath.StartsWith((Join-Path $repoRoot "artifacts\windows-stage"), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "CI staging must remain inside artifacts/windows-stage."
}
if (Test-Path $destinationPath) {
    if (-not $Clean) { throw "The staging destination already exists. Use -Clean to replace it." }
    Remove-Item -LiteralPath $destinationPath -Recurse -Force
}

function Assert-ApprovedManifest {
    param([object]$RuntimeManifest)

    if ($RuntimeManifest.schemaVersion -ne 1) { throw "Runtime manifest schema version is invalid." }
    $names = @($RuntimeManifest.components | ForEach-Object { $_.name } | Sort-Object)
    if (($names -join ',') -ne "cloudflared,node,winsw") {
        throw "Runtime manifest must contain node, winsw and cloudflared exactly once."
    }

    $destinations = @{}
    foreach ($component in $RuntimeManifest.components) {
        $uri = [Uri]$component.url
        $approved = $false
        if ($uri.Scheme -eq "https" -and $uri.Host -eq "nodejs.org") {
            $approved = $uri.AbsolutePath -match '^/dist/v\d+\.\d+\.\d+/node-v\d+\.\d+\.\d+-win-x64\.zip$'
        }
        elseif ($uri.Scheme -eq "https" -and $uri.Host -eq "github.com") {
            $approved = $uri.AbsolutePath -match '^/(winsw/winsw|cloudflare/cloudflared)/releases/download/'
        }
        if (-not $approved) { throw "Runtime download host or path is not approved: $($component.url)" }
        if ($component.sha256 -notmatch '^[a-f0-9]{64}$') { throw "Runtime SHA-256 is invalid: $($component.name)" }
        if ([System.IO.Path]::IsPathRooted($component.destination) -or $component.destination -match '(^|[\\/])\.\.([\\/]|$)') {
            throw "Runtime destination escapes the payload: $($component.destination)"
        }
        if ($destinations.ContainsKey($component.destination)) { throw "Runtime destination is duplicated: $($component.destination)" }
        $destinations[$component.destination] = $true
    }
}

function Save-ApprovedDownload {
    param(
        [Uri]$Uri,
        [string]$OutputFile
    )

    Add-Type -AssemblyName System.Net.Http
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.DefaultRequestHeaders.UserAgent.ParseAdd("Daymark-Installer-Builder/0.1")
    $current = $Uri
    try {
        for ($redirect = 0; $redirect -le 5; $redirect++) {
            $response = $client.GetAsync($current, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
            if ([int]$response.StatusCode -ge 300 -and [int]$response.StatusCode -lt 400) {
                $location = $response.Headers.Location
                if (-not $location) { throw "Runtime download redirect did not include a location." }
                if (-not $location.IsAbsoluteUri) { $location = New-Object Uri($current, $location) }
                $approvedRedirectHosts = @("nodejs.org", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com")
                if ($location.Scheme -ne "https" -or $approvedRedirectHosts -notcontains $location.Host) {
                    throw "Runtime download redirect host is not approved: $($location.Host)"
                }
                $response.Dispose()
                $current = $location
                continue
            }

            $response.EnsureSuccessStatusCode() | Out-Null
            $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $outputStream = [System.IO.File]::Open($OutputFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            try { $inputStream.CopyTo($outputStream) }
            finally {
                $outputStream.Dispose()
                $inputStream.Dispose()
                $response.Dispose()
            }
            return
        }
        throw "Runtime download exceeded the approved redirect limit."
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Copy-DirectoryLongPath {
    param(
        [string]$Source,
        [string]$Destination
    )
    New-Item -ItemType Directory -Force $Destination | Out-Null
    & robocopy.exe $Source $Destination /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    $robocopyExit = $LASTEXITCODE
    $global:LASTEXITCODE = 0
    if ($robocopyExit -ge 8) { throw "Could not copy the installer payload directory: $Source" }
}

$runtimeManifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
Assert-ApprovedManifest $runtimeManifest

$workingPath = $destinationPath
$downloadPath = Join-Path $workingPath ".downloads"
New-Item -ItemType Directory -Force $downloadPath | Out-Null

try {
    foreach ($component in $runtimeManifest.components) {
        $cachedFile = if ($DownloadCache) { Join-Path $DownloadCache $component.fileName } else { $null }
        if ($cachedFile -and (Test-Path $cachedFile)) {
            $sourceFile = (Resolve-Path $cachedFile).Path
        }
        else {
            $partialFile = Join-Path $downloadPath ($component.fileName + ".partial")
            Save-ApprovedDownload ([Uri]$component.url) $partialFile
            $sourceFile = Join-Path $downloadPath $component.fileName
            Move-Item -LiteralPath $partialFile -Destination $sourceFile
        }

        $actualHash = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $component.sha256) {
            throw "SHA-256 mismatch for $($component.name). Expected $($component.sha256), received $actualHash."
        }

        if ($component.name -eq "node") {
            $nodeDestination = Join-Path $workingPath "node"
            New-Item -ItemType Directory -Force $nodeDestination | Out-Null
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $archive = [System.IO.Compression.ZipFile]::OpenRead($sourceFile)
            try {
                foreach ($requiredName in @("node.exe", "LICENSE")) {
                    $entry = $archive.Entries | Where-Object { $_.FullName -match ("/" + [regex]::Escape($requiredName) + "$") } | Select-Object -First 1
                    if (-not $entry) { throw "The verified Node archive did not contain $requiredName." }
                    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $nodeDestination $requiredName), $true)
                }
            }
            finally { $archive.Dispose() }

            if (-not $DownloadCache) {
                $checksumsFile = Join-Path $downloadPath "node-SHASUMS256.txt.partial"
                Save-ApprovedDownload ([Uri]("https://nodejs.org/dist/v" + $component.version + "/SHASUMS256.txt")) $checksumsFile
                $checksumLine = Get-Content $checksumsFile | Where-Object { $_ -match ("\s+" + [regex]::Escape($component.fileName) + "$") }
                if (-not $checksumLine -or ($checksumLine -split '\s+')[0].ToLowerInvariant() -ne $component.sha256) {
                    throw "Node's official SHASUMS256 file does not match the pinned archive hash."
                }
            }
        }
        else {
            Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $workingPath $component.destination)
        }
        Write-Output ("Verified {0} {1}" -f $component.name, $component.version)
    }

    if (-not $RuntimeOnly) {
        foreach ($directory in @("dist", "drizzle", "runtime")) {
            $sourceDirectory = Join-Path $repoRoot $directory
            if (-not (Test-Path $sourceDirectory)) { throw "Required Daymark build directory is missing: $directory" }
            Copy-DirectoryLongPath $sourceDirectory (Join-Path $workingPath $directory)
        }
        Copy-Item -LiteralPath (Join-Path $repoRoot "packaging\windows\DaymarkService.xml") -Destination (Join-Path $workingPath "DaymarkService.xml")

        $dependencyInstall = Join-Path ([System.IO.Path]::GetTempPath()) ("daymark-dependencies-" + [guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Force $dependencyInstall | Out-Null
        try {
            Copy-Item -LiteralPath (Join-Path $repoRoot "package.json") -Destination $dependencyInstall
            Copy-Item -LiteralPath (Join-Path $repoRoot "package-lock.json") -Destination $dependencyInstall
            & npm.cmd ci --prefix $dependencyInstall --omit=dev --ignore-scripts --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw "Production Node dependencies could not be staged." }
            Copy-DirectoryLongPath (Join-Path $dependencyInstall "node_modules") (Join-Path $workingPath "node_modules")
        }
        finally {
            if (Test-Path $dependencyInstall) { Remove-Item -LiteralPath $dependencyInstall -Recurse -Force }
        }

        $licenseDirectory = Join-Path $workingPath "third-party-licenses"
        New-Item -ItemType Directory -Force $licenseDirectory | Out-Null
        Copy-Item -LiteralPath (Join-Path $repoRoot "packaging\windows\THIRD_PARTY_NOTICES.md") -Destination $licenseDirectory
        Copy-Item -LiteralPath (Join-Path $workingPath "node\LICENSE") -Destination (Join-Path $licenseDirectory "Node.js-LICENSE.txt")
    }

    if (Test-Path $downloadPath) { Remove-Item -LiteralPath $downloadPath -Recurse -Force }
    Write-Output "Windows runtime staged at $destinationPath"
}
catch {
    $failure = $_
    if (Test-Path $workingPath) {
        try { [System.IO.Directory]::Delete("\\?\$workingPath", $true) }
        catch { Write-Warning "The incomplete staging folder could not be removed automatically: $workingPath" }
    }
    throw $failure
}
