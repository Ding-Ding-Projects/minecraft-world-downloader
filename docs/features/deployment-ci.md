# Deployment, CI & installer

> How the unified desktop application is built, packaged, and released: one GitHub Actions
> workflow that builds the Java engine with Maven, builds and packages the Electron application
> with Squirrel.Windows, and publishes both — installer and engine jar — to one GitHub Release on
> every push. Two local scripts (`build.bat`, `build-installer.bat`) reproduce the same steps from
> a bare checkout.

## What it does

This feature covers everything that turns the source tree into the one artifact set this
repository ships: the Windows desktop application (`app/`) together with the Java engine
(`world-downloader.jar`, built from the Maven project at the repository root) it spawns to
actually speak the Minecraft protocol and write a world to disk.

The application is **not a second product beside the jar** — it is the Material Design 3 UI that
drives it: the downloader proxy, the world tools, the live map pipeline, the web console and the
automation bot, combined into one desktop shell that starts the jar as a child process with the
options the user configured. A release of the application without the engine it runs would ship
half a thing, which is why every release carries both.

- **`.github/workflows/release.yml`** — the only workflow that publishes a GitHub Release, on
  every push to any branch and on manual dispatch. It builds the jar with Maven, builds and
  packages the desktop application with electron-builder's Squirrel.Windows target (which bundles
  the jar into the packaged application as its default engine), collects the installer set and the
  jar into a staging directory, and publishes them together as one release.
- **`app/electron-builder.yml`** — the Squirrel.Windows packaging configuration for `app/`,
  including the `extraResources` entry that copies the Maven-built jar into the packaged
  application's `resources/engine/` directory.
- **`scripts/windows-build.ps1`** — the shared engine behind the two root-level one-click build
  scripts. Its `installer` mode reproduces the exact steps the release workflow runs: obtain a
  JDK and Maven, build and verify the jar, then package and verify the Squirrel installer.
- **`build.bat`** / **`build-installer.bat`** (and their POSIX counterparts) — the one-click entry
  points at the repository root that a fresh checkout runs to get, respectively, a runnable build
  and an installable, verified installer.
- **`.github/workflows/pages.yml`** — publishes the documentation site (`site/`) to GitHub Pages.
  Unrelated to the release artifacts described here.

Everything else the source tree still contains — the legacy Docker image, the NSIS installer for
the old WPF desktop manager, the five workflows that used to build them — is superseded and no
longer wired into any workflow. See `AGENTS.md` for the legacy-surface inventory; this document
covers only the release path that is actually live.

## How it works

### The Java engine (`pom.xml`, repository root)

`pom.xml` is a Maven project (Java 21, Eclipse Temurin) that shades the downloader core and all of
its runtime dependencies (JavaFX, Gson, Unirest, dnsjava, jo-nbt, args4j, …) into a single
executable jar via the `maven-shade-plugin`. The plugin pins
`<finalName>world-downloader</finalName>`, so `mvn package` always replaces
`target/world-downloader.jar` with the fully-shaded artifact — verified locally at
14,055,418 bytes (13.4 MiB) for the current dependency set.

`<skipTests>true</skipTests>` is the pom's own default, so a plain `mvn package` never runs the
Java test suite. The release workflow and both local build scripts run
`mvn -B -ntp clean package -DskipTests` explicitly, for the same reason the rest of this pipeline
runs no gate at all (see [Checks that run](#checks-that-run-and-checks-that-do-not) below): running
the Java tests here would quietly reintroduce exactly the gate this project's release path
deliberately does not have. A failing Java test remains a defect to fix locally, in the task that
changed the code; it simply never blocks a build or a release.

### The desktop application (`app/`)

`app/` is an Electron application built with `electron-vite` and packaged with `electron-builder`'s
Squirrel.Windows target (`app/electron-builder.yml`). It is the only installer format this project
ships — no NSIS, no MSI, no portable ZIP — carrying the standard Squirrel artifact set: a
`*Setup*.exe`, a `RELEASES` index, and one or more `.nupkg` packages (a full package always, delta
packages when Squirrel can produce one).

`app/electron-builder.yml`'s `extraResources` entry copies `../target/world-downloader.jar` (i.e.
the jar Maven just built, one directory above `app/`) into the packaged application at
`resources/engine/world-downloader.jar`. This is meant to become the renderer's **default** jar
location, with the user's own "Jar path" setting still winning when they set one explicitly — see
[Open items](#open-items) for the exact renderer/main change this still requires. Maven must run
before electron-builder packages the application. **This is not enforced by electron-builder
itself**: `copyFiles()` in `app-builder-lib/out/fileMatcher.js` does a plain `statOrNull` on each
`extraResources` entry's `from` path and, on a missing directory, logs `log.warn("file source
doesn't exist")` and returns — it does not throw and does not fail the build. A missing jar (or a
missing bundled runtime, or a missing scraper `node_modules`, see below) packages "successfully"
with the resource silently absent. What actually catches this is
`.github/workflows/release.yml`'s "Confirm the packaged bundle actually carries its dependencies"
step, which opens the real packaged output after `electron-builder` exits and asserts each expected
file is really there, by exact path, before anything is published.

Code signing is **permanently out of scope** for this project. `electron-builder.yml` pins
`forceCodeSigning: false` and `signExecutable: false`; the packaging step in `release.yml` clears
every `CSC_*` environment variable and disables certificate auto-discovery; and a dedicated
PowerShell step (`Confirm every executable is unsigned`) asserts every `.exe` in the staging
directory reports `NotSigned` via `Get-AuthenticodeSignature`, failing the release if anything ever
discovers a certificate. The published installer is unsigned and Windows will show an
unknown-publisher or SmartScreen warning; the release notes say so plainly.

### CI/CD workflow (`.github/workflows/release.yml`)

On `windows-latest`, triggered by every push to any branch and by manual dispatch:

1. **Check out** the repository with full history (`fetch-depth: 0` — the line counter attributes
   surviving lines with `git blame`, which needs the commits those lines came from).
2. **Set up Node 22** and **Set up Java 21** (Temurin, with Maven dependency caching).
3. **Decide the release tag and version**: `1.0.<run_number>` / `app-v1.0.<run_number>`, monotonic
   in the GitHub Actions run number so no tag is ever recycled, and refuses to proceed if that exact
   tag is already released.
4. **Build the Java engine (jar)**: `mvn -B -ntp clean package -DskipTests` at the repository root,
   followed by an explicit check that `target/world-downloader.jar` exists and is at least 1 MiB
   (anything smaller reads as a packaging stub, not the shaded jar with its dependencies).
5. **Install the application's dependencies**, stamp the release version into `app/package.json`
   (so the installer, the package metadata and the Squirrel update feed all agree), and confirm the
   Electron runtime binary is actually extracted.
6. **Build the application** (`electron-vite build`) and **package it with Squirrel**
   (`electron-builder --win squirrel`), which is also where the jar built in step 4 gets bundled in
   via `extraResources`.
7. **Collect the release artifacts** into a `staging/` directory: the Squirrel installer set,
   swept by exact filename pattern from `app/release/squirrel-windows/` (not a broad `*.exe` sweep
   across the whole output tree — see the inline comment in the workflow for why that used to
   attach the 211 MB unpacked application, its execution stub, and Squirrel's own updater as release
   assets), plus the engine jar, copied in **explicitly and by name** from
   `target/world-downloader.jar` with its own presence-and-size assertion. Losing the installer or
   losing the engine are both refused as the same kind of failure: a release that silently ships an
   incomplete artifact set.
8. **Confirm every executable is unsigned**, **count the lines of code** with the repository's own
   committed counter, and **resolve a dim sum release code name** from the public catalog — all
   best-effort and never blocking the release.
9. **Compose the release notes**, including a dedicated section explaining what the jar is and is
   not (see [Release notes](#release-notes) below), an artifact table with size and SHA-256 for
   every staged file (the jar included automatically, since the table is generated from whatever is
   in `staging/`), the line-count table, and the release code name.
10. **Publish the release** (`gh release create`) with every staged file attached, then **verify
    the published release** — not a draft, targets the intended commit, and carries an installer,
    a `RELEASES` index, a full `.nupkg`, and the engine jar by its exact filename
    (`world-downloader.jar`). Any of those missing fails the workflow after the release has already
    been created, which is deliberate: a partial release is a defect to see and fix, not one to hide
    by skipping verification.
11. **Summarize the run** and **upload the packaging outputs as run evidence** — both `if: always()`,
    so a failed run still leaves whatever was produced inspectable.

#### Checks that run, and checks that do not

This workflow runs **no test, lint, type-check, coverage, accessibility or screenshot gate**,
anywhere, for either the Java engine or the desktop application. This is the repository owner's
explicit standing decision, stated in the workflow's own header comment: the release workflow
builds, packages and publishes, and nothing in it — including the new jar-build step — can withhold
a release on a code-quality verdict. Checking happens locally, before the push, in the task that
changed the code. The release notes' "Checks that were run" section says this plainly rather than
implying the release passed something that was never run.

### Local build path (`build.bat`, `build-installer.bat`, `scripts/windows-build.ps1`)

`build-installer.bat` at the repository root reproduces the release workflow's build and packaging
steps from a bare Windows checkout with nothing installed, so a locally built installer and a
released one are the same artifact rather than two things that merely resemble each other. Its
entire contract lives in `scripts/windows-build.ps1`'s `installer` mode, which runs these phases in
order:

1. Preflight (repository/commit identification).
2. **Node.js runtime** and **npm package manager** — winget first (user scope), falling back to a
   checksum-verified portable extraction.
3. **Application dependencies** (`npm ci`/`npm install` in `app/`) and the **Electron runtime
   binary**.
4. **Java Development Kit** — the same floor as CI (`>= 21`, verified locally with a newer JDK
   too), resolved from `JAVA_HOME`, well-known per-vendor install directories, or PATH; if none
   qualifies, a user-scoped `winget install --id EclipseAdoptium.Temurin.21.JDK`, falling back to a
   SHA-256-verified portable extraction from Eclipse Temurin's own API. `JAVA_HOME` is set for the
   rest of the process either way, the same thing `actions/setup-java` does in CI.
5. **Maven build tool** — there is no Maven wrapper committed to this repository, so this is the
   one dependency in the whole build with no winget fallback: `mvn` is found on PATH or in a
   well-known install location, or a SHA-512-verified portable Apache Maven distribution is
   extracted from `archive.apache.org` (not `dlcdn.apache.org`, which only mirrors current releases
   and would eventually 404 on an older pin).
6. **Build the Java engine (jar)** — `mvn -B -ntp clean package -DskipTests` at the repository
   root, and **Verify the Java engine artifact** — confirms `target/world-downloader.jar` exists,
   is at least 1 MiB, and reports its exact path, size and SHA-256.
7. **Package the Squirrel.Windows installer** (`npm run dist`, in `app/`) and **Verify the installer
   artifact** — unchanged from before this feature: confirms the setup executable, `RELEASES` file
   and `.nupkg` all exist, that the setup executable is unsigned, and reports its path, size,
   SHA-256, version and source commit.

Every dependency phase follows the same shape the rest of this script already used for Node: check
what is already installed and skip it if it qualifies; prefer a user-scoped, non-elevated install;
verify every downloaded artifact's checksum before extracting it; extract to a staging directory and
move into place atomically, so an interrupted run never leaves a half-extracted toolchain the next
run would trust; and refresh the **current process's** `PATH` after every install — a package
manager writes `PATH` for future shells, so without this the very next line in the same script still
cannot find what it just installed, which reads as a failed install when it in fact succeeded. A
dependency that genuinely cannot be obtained fails that exact phase, naming the missing dependency,
the version constraint, the source that was tried, and the blocking error — never a bare
"build failed".

`build.bat`'s `app` mode (build and optionally run, no packaging) is unchanged by this feature: it
does not package an installer, so it never needs the JDK/Maven/jar phases above.

### Release notes

Composed entirely in the `Compose the release notes` step from real data — nothing hand-typed
outside the workflow. Beyond the existing unsigned-artifact warning, install instructions, "Checks
that were run: None" section, build metadata table, artifact table (file, size, SHA-256 for every
staged asset), line-count table and dim sum code name, every release now carries a dedicated
**"The engine (`world-downloader.jar`)"** section stating plainly that the jar is *not* a second
application to install, what it actually is (the Java process the desktop application spawns),
that it requires a Java 21+ runtime, that a normal install does not need it downloaded separately
because the installer bundles it as the default engine, and why it is still attached to the release
on its own (to run standalone or inspect without installing the desktop application at all).

## Key files

- `pom.xml` — the Maven project at the repository root; `finalName` `world-downloader`, main class
  `Launcher`, shade plugin, `<skipTests>true</skipTests>` by default. Produces
  `target/world-downloader.jar`.
- `.github/workflows/release.yml` — the one workflow that builds, packages and publishes. See
  [How it works](#how-it-works) above for its exact steps.
- `.github/workflows/pages.yml` — publishes `site/` to GitHub Pages. Not part of the release path.
- `app/electron-builder.yml` — Squirrel.Windows packaging configuration, including the
  `extraResources` entry that bundles the jar.
- `app/package.json` — `npm run build` (electron-vite build), `npm run dist` (build + package with
  electron-builder), `npm run ensure-electron` (extracts the Electron runtime binary if npm's own
  install script did not).
- `build.bat` / `build.sh` — one-click build (no packaging).
- `build-installer.bat` / `build-installer.sh` — one-click installer build, reproducing the release
  workflow's artifact set locally.
- `scripts/windows-build.ps1` — the shared engine behind both root-level scripts on Windows.
- `scripts/posix-build.sh` — the POSIX-host build engine, invoked by `build.sh` /
  `build-installer.sh`. Squirrel.Windows packaging needs a Windows host, so on Linux/macOS the
  installer script prepares everything and then states that boundary rather than substituting a
  different installer format.

## Configuration / flags

- `pom.xml` properties: `java.version` / `java.version.max` (`21`), `skipTests` (`true`).
- `app/electron-builder.yml`: `appId`, `productName`, `forceCodeSigning: false`,
  `win.signExecutable: false`, `win.target` (Squirrel, x64 only), `squirrelWindows.artifactName`,
  `squirrelWindows.iconUrl` (fetched by Squirrel at install time for Add/Remove Programs, so it must
  be a public HTTPS URL), `extraResources` (the jar bundle).
- `build-installer.bat` / `build-installer.sh`: `/s`, `--silent`, or `SILENT=1` for a fully
  non-interactive run that exits non-zero on the first real failure — the mode CI, a scheduled task,
  or another agent should use.
- Release workflow environment: `GH_TOKEN` resolved from
  `secrets.RELEASE_TOKEN || secrets.ORG_TOKEN || secrets.GITHUB_TOKEN`; `DIM_SUM_REPOSITORY` /
  `DIM_SUM_CATALOG_URL` for the release code name.
- Version: `1.0.<github.run_number>` for both the application (`npm version`) and the release tag
  (`app-v1.0.<run_number>`); the Java engine's own Maven `<version>` (`2.3`) is independent and not
  part of the release version scheme — it identifies the Java project's own source, not the release.

No application CLI flags are introduced by this feature; it only builds, packages and publishes the
existing application and jar.

## Usage

- **Get a runnable build without an installer:** `build.bat` (Windows) or `./build.sh` (Linux/macOS)
  from a bare checkout.
- **Get the same installer this project releases, built locally:**
  `build-installer.bat` (Windows). Reports the installer's path, size, SHA-256 and source commit,
  and states plainly that it is unsigned. Never publishes, tags, pushes, or creates a release.
- **Run the jar directly, without the desktop application:**
  `mvn package` at the repository root, then `java -jar target/world-downloader.jar --no-gui -s <server> -o <world>` (see `AGENTS.md` for the full flag reference, which the desktop application's own option
  table mirrors).
- **Cut a release:** push to any branch, or run the workflow manually. Every push publishes a new,
  uniquely tagged, non-draft release carrying the installer set and the jar — there is no separate
  release trigger and no tag-driven path; the workflow's own commit history documents an earlier
  narrowing away from that broader multi-workflow shape (see `AGENTS.md`'s legacy-surface table).

## Verification

- **Parsed for well-formedness**: `.github/workflows/release.yml` and `app/electron-builder.yml`
  both parse cleanly as YAML (`PyYAML` `safe_load`), and `actionlint` (with shellcheck disabled —
  shellcheck integration is known to hang indefinitely on some Windows hosts; see the shared agent
  notes) reports no structural problems.
- **Maven build exercised locally**: `mvn -B -ntp clean package -DskipTests` from the repository
  root exits `0` and produces `target/world-downloader.jar` at exactly 14,055,418 bytes
  (13.40 MiB), matching the filename the release workflow's collection step, the local build
  engine's verification phase, and `app/electron-builder.yml`'s `extraResources` entry all expect.
- **The new PowerShell phases exercised locally**: `Resolve-JdkToolchain`, `Resolve-MavenToolchain`,
  `Build-JavaEngine` and `Confirm-JavaEngine` were run end to end against the real repository
  (isolated from `app/` to avoid colliding with concurrent work there), correctly finding the
  already-installed JDK and Maven, building the jar, and verifying it.
- **Not exercised in this pass**: a full `npm run dist` / electron-builder packaging run (to
  confirm the jar actually lands at `resources/engine/world-downloader.jar` inside the packaged
  application), because `app/` had actively in-progress, uncommitted changes from concurrent work
  at the time this document was written. electron-builder is configured to fail packaging loudly if
  `../target/world-downloader.jar` does not exist when `extraResources` is evaluated, which is the
  intended fail-closed behavior rather than a gap in this verification.

## Gotchas & limitations

- **The jar is bundled, not yet the renderer's default.** `app/electron-builder.yml` places the jar
  at `resources/engine/world-downloader.jar` inside the packaged application, but the renderer code
  that resolves which jar to run (`app/src/renderer/features/downloader/runtime.ts`'s `probeJar`)
  does not yet know to look there. See [Open items](#open-items).
- **Squirrel runs the installed application to make its own shortcuts, and it will not make them
  for you.** After extracting the package, Squirrel launches the freshly installed executable with
  a lifecycle argument (`--squirrel-install`, `--squirrel-updated`, `--squirrel-uninstall`,
  `--squirrel-obsolete`) and waits roughly fifteen seconds for it to do that event’s housekeeping
  and exit. Creating the Start Menu and Desktop shortcuts is part of that housekeeping and is the
  APPLICATION’s job: Squirrel only supplies `Update.exe`, one directory above the versioned
  application folder. An application that ignores those arguments installs and, from the user’s
  side, does nothing — setup runs, the executable opens its full user interface instead of making
  a shortcut, the timeout expires, the process is killed, and the install finishes with no Start
  Menu entry, no Desktop icon and no window that stayed open. Nothing fails and nothing is logged.
  This application shipped in exactly that state; `app/src/main/squirrel.ts` now answers those
  events and is the first thing `app/src/main/index.ts` does. `--squirrel-firstrun` is
  deliberately NOT one of them: it means the user opened the app through the new shortcut, so it
  must start normally.
- **`-DskipTests` is deliberate, not a gap.** See [Checks that run](#checks-that-run-and-checks-that-do-not).
- **Squirrel.Windows only, x64 only.** No NSIS, no MSI, no ARM64 build. `signAndEditExecutable:
  false` was tried before `signExecutable: false` and rejected: it skips both code signing *and*
  resource editing, which shipped an executable carrying the framework's default icon and no
  version metadata. `signExecutable: false` skips only signing while keeping the icon and version
  string applied.
- **The Java project's own version (`2.3` in `pom.xml`) and the release version
  (`1.0.<run_number>`) are independent numbers.** Do not read the jar's filename or its own
  Maven-reported version as the release version; the release tag and the application's
  `package.json` version are the ones that are monotonic per push.
- **No Maven wrapper is committed.** Unlike Node (which has a winget package), a missing `mvn` on a
  fresh machine falls straight to the portable-download path in `scripts/windows-build.ps1`; there
  is no faster alternative today.
- **The legacy Docker image, NSIS installer, and the five superseded workflows are inert.** They
  remain in the tree (see `AGENTS.md`) but are not wired into `release.yml` or any other active
  workflow. Do not describe them as part of the current release contract.
- **electron-builder silently drops a `node_modules` directory sitting at the ROOT of an
  `extraResources` entry's `from`, regardless of any `filter:` on that entry.**
  `app-builder-lib/out/util/filter.js`'s `createFilter()` hardcodes `if (relative === "node_modules")
  return false` — a deliberate guard against `extraResources: {from: '.', to: '.'}` accidentally
  copying a project's own root `node_modules`, but it fires for *any* `from` whose immediate child is
  named `node_modules`, including a standalone project like `scraper/`. This shipped once
  (app-v1.0.96): `scraper/`'s own `npm ci` had already installed its dependencies before packaging
  ran, and the "Confirm the packaged bundle actually carries its dependencies" step still failed on
  `resources/scraper/node_modules/mineflayer/package.json` — it was a filtering bug, not an ordering
  one. `app/electron-builder.yml` works around it with a second, deliberately separate
  `extraResources` entry rooted directly at `../scraper/node_modules` (`walk()` in
  `builder-util/out/fs.js` never runs the filter against its own starting directory, only against
  that directory's children, so making `node_modules` itself the root sidesteps the check). Do not
  merge that back into the single `../scraper -> scraper` entry.

## Open items

- **Renderer/main default-jar resolution.** `app/src/renderer/features/downloader/runtime.ts`'s
  `probeJar` should gain a candidate for the bundled jar's packaged location
  (`path.join(process.resourcesPath, 'engine', 'world-downloader.jar')`) so the bundled jar becomes
  the application's default engine, with the user's own "Jar path" setting still winning when they
  set one. This also needs `AppInfo` (built in `app/src/main/ipc.ts`'s `buildAppInfo`, defined
  wherever its type lives) to expose a resources-path field the renderer can read, since nothing
  in the current `AppInfo` shape exposes `process.resourcesPath` today. This change was
  deliberately **not** made as part of adding the jar to the release, because `app/src/` is owned by
  a different task lane; see the codebase's own hand-off notes for the exact proposed change.
