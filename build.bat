@echo off
setlocal EnableExtensions

rem ===========================================================================
rem  World Downloader Studio - one-click build
rem ===========================================================================
rem
rem  Takes a checkout on a fresh Windows install with NOTHING on it - no Node,
rem  no npm, no package manager, no SDK - and gets it to a built, runnable
rem  program without asking you to go and install anything by hand.
rem
rem  Usage:
rem    build.bat            build, then offer to run the application
rem    build.bat /s         silent: install and build with no prompt and no
rem    build.bat --silent   interactive pause, exiting non-zero on the first
rem    set SILENT=1         real failure. This is the mode CI, a scheduled task
rem                         or another script should use.
rem    build.bat /?         this help
rem
rem  Code signing is permanently out of scope for this project. Nothing here
rem  requests, generates, stores or uses a certificate or signing key.
rem
rem  This never changes the machine's persistent execution policy. The
rem  -ExecutionPolicy Bypass below applies to this one PowerShell process only,
rem  which is what lets the unsigned local helper run out of a fresh checkout.
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
    "%PS_EXE%" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%ENGINE%" -Mode app -Silent
) else (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -Mode app
)
set "RESULT=%ERRORLEVEL%"

if not defined BUILD_SILENT (
    echo.
    pause
)
exit /b %RESULT%

:usage
echo.
echo   build.bat - build World Downloader Studio from a bare checkout
echo.
echo     build.bat              install every dependency, build, then ask
echo                            whether to run the application
echo     build.bat /s           silent: no prompt, no pause, non-zero exit on
echo     build.bat --silent     the first real failure
echo     build.bat /?           this help
echo.
echo     The environment variable SILENT=1 has the same effect as /s.
echo.
echo   It installs Node.js itself when the machine has none - a user-scoped
echo   winget install first, and a portable extract into
echo   %%LOCALAPPDATA%%\world-downloader-studio\toolchain when that is not
echo   available. Administrator rights are never required.
echo.
echo   To build the installer instead, run build-installer.bat.
echo.
exit /b 0
