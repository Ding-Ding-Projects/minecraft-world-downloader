@echo off
setlocal EnableExtensions

rem ===========================================================================
rem  World Downloader Studio - one-click BUILD DEPENDENCY download
rem ===========================================================================
rem
rem  Obtains every dependency needed to build, run and test this project on a
rem  fresh Windows machine with nothing installed: a JDK and Apache Maven for
rem  the root pom.xml engine, a Node.js runtime for app/'s own build tooling,
rem  and every Maven dependency the pom.xml declares. Every binary it places on
rem  disk is a pinned exact version verified against a checksum recorded in
rem  scripts\dependency-manifest.json, which is committed beside this script so
rem  a human can audit what a build puts on their machine without running it.
rem
rem  This is a narrower, standalone concern from build.bat: build.bat installs
rem  app/'s own npm packages and actually builds the application; this script
rem  only makes sure every dependency those steps need is already sitting on
rem  disk, pinned and verified, before anyone runs them. build.bat calls the
rem  same pinned toolchain this script resolves, so the two never install two
rem  different versions of the same thing.
rem
rem  Usage:
rem    download-dependencies.bat            download everything, then pause
rem    download-dependencies.bat /s         silent: no prompt, no interactive
rem    download-dependencies.bat --silent   pause, exiting non-zero on the
rem    set SILENT=1                         first real failure. This is the
rem                                         mode CI, a scheduled task or
rem                                         another script should use.
rem    download-dependencies.bat /?         this help
rem
rem  Nothing this script downloads is ever committed to the repository or
rem  routed through Git LFS in any form -- every archive and every extracted
rem  toolchain lives entirely under %LOCALAPPDATA%\world-downloader-studio,
rem  outside the working tree, so there is nothing here for Git or any LFS
rem  variant to carry.
rem
rem  Code signing is permanently out of scope for this project. Nothing here
rem  requests, generates, stores or uses a certificate or signing key.
rem
rem  This never changes the machine's persistent execution policy. The
rem  -ExecutionPolicy Bypass below applies to this one PowerShell process only,
rem  which is what lets the unsigned local helper run out of a fresh checkout.
rem ===========================================================================

set "SCRIPT_DIR=%~dp0"
set "ENGINE=%SCRIPT_DIR%scripts\download-dependencies.ps1"
set "DL_SILENT="

rem Each branch is wrapped in parentheses: in batch, `if cond a & b` runs b
rem unconditionally, which would make every invocation silent.
:parse
if "%~1"=="" goto parsed
if /i "%~1"=="/s"       (set "DL_SILENT=1" & shift & goto parse)
if /i "%~1"=="-s"       (set "DL_SILENT=1" & shift & goto parse)
if /i "%~1"=="/silent"  (set "DL_SILENT=1" & shift & goto parse)
if /i "%~1"=="--silent" (set "DL_SILENT=1" & shift & goto parse)
if /i "%~1"=="/?"       goto usage
if /i "%~1"=="-h"       goto usage
if /i "%~1"=="--help"   goto usage
echo.
echo   Unrecognised argument: %~1
call :usage
exit /b 2

:parsed
if defined SILENT if not "%SILENT%"=="0" set "DL_SILENT=1"

if not exist "%ENGINE%" (
    echo.
    echo   DEPENDENCY DOWNLOAD FAILED
    echo   Dependency or step : the download engine
    echo   Version constraint : scripts\download-dependencies.ps1 must exist
    echo   Source tried       : %ENGINE%
    echo   Blocking error     : the file is missing from this checkout, so there is
    echo                        nothing to run. Re-clone the repository.
    echo.
    exit /b 1
)

set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell.exe"

if defined DL_SILENT (
    "%PS_EXE%" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%ENGINE%" -Silent
) else (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%"
)
set "RESULT=%ERRORLEVEL%"

if not defined DL_SILENT (
    echo.
    pause
)
exit /b %RESULT%

:usage
echo.
echo   download-dependencies.bat - fetch every pinned build dependency
echo.
echo     download-dependencies.bat            download everything, then pause
echo     download-dependencies.bat /s         silent: no prompt, no pause,
echo     download-dependencies.bat --silent   non-zero exit on first failure
echo     download-dependencies.bat /?         this help
echo.
echo     The environment variable SILENT=1 has the same effect as /s.
echo.
echo   It resolves a JDK, Apache Maven and a Node.js runtime -- each a pinned,
echo   checksum-verified version recorded in scripts\dependency-manifest.json --
echo   into a per-user toolchain directory, resolves every Maven dependency the
echo   root pom.xml declares, and then delegates app/'s own bundled-runtime
echo   dependencies to app\scripts\fetch-dependencies.mjs when that script
echo   exists. Administrator rights are never required.
echo.
echo   To actually build the project, run build.bat instead (it calls this same
echo   pinned toolchain).
echo.
exit /b 0
