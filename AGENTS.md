# AGENTS.md

> **Mirror notice.** This file is a sanitized mirror of the shared agent-instruction rules this
> repository's maintainer applies to every project. It exists so any agent or contributor working
> here sees the rules without needing access to the maintainer's private instructions repository.
> The canonical source of these rules lives in that private repository and is edited there first;
> this file is refreshed to match whenever the canonical rules change. If something here reads as
> stale or contradicts a rule the maintainer states directly, the direct statement wins — say so and
> ask, don't guess. Nothing in this file grants any tool, integration, or agent authority beyond what
> its own platform and safety rules already allow.

---

## 1. What this repository is

This is `Ding-Ding-Projects/minecraft-world-downloader`, a public repository. It began as a Java
Minecraft world downloader (a proxy that sits between a client and a server and saves the chunks,
entities, and container contents the client sees) and grew a Dockerized Flask web console, a WPF C#
desktop manager, a Node.js auto-explore chat-scraper bot, and a Python BlueMap rendering pipeline
around it.

The repository is currently mid-unification: all of the above is being folded into **one Electron
desktop application** (`app/`) built to full Material Design 3 conformance, alongside a **documentation
website** (`site/`), with GitHub Actions cut down to a single workflow that builds, packages, and
releases the desktop application and nothing else.

**`FEATURE_INVENTORY.md` at the repository root is the authoritative, hand-written list of every
feature contract both the app and the site must carry**, with a status column per row. Read it before
starting any user-facing work here — it is more current than this file's prose ever will be. `ROADMAP.md`
tracks where the unification stands; `HANDOFF.md` is the factual state-of-the-world handoff for whoever
picks this up next. Update all three in the same task that changes the facts they record.

## 2. Repository layout

The legacy multi-surface product and the new unified application currently coexist in the tree during
migration. Do not add new user-facing feature code to the legacy surfaces below — new feature work
targets `app/` and `site/`. The legacy surfaces stay in the tree, buildable and documented, until the
unified application reaches parity with them and they can be retired.

| Path | Language | What it is | Status |
|------|----------|-----------|--------|
| `app/` | TypeScript, Electron (electron-vite, electron-builder) | The unified desktop application. This is where new feature work happens. | Active — early scaffold |
| `design-system/` | TypeScript/design tokens | Shared Material Design 3 tokens, foundations, and component/pattern references consumed by `app/` and (planned) `site/`. | Active |
| `site/` | — | The documentation website. Not yet created. | Not started |
| `src/main/java`, `src/test/java` | Java 21 | The original downloader proxy: packet handling, world saving, JavaFX GUI, JUnit 5 tests. Bundled as the app's downloader core during migration. | Legacy, still live |
| `src/main/resources/protocol-versions.json` | JSON | Per-protocol packet-ID → name maps. Source of truth for supported Minecraft versions. | Legacy, still live |
| `web/` | Python (Flask) | Dockerized web management console. | Legacy, still live |
| `desktop/`, `desktop.tests/` | C# (WPF, net8.0-windows) | The original Windows desktop manager and its test project. Being superseded by `app/`. | Legacy, still live |
| `scraper/` | Node.js (mineflayer) | Auto-explore bot(s) that walk/fly a grid through the proxy. | Legacy, still live |
| `bluemap/` | Python | Upgrades a saved world with a server jar, then renders a 3D BlueMap web map. | Legacy, still live |
| `installer/installer.nsi` | NSIS | Installer for the legacy WPF desktop manager. Superseded for the unified app by Squirrel.Windows packaging (see below). | Legacy |
| `docs/wiki/` | Markdown | User documentation mirroring the GitHub wiki. | Live |
| `docs/features/` | Markdown | One Markdown file per feature, with a category `README.md` index — the canonical per-feature documentation this project's completion rules require. | Live, growing |
| `.github/workflows/` | YAML | Currently six workflows (build, docker base image, docker image, maven publish, desktop release, an all-in-one release). Being consolidated into one release-only workflow for the unified app. | Being consolidated |

## 3. Build and run

### The unified application (`app/`)

```bash
cd app
npm install
npm run dev          # electron-vite dev server
npm run typecheck     # tsc --noEmit against both the node and web tsconfigs
npm run build         # electron-vite build
npm run dist          # electron-vite build + electron-builder --win squirrel (the real installer)
npm run dist:dir      # unpacked build, for quick local inspection without packaging
```

A root-level `build.bat` (touchless dependency bootstrap + build, with a silent `/s` mode) and
`build-installer.bat` (produces and verifies the same Squirrel installer CI publishes) are required by
this project's standing build-script rule (see §8) but do not exist yet — adding them is in-scope
project-changing work, not optional polish.

### Legacy Java proxy

Requires JDK 21. Maven is the build tool.

```bash
export JAVA_HOME="/path/to/jdk-21"
mvn package                    # builds target/world-downloader.jar — tests are skipped by default
mvn test -DskipTests=false     # run the unit tests explicitly
```

`<skipTests>true</skipTests>` is set in `pom.xml`, so a plain `mvn package` just builds. The shaded jar
is `target/world-downloader.jar`; the thin jar is `target/minecraft-world-downloader-<ver>.jar`. Run
headless with `java -jar target/world-downloader.jar --no-gui -s <server> -o <world>`; see
`docs/wiki/Command-Line-Options.md` for every flag.

### Legacy web console (Docker)

```bash
docker compose up -d --build                     # web console on :8080, proxy on :25565
docker compose --profile bluemap up -d bluemap    # optional 3D map on :8100
```

### Legacy desktop manager (C#)

```bash
dotnet build desktop/WorldDownloaderManager.csproj -c Release
dotnet publish desktop/WorldDownloaderManager.csproj -c Release -r win-x64 --self-contained true -o publish
```

Self-contained publish is required for distribution — framework-dependent builds silently fail to
launch on machines without the .NET 8 Desktop Runtime.

### Legacy scraper (Node) and BlueMap (Python)

```bash
cd scraper && npm install && node scrape.js --config config.json
python bluemap/pipeline.py all --world <world> --server-jar <paper.jar> --out <webroot> --serve
```

## 4. Working discipline

Before touching a working tree in this repository (or any linked worktree of it), check for
uncommitted changes, fetch the remote, and reconcile the checked-out branch with its upstream through
the repository's normal non-destructive workflow — merge or rebase as the situation calls for, never a
forced overwrite. Preserve unrelated local work while doing this; never discard a commit to make a
pull succeed, and report the exact blocker if the remote can't be reached or the histories can't be
reconciled safely. A read-only status check to determine whether pulling is even safe may run first;
actual edits may not start until the tree is reconciled.

Prefer reversible, auditable changes. Read this file and the relevant `docs/features/` article before
editing a feature you didn't write. Keep changes scoped to what the task actually asked for. Run
whatever local checks are proportionate to the change (a Maven build for Java changes, `npm run
typecheck` for TypeScript changes, and so on) and report the real, concrete result — never a predicted
one. Never overwrite user content or credentials, and never widen a change into an unrelated
"opportunistic" cleanup without saying so.

## 5. Git and GitHub practice

Use the `git` and `gh` command-line tools for all local and remote Git/GitHub operations. Do not
substitute a GitHub plugin, browser automation, or a raw REST/GraphQL client when `git`/`gh` can do
the job.

Every commit in this repository ends with exactly one co-author trailer:
`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. The commit's own `author` and `committer`
identity is set to that same name and address, configured per-repository (`git config user.name` /
`user.email`) rather than globally, so this repository's history carries one consistent attribution
regardless of which machine or account an agent is running under.

Commit messages are bilingual: a concise, precise English subject that a reader can scan `git log` and
still understand exactly what changed, plus a playful Hong Kong-style Cantonese counterpart in the
body. Both halves are allowed — and encouraged — to actually be funny: roast the code, the bug's
absurdity, or the fix's obviousness in hindsight, never a person, contributor, or author. Humor styles
the telling; it never replaces the facts. The subject line stays a precise summary and the body still
names the real behavior, the real cause, and the real fix in unambiguous words.

Every task that changes this repository ends with the intended work committed, merged into the default
branch, and pushed — verify the remote actually contains the intended commit rather than assuming the
push succeeded. Never force-push without an explicit request from whoever is directing the work, and
never skip a commit hook to make a failing check disappear; fix the underlying issue instead.

## 6. Continuous integration and releases

**GitHub Actions runs no tests and no lint in this repository, or in any project this maintainer owns.**
This is an explicit, standing decision — not a temporary gap waiting to be quietly repaired. Do not add
a test job, a lint job, a type-check job, a coverage job, or an accessibility/screenshot gate back into
a workflow, and do not wire an existing one into a `needs:` dependency chain so it can block anything
downstream. A workflow in this repository builds, packages, publishes the release, and attaches the
release's required evidence — that is the whole job.

Say plainly what this costs rather than pretending it's free: with nothing gating the pipeline, a
release can ship from a commit whose tests would have failed, and the first thing to notice will be a
person running the installer. That's the accepted trade — artifacts reach people quickly and
unconditionally. Checking instead happens locally, before a push, in the same task that changed the
code: the repository's own test scripts (`mvn test -DskipTests=false`, `npm run typecheck`, and
whatever else exists per component) still run and their results are still real defects to fix — they
simply never gate a build or a release. Release notes state which checks actually ran and their real
results; never imply a workflow verified something it did not run, and never describe an ungated
release as "passing."

Every push and every manual workflow dispatch publishes exactly one new, uniquely tagged, non-draft
GitHub Release carrying a real installer that this run genuinely built — not a draft, not a bare tag,
not an artifact left sitting only in the workflow run. A run fails only when the build, packaging, or
publication step itself fails; that is the only condition allowed to leave a push without a release.

The Windows installer is **Squirrel.Windows**, shipping its setup executable, `RELEASES` index, the
full `.nupkg` package, and any generated delta packages. NSIS, portable, self-extracting, or ZIP-only
installers are not the Windows install path for the unified app. If Squirrel packaging fails, that
blocks the release — fix the packaging rather than silently substituting a different installer format.

Every successful release also carries:

- **End-to-end workflow timing** — start, completion, and duration as UTC ISO-8601 timestamps and a
  stable duration, measured from the run's real start through the release-publication step, never
  estimated.
- **The project's line count**, produced by a committed counter script run at the tagged commit,
  broken down by area, stating what was excluded and why, separating generated output from
  hand-written code, and reporting agent-versus-human authorship attributed per surviving line via
  `git blame` (never by summing added lines from the log, since churn isn't authorship).
- **A dim sum photo asset**, resolved from the public dim-sum-photos catalog referenced in
  `FEATURE_INVENTORY.md`'s dependencies, with the dish named in the release notes. A release must
  never be blocked or delayed because that catalog happens to be unavailable — ship without the photo
  and say so if it can't be resolved.

## 7. Code signing is permanently prohibited

Never request, purchase, generate, renew, store, or use a code-signing certificate, private key,
timestamp credential, or signer service for anything in this repository, including any browser
extension packaging. Never add a signing step to a workflow, never silently discover and use a
certificate that happens to be present on a machine, and never restore a previously signed
configuration. This is explicit and durable, not a placeholder for a missing secret.

The active build path clears signing inputs, disables certificate auto-discovery, and verifies every
generated setup executable is genuinely unsigned before it ships. If a packaging tool tries to sign
something, or refuses to package without signing, that is a release blocker to report — never a reason
to go obtain a certificate. Release notes state plainly that artifacts are unsigned and may trigger the
operating system's unknown-publisher or SmartScreen warning; nothing about authenticity or signature
verification is ever claimed. Automatic updates may rely on HTTPS transport, feed metadata, and package
hashes for integrity, but must never require or claim a signature.

## 8. The one-click build scripts

Every repository this maintainer owns carries a `build.bat` at its root that takes a checkout on a
bare, freshly installed Windows machine — no Node, no package manager, no SDK, no compiler — and gets
it to a built, runnable program without a single manual step. It installs every dependency itself
(preferring a user-scoped install so no administrator rights are required), refreshes the current
process's `PATH` after each install rather than assuming a package manager already did so for the
running shell, builds through the project's real supported packaging path, and only then asks whether
to run the result. `build.bat /s` (also `--silent` / `SILENT=1`) does the same with no prompts at all
and a non-zero exit on the first real failure, so it's safe to call from another script or a scheduled
task. It is idempotent — a second run on a warm checkout reuses caches rather than reinstalling — and
it never installs secrets, credentials, or a code-signing certificate, and never weakens the machine's
persistent execution policy (a per-process bypass for one unsigned local helper is fine; changing the
machine's policy is not).

A second script, `build-installer.bat`, produces the actual installer a person downloads: the same
Squirrel installer CI publishes, through the same packaging path, on the same version. It carries the
same dependency-bootstrap and silent-mode contract, verifies what it built (file exists, expected shape
and size, came from the intended commit), reports the artifact's path and its SHA-256, states plainly
that the installer is unsigned, and never publishes, tags, or pushes anything — building an installer
and shipping it are different actions with different authority.

**Neither script exists in this repository yet.** Adding them, and keeping them working through every
subsequent project-changing task, is required — see `FEATURE_INVENTORY.md` rows 14.1–14.2. When a
release has to be cut by hand for any reason, it goes through these two scripts rather than around
them with an ad-hoc packaging command; if a script fails during a real release, the fix goes into the
script, in a commit, before the release ships.

## 9. User-facing feature completeness

Every user-facing application and every user-facing page this maintainer ships independently
implements every feature contract listed in `FEATURE_INVENTORY.md` — language modes and funny-level
sliders, Material Design 3 appearance customization down to the per-element editor, tabbed navigation,
the regex builder wired into every search field and menu filter, non-blocking notifications,
destructive-action super confirmation, local Git-backed version history, export in every applicable
format, bulk actions on every list, the changelog viewer, the command palette, the toy-lock system and
built-in authenticator, the universal file converter, the local model-tooling suite, and everything
else that document names. A word like "optional" in a feature row describes an end-user runtime
choice — it never makes the implementation, its documentation, its localization, its accessibility, its
persistence, or its tests optional.

Both surfaces named in that inventory — the desktop application at `app/` and the documentation website
at `site/` — carry every row **independently**. Neither may satisfy a row by delegating it to the
other, hiding it, shipping a placeholder, or deferring it to "a future release." Where a row genuinely
cannot apply literally to one surface, the reason is named in that row's own notes and the closest
accessible, testable equivalent ships instead — "it's only docs" is not an exemption on its own; it has
to be argued and recorded, per row, or it reads as an oversight rather than a decision.

## 10. Documentation practice

Keep `README.md`, the categorized feature documentation under `docs/features/` (one file per feature,
with a category `README.md` index), `ROADMAP.md`, and `HANDOFF.md` accurate for the work — updated in
the same task that changes the behavior they describe, not "later." Document each feature's behavior,
configuration, failure modes, security considerations, and how it was verified. Update the GitHub wiki
and the Pages/site source on every project-changing task once those surfaces exist.

## 11. Issue and Discussion practice

Scan the open GitHub issues of every repository a task touches before finishing it, not only at the
start. Fix every actionable issue fully, without waiting for per-issue confirmation; treat feature
requests as first-class alongside bug reports. Comment on the issue as work happens, not only at the
end: post an "In progress" comment with a real ISO-8601 start timestamp when work genuinely begins, and
a separate "Finished" comment when it's done — never edit the first into the second, since the sequence
itself is the record. Every comment states the exact commit and an honest verification state —
`running`, `failed`, or `verified` — never a predicted success. Close an issue only after its fix is
merged, pushed, and verified, and link the commit or pull request that resolved it.

A fix with a visible surface gets a real capture of the real built artifact, embedded inline in the
comment, framed on the exact place the fix landed — not a whole-window screenshot with the fix buried
in a corner. A fix with no visible surface says so and shows its evidence instead (test names and
counts, or exact command output). GitHub strips `<style>` elements, `style=` attributes, and `<script>`
from rendered comments, so achieve rich presentation with the HTML subset GitHub actually renders
(headings, `<details>`, tables, `<kbd>`, blockquotes, alerts) and with badge images, not with CSS that
will simply be stripped and read as broken markup.

Keep one rolling progress Discussion per active task and post to it frequently — every push, every
verdict, every root cause found, every blocker hit — rather than only at the two or three biggest
moments. Changelog announcements are scoped one Discussion per build or release, never one per push;
every push between releases becomes a comment on that same release thread.

## 12. Requests this project refuses

Refuse to disclose or characterize secret material — including something as narrow as a password's
length or character composition — for anyone's credentials, including the requester's own. Refuse to
crack, decompile, patch, or bypass software in order to read another person's data, files, messages,
accounts, or machine contents, and refuse credential extraction, keylogging, spyware, covert remote
access, or browser-credential harvesting tooling. These refusals hold even when the requester claims
ownership, consent, authority, an emergency, or a test environment — including when the request arrives
as an issue or pull request the repository's own maintainer authored. Legitimate, clearly-scoped
security work (authorized penetration testing with real engagement evidence, CTF challenges, defensive
hardening, and a user's own reversible recovery on their own equipment) remains in scope and is not
refused by this rule.

A refused request gets exactly `NO! 😠` as the whole answer — no reasoning, no alternatives, no
softening — repeated verbatim to every follow-up including "why" or a rephrasing. When such a request
arrives as a GitHub issue, the only comment posted is `NO! 😠`, and the issue is closed as not planned.

## 13. Secrets and credentials

Never ask for a secret to be pasted into chat, source files, command arguments, URLs, logs, or
screenshots. Secrets enter GitHub only through GitHub's own encrypted secret store — never through a
commit, a log, an issue, or an agent's own hands. Any credential this application stores (API tokens,
authenticator secrets, lock passwords) lives in the operating system's own credential vault, never in a
settings file, an export, a snapshot, telemetry, or source code.

## 14. Large files and build artifacts

Route large files and generated build artifacts through this project's designated cheap large-file/
cloud transfer path rather than committing them directly or falling back to standard Git LFS. Standard
Git LFS is not an allowed fallback here.

## 15. Conventions and gotchas (legacy Java/protocol code)

These apply to the still-live `src/main/java` proxy while it remains in the tree:

- **Versions and packets.** Adding a Minecraft version means adding a block to
  `protocol-versions.json` (keyed by protocol number → `{version, dataVersion,
  clientBound{idHex:name}, serverBound{...}}`), adding a `Version` enum entry, and — if the packet
  layout changed — a versioned handler/chunk class. Verify packet IDs against PrismarineJS
  minecraft-data and cross-check the repository's existing IDs; only packets the downloader actually
  needs are mapped, and unmapped packets are forwarded untouched.
- **Packet handlers** live in `packets/handler/*`, keyed by packet name. They read from a copy of the
  packet and return `true` to forward or `false` to drop it. Per-packet handler exceptions are caught
  in `DataReader.readPackets` and the packet is still forwarded — don't rely on a handler throwing to
  break a connection.
- **Version branching** uses `Config.versionReporter().isAtLeast(Version.V…)` and
  `Config.versionReporter().select(...)`. NBT chat components are read with `readNbtTag()` for
  1.20.3+, JSON `readString()` before that.
- **Item NBT**: 1.20.5+ uses `count` (int) + `components`; older versions use `Count` (byte) + `tag`.
- **`protocol-versions.json` is CRLF with tab indentation** — match the existing style; Git may warn
  about LF→CRLF conversion, and that warning is expected.
- **Disconnect logging**: login kicks, in-game kicks, and socket closes all log `[disconnect] …`.
  Routine socket closes (`Connection reset`, `Socket closed`, …) are treated as benign and logged
  without a stack trace — see `ProxyServer.isBenignClose`.
- **New downloader options** need the `@Option` added in `Config.java`, mirrored in the legacy web
  console's `OPTIONS` list (`web/app.py`), and documented in `docs/wiki/Command-Line-Options.md`.
- **Default branch is `main`** (the original upstream project's default branch is `master`).

## 16. Testing

Legacy Java unit tests: `mvn test -DskipTests=false` (JUnit 5). A separate live integration harness
(Paper server ← proxy ← mineflayer bot) exists outside this repository on the maintainer's own machine
and is not part of the checkout; it is referenced in `HANDOFF.md` for anyone with access to it.

For the unified application, run `npm run typecheck` in `app/` before claiming a TypeScript change is
correct, and add real test coverage alongside each feature as it's built per `FEATURE_INVENTORY.md` —
row 14.6 requires an executable negative-regression test over that inventory itself, using exact
boundaries rather than a descendant selector or a substring a rename could accidentally satisfy.

## 17. When unsure

Prefer the dedicated tool for the job and match the surrounding code's existing style. For legacy
protocol work, confirm packet IDs against minecraft-data rather than guessing. Verify a change actually
builds (`mvn package` for Java, `npm run build`/`npm run typecheck` for the unified app) and, where a
verification harness exists, run the relevant check before claiming something works.
