@echo off
setlocal EnableExtensions

rem ===========================================================================
rem  World Downloader Studio - one-click installer build
rem ===========================================================================
rem
rem  build.bat gets you a program you can run out of the checkout. This one
rem  produces the artifact a person downloads and installs: the Squirrel.Windows
rem  installer, built through the same supported packaging path the release
rem  workflow uses, on the same version, so a locally built installer and a
rem  released one are the same thing rather than two things that resemble each
rem  other.
rem
rem  Like build.bat it assumes a fresh Windows install with nothing on it and
rem  obtains every dependency itself.
rem
rem  Usage:
rem    build-installer.bat            build and verify the installer
rem    build-installer.bat /s         silent: no prompt, no interactive pause,
rem    build-installer.bat --silent   non-zero exit on the first real failure
rem    set SILENT=1                   same as /s
rem    build-installer.bat /with-gh   also bundle the GitHub CLI (gh.exe), not
rem    build-installer.bat --with-gh  fetched by default -- see the "runtime
rem                                   dependencies" note below
rem    build-installer.bat /?         this help
rem
rem  Alongside the Squirrel installer itself, this fetches and verifies the
rem  build-time runtime tools the packaged application looks for before ever
rem  falling back to PATH: a trimmed Java runtime and MinGit (Git). That is
rem  what lets a machine with nothing installed still download a world and use
rem  the World Vault feature with no browser link ever shown. The GitHub CLI
rem  is left off by default -- it only serves the World Vault's optional
rem  "publish to GitHub" action -- pass /with-gh to include it too. Every
rem  fetched archive is verified against a pinned SHA-256 in
rem  app\scripts\dependency-manifest.json before it is ever extracted.
rem
rem  THE INSTALLER IT PRODUCES IS UNSIGNED. Code signing is permanently out of
rem  scope for this project: nothing here requests, generates, discovers, stores
rem  or uses a certificate, and no signer is ever invoked. Windows will show an
rem  unknown-publisher or SmartScreen warning. The script says so in its own
rem  output rather than leaving you to find out from a publisher warning.
rem
rem  It never publishes, never tags, never pushes and never creates a release.
rem  Building an installer and shipping one are different actions with different
rem  authority, and a local build script has the first and not the second.
rem ===========================================================================

set "SCRIPT_DIR=%~dp0"
set "ENGINE=%SCRIPT_DIR%scripts\windows-build.ps1"
set "BUILD_SILENT="
set "BUILD_WITH_GH="

rem Each branch is wrapped in parentheses: in batch, `if cond a & b` runs b
rem unconditionally, which would make every invocation silent.
:parse
if "%~1"=="" goto parsed
if /i "%~1"=="/s"        (set "BUILD_SILENT=1" & shift & goto parse)
if /i "%~1"=="-s"        (set "BUILD_SILENT=1" & shift & goto parse)
if /i "%~1"=="/silent"   (set "BUILD_SILENT=1" & shift & goto parse)
if /i "%~1"=="--silent"  (set "BUILD_SILENT=1" & shift & goto parse)
if /i "%~1"=="/with-gh"    (set "BUILD_WITH_GH=1" & shift & goto parse)
if /i "%~1"=="--with-gh"   (set "BUILD_WITH_GH=1" & shift & goto parse)
if /i "%~1"=="/include-gh" (set "BUILD_WITH_GH=1" & shift & goto parse)
if /i "%~1"=="/?"       goto usage
if /i "%~1"=="-h"       goto usage
if /i "%~1"=="--help"   goto usage
echo.
echo   Unrecognised argument: %~1
call :usage
exit /b 2

:parsed
if defined SILENT if not "%SILENT%"=="0" set "BUILD_SILENT=1"
if defined WITH_GH if not "%WITH_GH%"=="0" set "BUILD_WITH_GH=1"

if not exist "%ENGINE%" (
    echo.
    echo   BUILD FAILED
    echo   Dependency or step : the build engine
    echo   Version constraint : scripts\windows-build.ps1 must exist
    echo   Source tried       : %ENGINE%
    echo   Blocking error     : the file is missing from this checkout, so there is
    echo                        nothing to run. Re-clone the repository.
    echo.
    exit /b 1
)

set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell.exe"

set "GH_ARG="
if defined BUILD_WITH_GH set "GH_ARG=-WithGh"

if defined BUILD_SILENT (
    "%PS_EXE%" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%ENGINE%" -Mode installer -Silent %GH_ARG%
) else (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -Mode installer %GH_ARG%
)
set "RESULT=%ERRORLEVEL%"

if not defined BUILD_SILENT (
    echo.
    pause
)
exit /b %RESULT%

:usage
echo.
echo   build-installer.bat - build the Squirrel.Windows installer from a bare checkout
echo.
echo     build-installer.bat              install every dependency, build and
echo                                      package, then verify the artifact
echo     build-installer.bat /s           silent: no prompt, no pause, non-zero
echo     build-installer.bat --silent     exit on the first real failure
echo     build-installer.bat /with-gh     also bundle the GitHub CLI (gh.exe);
echo     build-installer.bat --with-gh    off by default, see below
echo     build-installer.bat /?           this help
echo.
echo     The environment variable SILENT=1 has the same effect as /s, and
echo     WITH_GH=1 has the same effect as /with-gh.
echo.
echo   Fetches and verifies the JRE and MinGit this installer bundles so the
echo   packaged application never has to send a user to a browser for a
echo   dependency it needs itself (app\scripts\fetch-dependencies.mjs, pinned
echo   in app\scripts\dependency-manifest.json). The GitHub CLI is left off by
echo   default -- it only serves the World Vault's optional "publish to
echo   GitHub" action -- pass /with-gh to bundle it too.
echo.
echo   It reports the artifact path, its size, its SHA-256 and the source commit,
echo   and states plainly that the installer is UNSIGNED. It never publishes,
echo   tags, pushes or creates a release.
echo.
exit /b 0
