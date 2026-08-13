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
rem    build-installer.bat /?         this help
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

rem Each branch is wrapped in parentheses: in batch, `if cond a & b` runs b
rem unconditionally, which would make every invocation silent.
:parse
if "%~1"=="" goto parsed
if /i "%~1"=="/s"       (set "BUILD_SILENT=1" & shift & goto parse)
if /i "%~1"=="-s"       (set "BUILD_SILENT=1" & shift & goto parse)
if /i "%~1"=="/silent"  (set "BUILD_SILENT=1" & shift & goto parse)
if /i "%~1"=="--silent" (set "BUILD_SILENT=1" & shift & goto parse)
if /i "%~1"=="/?"       goto usage
if /i "%~1"=="-h"       goto usage
if /i "%~1"=="--help"   goto usage
echo.
echo   Unrecognised argument: %~1
call :usage
exit /b 2

:parsed
if defined SILENT if not "%SILENT%"=="0" set "BUILD_SILENT=1"

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

if defined BUILD_SILENT (
    "%PS_EXE%" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%ENGINE%" -Mode installer -Silent
) else (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -Mode installer
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
echo     build-installer.bat /?           this help
echo.
echo     The environment variable SILENT=1 has the same effect as /s.
echo.
echo   It reports the artifact path, its size, its SHA-256 and the source commit,
echo   and states plainly that the installer is UNSIGNED. It never publishes,
echo   tags, pushes or creates a release.
echo.
exit /b 0
