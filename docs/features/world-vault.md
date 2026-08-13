# World vault

> A version-controlled repository for a downloaded world: created locally, committed automatically as writes settle, restorable without limit, and published to a remote only when a person explicitly says so.

- **Feature id:** `worldvault`
- **Destination:** *World vault* (`worldvault.main`)
- **Settings section:** *World vault*
- **Command palette:** open, create the vault, publish the vault
- **Satisfies:** `FEATURE_INVENTORY.md` rows **13.6**, **13.7**, **13.8**

---

## What it does

A downloaded Minecraft world becomes a real Git repository. This feature
creates that repository, watches the world folder while a download is in
progress and commits automatically once writes have gone quiet, keeps
unlimited, append-only undo across every commit, and — only when a person
explicitly asks — publishes the whole thing to a remote.

It also publishes a small typed contract (`contract.ts`) that its two
sibling features import directly: `world-vault-renders` (an optional map
render per commit) and `world-vault-edit` (chunk operations driven from the
rendered map — copy a chunk to another coordinate, or remove it). Neither
sibling reimplements any of the git logic here; both call into this
feature's git operations through the privileged bridge
(`ctx.studio.worldVault.*`) and this file's own exported helpers.

## Where the repository lives, and why

The vault is a real `git` repository at `<worldPath>/.git` — **inside** the
world's own folder, not beside it. That was a deliberate choice with a
real trade-off on both sides:

- **Inside the folder:** the vault travels with the world. Copy the world
  folder to a USB stick, rename it, move it to another machine — the
  history comes along, because it never left. A server loading that world
  simply ignores the `.git` directory and the managed block this feature
  adds to `.gitignore`, exactly as it already ignores any other file it does
  not recognise.
- **Beside the folder (the alternative, not chosen):** nothing extra sits
  inside a folder a server might scan, but the vault is now a second
  directory that has to be found, kept in sync by name, and does not
  survive the world folder being copied or renamed on its own.

"Travels with the world" won. A managed block in `.gitignore` (marked with
`# >>> world-downloader-studio vault (managed) >>>` / `<<<` so it is never
mistaken for something the user wrote by hand) excludes `session.lock` and a
handful of OS/temp artefacts that are not world data and would otherwise
create a commit's worth of churn on every session start with nothing
meaningful captured.

## Hazard 1: never commit mid-write

A region file is rewritten continuously while chunks stream in. Committing
on every filesystem event would produce thousands of commits and, worse,
would sometimes catch a region file **half-written** — silent corruption
that only surfaces later as a chunk that will not load.

The background runner (`app/src/main/features/world-vault.ts`) polls the
world folder on an interval (default 2s, configurable) and tracks, per file,
the last time its size or modification time changed. A file only counts as
**settled** once nothing about it has changed for a full **quiet period**
(default 8s, configurable, both as real settings with a truthful provenance
line). The runner commits only once every currently-dirty file has been
quiet for that whole period — never on the poll that first notices activity.
This decision is a pure function,
[`computeSettleDecision`](../../app/src/main/features/world-vault.ts), with
no I/O at all, so it is unit-tested directly
(`app/tests/unit/world-vault.test.ts`) rather than only exercised indirectly
through a real download.

## Hazard 2: bounding the growth honestly

Region files are large binaries, rewritten repeatedly, and standard Git LFS
is prohibited project-wide. Rather than pretend history is free:

- **Vault size on disk is always visible** — the `.git` directory's size and
  the working tree's size are shown separately in the status card and in
  `WorldVaultStatus`, refreshed on every status read.
- **Compact history** runs `git gc`, a safe, lossless repack. No commit is
  ever removed by it.
- **Prune** is a genuinely destructive, explicitly gated action: it squashes
  every commit before a chosen one into a single new root, using
  `git commit-tree` plus `git rebase --onto` (real Git plumbing, not a
  hand-rolled history rewrite) — the tree at the chosen commit survives
  exactly; only the individual steps leading up to it are gone, and the disk
  space they occupied is reclaimed with `git gc --prune=now`. It goes
  through the two-key confirm gate and states the disk it will reclaim
  before it runs. If the rebase itself fails partway, it is aborted and
  rolled back rather than left half-rewritten.

The real cost is stated in the tab itself (`worldvault.status.retentionNote`)
before the runner is ever started, not discovered later when a disk fills.

## Hazard 3: publishing is always a person's decision

Publishing a downloaded world means publishing whatever another server's
players built inside it — their bases, their chests, their coordinates.
Nothing in this feature ever sets a remote, pushes, or creates a repository
on its own; every one of those three actions is a button a person presses,
and every one of them goes through the destructive-action confirm gate
naming the exact size, file count, and destination **before** anything
leaves the machine. There is no timer, no "publish on download complete,"
and no side effect of creating or watching the vault that reaches a remote.

Two publish routes are offered, both gated the same way:

1. **Push to an existing remote** — `git remote add/set-url origin <url>`
   then `git push -u origin <branch>`.
2. **Create a new GitHub repository** — via `gh repo create <name>
   --public|--private --source=. --remote=origin --push`, which requires the
   GitHub CLI to be installed and signed in. Both conditions are checked
   before the button is even enabled, with the exact missing piece named as
   the disabled reason.

## Hazard 4 and hazard 5 (not this lane)

An optional map render per commit (`world-vault-renders`) and chunk
copy/removal driven from the rendered map (`world-vault-edit`) are sibling
features. This feature does not render anything and does not touch chunk
bytes; it exposes exactly what those two need — `ctx.studio.worldVault.*`
on the privileged bridge, the `worldvault:event` push channel, and this
file's own `contract.ts` — and nothing more.

## Hazard 6: refusing to race the downloader

Editing a region the downloader is actively writing would corrupt the
world. `requestRegionAccess` (both `ctx.studio.worldVault.requestRegionAccess`
and the convenience wrapper in `contract.ts`) is the single gate every
sibling feature calls before touching a region file. It is refused, plainly,
naming the exact region path and reason, whenever either of two independent
checks says the file might still be moving:

1. **A live double-stat**, taken moments apart at the instant of the
   request — the ground truth, independent of the runner's own poll cadence.
2. **The runner's own tracked activity** for that exact path, if it is
   inside the current quiet window.

This decision is the second pure function tested directly:
[`evaluateRegionAccess`](../../app/src/main/features/world-vault.ts). Nothing
is ever queued to retry automatically; the caller decides for itself whether
and when to ask again.

## Undo, append-only

Restoring to an earlier commit is itself recorded as a **new** commit,
mirroring exactly how the application's own local history
(`app/src/renderer/core/history.ts`) behaves: the state being replaced is
committed first if it was not already, so nothing is ever silently
discarded, and the restore itself can be undone by restoring to what came
right before it. Files present now but absent from the target commit are
removed to truly match that snapshot (`git checkout <hash> -- .` alone only
updates files the target has; it never deletes extras), computed from
`git diff --name-status` between the two states before anything on disk
is touched.

## Files

| File | Owns |
| --- | --- |
| `app/src/main/features/world-vault.ts` | Every git/`gh` operation: create, status, the settle-and-commit runner, the timeline, restore, region-access refusal, publish (`setRemote`/`push`/`createGithubRepo`), and maintenance (`gc`/`prune`). Exports the two pure decision functions this feature's tests exercise directly. |
| `contract.ts` | The typed contract the two sibling features import: the active world path, a scoped commit-event subscription, and thin wrappers around `ctx.studio.worldVault.*` for region access and recording an edit as a commit. |
| `state.ts` | The tab's client-side state: settings ids, the currently selected world, cached status and commit list, formatting helpers. |
| `panel.ts` | The tab's DOM: the world picker, the status card, the searchable/filterable commit timeline with full bulk actions, and the two publish flows. |
| `docs.ts` | The in-application documentation article, mirroring this file. |
| `strings.ts` | This feature's own copy, in English and playful Hong Kong Cantonese, at all five humour levels. |
| `index.ts` | The `FeatureModule`: the tab, the settings section, palette entries, and `init`. |

## Configuration

Every setting lives under **Settings → World vault**:

| Setting | Default | Purpose |
| --- | --- | --- |
| World folder | (none) | The downloaded world folder this vault watches and versions. |
| Quiet period | 8000 ms | How long a file must go untouched before the runner treats it as settled. Too short risks capturing a region file mid-write. |
| Check interval | 2000 ms | How often the runner polls the world folder for changes. |
| Watch automatically | On | Starts the runner as soon as a vault is created or an existing one's tab is opened, instead of requiring **Start watching** by hand. |
| Default publish visibility | Private | Pre-selected visibility when creating a new GitHub repository. Still chosen by hand every time; private is the safer default because a world may hold other players' builds. |

## Failure modes

Every state below is a distinct, honest message:

- **git missing:** every surface — status, create, publish — says so by name and stops, rather than pretending.
- **Vault creation failed:** the exact underlying git error is shown; nothing is left half-initialized silently.
- **Restore/prune failed:** the operation is rolled back (a failed `git rebase` during pruning is explicitly aborted) and the exact reason is reported; nothing on disk is left half-changed.
- **Region access refused:** names the exact region path and how long ago it last changed, or that a live check just saw it move.
- **Publish preflight:** git missing, `gh` missing, `gh` installed but not signed in, and no remote configured are each their own message, checked before the relevant button is even enabled.
- **Push/create-repo failed:** the real `git`/`gh` error output is surfaced; the confirm dialog's promise of "nothing leaves the machine until confirmed" is only broken once the operation genuinely started, never before.

## Security considerations

- **No shell.** Every `git`/`gh` invocation runs through `execFile` with the
  command and its arguments passed as a real array — never string-concatenated
  into a shell command — so nothing a user types (a world path, a remote URL, a
  repository name) can be reinterpreted as shell syntax.
- **Repository name validation.** A new GitHub repository's name is checked
  against `^[A-Za-z0-9._-]+$` before it is ever passed to `gh`.
- **Serialized per world.** Every mutating operation against one world's
  vault is queued behind a per-world-path lock in the main process, so a
  background commit firing at the same moment as a user-initiated restore
  can never interleave into a corrupt index.
- **Publishing is opt-in, every time.** No setting, no automatic behaviour,
  and no side effect of creating or watching a vault ever sets a remote or
  pushes. See hazard 3 above.

## Verification

- With no world folder selected, confirm the honest empty state and that
  picking a folder is the one obvious next action.
- Create a vault for a folder with existing files; confirm the initial
  commit captures them, and for an empty folder, confirm an empty initial
  commit is still made (there is always something to point the timeline at).
- Start watching, then write to files continuously for longer than the
  configured quiet period; confirm no commit fires until the quiet period
  has genuinely elapsed after the *last* write, and that the status card's
  "waiting for writes to settle" message updates live.
- Call `requestRegionAccess` for a file that changed within the quiet
  window, and again for one that has been stable well past it; confirm the
  first is refused with a reason naming the file and the second is granted.
- Build a timeline of several commits, restore to an earlier one, and
  confirm: the current (pre-restore) state was committed first, the restore
  itself is a new commit, and restoring to the commit before that restore
  recovers the state that was about to be discarded.
- Select a commit and prune before it; confirm the resulting tree at that
  commit is byte-identical to before, the commit count dropped, and the
  `.git` directory shrank.
- With `gh` absent, with `gh` present but signed out, and with `gh` signed
  in, confirm the publish card's three distinct messages and that **Create a
  GitHub repository** is disabled with the exact right reason in the first
  two cases.
- `npx tsc --noEmit -p tsconfig.web.json` from `app/` is clean for this
  feature, and `app/tests/unit/world-vault.test.ts` passes.

## Language modes, humour and School mode

Every user-facing string in this feature is an i18n key with a five-rung
ladder in English and Cantonese (`strings.ts`). Both humour levels change
the voice independently; the facts survive every level — which world, which
commit hash, how many bytes, what leaves the machine and where it goes read
identically at level 1 and level 5. School mode needs no special handling
here beyond the shared translator: this feature exposes no Cantonese,
bilingual, humour or personal-vocabulary capability of its own.

## Gotchas and limitations

- A vault's identity is its folder path; there is no separate registry of
  "known vaults" to browse. Pointing the world folder field at a different
  path switches which vault the whole tab manages.
- The background runner watches at most one world at a time. Managing two
  worlds' vaults side by side means switching the world folder field (the
  vault not currently selected keeps its committed history exactly as it
  was; only the live polling pauses for it).
- `gh repo create --source=. --remote=origin --push` is the one command that
  both creates the remote repository and pushes to it; if it fails partway
  (for example, the repository is created but the push is refused), the
  reported error is `gh`'s own, and the repository may need a manual push or
  a manual deletion — this feature does not attempt to guess and undo a
  partially-succeeded `gh` operation.

## Suggested related articles

- [`world-download.md`](world-download.md) — where the world this feature
  versions actually comes from.
- [`map.md`](map.md) — the map surface the render sibling draws into.
- [`history.md`](history.md) — the application's own local version history,
  whose append-only restore model this feature deliberately mirrors.
- [`export.md`](export.md) — the shared export contract the commit timeline
  is written through.
- [`settings.md`](settings.md) — the settings surface this feature's section
  renders through.
