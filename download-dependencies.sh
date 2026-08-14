#!/usr/bin/env bash
# =============================================================================
#  World Downloader Studio - one-click BUILD DEPENDENCY download (POSIX hosts)
# =============================================================================
#
#  The counterpart of download-dependencies.bat. Obtains every pinned,
#  checksum-verified dependency needed to build, run and test this project --
#  see scripts/dependency-manifest.json for the exact versions and digests.
#
#  Usage:
#    ./download-dependencies.sh             download everything, then pause
#    ./download-dependencies.sh -s          silent: no prompt, no interactive
#    ./download-dependencies.sh --silent    pause, exiting non-zero on the
#    SILENT=1 ./download-dependencies.sh    first real failure
#    ./download-dependencies.sh --help      this help
#
#  Root is never required: every archive and every extracted toolchain lives
#  under a per-user cache directory outside the repository.
#
#  Code signing is permanently out of scope for this project. Nothing here
#  requests, generates, stores or uses a certificate or signing key.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="$SCRIPT_DIR/scripts/download-dependencies-posix.sh"

for argument in "$@"; do
  case "$argument" in
    -h|--help|/?)
      cat <<'USAGE'

  download-dependencies.sh - fetch every pinned build dependency

    ./download-dependencies.sh             download everything, then pause
    ./download-dependencies.sh -s          silent: no prompt, no pause,
    ./download-dependencies.sh --silent    non-zero exit on first failure
    ./download-dependencies.sh --help      this help

    The environment variable SILENT=1 has the same effect as -s.

  It resolves a JDK, Apache Maven and a Node.js runtime -- each a pinned,
  checksum-verified version recorded in scripts/dependency-manifest.json --
  into a per-user toolchain directory, resolves every Maven dependency the
  root pom.xml declares, and then delegates app/'s own bundled-runtime
  dependencies to app/scripts/fetch-dependencies.mjs when that script exists.

  To actually build the project, run build.sh instead (it calls this same
  pinned toolchain).

USAGE
      exit 0
      ;;
  esac
done

if [ ! -f "$ENGINE" ]; then
  cat >&2 <<EOF

  DEPENDENCY DOWNLOAD FAILED
  Dependency or step : the download engine
  Version constraint : scripts/download-dependencies-posix.sh must exist
  Source tried       : $ENGINE
  Blocking error     : the file is missing from this checkout, so there is
                       nothing to run. Re-clone the repository.

EOF
  exit 1
fi

exec bash "$ENGINE" "$@"
