#!/usr/bin/env bash
# =============================================================================
#  World Downloader Studio - one-click BUILD DEPENDENCY download (POSIX hosts)
# =============================================================================
#
#  This is the engine behind download-dependencies.sh at the repository root,
#  and the POSIX counterpart of scripts/download-dependencies.ps1. It obtains
#  every dependency needed to build, run and test this project: a JDK and
#  Apache Maven for the root pom.xml engine, a Node.js runtime for app/'s own
#  build tooling, and every Maven dependency the pom.xml declares.
#
#  Every binary this script places on disk is a pinned exact version, verified
#  against a checksum recorded in scripts/dependency-manifest.json -- the same
#  manifest scripts/download-dependencies.ps1 reads on Windows -- which is
#  committed beside this script so a human can audit exactly what a build
#  places on their machine without running anything.
#
#  This is a narrower, standalone concern from build.sh: build.sh installs
#  app/'s own npm packages and actually builds the application; this script
#  only makes sure every dependency those steps need is already on disk,
#  pinned and verified, before anyone runs them. It never touches app/ itself:
#  once a usable Node.js runtime is resolved, app/'s own BUNDLED runtime
#  dependencies (a Java runtime, a portable Git, the GitHub CLI -- the ones
#  shipped INSIDE the packaged installer) are delegated to
#  app/scripts/fetch-dependencies.mjs, if and when that file exists.
#
#  The manifest is small and flat by design, and is parsed here with awk/sed/
#  grep alone -- no jq, no python -- so this script has no dependency of its
#  own on a fresh host beyond the POSIX toolset it already requires to fetch
#  and verify archives.
#
#  Root is never required. Every archive and every extracted toolchain lives
#  entirely under a per-user cache directory outside the repository, so
#  nothing here is ever committed and nothing here uses Git LFS in any form.
#
#  CODE SIGNING IS PERMANENTLY OUT OF SCOPE for this project. Nothing here
#  requests, generates, discovers, stores or uses a certificate, signing key
#  or credential of any kind.
#
#  Usage:  download-dependencies-posix.sh [--silent]
# =============================================================================

set -euo pipefail

SILENT_MODE="${SILENT:-0}"
if [ "$SILENT_MODE" = "0" ]; then SILENT_MODE=""; fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    -s|--silent) SILENT_MODE=1 ;;
    *) printf '  Unrecognised argument: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SCRIPT_DIR/dependency-manifest.json"
TOOLCHAIN_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/world-downloader-studio/toolchain"
APP_FETCH_SCRIPT="$REPO_ROOT/app/scripts/fetch-dependencies.mjs"

NODE_EXE=""
JAVA_HOME_RESOLVED=""
MVN_CMD=""

PHASE_INDEX=0
PHASE_TOTAL=5
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

# A failure names the exact dependency, the version constraint, the source
# that was tried, and the blocking error. Never a bare "failed".
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
  {
    line ''
    rule
    line '  DEPENDENCY DOWNLOAD FAILED'
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

# --- manifest (awk/sed/grep only -- no jq, no python) -------------------------

if [ ! -f "$MANIFEST" ]; then
  fail 'dependency manifest' 'scripts/dependency-manifest.json must exist' "$MANIFEST" \
    'the pinned-version manifest is missing from this checkout, so there is nothing to verify a download against. Re-clone the repository.'
fi

# Prints the lines of the first "<key>": { ... } block found in stdin,
# tracking brace depth so nested objects (artifacts -> win-x64 -> {...}) are
# never mistaken for the end of the outer one.
extract_block() {
  local key="$1"
  awk -v key="\"$key\"" '
    BEGIN { depth = 0; capturing = 0 }
    {
      if (!capturing) {
        if (index($0, key) > 0 && index($0, "{") > 0) { capturing = 1 } else next
      }
      print
      depth += gsub(/\{/, "{")
      depth -= gsub(/\}/, "}")
      if (depth == 0) exit
    }
  '
}

# Prints the string value of "<field>": "..." from a block of JSON text piped
# in on stdin. Works because scripts/dependency-manifest.json is deliberately
# flat -- one key/value pair per line -- so this never has to understand
# nesting, only strip quoting and trailing commas from a matched line.
field_value() {
  local field="$1"
  grep -m1 "\"$field\"[[:space:]]*:" \
    | sed -E "s/^[[:space:]]*\"$field\"[[:space:]]*:[[:space:]]*\"?//; s/\"?,?[[:space:]]*\$//"
}

dependency_block() { extract_block "$1" < "$MANIFEST"; }
artifact_block()    { extract_block "$1"; }  # reads from stdin (a dependency/artifacts block already in hand)

require_manifest_field() {
  local block="$1" field="$2" label="$3"
  local value
  value="$(printf '%s\n' "$block" | field_value "$field")"
  if [ -z "$value" ]; then
    fail 'dependency manifest' "a non-empty \"$field\" for $label" "$MANIFEST" \
      "scripts/dependency-manifest.json did not yield a value for \"$field\" under $label -- the manifest is malformed or this parser's assumptions about its layout no longer hold"
  fi
  printf '%s' "$value"
}

# --- download / checksum helpers ---------------------------------------------

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

digest_of() {
  local algorithm="$1" path="$2"
  case "$algorithm" in
    sha256)
      if command -v sha256sum >/dev/null 2>&1; then sha256sum "$path" | awk '{print $1}'
      elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$path" | awk '{print $1}'
      else fail 'a SHA-256 tool' 'sha256sum or shasum' "$path" 'neither sha256sum nor shasum is available; refusing to extract an unverified archive'
      fi
      ;;
    sha512)
      if command -v sha512sum >/dev/null 2>&1; then sha512sum "$path" | awk '{print $1}'
      elif command -v shasum >/dev/null 2>&1; then shasum -a 512 "$path" | awk '{print $1}'
      else fail 'a SHA-512 tool' 'sha512sum or shasum' "$path" 'neither sha512sum nor shasum is available; refusing to extract an unverified archive'
      fi
      ;;
    *)
      fail 'checksum algorithm' 'sha256 or sha512' "$algorithm" "the manifest names an algorithm this script does not implement: $algorithm"
      ;;
  esac
}

require_fetch_tools() {
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    fail 'a download tool' 'curl or wget' "$MANIFEST" \
      'neither curl nor wget is installed, so nothing can be fetched. Install either one and re-run.'
  fi
  if ! command -v tar >/dev/null 2>&1; then
    fail 'tar' 'any tar that can read a gzip archive' "$MANIFEST" \
      'tar is not installed, so a downloaded archive cannot be extracted'
  fi
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
    *) printf 'unsupported' ;;
  esac
}

manifest_platform_key() {
  # node/jdk artifact keys in the manifest are "<os>-<arch>", e.g. linux-x64,
  # darwin-x64, darwin-arm64. This is the exact string used as the JSON key.
  printf '%s-%s' "$(node_platform)" "$(node_arch)"
}

# Downloads (or reuses a cached, still-verifying copy of) a pinned archive
# described by an artifact JSON block, verifies its digest, and extracts it
# into a fresh staging directory. Prints the staging directory path.
fetch_pinned_archive() {
  local dependency_name="$1" artifact_block_text="$2" pinned_version="$3"
  local archive_name url algorithm digest archive_path staging

  archive_name="$(require_manifest_field "$artifact_block_text" 'archiveName' "$dependency_name")"
  url="$(require_manifest_field "$artifact_block_text" 'url' "$dependency_name")"
  algorithm="$(require_manifest_field "$artifact_block_text" 'algorithm' "$dependency_name")"
  digest="$(require_manifest_field "$artifact_block_text" 'digest' "$dependency_name" | tr '[:upper:]' '[:lower:]')"

  require_fetch_tools
  mkdir -p "$TOOLCHAIN_ROOT/.download"
  archive_path="$TOOLCHAIN_ROOT/.download/$archive_name"

  if [ -f "$archive_path" ]; then
    found "cached archive at $archive_path; it will be reused only if it still verifies"
  else
    step "downloading $url"
    download_to "$url" "$archive_path"
  fi

  local actual
  actual="$(digest_of "$algorithm" "$archive_path" | tr '[:upper:]' '[:lower:]')"
  if [ "$actual" != "$digest" ]; then
    warn "the cached archive did not verify (expected $digest, got $actual); discarding and re-downloading"
    rm -f "$archive_path"
    download_to "$url" "$archive_path"
    actual="$(digest_of "$algorithm" "$archive_path" | tr '[:upper:]' '[:lower:]')"
  fi
  if [ "$actual" != "$digest" ]; then
    rm -f "$archive_path"
    fail "$dependency_name checksum" "$algorithm $digest (from scripts/dependency-manifest.json)" "$url" \
      "the downloaded archive hashed to $actual on both attempts; it has been deleted rather than extracted. Either the manifest's pinned digest is stale or the download was tampered with."
  fi
  info "$algorithm verified: $actual"

  staging="$TOOLCHAIN_ROOT/.staging-$$-$RANDOM"
  rm -rf "$staging"
  mkdir -p "$staging"
  step "extracting $archive_name"
  case "$archive_name" in
    *.tar.gz|*.tgz) tar -xzf "$archive_path" -C "$staging" ;;
    *.zip)
      if command -v unzip >/dev/null 2>&1; then unzip -q "$archive_path" -d "$staging"
      else fail "$dependency_name" 'unzip must be installed to extract a .zip archive' "$archive_path" 'unzip is not on PATH'
      fi
      ;;
    *) fail "$dependency_name" 'a .tar.gz or .zip archive' "$archive_path" "unrecognised archive extension: $archive_name" ;;
  esac
  printf '%s' "$staging"
}

# --- Node.js -------------------------------------------------------------

node_version_ok() {
  local candidate="$1" min_major="$2" min_minor="$3" min_patch="$4"
  local raw major minor patch rest
  raw="$("$candidate" --version 2>/dev/null || true)"
  case "$raw" in v[0-9]*) ;; *) return 1 ;; esac
  raw="${raw#v}"
  major="${raw%%.*}"; rest="${raw#*.}"; minor="${rest%%.*}"; patch="${rest#*.}"; patch="${patch%%-*}"
  [ -n "$major" ] && [ -n "$minor" ] && [ -n "$patch" ] || return 1
  if [ "$major" -gt "$min_major" ]; then return 0; fi
  if [ "$major" -lt "$min_major" ]; then return 1; fi
  if [ "$minor" -gt "$min_minor" ]; then return 0; fi
  if [ "$minor" -lt "$min_minor" ]; then return 1; fi
  [ "$patch" -ge "$min_patch" ]
}

find_usable_node() {
  local min_major="$1" min_minor="$2" min_patch="$3" candidate
  for candidate in \
    "$(command -v node 2>/dev/null || true)" \
    "/usr/local/bin/node" \
    "/opt/homebrew/bin/node" \
    "$HOME/.local/bin/node"
  do
    [ -n "$candidate" ] || continue
    [ -x "$candidate" ] || continue
    if node_version_ok "$candidate" "$min_major" "$min_minor" "$min_patch"; then printf '%s' "$candidate"; return 0; fi
  done
  # our own pinned toolchain, if a previous run already extracted it
  local dir
  for dir in "$TOOLCHAIN_ROOT"/node-v*; do
    [ -x "$dir/bin/node" ] || continue
    if node_version_ok "$dir/bin/node" "$min_major" "$min_minor" "$min_patch"; then printf '%s' "$dir/bin/node"; return 0; fi
  done
  return 1
}

resolve_node_toolchain() {
  local node_block platform_key artifact pinned min_major min_minor min_patch minimum
  start_phase 'Node.js runtime'
  node_block="$(dependency_block node)"
  minimum="$(require_manifest_field "$node_block" 'minimumVersion' node)"
  min_major="${minimum%%.*}"; local mrest="${minimum#*.}"; min_minor="${mrest%%.*}"; min_patch="${mrest#*.}"
  pinned="$(require_manifest_field "$node_block" 'pinnedVersion' node)"

  local existing
  if existing="$(find_usable_node "$min_major" "$min_minor" "$min_patch")"; then
    found "Node.js $("$existing" --version) at $existing"
    NODE_EXE="$existing"
  else
    info "no Node.js >= $minimum on this machine; obtaining the pinned build ($pinned) now"
    platform_key="$(manifest_platform_key)"
    local artifacts_block
    artifacts_block="$(printf '%s\n' "$node_block" | artifact_block artifacts)"
    artifact="$(printf '%s\n' "$artifacts_block" | artifact_block "$platform_key")"
    if [ -z "$artifact" ]; then
      fail 'Node.js runtime' ">= $minimum" "$MANIFEST" \
        "scripts/dependency-manifest.json has no node artifact recorded for platform \"$platform_key\" ($(uname -s)/$(uname -m)). Install Node.js >= $minimum by hand and re-run, or add a pinned entry for this platform."
    fi
    local staging extracted target
    staging="$(fetch_pinned_archive 'Node.js runtime' "$artifact" "$pinned")"
    # The target directory name is derived from the pinned version, not
    # assumed from the archive filename: what actually extracted is
    # discovered dynamically (see the Maven install below for why this
    # matters -- an archive's own filename is not a reliable guide to the
    # directory name it unpacks to).
    target="$TOOLCHAIN_ROOT/node-v$pinned-$platform_key"
    extracted="$(find "$staging" -mindepth 1 -maxdepth 1 -type d | head -n1)"
    if [ -z "$extracted" ] || [ ! -x "$extracted/bin/node" ]; then
      rm -rf "$staging"
      fail 'Node.js runtime' 'a single top-level directory containing bin/node' "$MANIFEST" "the archive extracted but no such directory was found under $staging"
    fi
    rm -rf "$target"
    mv "$extracted" "$target"
    rm -rf "$staging"
    NODE_EXE="$target/bin/node"
    added "Node.js $("$NODE_EXE" --version) at $NODE_EXE (pinned, user toolchain)"
  fi
  complete_phase
}

# --- Java Development Kit -----------------------------------------------

find_usable_jdk() {
  local min_major="$1" candidate javac_candidate version
  local candidates=()
  [ -n "${JAVA_HOME:-}" ] && candidates+=("$JAVA_HOME/bin/java")
  candidates+=(/usr/lib/jvm/*/bin/java /Library/Java/JavaVirtualMachines/*/Contents/Home/bin/java "$HOME/.local/share/world-downloader-studio/toolchain"/jdk-*/bin/java "$TOOLCHAIN_ROOT"/jdk-*/bin/java)
  for candidate in "${candidates[@]}"; do
    [ -x "$candidate" ] || continue
    javac_candidate="$(dirname "$candidate")/javac"
    [ -x "$javac_candidate" ] || continue
    version="$("$candidate" -version 2>&1 | sed -n '1s/.*version "\([0-9]*\).*/\1/p')"
    [ -n "$version" ] || continue
    if [ "$version" -ge "$min_major" ]; then printf '%s' "$candidate"; return 0; fi
  done
  return 1
}

resolve_jdk_toolchain() {
  local jdk_block platform_key artifact pinned minimum min_major
  start_phase 'Java Development Kit'
  jdk_block="$(dependency_block jdk)"
  minimum="$(require_manifest_field "$jdk_block" 'minimumVersion' jdk)"
  min_major="${minimum%%.*}"
  pinned="$(require_manifest_field "$jdk_block" 'pinnedVersion' jdk)"

  local existing
  if existing="$(find_usable_jdk "$min_major")"; then
    found "JDK at $existing"
    JAVA_HOME_RESOLVED="$(cd "$(dirname "$existing")/.." && pwd)"
  else
    info "no JDK >= $minimum on this machine; obtaining Temurin $pinned now"
    platform_key="$(manifest_platform_key)"
    local artifacts_block
    artifacts_block="$(printf '%s\n' "$jdk_block" | artifact_block artifacts)"
    artifact="$(printf '%s\n' "$artifacts_block" | artifact_block "$platform_key")"
    if [ -z "$artifact" ]; then
      fail 'Java Development Kit' ">= $minimum" "$MANIFEST" \
        "scripts/dependency-manifest.json has no jdk artifact recorded for platform \"$platform_key\" ($(uname -s)/$(uname -m)). Install a JDK >= $minimum by hand and re-run, or add a pinned entry for this platform."
    fi
    local staging prefix target binary_rel java_bin
    staging="$(fetch_pinned_archive 'Java Development Kit' "$artifact" "$pinned")"
    prefix="$(require_manifest_field "$artifact" 'extractedDirectoryPrefix' jdk)"
    binary_rel="$(require_manifest_field "$artifact" 'binaryRelativePath' jdk)"
    target="$TOOLCHAIN_ROOT/$prefix"
    local extracted
    extracted="$(find "$staging" -maxdepth 1 -type d -name "jdk-*" | head -n1)"
    if [ -z "$extracted" ] || [ ! -x "$extracted/$(dirname "$binary_rel")/javac" ]; then
      rm -rf "$staging"
      fail 'Java Development Kit' "a jdk-* directory containing $(dirname "$binary_rel")/javac" "$MANIFEST" \
        "the archive extracted but no such directory was found under $staging"
    fi
    rm -rf "$target"
    mv "$extracted" "$target"
    rm -rf "$staging"
    java_bin="$target/$binary_rel"
    # On macOS, JAVA_HOME is the directory containing Contents/Home; elsewhere
    # it is the extraction root itself.
    case "$binary_rel" in
      Contents/Home/*) JAVA_HOME_RESOLVED="$target/Contents/Home" ;;
      *) JAVA_HOME_RESOLVED="$target" ;;
    esac
    added "JDK $("$java_bin" -version 2>&1 | head -n1) at $JAVA_HOME_RESOLVED (pinned, user toolchain)"
  fi
  export JAVA_HOME="$JAVA_HOME_RESOLVED"
  export PATH="$JAVA_HOME_RESOLVED/bin:$PATH"
  complete_phase
}

# --- Apache Maven ----------------------------------------------------------

find_usable_maven() {
  local candidate
  for candidate in \
    "$(command -v mvn 2>/dev/null || true)" \
    "${MAVEN_HOME:-}/bin/mvn" \
    "${M2_HOME:-}/bin/mvn" \
    /usr/local/opt/maven/bin/mvn \
    /opt/homebrew/opt/maven/bin/mvn
  do
    [ -n "$candidate" ] || continue
    [ -x "$candidate" ] || continue
    printf '%s' "$candidate"; return 0
  done
  local dir
  for dir in "$TOOLCHAIN_ROOT"/apache-maven-*; do
    [ -x "$dir/bin/mvn" ] || continue
    printf '%s' "$dir/bin/mvn"; return 0
  done
  return 1
}

resolve_maven_toolchain() {
  local maven_block artifact pinned
  start_phase 'Maven build tool'
  maven_block="$(dependency_block maven)"
  pinned="$(require_manifest_field "$maven_block" 'pinnedVersion' maven)"

  local existing
  if existing="$(find_usable_maven)"; then
    found "$("$existing" --version 2>&1 | head -n1) at $existing"
    MVN_CMD="$existing"
  else
    info "no mvn on this machine; obtaining the pinned Apache Maven $pinned build now"
    artifact="$(printf '%s\n' "$maven_block" | artifact_block artifact)"
    local staging extracted target
    staging="$(fetch_pinned_archive 'Maven build tool' "$artifact" "$pinned")"
    # NOT "${archive_name%.zip}": Apache's own "apache-maven-<version>-bin.zip"
    # naming convention extracts to a directory WITHOUT the "-bin" suffix, so
    # stripping the extension from the archive name would silently compute
    # the wrong directory. What actually extracted is discovered dynamically.
    target="$TOOLCHAIN_ROOT/apache-maven-$pinned"
    extracted="$(find "$staging" -mindepth 1 -maxdepth 1 -type d | head -n1)"
    if [ -z "$extracted" ] || [ ! -f "$extracted/bin/mvn" ]; then
      rm -rf "$staging"
      fail 'Maven build tool' 'a single top-level directory containing bin/mvn' "$MANIFEST" "the archive extracted but no such directory was found under $staging"
    fi
    chmod +x "$extracted/bin/mvn"
    rm -rf "$target"
    mv "$extracted" "$target"
    rm -rf "$staging"
    MVN_CMD="$target/bin/mvn"
    added "$("$MVN_CMD" --version 2>&1 | head -n1) at $MVN_CMD (pinned, user toolchain)"
  fi
  complete_phase
}

# --- Maven project dependencies (~/.m2) -------------------------------------

resolve_maven_project_dependencies() {
  start_phase 'Maven project dependencies (pom.xml)'
  step 'mvn -B -ntp dependency:go-offline  (resolves every declared dependency and plugin into the local repository)'
  if ! ( cd "$REPO_ROOT" && "$MVN_CMD" -B -ntp dependency:go-offline ); then
    fail 'Maven project dependencies' 'as declared by pom.xml (including the jitpack.io repository for jo-nbt)' \
      'Maven Central, jitpack.io and the plugin repositories configured in pom.xml' \
      'mvn dependency:go-offline exited non-zero; its output is immediately above this message'
  fi
  added 'every declared Maven dependency and plugin into the local repository (~/.m2)'
  complete_phase
}

# --- delegate to app/'s own bundled-runtime fetcher, if it exists yet ------

invoke_app_fetch_dependencies() {
  start_phase "app/'s bundled runtime dependencies"
  if [ ! -f "$APP_FETCH_SCRIPT" ]; then
    info 'app/scripts/fetch-dependencies.mjs does not exist in this checkout yet.'
    info 'That script (owned by app/) obtains the runtime binaries bundled INSIDE the'
    info 'packaged installer -- a separate concern from the build toolchain this script'
    info 'just resolved. Nothing to delegate to yet; this is not a failure.'
    complete_phase 'skipped'
    return
  fi
  local args=("$APP_FETCH_SCRIPT")
  [ -n "$SILENT_MODE" ] && args+=(--silent)
  step "node $(basename "$APP_FETCH_SCRIPT")${SILENT_MODE:+ --silent}"
  if ! ( cd "$REPO_ROOT/app" && "$NODE_EXE" "${args[@]}" ); then
    fail "app/'s bundled runtime dependencies" '(defined by app/scripts/fetch-dependencies.mjs itself)' "$APP_FETCH_SCRIPT" \
      'app/scripts/fetch-dependencies.mjs exited non-zero; its output is immediately above this message'
  fi
  added 'bundled runtime dependencies via app/scripts/fetch-dependencies.mjs'
  complete_phase
}

# --- main --------------------------------------------------------------------

banner 'World Downloader Studio -- dependency download'
info "Repository : $REPO_ROOT"
info "Toolchain  : $TOOLCHAIN_ROOT"
info "Mode       : $([ -n "$SILENT_MODE" ] && echo silent || echo interactive)"
info ''
info 'Nothing this script downloads is ever committed to the repository or routed'
info 'through Git LFS in any form: every archive and every extracted toolchain'
info 'lives entirely under the per-user toolchain directory above, outside the'
info 'working tree.'

resolve_node_toolchain
resolve_jdk_toolchain
resolve_maven_toolchain
resolve_maven_project_dependencies
invoke_app_fetch_dependencies

line ''
rule
line '  ALL DEPENDENCIES READY'
rule
print_summary
exit 0
