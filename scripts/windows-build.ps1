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
    Mode 'installer' does everything 'app' does except running, then packages the
                     Squirrel.Windows installer through the project's own
                     supported packaging path and verifies the artifact.

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

    [switch]$Silent
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

$script:Phases = @()
$script:PhaseIndex = 0
$script:PhaseTotal = if ($Mode -eq 'installer') { 7 } else { 8 }
$script:NodeExe = $null
$script:NpmCmd = $null
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
# Installer packaging
# --------------------------------------------------------------------------- #

function Build-Installer {
    $phase = Start-Phase 'Package the Squirrel.Windows installer'

    Write-Info 'Packaging through the project''s own supported path: npm run dist'
    Write-Info '  = electron-vite build && electron-builder --win squirrel --config electron-builder.yml'
    Write-Info 'This is the same command the release workflow runs, on the same version, so a'
    Write-Info 'locally built installer and a published one are the same artifact.'
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
