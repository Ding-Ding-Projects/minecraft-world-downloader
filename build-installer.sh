#!/usr/bin/env bash
# =============================================================================
#  World Downloader Studio - one-click installer build (POSIX hosts)
# =============================================================================
#
#  The counterpart of build-installer.bat. build.sh gets you a program you can
#  run out of the checkout; this one produces the artifact a person downloads
#  and installs, through the same supported packaging path the release workflow
#  uses, on the same version.
#
#  Usage:
#    ./build-installer.sh             build and verify the installer
#    ./build-installer.sh -s          silent: no prompt, no interactive pause,
#    ./build-installer.sh --silent    non-zero exit on the first real failure
#    SILENT=1 ./build-installer.sh    same as -s
#    ./build-installer.sh --help      this help
#
#  THE INSTALLER IT PRODUCES IS UNSIGNED. Code signing is permanently out of
#  scope for this project: nothing here requests, generates, discovers, stores
#  or uses a certificate, and no signer is ever invoked.
#
#  Windows is this project's delivery target and Squirrel.Windows is a Windows
#  packaging target. On a Linux or macOS host this script runs every dependency
#  and preparation phase and then reports that exact boundary rather than
#  substituting a different installer format; run it from a shell on Windows,
#  or run build-installer.bat, to produce the real artifact.
#
#  It never publishes, never tags, never pushes and never creates a release.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="$SCRIPT_DIR/scripts/posix-build.sh"

for argument in "$@"; do
  case "$argument" in
    -h|--help|/?)
      cat <<'USAGE'

  build-installer.sh - build the Squirrel.Windows installer from a bare checkout

    ./build-installer.sh             install every dependency, build and
                                     package, then verify the artifact
    ./build-installer.sh -s          silent: no prompt, no pause, non-zero exit
    ./build-installer.sh --silent    on the first real failure
    ./build-installer.sh --help      this help

    The environment variable SILENT=1 has the same effect as -s.

  The installer it produces is UNSIGNED; code signing is permanently out of
  scope for this project. It never publishes, tags, pushes or creates a release.

  Squirrel.Windows packaging needs a Windows host. On Linux or macOS this
  script prepares everything and then names that boundary instead of producing
  a different kind of installer.

USAGE
      exit 0
      ;;
  esac
done

if [ ! -f "$ENGINE" ]; then
  cat >&2 <<EOF

  BUILD FAILED
  Dependency or step : the build engine
  Version constraint : scripts/posix-build.sh must exist
  Source tried       : $ENGINE
  Blocking error     : the file is missing from this checkout, so there is
                       nothing to run. Re-clone the repository.

EOF
  exit 1
fi

exec bash "$ENGINE" installer "$@"
