#!/usr/bin/env bash
# =============================================================================
#  One-click build engine for World Downloader Studio on POSIX hosts.
# =============================================================================
#
#  This is the engine behind build.sh and build-installer.sh at the repository
#  root, and the counterpart of scripts/windows-build.ps1. The two entry points
#  are thin so the phases cannot drift apart between modes.
#
#  It assumes a host with nothing installed: no Node.js, no npm, no toolchain.
#  Every dependency is obtained by this script itself, with no prompt and no
#  sentence that begins "install X and run this again". A user-scoped package
#  manager install is preferred where one exists without root; otherwise a
#  portable Node.js runtime is extracted into a per-user toolchain directory.
#  Root is never required.
#
#  CODE SIGNING IS PERMANENTLY OUT OF SCOPE for this project. Nothing here
#  requests, generates, discovers, stores or uses a certificate or signing key,
#  and no signer is ever invoked.
#
#  Usage:  posix-build.sh <app|installer> [--silent]
# =============================================================================

set -euo pipefail

MODE="${1:-app}"
shift || true

SILENT_MODE="${SILENT:-0}"
if [ "$SILENT_MODE" = "0" ]; then SILENT_MODE=""; fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    -s|/s|--silent|/silent) SILENT_MODE=1 ;;
    *) printf '  Unrecognised argument: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

case "$MODE" in
  app|installer) ;;
  *) printf '  Unknown mode: %s (expected app or installer)\n' "$MODE" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_ROOT/app"

# The application's own engines constraint, and the version used when Node has
# to be installed portably.
NODE_MIN_MAJOR=20
NODE_MIN_MINOR=19
NODE_MIN_PATCH=0
NODE_MIN="$NODE_MIN_MAJOR.$NODE_MIN_MINOR.$NODE_MIN_PATCH"
NODE_PORTABLE_VERSION="22.20.0"
NODE_DIST_BASE="https://nodejs.org/dist"

TOOLCHAIN_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/world-downloader-studio/toolchain"

NODE_EXE=""
NPM_CMD=""

PHASE_INDEX=0
if [ "$MODE" = "installer" ]; then PHASE_TOTAL=7; else PHASE_TOTAL=8; fi
PHASE_NAMES=()
PHASE_RESULTS=()
PHASE_SECONDS=()
PHASE_STARTED=0
RUN_STARTED="$(date +%s)"

# --- output ------------------------------------------------------------------

line()      { printf '%s\n' "${1:-}"; }
rule()      { printf '%s\n' '--------------------------------------------------------------------------'; }
banner()    { line ''; rule; printf '  %s\n' "$1"; rule; }
info()      { printf '  %s\n' "$1"; }
found()     { printf '  [present]   %s\n' "$1"; }
added()     { printf '  [installed] %s\n' "$1"; }
step()      { printf '  [running]   %s\n' "$1"; }
warn()      { printf '  [warning]   %s\n' "$1"; }

start_phase() {
  PHASE_INDEX=$((PHASE_INDEX + 1))
  PHASE_NAMES+=("$1")
  PHASE_RESULTS+=("running")
  PHASE_SECONDS+=("0")
  PHASE_STARTED="$(date +%s)"
  banner "Phase $PHASE_INDEX/$PHASE_TOTAL  $1"
}

complete_phase() {
  local result="${1:-done}"
  local elapsed=$(( $(date +%s) - PHASE_STARTED ))
  local last=$((PHASE_INDEX - 1))
  PHASE_RESULTS[$last]="$result"
  PHASE_SECONDS[$last]="$elapsed"
  printf '  -> %s in %s\n' "$result" "$(format_duration "$elapsed")"
}

format_duration() {
  local total="$1"
  if [ "$total" -lt 60 ]; then printf '%ss' "$total"; return; fi
  printf '%dm %02ds' "$((total / 60))" "$((total % 60))"
}

format_bytes() {
  local bytes="$1"
  if [ "$bytes" -ge 1048576 ]; then
    awk -v b="$bytes" 'BEGIN { printf "%.2f MiB", b / 1048576 }'
  elif [ "$bytes" -ge 1024 ]; then
    awk -v b="$bytes" 'BEGIN { printf "%.2f KiB", b / 1024 }'
  else
    printf '%s bytes' "$bytes"
  fi
}

print_summary() {
  line ''
  line 'Phase timings'
  printf '  %-4s %-40s %-12s %s\n' '#' 'Phase' 'Result' 'Elapsed'
  rule
  local i=0
  while [ "$i" -lt "${#PHASE_NAMES[@]}" ]; do
    printf '  %-4s %-40s %-12s %s\n' "$((i + 1))" "${PHASE_NAMES[$i]}" "${PHASE_RESULTS[$i]}" "$(format_duration "${PHASE_SECONDS[$i]}")"
    i=$((i + 1))
  done
  rule
  printf '  Total elapsed: %s\n' "$(format_duration "$(( $(date +%s) - RUN_STARTED ))")"
}

# A failure names the exact dependency, the version constraint, the source that
# was tried, and the blocking error. Never a bare "build failed".
fail() {
  local dependency="$1" constraint="$2" source="$3" problem="$4"
  shift 4
  if [ "${#PHASE_RESULTS[@]}" -gt 0 ]; then
    local last=$((PHASE_INDEX - 1))
    if [ "${PHASE_RESULTS[$last]}" = "running" ]; then
      PHASE_RESULTS[$last]="FAILED"
      PHASE_SECONDS[$last]="$(( $(date +%s) - PHASE_STARTED ))"
    fi
  fi
  # Everything goes to stderr: a failure raised inside a command substitution
  # would otherwise be captured as that substitution's value and never seen.
  {
    line ''
    rule
    line '  BUILD FAILED'
    rule
    printf '  Dependency or step : %s\n' "$dependency"
    printf '  Version constraint : %s\n' "$constraint"
    printf '  Source tried       : %s\n' "$source"
    printf '  Blocking error     : %s\n' "$problem"
    if [ "$#" -gt 0 ]; then
      line '  Everything that was attempted, in order:'
      for attempt in "$@"; do printf '    - %s\n' "$attempt"; done
    fi
    rule
    print_summary
  } >&2
  exit 1
}

# --- Node.js -----------------------------------------------------------------

node_version_ok() {
  # Prints nothing; returns 0 when the given node satisfies the minimum.
  local candidate="$1"
  local raw
  raw="$("$candidate" --version 2>/dev/null || true)"
  case "$raw" in v[0-9]*) ;; *) return 1 ;; esac
  raw="${raw#v}"
  local major="${raw%%.*}"
  local rest="${raw#*.}"
  local minor="${rest%%.*}"
  local patch="${rest#*.}"
  patch="${patch%%-*}"
  [ -n "$major" ] && [ -n "$minor" ] && [ -n "$patch" ] || return 1
  if [ "$major" -gt "$NODE_MIN_MAJOR" ]; then return 0; fi
  if [ "$major" -lt "$NODE_MIN_MAJOR" ]; then return 1; fi
  if [ "$minor" -gt "$NODE_MIN_MINOR" ]; then return 0; fi
  if [ "$minor" -lt "$NODE_MIN_MINOR" ]; then return 1; fi
  [ "$patch" -ge "$NODE_MIN_PATCH" ]
}

node_reported_version() {
  "$1" --version 2>/dev/null || printf 'unknown'
}

find_usable_node() {
  local candidate
  for candidate in \
    "$(command -v node 2>/dev/null || true)" \
    "$TOOLCHAIN_ROOT/node-v$NODE_PORTABLE_VERSION-$(node_platform)-$(node_arch)/bin/node" \
    "/usr/local/bin/node" \
    "/opt/homebrew/bin/node" \
    "$HOME/.local/bin/node"
  do
    [ -n "$candidate" ] || continue
    [ -x "$candidate" ] || continue
    if node_version_ok "$candidate"; then printf '%s' "$candidate"; return 0; fi
  done
  return 1
}

node_platform() {
  case "$(uname -s)" in
    Linux) printf 'linux' ;;
    Darwin) printf 'darwin' ;;
    *) printf 'unsupported' ;;
  esac
}

node_arch() {
  case "$(uname -m)" in
    x86_64|amd64) printf 'x64' ;;
    aarch64|arm64) printf 'arm64' ;;
    armv7l) printf 'armv7l' ;;
    *) printf 'unsupported' ;;
  esac
}

download_to() {
  local url="$1" target="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 -o "$target" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$target" "$url"
  else
    fail 'a download tool' 'curl or wget' "$url" \
      'neither curl nor wget is installed, so nothing can be fetched. Install either one and re-run.'
  fi
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    fail 'a SHA-256 tool' 'sha256sum or shasum' "$1" \
      'neither sha256sum nor shasum is available, so a downloaded archive cannot be verified. Refusing to extract an unverified archive.'
  fi
}

install_node_with_package_manager() {
  # Only package managers that install into the user's own prefix without root.
  # apt/dnf/pacman all need root, so they are deliberately not attempted here.
  if command -v brew >/dev/null 2>&1; then
    step 'brew install node'
    if brew install node; then
      hash -r 2>/dev/null || true
      export PATH="$PATH"
      return 0
    fi
    warn 'brew install node failed; falling back to a portable runtime'
    return 1
  fi
  warn 'no root-free package manager found (Homebrew absent); falling back to a portable runtime'
  return 1
}

# Checked once, up front, rather than from inside a command substitution where a
# failure message would be swallowed as that substitution's value.
require_fetch_tools() {
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    fail 'a download tool' 'curl or wget' "$NODE_DIST_BASE" \
      'neither curl nor wget is installed, so the Node.js runtime cannot be fetched. Install either one, or install Node.js itself, and re-run.'
  fi
  if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
    fail 'a SHA-256 tool' 'sha256sum or shasum' "$NODE_DIST_BASE" \
      'neither sha256sum nor shasum is available, so a downloaded archive could not be verified. Refusing to extract an unverified archive.'
  fi
  if ! command -v tar >/dev/null 2>&1; then
    fail 'tar' 'any tar that can read a gzip archive' "$NODE_DIST_BASE" \
      'tar is not installed, so the Node.js archive could not be extracted'
  fi
}

# Sets the global PORTABLE_NODE rather than printing the path, because this
# function also prints progress and a caller using command substitution would
# capture all of it.
PORTABLE_NODE=""
install_node_portable() {
  local platform arch folder archive url sums_url archive_path sums_path expected actual staging target
  require_fetch_tools
  platform="$(node_platform)"
  arch="$(node_arch)"
  if [ "$platform" = "unsupported" ] || [ "$arch" = "unsupported" ]; then
    fail 'Node.js runtime' ">= $NODE_MIN" "$NODE_DIST_BASE" \
      "no official Node.js build exists for $(uname -s)/$(uname -m); install Node.js >= $NODE_MIN by hand and re-run"
  fi

  folder="node-v$NODE_PORTABLE_VERSION-$platform-$arch"
  archive="$folder.tar.gz"
  url="$NODE_DIST_BASE/v$NODE_PORTABLE_VERSION/$archive"
  sums_url="$NODE_DIST_BASE/v$NODE_PORTABLE_VERSION/SHASUMS256.txt"
  target="$TOOLCHAIN_ROOT/$folder"

  if [ -x "$target/bin/node" ]; then
    found "portable Node.js already extracted at $target"
    PORTABLE_NODE="$target/bin/node"
    return 0
  fi

  mkdir -p "$TOOLCHAIN_ROOT/.download"
  archive_path="$TOOLCHAIN_ROOT/.download/$archive"
  sums_path="$TOOLCHAIN_ROOT/.download/SHASUMS256-$NODE_PORTABLE_VERSION.txt"

  if [ -f "$archive_path" ]; then
    found "cached archive at $archive_path; it will be reused only if it still verifies"
  else
    step "downloading $url"
    download_to "$url" "$archive_path"
  fi

  step "verifying SHA-256 against $sums_url"
  download_to "$sums_url" "$sums_path"
  expected="$(awk -v name="$archive" '$2 == name { print $1 }' "$sums_path" | head -n 1)"
  if [ -z "$expected" ]; then
    fail 'Node.js runtime checksum' "an entry for $archive" "$sums_url" \
      "the published checksum list contains no line for $archive"
  fi

  actual="$(sha256_of "$archive_path")"
  if [ "$actual" != "$expected" ]; then
    warn 'the archive did not verify; discarding it and downloading again'
    rm -f "$archive_path"
    download_to "$url" "$archive_path"
    actual="$(sha256_of "$archive_path")"
  fi
  if [ "$actual" != "$expected" ]; then
    rm -f "$archive_path"
    fail 'Node.js runtime checksum' "SHA-256 $expected" "$url" \
      "the downloaded archive hashed to $actual; it has been deleted rather than extracted"
  fi
  info "SHA-256 verified: $actual"

  # Extract into a staging directory and move into place, so an interrupted run
  # never leaves a half-extracted toolchain that the next run would trust.
  staging="$TOOLCHAIN_ROOT/.staging-$$"
  rm -rf "$staging"
  mkdir -p "$staging"
  step "extracting to $target"
  tar -xzf "$archive_path" -C "$staging"
  if [ ! -x "$staging/$folder/bin/node" ]; then
    rm -rf "$staging"
    fail 'Node.js runtime' "bin/node inside $folder" "$url" \
      "the archive extracted but contained no runnable bin/node at $staging/$folder"
  fi
  rm -rf "$target"
  mv "$staging/$folder" "$target"
  rm -rf "$staging"

  PORTABLE_NODE="$target/bin/node"
}

resolve_node_toolchain() {
  start_phase 'Node.js runtime'

  local existing=""
  if existing="$(find_usable_node)"; then
    found "Node.js $(node_reported_version "$existing") at $existing"
    NODE_EXE="$existing"
  else
    info "no Node.js >= $NODE_MIN on this machine; obtaining one now"
    if install_node_with_package_manager; then
      if existing="$(find_usable_node)"; then
        added "Node.js $(node_reported_version "$existing") at $existing (package manager)"
        NODE_EXE="$existing"
      else
        warn 'the package manager reported success but no qualifying node appeared on PATH'
      fi
    fi
    if [ -z "$NODE_EXE" ]; then
      info 'falling back to a portable, user-scoped Node.js runtime (no root needed)'
      local portable
      install_node_portable
      portable="$PORTABLE_NODE"
      if ! node_version_ok "$portable"; then
        fail 'Node.js runtime' ">= $NODE_MIN" "$NODE_DIST_BASE/v$NODE_PORTABLE_VERSION/" \
          "the portable runtime at $portable reported version $(node_reported_version "$portable")" \
          'package manager install' 'portable extract'
      fi
      added "Node.js $(node_reported_version "$portable") at $portable (portable, user toolchain)"
      NODE_EXE="$portable"
    fi
  fi

  # Put the resolved runtime ahead of anything else for the rest of this
  # process, so npm and every tool it spawns agree on which Node is in use.
  PATH="$(dirname "$NODE_EXE"):$PATH"
  export PATH
  hash -r 2>/dev/null || true

  complete_phase
}

resolve_npm_toolchain() {
  start_phase 'npm package manager'
  local dir candidate
  dir="$(dirname "$NODE_EXE")"
  candidate="$dir/npm"
  if [ ! -x "$candidate" ]; then
    candidate="$(command -v npm 2>/dev/null || true)"
  fi
  if [ -z "$candidate" ] || [ ! -x "$candidate" ]; then
    fail 'npm' 'the npm that ships inside the Node.js distribution' "$dir" \
      "no npm was found beside node at $dir and none is on PATH"
  fi
  NPM_CMD="$candidate"
  found "npm $("$NPM_CMD" --version) at $NPM_CMD"
  complete_phase
}

# --- application -------------------------------------------------------------

# Asks whether what is installed matches what the manifest and lockfile declare,
# rather than comparing modification times. A timestamp comparison reinstalls the
# whole tree whenever anyone edits a script in package.json, which makes a warm
# run as slow as a cold one and wipes node_modules underneath anything else that
# happens to be building. The same checker serves the Windows engine.
DEPENDENCY_STATE=""
dependencies_are_fresh() {
  local checker="$SCRIPT_DIR/deps-in-sync.mjs"
  if [ ! -f "$checker" ]; then
    DEPENDENCY_STATE='scripts/deps-in-sync.mjs is missing, so the dependency state cannot be judged'
    return 1
  fi
  if DEPENDENCY_STATE="$("$NODE_EXE" "$checker" "$APP_DIR")"; then
    return 0
  fi
  return 1
}

install_app_dependencies() {
  start_phase 'Application dependencies'

  if dependencies_are_fresh; then
    found "$DEPENDENCY_STATE; nothing to install"
    complete_phase 'skipped'
    return
  fi
  info "needs installing: $DEPENDENCY_STATE"

  local installed=1
  if [ -f "$APP_DIR/package-lock.json" ]; then
    step 'npm ci --no-audit --no-fund  (in app/)'
    if (cd "$APP_DIR" && "$NPM_CMD" ci --no-audit --no-fund); then
      installed=0
    else
      warn 'npm ci failed; the lockfile and package.json are probably out of step, retrying with npm install'
    fi
  fi
  if [ "$installed" -ne 0 ]; then
    step 'npm install --no-audit --no-fund  (in app/)'
    if (cd "$APP_DIR" && "$NPM_CMD" install --no-audit --no-fund); then
      installed=0
    fi
  fi
  if [ "$installed" -ne 0 ]; then
    fail 'app/node_modules (project dependencies)' \
      'as declared by app/package.json and app/package-lock.json' \
      'the npm registry configured for this machine' \
      'npm exited non-zero; its output is immediately above this message' \
      'npm ci --no-audit --no-fund' 'npm install --no-audit --no-fund'
  fi

  added "project dependencies into $APP_DIR/node_modules"
  complete_phase
}

confirm_electron_runtime() {
  start_phase 'Electron runtime binary'

  local helper="$APP_DIR/scripts/ensure-electron-binary.mjs"
  if [ ! -f "$helper" ]; then
    fail 'Electron runtime binary' 'app/scripts/ensure-electron-binary.mjs must exist' "$helper" \
      'the helper that extracts the Electron runtime is missing from this checkout'
  fi

  local dist="$APP_DIR/node_modules/electron/dist"
  local marker="$dist/electron"
  if [ "$(node_platform)" = "darwin" ]; then marker="$dist/Electron.app"; fi
  if [ -e "$marker" ]; then
    found "Electron runtime already extracted at $marker"
    complete_phase 'skipped'
    return
  fi

  step 'node scripts/ensure-electron-binary.mjs  (in app/)'
  if ! (cd "$APP_DIR" && "$NODE_EXE" scripts/ensure-electron-binary.mjs) || [ ! -e "$marker" ]; then
    fail 'Electron runtime binary' "$marker must exist" \
      'the @electron/get cache populated by npm install' \
      "ensure-electron-binary.mjs did not leave a runnable Electron at $marker" \
      "npm install (which runs electron's own install script)" \
      'node scripts/ensure-electron-binary.mjs'
  fi
  added "Electron runtime at $marker"
  complete_phase
}

build_application() {
  start_phase 'Build the application'
  step 'npm run build  (electron-vite build, in app/)'
  if ! (cd "$APP_DIR" && "$NPM_CMD" run build); then
    fail 'application build' 'npm run build must exit 0' 'electron-vite build' \
      'npm run build exited non-zero; its output is immediately above this message'
  fi
  complete_phase
}

confirm_build_output() {
  start_phase 'Verify the build output'
  local missing=()
  local file
  for file in "$APP_DIR/out/main/index.js" "$APP_DIR/out/preload/index.js" "$APP_DIR/out/renderer/index.html"; do
    if [ -f "$file" ]; then
      found "$file  ($(format_bytes "$(wc -c < "$file" | tr -d ' ')"))"
    elif [ -f "${file%.js}.mjs" ]; then
      # electron-vite emits the preload as .mjs when the package is ESM.
      found "${file%.js}.mjs  ($(format_bytes "$(wc -c < "${file%.js}.mjs" | tr -d ' ')"))"
    else
      missing+=("$file")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    fail 'application build output' \
      'electron-vite must emit main, preload and renderer bundles' \
      "$APP_DIR/out" \
      "npm run build exited 0 but these files are absent: ${missing[*]}"
  fi
  complete_phase
}

repository_commit() {
  if ! command -v git >/dev/null 2>&1; then printf ''; return; fi
  (cd "$REPO_ROOT" && git rev-parse HEAD 2>/dev/null) || printf ''
}

repository_dirty() {
  if ! command -v git >/dev/null 2>&1; then printf 'unknown'; return; fi
  local status
  status="$(cd "$REPO_ROOT" && git status --porcelain 2>/dev/null || true)"
  if [ -n "$status" ]; then printf 'yes'; else printf 'no'; fi
}

preflight() {
  start_phase 'Preflight'
  info "Repository        : $REPO_ROOT"
  info "Application       : $APP_DIR"
  if [ "$MODE" = "installer" ]; then
    info 'Mode              : installer (build + package the Squirrel.Windows installer)'
  else
    info 'Mode              : app (build and optionally run)'
  fi
  if [ -n "$SILENT_MODE" ]; then
    info 'Silent            : yes - no prompts, non-zero exit on first failure'
  else
    info 'Silent            : no - will offer to run the app at the end'
  fi
  info "Host              : $(uname -s) $(uname -m)"
  info "User toolchain    : $TOOLCHAIN_ROOT"

  if [ ! -f "$APP_DIR/package.json" ]; then
    fail 'application sources' 'app/package.json must exist' "$APP_DIR" \
      'this does not look like a checkout of this repository'
  fi

  local commit
  commit="$(repository_commit)"
  if [ -n "$commit" ]; then
    info "Source commit     : $commit (uncommitted changes: $(repository_dirty))"
  else
    info 'Source commit     : unknown - git is not available or this is not a checkout'
  fi
  complete_phase
}

build_installer() {
  start_phase 'Package the Squirrel.Windows installer'

  # Squirrel.Windows is a Windows packaging target and this project's delivery
  # target is Windows. On a POSIX host electron-builder would need Wine, which is
  # not the supported packaging path, so this reports the exact boundary rather
  # than substituting a different installer format and calling it the same thing.
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      local engine="$SCRIPT_DIR/windows-build.ps1"
      if [ ! -f "$engine" ]; then
        fail 'the Windows build engine' 'scripts/windows-build.ps1 must exist' "$engine" \
          'this shell is running on Windows but the PowerShell engine is missing from this checkout'
      fi
      step 'delegating to scripts/windows-build.ps1 (this shell is running on Windows)'
      local engine_win
      engine_win="$(cygpath -w "$engine" 2>/dev/null || printf '%s' "$engine")"
      if [ -n "$SILENT_MODE" ]; then
        powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$engine_win" -Mode installer -Silent || exit 1
      else
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$engine_win" -Mode installer || exit 1
      fi
      complete_phase
      print_summary
      exit 0
      ;;
  esac

  fail 'Squirrel.Windows installer packaging' \
    'a Windows host (electron-builder --win squirrel)' \
    "$(uname -s) $(uname -m)" \
    "Squirrel.Windows is a Windows packaging target and this project's delivery target is Windows. Producing it here would need Wine, which is not this project's supported packaging path, and substituting a different installer format would not be the same artifact. Run build-installer.bat on Windows. Use ./build.sh on this host to build and run the application itself." \
    'checked the host operating system before invoking electron-builder'
}

run_prompt() {
  start_phase 'Run the application'
  if [ -n "$SILENT_MODE" ]; then
    info 'Silent mode: not offering to run. Start it later with:  npm start   (in app/)'
    complete_phase 'skipped'
    return
  fi
  line ''
  printf '  Run World Downloader Studio now? [Y/n] '
  local answer=''
  read -r answer || answer=''
  case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
    ''|y|yes) ;;
    *) info 'Not running. Start it later with:  npm start   (in app/)'; complete_phase 'skipped'; return ;;
  esac
  step 'npm start  (electron-vite preview, in app/)'
  if ! (cd "$APP_DIR" && "$NPM_CMD" start); then
    warn 'the application exited non-zero'
    complete_phase 'exited non-zero'
    return
  fi
  complete_phase
}

# --- main --------------------------------------------------------------------

if [ "$MODE" = "installer" ]; then
  banner 'World Downloader Studio - one-click installer build'
else
  banner 'World Downloader Studio - one-click build'
fi

preflight
resolve_node_toolchain
resolve_npm_toolchain
install_app_dependencies
confirm_electron_runtime

if [ "$MODE" = "installer" ]; then
  build_installer
else
  build_application
  confirm_build_output
  run_prompt
fi

line ''
rule
if [ "$MODE" = "installer" ]; then
  line '  SUCCESS - the unsigned Squirrel.Windows installer is built and verified.'
else
  line '  SUCCESS - the application is built and ready to run.'
fi
rule
print_summary
exit 0
