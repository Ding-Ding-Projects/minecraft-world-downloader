#!/usr/bin/env bash
# =============================================================================
#  World Downloader Studio - one-click build (POSIX hosts)
# =============================================================================
#
#  The counterpart of build.bat. Takes a checkout on a machine with nothing
#  installed - no Node.js, no npm, no toolchain - and gets it to a built,
#  runnable program without asking you to install anything by hand.
#
#  Usage:
#    ./build.sh             build, then offer to run the application
#    ./build.sh -s          silent: install and build with no prompt and no
#    ./build.sh --silent    interactive pause, exiting non-zero on the first
#    SILENT=1 ./build.sh    real failure
#    ./build.sh --help      this help
#
#  Root is never required: a user-scoped package manager install is preferred
#  where one exists without root, and a portable Node.js runtime is extracted
#  into a per-user toolchain directory otherwise.
#
#  Code signing is permanently out of scope for this project. Nothing here
#  requests, generates, stores or uses a certificate or signing key.
#
#  Windows is this project's delivery target, so build.bat is the one that is
#  never optional; this script is the equivalent for developing on a POSIX host.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="$SCRIPT_DIR/scripts/posix-build.sh"

for argument in "$@"; do
  case "$argument" in
    -h|--help|/?)
      cat <<'USAGE'

  build.sh - build World Downloader Studio from a bare checkout

    ./build.sh             install every dependency, build, then ask whether to
                           run the application
    ./build.sh -s          silent: no prompt, no pause, non-zero exit on the
    ./build.sh --silent    first real failure
    ./build.sh --help      this help

    The environment variable SILENT=1 has the same effect as -s.

  It installs Node.js itself when the machine has none, into a per-user
  toolchain directory. Root is never required.

  To build the Windows installer, run build-installer.bat on Windows.

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

exec bash "$ENGINE" app "$@"
