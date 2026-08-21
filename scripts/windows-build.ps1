<#
.SYNOPSIS
    One-click build engine for World Downloader Studio on Windows.

.DESCRIPTION
    This is the engine behind build.bat and build-installer.bat at the repository
    root. Those two files are the entry points; this file does the work, so the
    two modes cannot drift apart.

    It assumes a FRESH Windows install with nothing on it: no Node.js, no npm, no
    SDK, no build tools. Every dependency is obtained by this script itself, with
    no prompt, no manual download, and no sentence that begins "install X and run
    this again". A user-scoped winget install is preferred; when winget is absent,
    refuses, or needs elevation, a portable Node.js runtime is extracted into a
    per-user toolchain directory instead.

    Mode 'app'       installs dependencies, builds the application, verifies the
                     build output, and (interactively) offers to run it.
    Mode 'installer' does everything 'app' does except running, then additionally
                     obtains a JDK and Maven, builds the Java engine
                     (world-downloader.jar) the application spawns to actually
                     download a world, packages the Squirrel.Windows installer
                     (which bundles that jar as its default engine) through the
                     project's own supported packaging path, and verifies the
                     artifact. This is the same artifact set the release
                     workflow publishes, so a locally built installer and a
                     released one are the same thing.

.PARAMETER Mode
    'app' or 'installer'.

.PARAMETER Silent
    No prompts of any kind and no interactive pause. Exits non-zero on the first
    real failure so a caller can branch on it.

.NOTES
    CODE SIGNING IS PERMANENTLY OUT OF SCOPE for this project. This script never
    requests, generates, discovers, stores or uses a certificate, signing key or
    timestamp credential, and it never invokes a signer. The installer it builds
    is unsigned and says so in its own output.

    It never installs a secret or a credential, and it never changes the
    machine's persistent execution policy. build.bat passes -ExecutionPolicy
    Bypass for this one process only, which is what lets an unsigned local helper
    run out of a fresh checkout.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('app', 'installer')]
    [string]$Mode,

    [switch]$Silent,

    # Installer mode only. Also fetches and bundles the GitHub CLI (gh.exe)
    # alongside the JRE and MinGit that are always fetched. Off by default:
    # gh only serves the World Vault's optional "publish to a new GitHub
    # repository" action, and bundling it in every installer would add
    # roughly another 14 MB (compressed) for a path most users never touch.
    # When it is not bundled the application falls back to gh on PATH exactly
    # as it does for the JRE and MinGit, and reports honestly (never a
    # browser link) when neither is present -- see
    # app/src/main/services/bundled.ts and app/scripts/dependency-manifest.json.
    [switch]$WithGh
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# PowerShell 7.4+ turns a non-zero native exit code into a terminating error when
# ErrorActionPreference is Stop; Windows PowerShell 5.1 does not. Turn it off so
# both hosts behave identically and every exit code is checked deliberately below.
if (Test-Path 'Variable:PSNativeCommandUseErrorActionPreference') {
    $PSNativeCommandUseErrorActionPreference = $false
}

# TLS 1.2 is not the default on Windows PowerShell 5.1, and nodejs.org refuses
# anything older. Without this the portable fallback fails with a connection
# error that reads like the site is down.
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
$AppDir = Join-Path $RepoRoot 'app'

# The application's own engines constraint. Kept in one place so a bump to
# app/package.json and a bump here are visibly the same decision.
$NodeMinimumVersion = [version]'20.19.0'

# The version used when Node has to be installed portably. An active LTS line,
# comfortably above the minimum.
$NodePortableVersion = '22.20.0'
$NodeDistBase = 'https://nodejs.org/dist'

$ToolchainRoot = Join-Path $env:LOCALAPPDATA 'world-downloader-studio\toolchain'

# A Squirrel setup executable for an Electron application is tens of megabytes.
# Anything under this is a packaging failure that produced a stub rather than an
# installer, and is reported as such rather than passed off as success.
$MinimumInstallerBytes = 20MB

# pom.xml declares <java.version>21</java.version> for both source and target.
# Any JDK at or above this compiles it (verified locally with JDK 25), so this
# is a floor, not a pin — exactly the same shape as $NodeMinimumVersion below.
$JdkMinimumVersion = [version]'21.0.0'
$JdkWingetId = 'EclipseAdoptium.Temurin.21.JDK'

# Used only when a JDK has to be fetched portably. Eclipse Temurin's own API
# always resolves to its current 21 GA build, so no version number is pinned
# here the way it is for Node and Maven below.
$JdkAdoptiumAssetsUrl = 'https://api.adoptium.net/v3/assets/latest/21/hotspot?vendor=eclipse&os=windows&architecture=x64&image_type=jdk&heap_size=normal&project=jdk'

# The version used when Maven has to be installed portably. There is no Maven
# wrapper committed to this repository, so unlike Node (which has a winget
# fallback) this is the only route when `mvn` is not already on the machine.
# archive.apache.org (not dlcdn.apache.org) is used because it retains every
# past release permanently; dlcdn only mirrors current releases and an older
# pin would eventually 404 there.
$MavenPortableVersion = '3.9.9'
$MavenDistBase = 'https://archive.apache.org/dist/maven/maven-3'

# pom.xml's shade plugin pins <finalName>world-downloader</finalName>, so the
# artifact `mvn package` produces is always target/world-downloader.jar.
# Verified locally: 14,055,418 bytes for the fully-shaded jar with its
# dependencies. Anything under this floor is a packaging stub, not the engine.
$JarFinalName = 'world-downloader.jar'
$MinimumJarBytes = 1MB

$script:Phases = @()
$script:PhaseIndex = 0
$script:PhaseTotal = if ($Mode -eq 'installer') { 13 } else { 8 }
$script:NodeExe = $null
$script:NpmCmd = $null
$script:JavaHome = $null
$script:MvnCmd = $null
$script:StartedAt = Get-Date

# --------------------------------------------------------------------------- #
# Output helpers
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
    param(
        [Parameter(Mandatory = $true)]$Phase,
        [string]$Result = 'done'
    )
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

function Format-Bytes {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GiB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N2} MiB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N2} KiB' -f ($Bytes / 1KB)) }
    return ("$Bytes bytes")
}

# A failure names the exact dependency, the version constraint, the source that
# was tried, and the blocking error. Never a bare "build failed".
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
    Write-Line '  BUILD FAILED' 'Red'
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

# Runs a native command and returns its exit code and combined output. Native
# commands write ordinary progress to stderr, and with ErrorActionPreference set
# to Stop that alone can be raised as a terminating error even when the command
# succeeded, so the preference is relaxed for the duration of the call and the
# verdict is taken from the exit code.
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
    return [pscustomobject]@{
        ExitCode = $code
        Output   = ($output | Out-String).Trim()
    }
}

# Runs a native command with its output streaming straight to the console, which
# is what a build log wants. Returns the exit code and NOTHING ELSE.
#
# The `| Out-Host` is the load-bearing part. A native command's standard output
# is the function's own success stream, so without it a caller writing
# `$code = Invoke-Stream ...` captures every line the build printed and gets an
# ARRAY back rather than a number. That array then makes `if ($code -ne 0)` true
# for a perfectly successful build, and prints an empty exit code into the
# failure message. Out-Host writes to the console and emits nothing into the
# pipeline, so the exit code is all that comes back.
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
# PATH handling
# --------------------------------------------------------------------------- #

# THE ONE THAT BITES EVERYBODY: winget writes PATH for FUTURE shells. The very
# next command in THIS process still cannot find what was just installed, and
# that reads as "the install failed" when it in fact succeeded. Rebuild this
# process's PATH from the registry after every install, and probe the known
# install locations directly as well.
function Update-ProcessPath {
    param([string[]]$ExtraDirectories = @())

    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($scope in @('Machine', 'User')) {
        try {
            $value = [Environment]::GetEnvironmentVariable('Path', $scope)
        } catch {
            $value = $null
        }
        if ($value) {
            foreach ($piece in $value.Split(';')) { if ($piece) { $parts.Add($piece) } }
        }
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

# --------------------------------------------------------------------------- #
# Node.js
# --------------------------------------------------------------------------- #

function Get-NodeVersion {
    param([string]$NodePath)
    $result = Invoke-Capture -File $NodePath -Arguments @('--version')
    if ($result.ExitCode -ne 0) { return $null }
    $text = ($result.Output -split "`n" | Where-Object { $_ -match '^v\d' } | Select-Object -First 1)
    if (-not $text) { return $null }
    try { return [version]($text.Trim().TrimStart('v')) } catch { return $null }
}

function Find-UsableNode {
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

    # First match wins rather than best version: candidates are already in
    # preference order (PATH, then the well-known install locations), and each
    # probe costs a process launch, so scoring them all just makes a warm run
    # slower for no better answer.
    foreach ($candidate in $candidates) {
        $version = Get-NodeVersion -NodePath $candidate
        if (-not $version) { continue }
        if ($version -lt $NodeMinimumVersion) { continue }
        return [pscustomobject]@{ Path = $candidate; Version = $version }
    }
    return $null
}

function Install-NodeWithWinget {
    # Select-Object -First 1 is not cosmetic: a machine with the same executable
    # on PATH twice makes Get-Command return an array, and passing that array's
    # .Source to a [string] parameter fails with a type-conversion error that
    # reads as though the tool were missing.
    $winget = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) {
        return [pscustomobject]@{ Installed = $false; Attempt = 'winget: not present on this machine' }
    }

    # --scope user keeps this out of an elevation prompt. --disable-interactivity
    # is what keeps the whole thing touchless: without it winget can stop on a
    # confirmation, which breaks silent mode and hangs an unattended caller.
    $arguments = @(
        'install', '--exact', '--id', 'OpenJS.NodeJS.LTS',
        '--source', 'winget',
        '--scope', 'user',
        '--silent',
        '--disable-interactivity',
        '--accept-package-agreements',
        '--accept-source-agreements'
    )
    Write-Step ('winget install --exact --id OpenJS.NodeJS.LTS --scope user')
    $result = Invoke-Capture -File $winget.Source -Arguments $arguments
    if ($result.ExitCode -ne 0) {
        $summary = (($result.Output -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join ' / ')
        return [pscustomobject]@{
            Installed = $false
            Attempt   = ("winget user-scope install exited {0}: {1}" -f $result.ExitCode, $summary)
        }
    }

    Update-ProcessPath -ExtraDirectories (Get-CandidateNodeDirectories)
    return [pscustomobject]@{ Installed = $true; Attempt = 'winget user-scope install succeeded' }
}

function Install-NodePortable {
    $archiveName = "node-v$NodePortableVersion-win-x64.zip"
    $folderName = "node-v$NodePortableVersion-win-x64"
    $target = Join-Path $ToolchainRoot $folderName
    $nodeExe = Join-Path $target 'node.exe'

    if (Test-Path -LiteralPath $nodeExe) {
        Write-Found ("portable Node.js already extracted at $target")
        Update-ProcessPath -ExtraDirectories @($target)
        return $target
    }

    New-Item -ItemType Directory -Force -Path $ToolchainRoot | Out-Null
    $downloadDir = Join-Path $ToolchainRoot '.download'
    New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null

    $archivePath = Join-Path $downloadDir $archiveName
    $archiveUrl = "$NodeDistBase/v$NodePortableVersion/$archiveName"
    $sumsUrl = "$NodeDistBase/v$NodePortableVersion/SHASUMS256.txt"
    $sumsPath = Join-Path $downloadDir "SHASUMS256-$NodePortableVersion.txt"

    $reusedCache = $false
    if (Test-Path -LiteralPath $archivePath) {
        Write-Found ("cached archive at $archivePath; it will be reused only if it still verifies")
        $reusedCache = $true
    } else {
        Write-Step ("downloading $archiveUrl")
        try {
            Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing
        } catch {
            Stop-WithFailure -Dependency 'Node.js runtime' `
                -Constraint (">= $NodeMinimumVersion (portable pin v$NodePortableVersion)") `
                -Source $archiveUrl `
                -Problem $_.Exception.Message `
                -Attempts @('winget user-scope install', "portable download from $archiveUrl")
        }
    }

    Write-Step ("verifying SHA-256 against $sumsUrl")
    try {
        Invoke-WebRequest -Uri $sumsUrl -OutFile $sumsPath -UseBasicParsing
    } catch {
        Stop-WithFailure -Dependency 'Node.js runtime checksum' `
            -Constraint "official SHASUMS256.txt for v$NodePortableVersion" `
            -Source $sumsUrl `
            -Problem $_.Exception.Message `
            -Attempts @("downloaded $archiveName but could not fetch its checksum list")
    }

    $expected = $null
    foreach ($line in (Get-Content -LiteralPath $sumsPath)) {
        $parts = $line -split '\s+'
        if ($parts.Count -ge 2 -and $parts[-1] -eq $archiveName) { $expected = $parts[0].ToLowerInvariant(); break }
    }
    if (-not $expected) {
        Stop-WithFailure -Dependency 'Node.js runtime checksum' `
            -Constraint "an entry for $archiveName" `
            -Source $sumsUrl `
            -Problem "the published checksum list contains no line for $archiveName"
    }

    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected -and $reusedCache) {
        # A cached archive from an interrupted run is the likely cause, so it is
        # discarded and fetched once more before this is called a failure.
        Write-Warn 'the cached archive did not verify; discarding it and downloading again'
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
        try {
            Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing
        } catch {
            Stop-WithFailure -Dependency 'Node.js runtime' `
                -Constraint (">= $NodeMinimumVersion (portable pin v$NodePortableVersion)") `
                -Source $archiveUrl `
                -Problem $_.Exception.Message `
                -Attempts @('winget user-scope install', 'reused a cached archive that failed its checksum', "re-download from $archiveUrl")
        }
        $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    if ($actual -ne $expected) {
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
        Stop-WithFailure -Dependency 'Node.js runtime checksum' `
            -Constraint "SHA-256 $expected" `
            -Source $archiveUrl `
            -Problem "the downloaded archive hashed to $actual; it has been deleted rather than extracted"
    }
    Write-Info ("SHA-256 verified: $actual")

    # Extract into a staging directory and move into place, so an interrupted run
    # never leaves a half-extracted toolchain that the next run would trust.
    $staging = Join-Path $ToolchainRoot (".staging-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    try {
        Write-Step ("extracting to $target")
        Expand-Archive -LiteralPath $archivePath -DestinationPath $staging -Force
        $extracted = Join-Path $staging $folderName
        if (-not (Test-Path -LiteralPath (Join-Path $extracted 'node.exe'))) {
            Stop-WithFailure -Dependency 'Node.js runtime' `
                -Constraint "node.exe inside $folderName" `
                -Source $archiveUrl `
                -Problem "the archive extracted but contained no node.exe at $extracted"
        }
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        Move-Item -LiteralPath $extracted -Destination $target
    } finally {
        if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
    }

    Update-ProcessPath -ExtraDirectories @($target)
    return $target
}

function Resolve-NodeToolchain {
    $phase = Start-Phase 'Node.js runtime'

    $existing = Find-UsableNode
    if ($existing) {
        Write-Found ("Node.js {0} at {1}" -f $existing.Version, $existing.Path)
        $script:NodeExe = $existing.Path
    } else {
        Write-Info ("no Node.js >= $NodeMinimumVersion on this machine; obtaining one now")
        $attempts = @()

        $winget = Install-NodeWithWinget
        $attempts += $winget.Attempt
        if ($winget.Installed) {
            $found = Find-UsableNode
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
            Write-Info 'falling back to a portable, user-scoped Node.js runtime (no administrator rights needed)'
            $portableDir = Install-NodePortable
            $portableExe = Join-Path $portableDir 'node.exe'
            $version = Get-NodeVersion -NodePath $portableExe
            if (-not $version -or $version -lt $NodeMinimumVersion) {
                Stop-WithFailure -Dependency 'Node.js runtime' `
                    -Constraint ">= $NodeMinimumVersion" `
                    -Source "$NodeDistBase/v$NodePortableVersion/" `
                    -Problem ("the portable runtime at $portableExe reported version '{0}'" -f $version) `
                    -Attempts $attempts
            }
            Write-Added ("Node.js {0} at {1} (portable, user toolchain)" -f $version, $portableExe)
            $script:NodeExe = $portableExe
        }
    }

    Complete-Phase $phase
}

function Resolve-NpmToolchain {
    $phase = Start-Phase 'npm package manager'

    $nodeDir = Split-Path -Parent $script:NodeExe
    $candidates = @(
        (Join-Path $nodeDir 'npm.cmd'),
        (Join-Path $nodeDir 'npm')
    )
    $found = $null
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { $found = $candidate; break }
    }
    if (-not $found) {
        $command = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) { $found = $command.Source }
    }
    if (-not $found) {
        Stop-WithFailure -Dependency 'npm' `
            -Constraint 'the npm that ships inside the Node.js distribution' `
            -Source $nodeDir `
            -Problem "no npm.cmd was found beside node.exe at $nodeDir and none is on PATH"
    }

    $script:NpmCmd = $found
    $version = Invoke-Capture -File $script:NpmCmd -Arguments @('--version')
    if ($version.ExitCode -ne 0) {
        Stop-WithFailure -Dependency 'npm' `
            -Constraint 'must report a version' `
            -Source $script:NpmCmd `
            -Problem $version.Output
    }
    Write-Found ("npm {0} at {1}" -f $version.Output, $script:NpmCmd)
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Java Development Kit and Maven
#
# Only used in 'installer' mode, to build the Java engine (world-downloader.jar)
# that gets bundled into the packaged application. Mirrors the Node.js section
# above: check well-known locations and PATH first, prefer a user-scoped
# winget install when something is missing, and fall back to a checksum-
# verified portable extraction into the same per-user toolchain directory.
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

# A JDK is a JRE plus javac. Accepting a bare JRE would pass this check and
# then fail confusingly deep inside the Maven compiler plugin, so javac is
# required to sit right beside java in the same bin directory.
function Find-UsableJdk {
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
        if (-not $version) { continue }
        if ($version -lt $JdkMinimumVersion) { continue }
        # JAVA_HOME is the bin directory's parent: <jdkHome>\bin\java.exe.
        # (Named $jdkHome rather than $home -- $home is a read-only PowerShell
        # automatic variable for the user's profile directory.)
        $jdkHome = Split-Path -Parent (Split-Path -Parent $candidate)
        return [pscustomobject]@{ JavaExe = $candidate; JavaHome = $jdkHome; Version = $version }
    }
    return $null
}

function Install-JdkWithWinget {
    $winget = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) {
        return [pscustomobject]@{ Installed = $false; Attempt = 'winget: not present on this machine' }
    }

    $arguments = @(
        'install', '--exact', '--id', $JdkWingetId,
        '--source', 'winget',
        '--scope', 'user',
        '--silent',
        '--disable-interactivity',
        '--accept-package-agreements',
        '--accept-source-agreements'
    )
    Write-Step ("winget install --exact --id $JdkWingetId --scope user")
    $result = Invoke-Capture -File $winget.Source -Arguments $arguments
    if ($result.ExitCode -ne 0) {
        $summary = (($result.Output -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join ' / ')
        return [pscustomobject]@{
            Installed = $false
            Attempt   = ("winget user-scope install exited {0}: {1}" -f $result.ExitCode, $summary)
        }
    }

    Update-ProcessPath -ExtraDirectories (Get-CandidateJdkDirectories | ForEach-Object { Join-Path $_ 'bin' })
    return [pscustomobject]@{ Installed = $true; Attempt = 'winget user-scope install succeeded' }
}

function Install-JdkPortable {
    Write-Step ("resolving the current Temurin 21 build from $JdkAdoptiumAssetsUrl")
    try {
        $releases = Invoke-RestMethod -Uri $JdkAdoptiumAssetsUrl -UseBasicParsing
    } catch {
        Stop-WithFailure -Dependency 'Java Development Kit' `
            -Constraint ">= $JdkMinimumVersion (Temurin 21)" `
            -Source $JdkAdoptiumAssetsUrl `
            -Problem $_.Exception.Message `
            -Attempts @('winget user-scope install', "portable resolution from $JdkAdoptiumAssetsUrl")
    }
    if (-not $releases -or $releases.Count -eq 0) {
        Stop-WithFailure -Dependency 'Java Development Kit' `
            -Constraint ">= $JdkMinimumVersion (Temurin 21)" `
            -Source $JdkAdoptiumAssetsUrl `
            -Problem 'the Adoptium API returned no matching release'
    }

    $package = $releases[0].binary.package
    $downloadUrl = $package.link
    $expectedSha256 = $package.checksum
    $archiveName = $package.name
    if (-not $downloadUrl -or -not $expectedSha256 -or -not $archiveName) {
        Stop-WithFailure -Dependency 'Java Development Kit' `
            -Constraint 'the Adoptium API response must include a download link, checksum and archive name' `
            -Source $JdkAdoptiumAssetsUrl `
            -Problem 'the response JSON did not have the expected shape'
    }

    $downloadDir = Join-Path $ToolchainRoot '.download'
    New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
    $archivePath = Join-Path $downloadDir $archiveName

    Write-Step ("downloading $downloadUrl")
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing
    } catch {
        Stop-WithFailure -Dependency 'Java Development Kit' `
            -Constraint ">= $JdkMinimumVersion (Temurin 21)" `
            -Source $downloadUrl `
            -Problem $_.Exception.Message `
            -Attempts @('winget user-scope install', "portable download from $downloadUrl")
    }

    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expectedSha256.ToLowerInvariant()) {
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
        Stop-WithFailure -Dependency 'Java Development Kit checksum' `
            -Constraint "SHA-256 $expectedSha256" `
            -Source $downloadUrl `
            -Problem "the downloaded archive hashed to $actual; it has been deleted rather than extracted"
    }
    Write-Info ("SHA-256 verified: $actual")

    $staging = Join-Path $ToolchainRoot (".staging-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    $target = $null
    try {
        Write-Step ("extracting to $ToolchainRoot")
        Expand-Archive -LiteralPath $archivePath -DestinationPath $staging -Force
        # Adoptium archives contain one top-level jdk-<version>+<build> directory.
        $extracted = Get-ChildItem -LiteralPath $staging -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $extracted -or -not (Test-Path -LiteralPath (Join-Path $extracted.FullName 'bin\javac.exe'))) {
            Stop-WithFailure -Dependency 'Java Development Kit' `
                -Constraint "a jdk-* directory containing bin\javac.exe" `
                -Source $downloadUrl `
                -Problem "the archive extracted but no such directory was found under $staging"
        }
        $target = Join-Path $ToolchainRoot $extracted.Name
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        Move-Item -LiteralPath $extracted.FullName -Destination $target
    } finally {
        if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
    }

    Update-ProcessPath -ExtraDirectories @((Join-Path $target 'bin'))
    return $target
}

function Resolve-JdkToolchain {
    $phase = Start-Phase 'Java Development Kit'

    $existing = Find-UsableJdk
    if ($existing) {
        Write-Found ("JDK {0} at {1}" -f $existing.Version, $existing.JavaHome)
        $script:JavaHome = $existing.JavaHome
    } else {
        Write-Info ("no JDK >= $JdkMinimumVersion on this machine; obtaining Temurin 21 now")
        $attempts = @()

        $winget = Install-JdkWithWinget
        $attempts += $winget.Attempt
        if ($winget.Installed) {
            $found = Find-UsableJdk
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
            Write-Info 'falling back to a portable, user-scoped Temurin 21 JDK (no administrator rights needed)'
            $portableHome = Install-JdkPortable
            $portableJava = Join-Path $portableHome 'bin\java.exe'
            $version = Get-JdkVersion -JavaExe $portableJava
            if (-not $version -or $version -lt $JdkMinimumVersion) {
                Stop-WithFailure -Dependency 'Java Development Kit' `
                    -Constraint ">= $JdkMinimumVersion" `
                    -Source $JdkAdoptiumAssetsUrl `
                    -Problem ("the portable JDK at $portableJava reported version '{0}'" -f $version) `
                    -Attempts $attempts
            }
            Write-Added ("JDK {0} at {1} (portable, user toolchain)" -f $version, $portableHome)
            $script:JavaHome = $portableHome
        }
    }

    # Maven's own launcher script looks for JAVA_HOME; setting it here is the
    # same thing actions/setup-java does in CI, and is more robust than relying
    # on mvn's own PATH-search fallback.
    $env:JAVA_HOME = $script:JavaHome
    Complete-Phase $phase
}

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

function Install-MavenPortable {
    $archiveName = "apache-maven-$MavenPortableVersion-bin.zip"
    $folderName = "apache-maven-$MavenPortableVersion"
    $target = Join-Path $ToolchainRoot $folderName
    $mvnCmd = Join-Path $target 'bin\mvn.cmd'

    if (Test-Path -LiteralPath $mvnCmd) {
        Write-Found ("portable Maven already extracted at $target")
        Update-ProcessPath -ExtraDirectories @((Join-Path $target 'bin'))
        return $target
    }

    New-Item -ItemType Directory -Force -Path $ToolchainRoot | Out-Null
    $downloadDir = Join-Path $ToolchainRoot '.download'
    New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null

    $archivePath = Join-Path $downloadDir $archiveName
    $archiveUrl = "$MavenDistBase/$MavenPortableVersion/binaries/$archiveName"
    $sumUrl = "$archiveUrl.sha512"
    $sumPath = Join-Path $downloadDir "$archiveName.sha512"

    Write-Step ("downloading $archiveUrl")
    try {
        Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing
    } catch {
        Stop-WithFailure -Dependency 'Maven build tool' `
            -Constraint "Apache Maven $MavenPortableVersion" `
            -Source $archiveUrl `
            -Problem $_.Exception.Message
    }

    Write-Step ("verifying SHA-512 against $sumUrl")
    try {
        Invoke-WebRequest -Uri $sumUrl -OutFile $sumPath -UseBasicParsing
    } catch {
        Stop-WithFailure -Dependency 'Maven build tool checksum' `
            -Constraint "official $archiveName.sha512" `
            -Source $sumUrl `
            -Problem $_.Exception.Message `
            -Attempts @("downloaded $archiveName but could not fetch its checksum")
    }

    # Apache publishes the sha512 file as the bare hex digest, optionally with
    # trailing whitespace or a filename — take the first hex-looking token.
    $sumContent = (Get-Content -LiteralPath $sumPath -Raw).Trim()
    $expected = ([regex]::Match($sumContent, '[0-9a-fA-F]{128}')).Value.ToLowerInvariant()
    if (-not $expected) {
        Stop-WithFailure -Dependency 'Maven build tool checksum' `
            -Constraint 'a 128-character SHA-512 hex digest' `
            -Source $sumUrl `
            -Problem "the checksum file did not contain one: '$sumContent'"
    }

    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA512).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
        Stop-WithFailure -Dependency 'Maven build tool checksum' `
            -Constraint "SHA-512 $expected" `
            -Source $archiveUrl `
            -Problem "the downloaded archive hashed to $actual; it has been deleted rather than extracted"
    }
    Write-Info ("SHA-512 verified: $actual")

    $staging = Join-Path $ToolchainRoot (".staging-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    try {
        Write-Step ("extracting to $target")
        Expand-Archive -LiteralPath $archivePath -DestinationPath $staging -Force
        $extracted = Join-Path $staging $folderName
        if (-not (Test-Path -LiteralPath (Join-Path $extracted 'bin\mvn.cmd'))) {
            Stop-WithFailure -Dependency 'Maven build tool' `
                -Constraint "bin\mvn.cmd inside $folderName" `
                -Source $archiveUrl `
                -Problem "the archive extracted but contained no bin\mvn.cmd at $extracted"
        }
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        Move-Item -LiteralPath $extracted -Destination $target
    } finally {
        if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
    }

    Update-ProcessPath -ExtraDirectories @((Join-Path $target 'bin'))
    return $target
}

function Resolve-MavenToolchain {
    $phase = Start-Phase 'Maven build tool'

    $existing = Find-UsableMaven
    if ($existing) {
        Write-Found $existing.VersionLine
        $script:MvnCmd = $existing.MvnCmd
    } else {
        Write-Info 'no mvn on this machine; obtaining a portable, user-scoped Apache Maven now'
        $portableDir = Install-MavenPortable
        $portableMvn = Join-Path $portableDir 'bin\mvn.cmd'
        $found = Find-UsableMaven
        if (-not $found -or $found.MvnCmd -ne $portableMvn) {
            # Fall back to invoking the freshly extracted copy directly even if
            # Find-UsableMaven's PATH-based search did not pick it up for some
            # reason: it was just verified to exist and to have the right shape.
            if (Test-Path -LiteralPath $portableMvn) {
                Write-Added ("Maven at $portableMvn (portable, user toolchain)")
                $script:MvnCmd = $portableMvn
            } else {
                Stop-WithFailure -Dependency 'Maven build tool' `
                    -Constraint "bin\mvn.cmd must exist after extraction" `
                    -Source $portableDir `
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
# Application dependencies and build
# --------------------------------------------------------------------------- #

# Asks whether what is installed matches what the manifest and lockfile declare,
# rather than comparing modification times. A timestamp comparison reinstalls the
# whole tree whenever anyone edits a script in package.json, which makes a warm
# run as slow as a cold one and wipes node_modules underneath anything else that
# happens to be building.
function Test-DependenciesFresh {
    $checker = Join-Path $RepoRoot 'scripts\deps-in-sync.mjs'
    if (-not (Test-Path -LiteralPath $checker)) {
        Write-Warn 'scripts/deps-in-sync.mjs is missing, so the dependency state cannot be judged; installing to be safe'
        return $false
    }
    $result = Invoke-Capture -File $script:NodeExe -Arguments @($checker, $AppDir)
    if ($result.ExitCode -eq 0) {
        Write-Info $result.Output
        return $true
    }
    Write-Info ('needs installing: ' + $result.Output)
    return $false
}

function Install-AppDependencies {
    $phase = Start-Phase 'Application dependencies'

    if (Test-DependenciesFresh) {
        Write-Found 'what is installed matches package.json and package-lock.json; nothing to install'
        Complete-Phase $phase 'skipped'
        return
    }

    $lock = Join-Path $AppDir 'package-lock.json'
    $code = $null
    if (Test-Path -LiteralPath $lock) {
        Write-Step 'npm ci --no-audit --no-fund  (in app/)'
        $code = Invoke-Stream -File $script:NpmCmd -Arguments @('ci', '--no-audit', '--no-fund') -WorkingDirectory $AppDir
        if ($code -ne 0) {
            Write-Warn ("npm ci exited {0}; the lockfile and package.json are probably out of step, retrying with npm install" -f $code)
            $code = $null
        }
    }
    if ($null -eq $code) {
        Write-Step 'npm install --no-audit --no-fund  (in app/)'
        $code = Invoke-Stream -File $script:NpmCmd -Arguments @('install', '--no-audit', '--no-fund') -WorkingDirectory $AppDir
    }
    if ($code -ne 0) {
        Stop-WithFailure -Dependency 'app/node_modules (project dependencies)' `
            -Constraint 'as declared by app/package.json and app/package-lock.json' `
            -Source 'the npm registry configured for this machine' `
            -Problem ("npm exited {0}; its output is immediately above this message" -f $code) `
            -Attempts @('npm ci --no-audit --no-fund', 'npm install --no-audit --no-fund')
    }

    Write-Added ('project dependencies into ' + (Join-Path $AppDir 'node_modules'))
    Complete-Phase $phase
}

function Confirm-ElectronRuntime {
    $phase = Start-Phase 'Electron runtime binary'

    $script = Join-Path $AppDir 'scripts\ensure-electron-binary.mjs'
    if (-not (Test-Path -LiteralPath $script)) {
        Stop-WithFailure -Dependency 'Electron runtime binary' `
            -Constraint 'app/scripts/ensure-electron-binary.mjs must exist' `
            -Source $script `
            -Problem 'the helper that extracts the Electron runtime is missing from this checkout'
    }

    $electronExe = Join-Path $AppDir 'node_modules\electron\dist\electron.exe'
    if (Test-Path -LiteralPath $electronExe) {
        Write-Found ("Electron runtime already extracted at $electronExe")
        Complete-Phase $phase 'skipped'
        return
    }

    Write-Step 'node scripts/ensure-electron-binary.mjs  (in app/)'
    $code = Invoke-Stream -File $script:NodeExe -Arguments @('scripts/ensure-electron-binary.mjs') -WorkingDirectory $AppDir
    if ($code -ne 0 -or -not (Test-Path -LiteralPath $electronExe)) {
        Stop-WithFailure -Dependency 'Electron runtime binary' `
            -Constraint 'node_modules/electron/dist/electron.exe must exist' `
            -Source 'the @electron/get cache populated by npm install' `
            -Problem ("ensure-electron-binary.mjs exited {0} and {1} is still absent" -f $code, $electronExe) `
            -Attempts @('npm install (which runs electron''s own install script)', 'node scripts/ensure-electron-binary.mjs')
    }
    Write-Added ("Electron runtime at $electronExe")
    Complete-Phase $phase
}

function Build-Application {
    $phase = Start-Phase 'Build the application'

    Write-Step 'npm run build  (electron-vite build, in app/)'
    $code = Invoke-Stream -File $script:NpmCmd -Arguments @('run', 'build') -WorkingDirectory $AppDir
    if ($code -ne 0) {
        Stop-WithFailure -Dependency 'application build' `
            -Constraint 'npm run build must exit 0' `
            -Source 'electron-vite build' `
            -Problem ("npm run build exited {0}; its output is immediately above this message" -f $code)
    }
    Complete-Phase $phase
}

function Confirm-BuildOutput {
    $phase = Start-Phase 'Verify the build output'

    $required = @(
        (Join-Path $AppDir 'out\main\index.js'),
        (Join-Path $AppDir 'out\preload\index.js'),
        (Join-Path $AppDir 'out\renderer\index.html')
    )
    $missing = @()
    foreach ($file in $required) {
        if (Test-Path -LiteralPath $file) {
            $size = (Get-Item -LiteralPath $file).Length
            Write-Found ('{0}  ({1})' -f $file, (Format-Bytes $size))
        } else {
            # electron-vite emits the preload as .mjs when the package is ESM.
            $alternative = [IO.Path]::ChangeExtension($file, '.mjs')
            if ((Split-Path -Leaf $file) -eq 'index.js' -and (Test-Path -LiteralPath $alternative)) {
                $size = (Get-Item -LiteralPath $alternative).Length
                Write-Found ('{0}  ({1})' -f $alternative, (Format-Bytes $size))
            } else {
                $missing += $file
            }
        }
    }
    if ($missing.Count -gt 0) {
        Stop-WithFailure -Dependency 'application build output' `
            -Constraint 'electron-vite must emit main, preload and renderer bundles' `
            -Source (Join-Path $AppDir 'out') `
            -Problem ('npm run build exited 0 but these files are absent: ' + ($missing -join ', '))
    }
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# The Java engine
#
# The desktop application is not a second product beside world-downloader.jar
# -- it is the UI that spawns that jar to actually download a world. Packaging
# an installer without it would ship an application with no engine, so this
# runs before Build-Installer and its output is what
# app/electron-builder.yml's extraResources entry bundles in.
# --------------------------------------------------------------------------- #

function Build-JavaEngine {
    $phase = Start-Phase 'Build the Java engine (jar)'

    Write-Info 'Building through the project''s own supported path: mvn -B -ntp clean package -DskipTests'
    Write-Info '  (from the repository root, not app/ -- this is Maven, not npm)'
    Write-Line ''
    Write-Line '  -DskipTests is correct and required here, not an oversight. Just like the' 'DarkGray'
    Write-Line '  release workflow, this script runs no test, lint or type-check gate anywhere;' 'DarkGray'
    Write-Line '  running the Java tests here would quietly reintroduce exactly the gate that' 'DarkGray'
    Write-Line '  was deliberately left out everywhere else in this project.' 'DarkGray'
    Write-Line ''

    Write-Step 'mvn -B -ntp clean package -DskipTests  (in repository root)'
    $code = Invoke-Stream -File $script:MvnCmd -Arguments @('-B', '-ntp', 'clean', 'package', '-DskipTests') -WorkingDirectory $RepoRoot
    if ($code -ne 0) {
        Stop-WithFailure -Dependency 'Java engine build' `
            -Constraint 'mvn -B -ntp clean package -DskipTests must exit 0' `
            -Source (Join-Path $RepoRoot 'pom.xml') `
            -Problem ("mvn exited {0}; its output is immediately above this message" -f $code)
    }
    Complete-Phase $phase
}

function Confirm-JavaEngine {
    $phase = Start-Phase 'Verify the Java engine artifact'

    $jarPath = Join-Path $RepoRoot "target\$JarFinalName"
    if (-not (Test-Path -LiteralPath $jarPath)) {
        Stop-WithFailure -Dependency 'Java engine artifact' `
            -Constraint "target\$JarFinalName must exist (pom.xml pins <finalName>world-downloader</finalName> on the shade plugin)" `
            -Source (Join-Path $RepoRoot 'target') `
            -Problem 'mvn package exited 0 but the shaded jar is not where the shade plugin configuration says it will be'
    }

    $jar = Get-Item -LiteralPath $jarPath
    if ($jar.Length -lt $MinimumJarBytes) {
        Stop-WithFailure -Dependency 'Java engine artifact' `
            -Constraint ("at least {0}" -f (Format-Bytes $MinimumJarBytes)) `
            -Source $jarPath `
            -Problem ("the jar is only {0}, which looks like a packaging stub rather than the shaded jar with its dependencies" -f (Format-Bytes $jar.Length))
    }

    $hash = (Get-FileHash -LiteralPath $jarPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Found ("$jarPath  ({0}, SHA-256 {1})" -f (Format-Bytes $jar.Length), $hash)
    Write-Info 'This is the DEFAULT engine app/electron-builder.yml bundles into the packaged'
    Write-Info 'application at resources/engine/world-downloader.jar. The application''s own'
    Write-Info '"Jar path" setting still wins over the bundled default when a user sets one.'
    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Bundled runtime dependencies (JRE, MinGit, and optionally the GitHub CLI)
#
# The application looks for these INSIDE its own installation before ever
# falling back to PATH (app/src/main/services/bundled.ts), so that a machine
# with nothing installed can still download a world and use the World Vault
# feature without being handed a browser link. This is the build-time half of
# that contract: it puts the tools where the application looks for them.
#
# Runs only in 'installer' mode, right before packaging, so
# app/electron-builder.yml's second extraResources entry
# (resources/runtime -> runtime) has something real to bundle when
# electron-builder runs inside Build-Installer below. 'app' mode never
# packages anything, so it has no need to fetch these -- PATH fallback is
# fine for running the application straight out of the checkout.
# --------------------------------------------------------------------------- #

# --------------------------------------------------------------------------- #
# The Scraper bot project's own dependencies.
#
# scraper/ is a standalone Node project one directory above app/, packaged
# whole into the installer (electron-builder.yml copies ../scraper -> scraper
# and ../scraper/node_modules -> scraper/node_modules) so the Scraper bot tab
# works on a machine that has never had Node installed. Its dependencies are
# NOT app/node_modules and are not installed by the phase that fills that:
# they are a separate npm project with its own manifest.
#
# Without this phase the installer build reaches packaging and dies at
# app/scripts/check-scraper-bundle.mjs, naming the exact missing packages --
# which is the guard behaving correctly, and a one-click script that cannot
# reach an installer from a bare checkout behaving incorrectly. The release
# workflow has always installed these in its own step; only the local path
# was missing it, so this failed on a fresh machine while CI stayed green.
# --------------------------------------------------------------------------- #

function Install-ScraperDependencies {
    $phase = Start-Phase 'Scraper bot dependencies'

    $scraperDir = Join-Path $RepoRoot 'scraper'
    if (-not (Test-Path -LiteralPath $scraperDir)) {
        Stop-WithFailure -Dependency 'scraper/ (the Scraper bot project)' `
            -Constraint 'the directory must exist in this checkout' `
            -Source $scraperDir `
            -Problem 'the standalone Scraper bot project is missing from this checkout'
    }

    # The packaging guard is the authority on "ready", so ask it rather than
    # keeping a second list of package names here that could drift from it.
    $guard = Join-Path $AppDir 'scripts\check-scraper-bundle.mjs'
    if (Test-Path -LiteralPath $guard) {
        $probe = Invoke-Stream -File $script:NodeExe -Arguments @('scripts/check-scraper-bundle.mjs') -WorkingDirectory $AppDir
        if ($probe -eq 0) {
            Write-Found 'scrape.js and every declared Scraper bot dependency are already installed'
            Complete-Phase $phase 'skipped'
            return
        }
    }

    $lock = Join-Path $scraperDir 'package-lock.json'
    $code = $null
    if (Test-Path -LiteralPath $lock) {
        Write-Step 'npm ci --no-audit --no-fund  (in scraper/)'
        $code = Invoke-Stream -File $script:NpmCmd -Arguments @('ci', '--no-audit', '--no-fund') -WorkingDirectory $scraperDir
        if ($code -ne 0) {
            Write-Warn ("npm ci exited {0} in scraper/; falling back to npm install" -f $code)
            $code = $null
        }
    }
    if ($null -eq $code) {
        Write-Step 'npm install --no-audit --no-fund  (in scraper/)'
        $code = Invoke-Stream -File $script:NpmCmd -Arguments @('install', '--no-audit', '--no-fund') -WorkingDirectory $scraperDir
    }
    if ($code -ne 0) {
        Stop-WithFailure -Dependency 'scraper/node_modules (Scraper bot dependencies)' `
            -Constraint 'as declared by scraper/package.json' `
            -Source 'the npm registry configured for this machine' `
            -Problem ("npm exited {0}; its output is immediately above this message" -f $code) `
            -Attempts @('npm ci --no-audit --no-fund', 'npm install --no-audit --no-fund')
    }

    Write-Added ('Scraper bot dependencies into ' + (Join-Path $scraperDir 'node_modules'))
    Complete-Phase $phase
}

function Resolve-BundledRuntimeDependencies {
    $phase = Start-Phase 'Fetch bundled runtime dependencies (JRE, MinGit)'

    Write-Info 'Populating app/resources/runtime with the build-time tools the packaged'
    Write-Info 'application looks for before ever falling back to PATH: a trimmed Java'
    Write-Info 'runtime and MinGit. Each is downloaded once, verified against the pinned'
    Write-Info 'SHA-256 in app/scripts/dependency-manifest.json, and cached for later warm'
    Write-Info 'runs -- a repeat run re-verifies and skips rather than re-downloading.'
    if ($WithGh) {
        Write-Info 'Also fetching the GitHub CLI (-WithGh was passed).'
    } else {
        Write-Info 'The GitHub CLI is left off by default (it only serves the World Vault''s'
        Write-Info 'optional "publish to GitHub" action) -- pass -WithGh to include it.'
    }
    Write-Line ''

    $fetchScript = Join-Path $AppDir 'scripts\fetch-dependencies.mjs'
    if (-not (Test-Path -LiteralPath $fetchScript)) {
        Stop-WithFailure -Dependency 'bundled runtime dependency fetcher' `
            -Constraint 'app/scripts/fetch-dependencies.mjs must exist' `
            -Source $fetchScript `
            -Problem 'the script that downloads and verifies the bundled JRE and MinGit is missing from this checkout'
    }

    $fetchArgs = @('scripts/fetch-dependencies.mjs')
    if ($WithGh) { $fetchArgs += '--with-gh' }

    Write-Step ('node scripts/fetch-dependencies.mjs' + $(if ($WithGh) { ' --with-gh' } else { '' }) + '  (in app/)')
    $code = Invoke-Stream -File $script:NodeExe -Arguments $fetchArgs -WorkingDirectory $AppDir
    if ($code -ne 0) {
        Stop-WithFailure -Dependency 'bundled runtime dependencies (JRE, MinGit)' `
            -Constraint 'node scripts/fetch-dependencies.mjs must exit 0' `
            -Source 'app/scripts/dependency-manifest.json (pinned versions and SHA-256 digests)' `
            -Problem ("fetch-dependencies.mjs exited {0}; its output is immediately above this message" -f $code)
    }

    $checks = @(
        [pscustomobject]@{ Name = 'JRE (java.exe)'; Path = (Join-Path $AppDir 'resources\runtime\jre\bin\java.exe') },
        [pscustomobject]@{ Name = 'MinGit (git.exe)'; Path = (Join-Path $AppDir 'resources\runtime\git\cmd\git.exe') }
    )
    if ($WithGh) {
        $checks += [pscustomobject]@{ Name = 'GitHub CLI (gh.exe)'; Path = (Join-Path $AppDir 'resources\runtime\gh\bin\gh.exe') }
    }
    foreach ($check in $checks) {
        if (Test-Path -LiteralPath $check.Path) {
            Write-Found ("{0} at {1}" -f $check.Name, $check.Path)
        } else {
            Stop-WithFailure -Dependency $check.Name `
                -Constraint "$($check.Path) must exist after fetch-dependencies.mjs succeeds" `
                -Source (Join-Path $AppDir 'resources\runtime') `
                -Problem 'fetch-dependencies.mjs exited 0 but the expected executable is not where the fixed path contract says it will be'
        }
    }

    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Installer packaging
# --------------------------------------------------------------------------- #

function Build-Installer {
    $phase = Start-Phase 'Package the Squirrel.Windows installer'

    Write-Info 'Packaging through the project''s own supported path: npm run dist'
    Write-Info '  = electron-vite build && electron-builder --win squirrel --config electron-builder.yml'
    Write-Info 'This is the same command the release workflow runs, on the same version, so a'
    Write-Info 'locally built installer and a published one are the same artifact.'
    Write-Info '"npm run dist" also re-runs fetch-dependencies.mjs itself via its own predist'
    Write-Info 'hook (app/package.json) -- an instant no-op here since the phase above just'
    Write-Info 'fetched and verified everything, but it means a bare "npm run dist" run on its'
    Write-Info 'own self-heals exactly the same way this script does.'
    Write-Line ''
    Write-Line '  CODE SIGNING IS OUT OF SCOPE. The installer this produces is UNSIGNED.' 'Yellow'
    Write-Line '  Windows will show an unknown-publisher / SmartScreen warning when it runs.' 'Yellow'
    Write-Line '  That is expected and permanent; no certificate is requested or used here.' 'Yellow'
    Write-Line ''

    # Belt and braces against a tool discovering a certificate from the
    # environment. These make a signer invocation impossible rather than merely
    # unconfigured.
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    $env:CSC_LINK = ''
    $env:CSC_KEY_PASSWORD = ''
    $env:WIN_CSC_LINK = ''
    $env:WIN_CSC_KEY_PASSWORD = ''

    Write-Step 'npm run dist  (in app/)'
    $code = Invoke-Stream -File $script:NpmCmd -Arguments @('run', 'dist') -WorkingDirectory $AppDir
    if ($code -ne 0) {
        Stop-WithFailure -Dependency 'Squirrel.Windows installer packaging' `
            -Constraint 'npm run dist must exit 0' `
            -Source 'electron-builder --win squirrel --config electron-builder.yml' `
            -Problem ("npm run dist exited {0}; its output is immediately above this message" -f $code)
    }
    Complete-Phase $phase
}

function Get-RepositoryCommit {
    $git = Get-Command git.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $git) {
        return [pscustomobject]@{ Commit = $null; Dirty = $null; Note = 'git is not installed, so the source commit could not be read' }
    }
    $head = Invoke-Capture -File $git.Source -Arguments @('rev-parse', 'HEAD') -WorkingDirectory $RepoRoot
    if ($head.ExitCode -ne 0) {
        return [pscustomobject]@{ Commit = $null; Dirty = $null; Note = 'this directory is not a git checkout, so the source commit could not be read' }
    }
    $status = Invoke-Capture -File $git.Source -Arguments @('status', '--porcelain') -WorkingDirectory $RepoRoot
    $dirty = ($status.ExitCode -eq 0 -and $status.Output.Trim().Length -gt 0)
    return [pscustomobject]@{ Commit = $head.Output.Trim(); Dirty = $dirty; Note = $null }
}

function Confirm-Installer {
    $phase = Start-Phase 'Verify the installer artifact'

    $releaseDir = Join-Path $AppDir 'release'
    if (-not (Test-Path -LiteralPath $releaseDir)) {
        Stop-WithFailure -Dependency 'installer output directory' `
            -Constraint 'electron-builder writes into app/release (directories.output in electron-builder.yml)' `
            -Source $releaseDir `
            -Problem 'the packaging step exited 0 but produced no output directory at all'
    }

    # electron-builder writes the Squirrel artifacts into a squirrel-windows
    # subdirectory of the configured output directory, so a search of the output
    # root alone reports a missing setup after a successful packaging run.
    $setup = Get-ChildItem -LiteralPath $releaseDir -Recurse -File -Filter '*.exe' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like '*Setup*' } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
    if (-not $setup) {
        $seen = (Get-ChildItem -LiteralPath $releaseDir -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 20 | ForEach-Object { $_.FullName }) -join ', '
        Stop-WithFailure -Dependency 'Squirrel setup executable' `
            -Constraint 'a file matching *Setup*.exe below app/release' `
            -Source $releaseDir `
            -Problem ('no setup executable was produced. What is there instead: ' + $(if ($seen) { $seen } else { '(the directory is empty)' }))
    }

    if ($setup.Length -lt $MinimumInstallerBytes) {
        Stop-WithFailure -Dependency 'Squirrel setup executable' `
            -Constraint ("at least {0}" -f (Format-Bytes $MinimumInstallerBytes)) `
            -Source $setup.FullName `
            -Problem ("the setup executable is only {0}, which is a packaging stub rather than an installer" -f (Format-Bytes $setup.Length))
    }

    $artifactDir = $setup.Directory.FullName
    $releasesFile = Get-ChildItem -LiteralPath $artifactDir -File -Filter 'RELEASES' -ErrorAction SilentlyContinue | Select-Object -First 1
    $nupkgs = @(Get-ChildItem -LiteralPath $artifactDir -File -Filter '*.nupkg' -ErrorAction SilentlyContinue)

    if (-not $releasesFile) {
        Stop-WithFailure -Dependency 'Squirrel RELEASES index' `
            -Constraint 'Squirrel.Windows requires a RELEASES file beside the setup executable' `
            -Source $artifactDir `
            -Problem 'the setup executable was produced but its RELEASES index is missing, so updates could not resolve'
    }
    if ($nupkgs.Count -eq 0) {
        Stop-WithFailure -Dependency 'Squirrel package (.nupkg)' `
            -Constraint 'Squirrel.Windows requires at least the full .nupkg beside the setup executable' `
            -Source $artifactDir `
            -Problem 'the setup executable was produced but no .nupkg accompanies it'
    }

    # The permanent no-signing policy, asserted rather than assumed. A signed
    # artifact here means something discovered a certificate, and that is a
    # release blocker for this project.
    $signature = Get-AuthenticodeSignature -LiteralPath $setup.FullName
    if ($signature.Status -ne 'NotSigned') {
        Stop-WithFailure -Dependency 'unsigned artifact policy' `
            -Constraint 'the setup executable must report NotSigned' `
            -Source $setup.FullName `
            -Problem ("Authenticode status is '{0}'. Code signing is permanently out of scope for this project; something discovered a certificate and signed the build." -f $signature.Status)
    }

    $hash = (Get-FileHash -LiteralPath $setup.FullName -Algorithm SHA256).Hash.ToLowerInvariant()

    $manifest = Get-Content -LiteralPath (Join-Path $AppDir 'package.json') -Raw | ConvertFrom-Json
    $version = $manifest.version
    $versionInName = $setup.Name -like ("*$version*")

    $commit = Get-RepositoryCommit

    Write-Line ''
    Write-Line '  Installer artifact' 'Cyan'
    Write-Line ('  ' + ('-' * 70)) 'DarkGray'
    Write-Line ('  Path            : {0}' -f $setup.FullName)
    Write-Line ('  Size            : {0} ({1} bytes)' -f (Format-Bytes $setup.Length), $setup.Length)
    Write-Line ('  SHA-256         : {0}' -f $hash)
    Write-Line ('  Version         : {0}{1}' -f $version, $(if ($versionInName) { ' (present in the artifact name)' } else { ' (NOT present in the artifact name)' }))
    Write-Line ('  RELEASES        : {0}' -f $releasesFile.FullName)
    foreach ($nupkg in $nupkgs) {
        Write-Line ('  Package         : {0} ({1})' -f $nupkg.Name, (Format-Bytes $nupkg.Length))
    }
    if ($commit.Commit) {
        Write-Line ('  Source commit   : {0}{1}' -f $commit.Commit, $(if ($commit.Dirty) { '  (WORKING TREE HAS UNCOMMITTED CHANGES - this artifact does not match that commit exactly)' } else { '  (working tree clean)' })) $(if ($commit.Dirty) { 'Yellow' } else { 'Gray' })
    } else {
        Write-Line ('  Source commit   : unknown - {0}' -f $commit.Note) 'Yellow'
    }
    Write-Line ('  Authenticode    : {0}' -f $signature.Status)
    Write-Line ('  ' + ('-' * 70)) 'DarkGray'
    Write-Line '  THIS INSTALLER IS UNSIGNED.' 'Yellow'
    Write-Line '  Code signing is permanently out of scope for this project, so Windows will' 'Yellow'
    Write-Line '  show an unknown-publisher or SmartScreen warning the first time it is run.' 'Yellow'
    Write-Line '  Nothing here claims authenticity, and no signature can be verified.' 'Yellow'
    Write-Line ('  ' + ('-' * 70)) 'DarkGray'
    Write-Line '  This script does not publish, tag, push, or create a release. Building an' 'DarkGray'
    Write-Line '  installer and shipping one are different actions with different authority.' 'DarkGray'

    Complete-Phase $phase
}

# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

function Invoke-Preflight {
    $phase = Start-Phase 'Preflight'
    Write-Info ('Repository        : {0}' -f $RepoRoot)
    Write-Info ('Application       : {0}' -f $AppDir)
    Write-Info ('Mode              : {0}' -f $(if ($Mode -eq 'installer') { 'installer (build + package the Squirrel.Windows installer)' } else { 'app (build and optionally run)' }))
    Write-Info ('Silent            : {0}' -f $(if ($Silent) { 'yes - no prompts, non-zero exit on first failure' } else { 'no - will offer to run the app at the end' }))
    Write-Info ('Operating system  : {0}' -f [Environment]::OSVersion.VersionString)
    Write-Info ('PowerShell        : {0}' -f $PSVersionTable.PSVersion)
    Write-Info ('User toolchain    : {0}' -f $ToolchainRoot)

    if (-not (Test-Path -LiteralPath (Join-Path $AppDir 'package.json'))) {
        Stop-WithFailure -Dependency 'application sources' `
            -Constraint 'app/package.json must exist' `
            -Source $AppDir `
            -Problem 'this does not look like a checkout of this repository'
    }

    $commit = Get-RepositoryCommit
    if ($commit.Commit) {
        Write-Info ('Source commit     : {0}{1}' -f $commit.Commit, $(if ($commit.Dirty) { ' (working tree has uncommitted changes)' } else { ' (clean)' }))
    } else {
        Write-Info ('Source commit     : unknown - {0}' -f $commit.Note)
    }
    Complete-Phase $phase
}

function Invoke-RunPrompt {
    $phase = Start-Phase 'Run the application'

    if ($Silent) {
        Write-Info 'Silent mode: not offering to run. Start it later with:  npm start   (in app/)'
        Complete-Phase $phase 'skipped'
        return
    }

    Write-Line ''
    $answer = Read-Host '  Run World Downloader Studio now? [Y/n]'
    if ($answer -and $answer.Trim().ToLowerInvariant() -notin @('y', 'yes')) {
        Write-Info 'Not running. Start it later with:  npm start   (in app/)'
        Complete-Phase $phase 'skipped'
        return
    }

    Write-Step 'npm start  (electron-vite preview, in app/)'
    $code = Invoke-Stream -File $script:NpmCmd -Arguments @('start') -WorkingDirectory $AppDir
    if ($code -ne 0) {
        Write-Warn ("the application exited with code {0}" -f $code)
        Complete-Phase $phase ('exit ' + $code)
        return
    }
    Complete-Phase $phase
}

Write-Banner ('World Downloader Studio - one-click ' + $(if ($Mode -eq 'installer') { 'installer build' } else { 'build' }))

Invoke-Preflight
Resolve-NodeToolchain
Resolve-NpmToolchain
Install-AppDependencies
Confirm-ElectronRuntime

if ($Mode -eq 'installer') {
    # The Java engine is built and verified before the application is packaged,
    # so app/electron-builder.yml's extraResources entry has something real to
    # bundle when electron-builder runs inside Build-Installer.
    Resolve-JdkToolchain
    Resolve-MavenToolchain
    Build-JavaEngine
    Confirm-JavaEngine
    Install-ScraperDependencies
    Resolve-BundledRuntimeDependencies
    Build-Installer
    Confirm-Installer
} else {
    Build-Application
    Confirm-BuildOutput
    Invoke-RunPrompt
}

Write-Line ''
Write-Line ('=' * 74) 'DarkGray'
Write-Line ('  SUCCESS - ' + $(if ($Mode -eq 'installer') { 'the unsigned Squirrel.Windows installer is built and verified.' } else { 'the application is built and ready to run.' })) 'Green'
Write-Line ('=' * 74) 'DarkGray'
Write-Summary
exit 0
