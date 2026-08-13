# Workflows

There are two, and only two.

| File | What it does | What it produces |
| --- | --- | --- |
| [`release.yml`](release.yml) | Builds, packages and publishes the desktop application | A non-draft GitHub Release with a Squirrel.Windows installer |
| [`pages.yml`](pages.yml) | Deploys the static documentation site in `site/` | A GitHub Pages deployment |

Nothing else lives here. Six workflows that used to build and release the other pieces of this
repository — the Maven jar, the WPF desktop manager, two Docker images and their base image — were
retired when those pieces were folded into the one Electron application in `app/`. The source they
built is all still in the tree and none of it was deleted; it simply is not what gets shipped any
more.

---

## `release.yml` — the only thing that publishes a release

**Triggers:** every push to any branch, plus manual `workflow_dispatch`.

**Runner:** `windows-latest`. Windows is the delivery target, so the installer is built on the
platform it installs on.

**What one run does, in order:**

1. Checks out the full history (the line counter attributes surviving lines with `git blame`, which
   needs the commits those lines came from).
2. Reads the workflow's own `run_started_at` back from the API, so the recorded start time covers
   queueing rather than starting from a clock inside the job.
3. Derives the version and tag from the run number: `1.0.<run_number>`, tagged `app-v1.0.<run_number>`.
   Monotonic, so no tag is ever recycled — and the run refuses to continue if that tag already has a
   release.
4. Installs dependencies (`npm ci` when a lockfile is present, falling back to `npm install`), stamps
   the version into `package.json` so the installer, the package metadata and the tag all agree, and
   makes sure the Electron binary is actually extracted.
5. Builds with `electron-vite` and packages with `electron-builder --win squirrel --publish never`.
6. Collects the packaging output, then **fails closed** if the setup executable, the `RELEASES` index
   or the full `.nupkg` is missing. Delta packages are collected when they exist.
7. Asserts every produced executable reports `NotSigned` (see below).
8. Runs the committed line counter and puts its table in the notes.
9. Resolves a release code name from the public dim sum catalog and attaches one photo.
10. Composes the release notes, publishes a **non-draft** release, then reads the published release
    back and verifies it is not a draft and carries all three required assets.
11. Uploads the packaging output as run evidence — behind `if: always()`, so evidence survives a
    failed run.

### There are no test, lint or type-check gates, and that is deliberate

This workflow runs no test job, no lint job, no type-check job, no coverage job and no screenshot
gate, and there is nothing in any `needs:` chain that could withhold a release on a code-quality
verdict. It builds, packages and publishes. That is the whole job.

This is the repository owner's explicit standing decision. It is not an oversight and it is not a
temporary state to be quietly repaired — do not add a check back "to be safe", do not wire an
existing script into a gate, and do not fail a run on a code-quality verdict.

The cost is real and worth stating rather than pretending it is free: with no gate in the pipeline, a
release can ship from a commit whose tests would have failed, and the first thing that notices will
be a person running the installer. That is the accepted trade — artifacts reach people quickly and
unconditionally.

Checking has not disappeared; it moved to where a human asked for it. The repository's own scripts
still exist and are still run locally, before the push, in the task that changes the code. What
changed is that their verdict never blocks a build, never blocks a release and never appears as a
required check. A failing local test is still a defect to fix in that same task; it is simply not a
gate.

The release notes say so explicitly, in a "Checks that were run" section that says *none*. A release
from this pipeline is never described as "passing" anything, because nothing here checked it.

### No code signing, ever

Code signing is permanently out of scope for this project. No certificate, no signing key, no
timestamp credential, no signer service, and no step that would invoke one. The workflow states this
three ways so it cannot happen by accident:

- `electron-builder.yml` pins `forceCodeSigning: false`, `signExecutable: false` and
  `signAndEditExecutable: false`.
- The packaging step blanks `CSC_IDENTITY_AUTO_DISCOVERY`, `CSC_LINK`, `CSC_KEY_PASSWORD`,
  `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`, so nothing can discover a certificate on the runner.
- A dedicated step runs `Get-AuthenticodeSignature` over every produced executable and **fails the
  run** if any of them reports anything other than `NotSigned`. A signed artifact is a release
  blocker here, not a bonus.

The release notes warn plainly that the artifacts are unsigned, that Windows will show an
unknown-publisher or SmartScreen warning, and that no authenticity or signature verification is
claimed. SHA-256 digests are published for every asset so an integrity check is still possible.

### Squirrel.Windows, not NSIS

The Windows installer is Squirrel.Windows and ships its full artifact set: the setup executable, the
`RELEASES` index, the full `.nupkg`, and any delta packages the build produced. The application's
in-app updater reads that same feed over HTTPS. NSIS, portable builds and ZIP-only installers are not
acceptable substitutes; if Squirrel packaging fails, the release is blocked and the packaging gets
fixed rather than quietly swapped for another installer.

Note that `electron-builder` writes Squirrel output into a `squirrel-windows` subdirectory of the
configured output directory. A collector that only looks at the output root reports a missing
installer even though packaging succeeded, so the collection step searches the whole tree.

### Timing

Every successful release records `Workflow started`, `Workflow completed` and `Workflow duration` in
its notes, as UTC ISO-8601 timestamps and a stable `HH:mm:ss` duration. The start comes from the
run's own `run_started_at`, the completion from the clock at notes composition. Neither is ever
estimated: if the API cannot answer, the notes say `unavailable` rather than guessing.

### Line count

CI does the counting, at exactly the commit being released, by running the repository's committed
`scripts/count-lines.mjs`. The figure is reproducible locally with the same one command, which is the
whole point of committing the script rather than counting by hand. If the script is absent or exits
non-zero the release still ships and the notes say what happened — the counter never substitutes a
hand-written number.

### Release code name

Each release carries a dim sum code name resolved from the public catalog at
[`Ding-Ding-Projects/dim-sum-photos`](https://github.com/Ding-Ding-Projects/dim-sum-photos), and one
photo is attached as a release asset. The dish's English and Traditional Chinese names and the exact
asset filename go in the notes.

A dish is used once and never repeated: the workflow reads the bodies of this repository's prior
releases in one API call and skips any dish already named there, then takes the next unused record
from the catalog. Asset lists are deliberately **not** paginated — there are thousands of assets
across the catalog volumes, and paging through all of them to choose one name costs far more than
asking about the single candidate actually wanted, so the chosen filename is probed with a `HEAD`
request against each published volume until one answers. Nothing is generated, and no image is
vendored into this repository.

The code name is a label beside the version, never a replacement for it, and it never blocks a
release. Every failure path — catalog unreachable, volumes unlistable, every candidate already used —
ends with the release shipping and the notes saying plainly that no code name was resolved.

### Concurrency

`release.yml` has a concurrency group keyed on the workflow and ref **without** `cancel-in-progress`.
This workflow has non-idempotent side effects: it creates a tag, creates a release and uploads assets.
Cancelling a run halfway can strand a tag with no artifact behind it, which is worse than letting two
publishes queue behind each other.

### Token

`GH_TOKEN` resolves as `secrets.RELEASE_TOKEN || secrets.ORG_TOKEN || secrets.GITHUB_TOKEN` — an
optional repository-scoped fine-grained token first, then the organization token, then the workflow
token as a last fallback. It is passed only through the `GH_TOKEN` environment convention and is
never echoed, logged or written to a file. The packaging step blanks it deliberately so
`electron-builder` cannot start a second publish of its own and race the explicit one.

### Run evidence

The packaging output, the generated release notes, the line-count table and the resolved code-name
record are uploaded with `actions/upload-artifact` behind `if: always()`, with
`if-no-files-found: warn`, `continue-on-error: true` and a 14-day retention. Evidence therefore
survives a failed run, and artifact handling can never mask the original failure or turn it green.
Only those outputs are uploaded — never credentials, never `node_modules`, never a cache, never the
source tree.

---

## `pages.yml` — the documentation site

**Triggers:** pushes to `main` that touch `site/**` (or the workflow itself), plus manual
`workflow_dispatch`.

Deploys the static site in `site/` to GitHub Pages with `actions/configure-pages`,
`actions/upload-pages-artifact` and `actions/deploy-pages`. It checks that `site/` exists, holds
files and has an `index.html` before publishing, and adds a `.nojekyll` marker if one is missing so
Pages serves underscore-prefixed paths unprocessed.

This publishes a **website**, not a release. It creates no tag, uploads no installer and touches no
release. The release-only rule is about what gets *released*, and this workflow releases nothing.

It has no test or lint gate either, for the same reason `release.yml` does not.

Its concurrency group **does** use `cancel-in-progress: true`, which is the opposite of
`release.yml` and is correct for the same reason: a superseded documentation deploy is safe to
cancel, because the newer commit's deploy replaces it wholesale and nothing is left half-written.

---

## Changing these

- Do not add a third workflow without a reason that survives the question "what does this release,
  and why does it need its own file".
- Do not add a test, lint, type-check, coverage or screenshot gate to either one.
- Do not add code signing to either one.
- Do not switch the Windows installer away from Squirrel.
- Validate a change before pushing it: the YAML must parse, and `actionlint` should be clean. On
  Windows, run `actionlint -shellcheck=` — with its shellcheck integration enabled `actionlint`
  deadlocks on Windows and never returns, which looks exactly like a broken workflow and is not.
  Run `shellcheck` separately over the shell bodies instead.
