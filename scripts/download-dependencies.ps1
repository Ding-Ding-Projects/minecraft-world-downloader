<#
.SYNOPSIS
    One-click BUILD-DEPENDENCY fetcher for World Downloader Studio (Windows).

.DESCRIPTION
    This is the engine behind download-dependencies.bat at the repository root.
    It obtains every dependency needed to BUILD, RUN and TEST this project on a
    fresh Windows machine with nothing installed: a JDK and Apache Maven for the
    root pom.xml engine, and a Node.js runtime for app/'s own build tooling.

    Every binary this script places on disk comes from a pinned exact version
    recorded in scripts/dependency-manifest.json, and its download is verified
    against the digest recorded there before it is ever extracted. That manifest
    is committed beside this script so a human can audit exactly what a build
    puts on their machine without running anything.

    Once a usable Node.js runtime is resolved, this script also runs
    `npm install` inside scraper/ -- the standalone Scraper bot project one
    directory above app/, which the packaged installer now bundles alongside
    the application (app/electron-builder.yml's extraResources) so the
    Scraper bot tab works without a system Node install. It otherwise never
    touches app/ itself: it delegates the separate concern of app/'s own
    BUNDLED runtime dependencies (a Java runtime, a portable Git, the GitHub
    CLI -- the ones that ship INSIDE the packaged installer for end users) to
    app/scripts/fetch-dependencies.mjs, if and when that file exists. Installing
    app/'s own npm package dependencies (app/node_modules) is build.bat's job,
    not this script's -- see the README section on the two dependency fetchers.

    Nothing this script downloads is ever committed to the repository: every
    archive and every extracted toolchain lives entirely under a per-user
    directory outside the checkout (the same one build.bat/windows-build.ps1
    already use), so there is nothing here for Git or any Git LFS variant to
    carry. Large payloads never enter the working tree in the first place.

.PARAMETER Silent
    No prompts of any kind. Exits non-zero on the first real failure so a
    caller can branch on it. This is the mode CI, a scheduled task or another
    script should use.

.NOTES
    CODE SIGNING IS PERMANENTLY OUT OF SCOPE for this project. This script never
    requests, generates, discovers, stores or uses a certificate, signing key or
    credential of any kind, and it never weakens the machine's persistent
    execution policy. download-dependencies.bat passes -ExecutionPolicy Bypass
    for this one process only, which is what lets an unsigned local helper run
    out of a fresh checkout.
#>

[CmdletBinding()]
param(
    [switch]$Silent
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (Test-Path 'Variable:PSNativeCommandUseErrorActionPreference') {
    $PSNativeCommandUseErrorActionPreference = $false
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {
    # A host that has already removed the older protocols throws here and is
    # already on TLS 1.2 or better. Nothing to do.
}

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ManifestPath = Join-Path $PSScriptRoot 'dependency-manifest.json'
$ToolchainRoot = Join-Path $env:LOCALAPPDATA 'world-downloader-studio\toolchain'
$AppFetchScript = Join-Path $RepoRoot 'app\scripts\fetch-dependencies.mjs'

$script:Phases = @()
$script:PhaseIndex = 0
$script:PhaseTotal = 6
$script:StartedAt = Get-Date
$script:NodeExe = $null
$script:JavaHome = $null
$script:MvnCmd = $null

# --------------------------------------------------------------------------- #
# Output helpers (same shape as scripts/windows-build.ps1, kept independent so
# the two engines cannot drift into depending on each other's internals)
# --------------------------------------------------------------------------- #

function Write-Line {
    param([string]$Text = '', [string]$Color = '')
    if ($Color) { Write-Host $Text -ForegroundColor $Color } else { Write-Host $Text }
}

function Write-Banner {
    param([string]$Title)
    Write-Line ''
    Write-Line ('=' * 74) 'DarkGray'
    Write-Line "  $Title" 'Cyan'
    Write-Line ('=' * 74) 'DarkGray'
}

function Start-Phase {
    param([string]$Name)
    $script:PhaseIndex += 1
    $phase = [pscustomobject]@{
        Index   = $script:PhaseIndex
        Name    = $Name
        Started = Get-Date
        Elapsed = [timespan]::Zero
        Result  = 'running'
    }
    $script:Phases += $phase
    Write-Banner ("Phase {0}/{1}  {2}" -f $phase.Index, $script:PhaseTotal, $Name)
    return $phase
}

function Complete-Phase {
    param([Parameter(Mandatory = $true)]$Phase, [string]$Result = 'done')
    $Phase.Elapsed = (Get-Date) - $Phase.Started
    $Phase.Result = $Result
    Write-Line ("  -> {0} in {1}" -f $Result, (Format-Duration $Phase.Elapsed)) 'DarkGray'
}

function Format-Duration {
    param([timespan]$Span)
    if ($Span.TotalSeconds -lt 1) { return ('{0} ms' -f [int]$Span.TotalMilliseconds) }
    if ($Span.TotalMinutes -lt 1) { return ('{0:N1} s' -f $Span.TotalSeconds) }
    return ('{0}m {1:00}s' -f [int]$Span.TotalMinutes, $Span.Seconds)
}

function Write-Info { param([string]$Text) Write-Line "  $Text" }
function Write-Found { param([string]$Text) Write-Line "  [present]   $Text" 'Green' }
function Write-Added { param([string]$Text) Write-Line "  [installed] $Text" 'Yellow' }
function Write-Step { param([string]$Text) Write-Line "  [running]   $Text" 'DarkCyan' }
function Write-Warn { param([string]$Text) Write-Line "  [warning]   $Text" 'Yellow' }

# A failure names the exact dependency, the version constraint, the source that
# was tried, and the blocking error. Never a bare "failed".
function Stop-WithFailure {
    param(
        [string]$Dependency,
        [string]$Constraint = '(none)',
        [string]$Source = '(none)',
        [string]$Problem,
        [string[]]$Attempts = @()
    )
    if ($script:Phases.Count -gt 0) {
        $last = $script:Phases[-1]
        if ($last.Result -eq 'running') {
            $last.Elapsed = (Get-Date) - $last.Started
            $last.Result = 'FAILED'
        }
    }
    Write-Line ''
    Write-Line ('-' * 74) 'Red'
    Write-Line '  DEPENDENCY DOWNLOAD FAILED' 'Red'
    Write-Line ('-' * 74) 'Red'
    Write-Line ("  Dependency or step : {0}" -f $Dependency) 'Red'
    Write-Line ("  Version constraint : {0}" -f $Constraint) 'Red'
    Write-Line ("  Source tried       : {0}" -f $Source) 'Red'
    Write-Line ("  Blocking error     : {0}" -f $Problem) 'Red'
    if ($Attempts.Count -gt 0) {
        Write-Line '  Everything that was attempted, in order:' 'Red'
        foreach ($attempt in $Attempts) { Write-Line ("    - {0}" -f $attempt) 'Red' }
    }
    Write-Line ('-' * 74) 'Red'
    Write-Summary
    exit 1
}

function Write-Summary {
    Write-Line ''
    Write-Line 'Phase timings' 'Cyan'
    Write-Line ('  {0,-4} {1,-40} {2,-10} {3}' -f '#', 'Phase', 'Result', 'Elapsed')
    Write-Line ('  ' + ('-' * 70)) 'DarkGray'
    foreach ($phase in $script:Phases) {
        $color = switch ($phase.Result) {
            'FAILED' { 'Red' }
            'skipped' { 'DarkGray' }
            default { 'Gray' }
        }
        Write-Line ('  {0,-4} {1,-40} {2,-10} {3}' -f $phase.Index, $phase.Name, $phase.Result, (Format-Duration $phase.Elapsed)) $color
    }
    Write-Line ('  ' + ('-' * 70)) 'DarkGray'
    Write-Line ('  Total elapsed: {0}' -f (Format-Duration ((Get-Date) - $script:StartedAt)))
}

# --------------------------------------------------------------------------- #
# Process helpers
# --------------------------------------------------------------------------- #

function Invoke-Capture {
    param(
        [Parameter(Mandatory = $true)][string]$File,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $null
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $pushed = $false
    try {
        if ($WorkingDirectory) { Push-Location $WorkingDirectory; $pushed = $true }
        $global:LASTEXITCODE = 0
        $output = & $File @Arguments 2>&1
        $code = $LASTEXITCODE
    } catch {
        $output = $_.Exception.Message
        $code = -1
    } finally {
        if ($pushed) { Pop-Location }
        $ErrorActionPreference = $previous
    }
    return [pscustomobject]@{ ExitCode = $code; Output = ($output | Out-String).Trim() }
}

function Invoke-Stream {
    param(
        [Parameter(Mandatory = $true)][string]$File,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $null
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $pushed = $false
    $code = $null
    try {
        if ($WorkingDirectory) { Push-Location $WorkingDirectory; $pushed = $true }
        $global:LASTEXITCODE = 0
        & $File @Arguments | Out-Host
        $code = $LASTEXITCODE
    } finally {
        if ($pushed) { Pop-Location }
        $ErrorActionPreference = $previous
    }
    if ($null -eq $code) { return -1 }
    return [int]$code
}

# --------------------------------------------------------------------------- #
# PATH handling -- THE ONE THAT BITES EVERYBODY: a package manager writes PATH
# for FUTURE shells. The very next command in THIS process still cannot find
# what was just installed, which reads as "the install failed" when it in fact
# succeeded. Rebuild this process's PATH from the registry after every install.
# --------------------------------------------------------------------------- #

function Update-ProcessPath {
    param([string[]]$ExtraDirectories = @())

    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($scope in @('Machine', 'User')) {
        try { $value = [Environment]::GetEnvironmentVariable('Path', $scope) } catch { $value = $null }
        if ($value) { foreach ($piece in $value.Split(';')) { if ($piece) { $parts.Add($piece) } } }
    }
    foreach ($piece in ($env:Path -split ';')) { if ($piece) { $parts.Add($piece) } }
    foreach ($extra in $ExtraDirectories) { if ($extra -and (Test-Path -LiteralPath $extra)) { $parts.Insert(0, $extra) } }

    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $ordered = New-Object System.Collections.Generic.List[string]
    foreach ($piece in $parts) {
        $trimmed = $piece.TrimEnd('\')
        if ($trimmed -and $seen.Add($trimmed)) { $ordered.Add($piece) }
    }
    $env:Path = ($ordered -join ';')
}

# --------------------------------------------------------------------------- #
# Manifest
# --------------------------------------------------------------------------- #

function Read-Manifest {
    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        Stop-WithFailure -Dependency 'dependency manifest' `
            -Constraint 'scripts/dependency-manifest.json must exist' `
            -Source $ManifestPath `
            -Problem 'the pinned-version manifest is missing from this checkout, so there is nothing to verify a download against. Re-clone the repository.'
    }
    try {
        return Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    } catch {
        Stop-WithFailure -Dependency 'dependency manifest' `
            -Constraint 'valid JSON' `
            -Source $ManifestPath `
            -Problem $_.Exception.Message
    }
}

# Generic pinned-archive download+verify+extract, shared by Node/JDK below.
# Returns the directory the archive extracted into.
function Get-PinnedArchive {
    param(
        [Parameter(Mandatory = $true)][string]$DependencyName,
        [Parameter(Mandatory = $true)]$Artifact,
        [Parameter(Mandatory = $true)][string]$PinnedVersion
    )

    $downloadDir = Join-Path $ToolchainRoot '.download'
    New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
    $archivePath = Join-Path $downloadDir $Artifact.archiveName

    if (-not (Test-Path -LiteralPath $archivePath)) {
        Write-Step ("downloading $($Artifact.url)")
        try {
            Invoke-WebRequest -Uri $Artifact.url -OutFile $archivePath -UseBasicParsing
        } catch {
            Stop-WithFailure -Dependency $DependencyName `
                -Constraint "pinned version $PinnedVersion" `
                -Source $Artifact.url `
                -Problem $_.Exception.Message
        }
    } else {
        Write-Found "cached archive at $archivePath; it will be reused only if it still verifies"
    }

    $algorithm = $Artifact.algorithm.ToUpperInvariant()
    $expected = $Artifact.digest.ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm $algorithm).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        # Discard and re-download exactly once before treating this as a hard
        # failure -- the likely cause is an interrupted prior run's cache.
        Write-Warn "the cached archive did not verify (expected $expected, got $actual); discarding and re-downloading"
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
        try {
            Invoke-WebRequest -Uri $Artifact.url -OutFile $archivePath -UseBasicParsing
        } catch {
            Stop-WithFailure -Dependency $DependencyName `
                -Constraint "pinned version $PinnedVersion" `
                -Source $Artifact.url `
                -Problem $_.Exception.Message `
                -Attempts @('reused a cached archive that failed its checksum', "re-download from $($Artifact.url)")
        }
        $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm $algorithm).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
            Stop-WithFailure -Dependency "$DependencyName checksum" `
                -Constraint "$algorithm $expected (from scripts/dependency-manifest.json)" `
                -Source $Artifact.url `
                -Problem "the downloaded archive hashed to $actual on both attempts; it has been deleted rather than extracted. Either the manifest's pinned digest is stale or the download was tampered with -- do not proceed without re-verifying against the upstream checksum source recorded in the manifest."
        }
    }
    Write-Info ("$algorithm verified: $actual")

    $staging = Join-Path $ToolchainRoot (".staging-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    try {
        Write-Step ("extracting $($Artifact.archiveName)")
        Expand-Archive -LiteralPath $archivePath -DestinationPath $staging -Force
        return $staging
    } catch {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
        Stop-WithFailure -Dependency $DependencyName `
            -Constraint 'a readable zip archive' `
            -Source $archivePath `
            -Problem $_.Exception.Message
    }
}

# --------------------------------------------------------------------------- #
# Node.js
# --------------------------------------------------------------------------- #

function Get-CandidateNodeDirectories {
    $candidates = @()
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'nodejs') }
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'nodejs') }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs') }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'nodejs') }
    if (Test-Path -LiteralPath $ToolchainRoot) {
        foreach ($dir in Get-ChildItem -LiteralPath $ToolchainRoot -Directory -Filter 'node-v*' -ErrorAction SilentlyContinue) {
            $candidates += $dir.FullName
        }
    }
    return $candidates
}

function Get-NodeVersion {
    param([string]$NodePath)
    $result = Invoke-Capture -File $NodePath -Arguments @('--version')
    if ($result.ExitCode -ne 0) { return $null }
    $text = ($result.Output -split "`n" | Where-Object { $_ -match '^v\d' } | Select-Object -First 1)
    if (-not $text) { return $null }
    try { return [version]($text.Trim().TrimStart('v')) } catch { return $null }
}

function Find-UsableNode {
    param([version]$MinimumVersion)
    Update-ProcessPath -ExtraDirectories (Get-CandidateNodeDirectories)

    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($command in (Get-Command node.exe, node -CommandType Application -ErrorAction SilentlyContinue)) {
        if ($command.Source -and $seen.Add($command.Source)) { $candidates.Add($command.Source) }
    }
    foreach ($dir in (Get-CandidateNodeDirectories)) {
        $exe = Join-Path $dir 'node.exe'
        if ((Test-Path -LiteralPath $exe) -and $seen.Add($exe)) { $candidates.Add($exe) }
    }
    foreach ($candidate in $candidates) {
        $version = Get-NodeVersion -NodePath $candidate
        if (-not $version -or $version -lt $MinimumVersion) { continue }
        return [pscustomobject]@{ Path = $candidate; Version = $version }
    }
    return $null
}

function Install-NodeWithWinget {
    $winget = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) { return [pscustomobject]@{ Installed = $false; Attempt = 'winget: not present on this machine' } }

    $arguments = @(
        'install', '--exact', '--id', 'OpenJS.NodeJS.LTS', '--source', 'winget',
        '--scope', 'user', '--silent', '--disable-interactivity',
        '--accept-package-agreements', '--accept-source-agreements'
    )
    Write-Step 'winget install --exact --id OpenJS.NodeJS.LTS --scope user'
    $result = Invoke-Capture -File $winget.Source -Arguments $arguments
    if ($result.ExitCode -ne 0) {
        $summary = (($result.Output -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join ' / ')
        return [pscustomobject]@{ Installed = $false; Attempt = ("winget user-scope install exited {0}: {1}" -f $result.ExitCode, $summary) }
    }
    Update-ProcessPath -ExtraDirectories (Get-CandidateNodeDirectories)
    return [pscustomobject]@{ Installed = $true; Attempt = 'winget user-scope install succeeded' }
}

function Install-NodePinned {
    param($Manifest)
    $node = $Manifest.dependencies.node
    $artifact = $node.artifacts.'win-x64'
    # The target directory name is derived from the pinned version, not from
    # the archive filename -- an archive's on-disk name and the directory name
    # it extracts to are not guaranteed to match (Maven's below is the proof:
    # "...-bin.zip" extracts to a directory without "-bin"). What actually
    # extracted is discovered dynamically after the fact instead of assumed.
    $target = Join-Path $ToolchainRoot "node-v$($node.pinnedVersion)-win-x64"
    $nodeExe = Join-Path $target 'node.exe'

    if (Test-Path -LiteralPath $nodeExe) {
        Write-Found "pinned Node.js $($node.pinnedVersion) already extracted at $target"
        Update-ProcessPath -ExtraDirectories @($target)
        return $target
    }

    $staging = Get-PinnedArchive -DependencyName 'Node.js runtime' -Artifact $artifact -PinnedVersion $node.pinnedVersion
    try {
        $extracted = Get-ChildItem -LiteralPath $staging -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $extracted -or -not (Test-Path -LiteralPath (Join-Path $extracted.FullName 'node.exe'))) {
            Stop-WithFailure -Dependency 'Node.js runtime' `
                -Constraint 'a single top-level directory containing node.exe' -Source $artifact.url `
                -Problem "the archive extracted but no such directory was found under $staging"
        }
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        Move-Item -LiteralPath $extracted.FullName -Destination $target
    } finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }

    Update-ProcessPath -ExtraDirectories @($target)
    return $target
}

function Resolve-NodeToolchain {
    param($Manifest)
    $phase = Start-Phase 'Node.js runtime'
    $minimum = [version]$Manifest.dependencies.node.minimumVersion

    $existing = Find-UsableNode -MinimumVersion $minimum
    if ($existing) {
        Write-Found ("Node.js {0} at {1}" -f $existing.Version, $existing.Path)
        $script:NodeExe = $existing.Path
    } else {
        Write-Info ("no Node.js >= $minimum on this machine; obtaining the pinned build now")
        $attempts = @()
        $winget = Install-NodeWithWinget
        $attempts += $winget.Attempt
        if ($winget.Installed) {
            $found = Find-UsableNode -MinimumVersion $minimum
            if ($found) {
                Write-Added ("Node.js {0} at {1} (winget, user scope)" -f $found.Version, $found.Path)
                $script:NodeExe = $found.Path
            } else {
                $attempts += 'winget reported success but no qualifying node.exe appeared on the refreshed PATH'
            }
        } else {
            Write-Warn $winget.Attempt
        }

        if (-not $script:NodeExe) {
            Write-Info 'falling back to the pinned portable Node.js build recorded in scripts/dependency-manifest.json (no administrator rights needed)'
            $portableDir = Install-NodePinned -Manifest $Manifest
            $portableExe = Join-Path $portableDir 'node.exe'
            $version = Get-NodeVersion -NodePath $portableExe
            if (-not $version -or $version -lt $minimum) {
                Stop-WithFailure -Dependency 'Node.js runtime' -Constraint ">= $minimum" `
                    -Source $Manifest.dependencies.node.artifacts.'win-x64'.url `
                    -Problem ("the pinned runtime at $portableExe reported version '{0}'" -f $version) -Attempts $attempts
            }
            Write-Added ("Node.js {0} at {1} (pinned, user toolchain)" -f $version, $portableExe)
            $script:NodeExe = $portableExe
        }
    }
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Java Development Kit
# --------------------------------------------------------------------------- #

function Get-CandidateJdkDirectories {
    $candidates = @()
    if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }
    if ($env:ProgramFiles) {
        foreach ($vendor in @('Eclipse Adoptium', 'Java', 'Microsoft', 'Amazon Corretto', 'Zulu')) {
            $vendorDir = Join-Path $env:ProgramFiles $vendor
            if (Test-Path -LiteralPath $vendorDir) {
                foreach ($dir in Get-ChildItem -LiteralPath $vendorDir -Directory -ErrorAction SilentlyContinue) {
                    $candidates += $dir.FullName
                }
            }
        }
    }
    if (Test-Path -LiteralPath $ToolchainRoot) {
        foreach ($dir in Get-ChildItem -LiteralPath $ToolchainRoot -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue) {
            $candidates += $dir.FullName
        }
    }
    return $candidates
}

function Get-JdkVersion {
    param([string]$JavaExe)
    $result = Invoke-Capture -File $JavaExe -Arguments @('-version')
    if ($result.ExitCode -ne 0) { return $null }
    $match = [regex]::Match($result.Output, 'version\s+"(\d+(?:\.\d+)*)')
    if (-not $match.Success) { return $null }
    try { return [version]$match.Groups[1].Value } catch { return $null }
}

function Find-UsableJdk {
    param([version]$MinimumVersion)
    Update-ProcessPath -ExtraDirectories (Get-CandidateJdkDirectories | ForEach-Object { Join-Path $_ 'bin' })

    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($command in (Get-Command java.exe, java -CommandType Application -ErrorAction SilentlyContinue)) {
        if ($command.Source -and $seen.Add($command.Source)) { $candidates.Add($command.Source) }
    }
    foreach ($dir in (Get-CandidateJdkDirectories)) {
        $exe = Join-Path $dir 'bin\java.exe'
        if ((Test-Path -LiteralPath $exe) -and $seen.Add($exe)) { $candidates.Add($exe) }
    }
    foreach ($candidate in $candidates) {
        $javac = Join-Path (Split-Path -Parent $candidate) 'javac.exe'
        if (-not (Test-Path -LiteralPath $javac)) { continue }
        $version = Get-JdkVersion -JavaExe $candidate
        if (-not $version -or $version -lt $MinimumVersion) { continue }
        $jdkHome = Split-Path -Parent (Split-Path -Parent $candidate)
        return [pscustomobject]@{ JavaExe = $candidate; JavaHome = $jdkHome; Version = $version }
    }
    return $null
}

function Install-JdkWithWinget {
    param([string]$WingetId)
    $winget = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) { return [pscustomobject]@{ Installed = $false; Attempt = 'winget: not present on this machine' } }

    $arguments = @(
        'install', '--exact', '--id', $WingetId, '--source', 'winget',
        '--scope', 'user', '--silent', '--disable-interactivity',
        '--accept-package-agreements', '--accept-source-agreements'
    )
    Write-Step "winget install --exact --id $WingetId --scope user"
    $result = Invoke-Capture -File $winget.Source -Arguments $arguments
    if ($result.ExitCode -ne 0) {
        $summary = (($result.Output -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join ' / ')
        return [pscustomobject]@{ Installed = $false; Attempt = ("winget user-scope install exited {0}: {1}" -f $result.ExitCode, $summary) }
    }
    Update-ProcessPath -ExtraDirectories (Get-CandidateJdkDirectories | ForEach-Object { Join-Path $_ 'bin' })
    return [pscustomobject]@{ Installed = $true; Attempt = 'winget user-scope install succeeded' }
}

function Install-JdkPinned {
    param($Manifest)
    $jdk = $Manifest.dependencies.jdk
    $artifact = $jdk.artifacts.'win-x64'
    $target = Join-Path $ToolchainRoot $artifact.extractedDirectoryPrefix
    $javaExe = Join-Path $target 'bin\java.exe'

    if (Test-Path -LiteralPath $javaExe) {
        Write-Found "pinned JDK $($jdk.pinnedVersion) already extracted at $target"
        Update-ProcessPath -ExtraDirectories @((Join-Path $target 'bin'))
        return $target
    }

    $staging = Get-PinnedArchive -DependencyName 'Java Development Kit' -Artifact $artifact -PinnedVersion $jdk.pinnedVersion
    try {
        # Adoptium archives contain one top-level jdk-<version>+<build> directory.
        $extracted = Get-ChildItem -LiteralPath $staging -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $extracted -or -not (Test-Path -LiteralPath (Join-Path $extracted.FullName 'bin\javac.exe'))) {
            Stop-WithFailure -Dependency 'Java Development Kit' `
                -Constraint 'a jdk-* directory containing bin\javac.exe' -Source $artifact.url `
                -Problem "the archive extracted but no such directory was found under $staging"
        }
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        Move-Item -LiteralPath $extracted.FullName -Destination $target
    } finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }

    Update-ProcessPath -ExtraDirectories @((Join-Path $target 'bin'))
    return $target
}

function Resolve-JdkToolchain {
    param($Manifest)
    $phase = Start-Phase 'Java Development Kit'
    $jdk = $Manifest.dependencies.jdk
    $minimum = [version]$jdk.minimumVersion

    $existing = Find-UsableJdk -MinimumVersion $minimum
    if ($existing) {
        Write-Found ("JDK {0} at {1}" -f $existing.Version, $existing.JavaHome)
        $script:JavaHome = $existing.JavaHome
    } else {
        Write-Info ("no JDK >= $minimum on this machine; obtaining Temurin $($jdk.pinnedVersion) now")
        $attempts = @()
        $winget = Install-JdkWithWinget -WingetId $jdk.wingetId
        $attempts += $winget.Attempt
        if ($winget.Installed) {
            $found = Find-UsableJdk -MinimumVersion $minimum
            if ($found) {
                Write-Added ("JDK {0} at {1} (winget, user scope)" -f $found.Version, $found.JavaHome)
                $script:JavaHome = $found.JavaHome
            } else {
                $attempts += 'winget reported success but no qualifying javac appeared on the refreshed PATH'
            }
        } else {
            Write-Warn $winget.Attempt
        }

        if (-not $script:JavaHome) {
            Write-Info 'falling back to the pinned portable Temurin build recorded in scripts/dependency-manifest.json (no administrator rights needed)'
            $portableHome = Install-JdkPinned -Manifest $Manifest
            $portableJava = Join-Path $portableHome 'bin\java.exe'
            $version = Get-JdkVersion -JavaExe $portableJava
            if (-not $version -or $version -lt $minimum) {
                Stop-WithFailure -Dependency 'Java Development Kit' -Constraint ">= $minimum" `
                    -Source $jdk.artifacts.'win-x64'.url `
                    -Problem ("the pinned JDK at $portableJava reported version '{0}'" -f $version) -Attempts $attempts
            }
            Write-Added ("JDK {0} at {1} (pinned, user toolchain)" -f $version, $portableHome)
            $script:JavaHome = $portableHome
        }
    }
    $env:JAVA_HOME = $script:JavaHome
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Apache Maven
# --------------------------------------------------------------------------- #

function Get-CandidateMavenDirectories {
    $candidates = @()
    if ($env:MAVEN_HOME) { $candidates += (Join-Path $env:MAVEN_HOME 'bin') }
    if ($env:M2_HOME) { $candidates += (Join-Path $env:M2_HOME 'bin') }
    if ($env:ProgramFiles) {
        $apacheDir = Join-Path $env:ProgramFiles 'Apache'
        if (Test-Path -LiteralPath $apacheDir) {
            foreach ($dir in Get-ChildItem -LiteralPath $apacheDir -Directory -Filter 'apache-maven-*' -ErrorAction SilentlyContinue) {
                $candidates += (Join-Path $dir.FullName 'bin')
            }
        }
    }
    if (Test-Path -LiteralPath $ToolchainRoot) {
        foreach ($dir in Get-ChildItem -LiteralPath $ToolchainRoot -Directory -Filter 'apache-maven-*' -ErrorAction SilentlyContinue) {
            $candidates += (Join-Path $dir.FullName 'bin')
        }
    }
    return $candidates
}

function Find-UsableMaven {
    Update-ProcessPath -ExtraDirectories (Get-CandidateMavenDirectories)
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($command in (Get-Command mvn.cmd, mvn -CommandType Application -ErrorAction SilentlyContinue)) {
        if ($command.Source -and $seen.Add($command.Source)) { $candidates.Add($command.Source) }
    }
    foreach ($dir in (Get-CandidateMavenDirectories)) {
        $exe = Join-Path $dir 'mvn.cmd'
        if ((Test-Path -LiteralPath $exe) -and $seen.Add($exe)) { $candidates.Add($exe) }
    }
    foreach ($candidate in $candidates) {
        $result = Invoke-Capture -File $candidate -Arguments @('--version')
        if ($result.ExitCode -ne 0) { continue }
        $firstLine = ($result.Output -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 1)
        return [pscustomobject]@{ MvnCmd = $candidate; VersionLine = $firstLine.Trim() }
    }
    return $null
}

function Install-MavenPinned {
    param($Manifest)
    $maven = $Manifest.dependencies.maven
    $artifact = $maven.artifact
    # NOT [IO.Path]::GetFileNameWithoutExtension($artifact.archiveName): Apache's
    # own "apache-maven-<version>-bin.zip" naming convention extracts to a
    # directory WITHOUT the "-bin" suffix, so that would silently compute the
    # wrong target directory. The target name is derived from the pinned
    # version instead, and what actually extracted is discovered dynamically.
    $target = Join-Path $ToolchainRoot "apache-maven-$($maven.pinnedVersion)"
    $mvnCmd = Join-Path $target 'bin\mvn.cmd'

    if (Test-Path -LiteralPath $mvnCmd) {
        Write-Found "pinned Maven $($maven.pinnedVersion) already extracted at $target"
        Update-ProcessPath -ExtraDirectories @((Join-Path $target 'bin'))
        return $target
    }

    $staging = Get-PinnedArchive -DependencyName 'Maven build tool' -Artifact $artifact -PinnedVersion $maven.pinnedVersion
    try {
        $extracted = Get-ChildItem -LiteralPath $staging -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $extracted -or -not (Test-Path -LiteralPath (Join-Path $extracted.FullName 'bin\mvn.cmd'))) {
            Stop-WithFailure -Dependency 'Maven build tool' `
                -Constraint 'a single top-level directory containing bin\mvn.cmd' -Source $artifact.url `
                -Problem "the archive extracted but no such directory was found under $staging"
        }
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        Move-Item -LiteralPath $extracted.FullName -Destination $target
    } finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }

    Update-ProcessPath -ExtraDirectories @((Join-Path $target 'bin'))
    return $target
}

function Resolve-MavenToolchain {
    param($Manifest)
    $phase = Start-Phase 'Maven build tool'

    $existing = Find-UsableMaven
    if ($existing) {
        Write-Found $existing.VersionLine
        $script:MvnCmd = $existing.MvnCmd
    } else {
        Write-Info 'no mvn on this machine; obtaining the pinned Apache Maven build now'
        $portableDir = Install-MavenPinned -Manifest $Manifest
        $portableMvn = Join-Path $portableDir 'bin\mvn.cmd'
        $found = Find-UsableMaven
        if (-not $found -or $found.MvnCmd -ne $portableMvn) {
            if (Test-Path -LiteralPath $portableMvn) {
                Write-Added "Maven at $portableMvn (pinned, user toolchain)"
                $script:MvnCmd = $portableMvn
            } else {
                Stop-WithFailure -Dependency 'Maven build tool' `
                    -Constraint 'bin\mvn.cmd must exist after extraction' -Source $portableDir `
                    -Problem "extraction reported success but $portableMvn is missing"
            }
        } else {
            Write-Added $found.VersionLine
            $script:MvnCmd = $found.MvnCmd
        }
    }
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Maven project dependencies (~/.m2) -- the pom.xml half of "every dependency
# the project needs to build". app/'s own npm dependencies stay build.bat's
# job so the two scripts never race installing into the same node_modules.
# --------------------------------------------------------------------------- #

function Resolve-MavenProjectDependencies {
    $phase = Start-Phase 'Maven project dependencies (pom.xml)'
    Write-Step 'mvn -B -ntp dependency:go-offline  (resolves every declared dependency and plugin into the local repository)'
    $code = Invoke-Stream -File $script:MvnCmd -Arguments @('-B', '-ntp', 'dependency:go-offline') -WorkingDirectory $RepoRoot
    if ($code -ne 0) {
        Stop-WithFailure -Dependency 'Maven project dependencies' `
            -Constraint 'as declared by pom.xml (including the jitpack.io repository for jo-nbt)' `
            -Source 'Maven Central, jitpack.io and the plugin repositories configured in pom.xml' `
            -Problem ("mvn dependency:go-offline exited {0}; its output is immediately above this message" -f $code)
    }
    Write-Added 'every declared Maven dependency and plugin into the local repository (~/.m2)'
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# scraper/'s own Node dependencies (scraper/node_modules)
#
# scraper/ is a separate standalone Node project one directory above app/ --
# its own package.json, its own node_modules -- that the packaged installer
# now bundles (app/electron-builder.yml's extraResources) so the *Scraper
# bot* tab works on a machine that has never had Node.js installed at all.
# Resolving its dependencies here, once a usable Node.js is on hand, is what
# actually makes that packaging step have something real to copy: without
# this, electron-builder would still happily package a scraper/ whose own
# `npm install` was never run, and app/scripts/check-scraper-bundle.mjs (run
# just before packaging) would then fail the build loudly rather than let
# that ship. Installing app/'s OWN npm dependencies (app/node_modules) stays
# build.bat's job, exactly as the module doc above says.
# --------------------------------------------------------------------------- #

function Resolve-ScraperDependencies {
    $phase = Start-Phase "scraper/'s Node dependencies (npm install)"
    $scraperDir = Join-Path $RepoRoot 'scraper'
    $scraperPackageJson = Join-Path $scraperDir 'package.json'
    if (-not (Test-Path -LiteralPath $scraperPackageJson)) {
        Write-Info 'scraper/package.json does not exist in this checkout yet. Nothing to install.'
        Complete-Phase $phase 'skipped'
        return
    }

    # Every Node.js Windows distribution -- the official installer, winget's
    # package and the pinned portable zip this script itself falls back to --
    # ships npm.cmd in the same directory as node.exe, so that is tried first.
    # A PATH lookup is the fallback for the one case that assumption does not
    # cover: an existing Node install this script found by name alone.
    $npmCmd = Join-Path (Split-Path -Parent $script:NodeExe) 'npm.cmd'
    if (-not (Test-Path -LiteralPath $npmCmd)) {
        $found = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $npmCmd = $found.Source }
    }
    if (-not (Test-Path -LiteralPath $npmCmd)) {
        Stop-WithFailure -Dependency "scraper/'s Node dependencies" `
            -Constraint 'npm (ships alongside node.exe in every Node.js Windows distribution)' `
            -Source (Split-Path -Parent $script:NodeExe) `
            -Problem "no npm.cmd was found next to $script:NodeExe or on PATH"
    }

    Write-Step "npm install  (in scraper/, using $npmCmd)"
    $code = Invoke-Stream -File $npmCmd -Arguments @('install') -WorkingDirectory $scraperDir
    if ($code -ne 0) {
        Stop-WithFailure -Dependency "scraper/'s Node dependencies" `
            -Constraint 'as declared by scraper/package.json' `
            -Source 'the npm registry' `
            -Problem ("npm install exited {0} in scraper/; its output is immediately above this message" -f $code)
    }
    Write-Added 'scraper/node_modules (mineflayer, mineflayer-pathfinder, prismarine-auth)'
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Delegate to app/'s own bundled-runtime fetcher, if it exists yet
# --------------------------------------------------------------------------- #

function Invoke-AppFetchDependencies {
    $phase = Start-Phase "app/'s bundled runtime dependencies"

    if (-not (Test-Path -LiteralPath $AppFetchScript)) {
        Write-Info 'app/scripts/fetch-dependencies.mjs does not exist in this checkout yet.'
        Write-Info 'That script (owned by app/) obtains the runtime binaries bundled INSIDE the'
        Write-Info 'packaged installer -- a separate concern from the build toolchain this script'
        Write-Info 'just resolved. Nothing to delegate to yet; this is not a failure.'
        Complete-Phase $phase 'skipped'
        return
    }

    $arguments = @($AppFetchScript)
    if ($Silent) { $arguments += '--silent' }
    Write-Step ("node {0}{1}" -f (Split-Path -Leaf $AppFetchScript), ($(if ($Silent) { ' --silent' } else { '' })))
    $code = Invoke-Stream -File $script:NodeExe -Arguments $arguments -WorkingDirectory (Split-Path -Parent (Split-Path -Parent $AppFetchScript))
    if ($code -ne 0) {
        Stop-WithFailure -Dependency "app/'s bundled runtime dependencies" `
            -Constraint '(defined by app/scripts/fetch-dependencies.mjs itself)' `
            -Source $AppFetchScript `
            -Problem ("app/scripts/fetch-dependencies.mjs exited {0}; its output is immediately above this message" -f $code)
    }
    Write-Added 'bundled runtime dependencies via app/scripts/fetch-dependencies.mjs'
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

Write-Banner 'World Downloader Studio -- dependency download'
Write-Info ("Repository : {0}" -f $RepoRoot)
Write-Info ("Toolchain  : {0}" -f $ToolchainRoot)
Write-Info ("Mode       : {0}" -f ($(if ($Silent) { 'silent' } else { 'interactive' })))
Write-Info ''
Write-Info 'Nothing this script downloads is ever committed to the repository or routed'
Write-Info 'through Git LFS in any form: every archive and every extracted toolchain'
Write-Info 'lives entirely under the per-user toolchain directory above, outside the'
Write-Info 'working tree.'

$manifest = Read-Manifest
Resolve-NodeToolchain -Manifest $manifest
Resolve-JdkToolchain -Manifest $manifest
Resolve-MavenToolchain -Manifest $manifest
Resolve-MavenProjectDependencies
Resolve-ScraperDependencies
Invoke-AppFetchDependencies

Write-Line ''
Write-Line ('=' * 74) 'DarkGray'
Write-Line '  ALL DEPENDENCIES READY' 'Green'
Write-Line ('=' * 74) 'DarkGray'
Write-Summary
exit 0
