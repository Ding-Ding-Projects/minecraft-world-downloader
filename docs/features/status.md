# Status

> The application's own status board: this checkout's real Git state, plus any local status lanes
> you record by hand, in exactly the record shape `scripts/report-status.mjs` reports to the shared
> status hub — read entirely from a local file, never over the network.

## What it does

`scripts/report-status.mjs` is a command-line tool that posts this project's state to a shared
status hub, over the network, with a secret enrollment token that never enters this application's
process. This feature is the other half of that story: an in-app tab that shows the same *kind* of
record — a status value, a summary, an assumption, a verified baseline, evidence with its own state
and link, and a list of next gates — without ever talking to the hub.

It ships one destination:

| Tab | What it holds |
| --- | --- |
| **Status** (`status.panel`) | This checkout's own record (refreshed from real Git state), plus every status lane you add by hand, filterable, searchable and exportable in bulk. |

The first row is always **this checkout**. It is refreshed by running the exact `git` commands
`report-status.mjs` runs — `git rev-parse HEAD`, `git status --porcelain`,
`git rev-parse origin/<branch>` — through the application's privileged process bridge, so the two
surfaces can never disagree about whether this checkout is dirty or whether its branch has actually
reached the remote. That claim is proven by comparing SHAs, not asserted.

Every other row is a lane a person added with **Add a status lane** — a second project, an earlier
session, anything whose last-known state is worth keeping somewhere it will actually be seen.

## How it works

### The record shape

`app/src/renderer/features/status/model.ts` defines `LaneRecord`, matching
`scripts/report-status.mjs`'s payload field for field:

- `status`: one of `running`, `waiting`, `blocked`, `landed`, `failed` — exactly the values the
  script accepts for `--status`.
- `evidence`: an array of `{ label, url, state }`, where `state` is one of `pending`, `running`,
  `verified`, `failed` — exactly the states the script's `--evidence "state|label|url"` accepts. A
  link is required to be a real `http` or `https` URL before it is accepted, by both surfaces.
- `worktrees`: exactly one entry for this checkout, `{ path, branch, commit, bytes: 0, dirty }` —
  `bytes` is fixed at `0` in both places, because measuring a working tree's real size on disk needs
  a recursive walk that neither surface performs.
- `nextGates`, `verifiedBaseline`, `assumption`, `summary`, `agent`, `machine`, `repository`,
  `branch`, `title` — the rest of the fields the script's payload and this tab's form share.

Every status value and every evidence state carries a **stable emoji** for scanning the list at a
glance (`STATUS_EMOJI`, `EVIDENCE_EMOJI` in `model.ts`). The emoji is decoration: it never upgrades
what it labels, so a `failed` lane still gets its emoji rather than being dressed down to look
better than it is.

### Reading real Git state

`app/src/renderer/features/status/git.ts`'s `gatherSelfSnapshot()` spawns `git` — a bare name on the
privileged process bridge's command allow-list — through `ctx.studio.process.spawn`, buffers its
stdout/stderr via the `process:event` push channel, and reports an honest `Result`-shaped outcome. A
packaged build is not normally a Git checkout at all, and that failure is reported on the row itself,
with a **Retry** action, rather than treated as a crash.

`FeatureState.refreshSelf()` (`state.ts`) keeps two timestamps that are deliberately different:

- **Last refresh attempt** — updates every time a refresh runs, whether it succeeded or failed.
- **The record's own `updatedAt`** — only moves when the record's content actually changed. A failed
  attempt leaves the last-known-good Git facts exactly as they were, dated honestly, rather than
  claiming they were just confirmed.

This checkout's lane can still be edited by hand — its status, summary, assumption, evidence and next
gates are yours to set — but the Git-derived fields (repository, branch, the verified baseline) can
only change by pressing **Refresh from Git**; the add/edit form disables those three fields for this
one lane and says why.

### Storage

`app/src/renderer/features/status/store.ts`'s `StatusStore` keeps every lane in its own file,
`status-lanes.json`, inside the application's own data directory — not inside the settings document.
Lanes are data this application recorded, not a user preference, and mixing them into settings would
make every lane edit show up as a generic "changed a setting" entry in the very history panel this
data is trying to stay legible next to.

Every field is bounded and sanitised on load (`MAX_LANES`, `MAX_EVIDENCE_PER_LANE`,
`MAX_GATES_PER_LANE`, text-length ceilings in `model.ts`); a record that fails validation is dropped
individually rather than refusing the whole file. Every write reports whether it actually reached
disk, and the banner at the top of the tab and the store-status line beneath it read that failure
honestly rather than pretending the write succeeded.

### The local-only banner

The banner is not a decoration; it states the actual architecture: this tab never makes a network
request, and it never reads, stores or displays the shared hub's enrollment token — that token is
resolved only by `report-status.mjs`, on the machine or container that actually posts to the hub, and
this tab has no code path that could touch it even by accident. Every age shown ("updated 3 minutes
ago", "Last refresh attempt: just now") comes from a real timestamp, computed fresh on every redraw,
so a stale record is never presented as current.

### Filtering, search and bulk actions

- **Search** (`ctx.createSearchBar`) matches title, repository, branch, agent, status, summary,
  assumption, verified baseline, machine, every next gate and every evidence label/URL — plain text
  by default, with the anchored pattern builder for an explicit regular-expression opt-in.
- **Status chips** — one per status value plus **All** — carry a live count computed after search but
  before the chip filter, so a status with zero matches under the current search still shows `0`
  rather than disappearing, and compose with the search rather than overriding it.
- **Selection** — a checkbox per lane, shift-click for a range (tracked the same way the changelog
  viewer tracks it: a capture-phase `mousedown` listener records the modifier before the checkbox's
  own `change` event fires), a select-all that names the exact honest scope (every currently matching
  lane — there is no separate paging concept to disambiguate), invert and clear.
- **Bulk delete** goes through the two-key confirmation gate, lists every affected lane by name and
  status, and automatically excludes this checkout's own record from the batch — the button states
  exactly why when the whole selection is that one record, and a mixed selection reports which lane
  was left alone rather than silently dropping it from the count.
- **Export** (top bar: everything currently visible; bulk bar: only the current selection) flattens
  evidence and next gates into readable text before handing rows to `ctx.exporter`, so every export
  format carries them the same legible way rather than one flattening nested arrays differently from
  another. `ctx.exporter.preflight` still runs and reports any remaining field loss before anything is
  written.

### The add/edit form

`app/src/renderer/features/status/laneform.ts` opens a non-modal, anchored, resizable and draggable
panel (`ctx.overlay`) with every field from the record shape: a real `select` for status (the
enumerable value gets a picker, never a free-text box), a real `select` per evidence row for its
state, repeatable evidence and next-gate rows each with their own remove action and a shared upper
bound (`MAX_EVIDENCE_PER_LANE`, `MAX_GATES_PER_LANE`), and inline plain-word validation — a title is
required, and any evidence row that has started being filled in must finish with a real link before
saving, or be removed.

## Key files

| Path | What lives there |
| --- | --- |
| `app/src/renderer/features/status/index.ts` | The feature module: tab, settings, palette entries, documentation, `init`. |
| `app/src/renderer/features/status/panel.ts` | The Status tab: banner, filters, bulk bar, the lane list, row rendering, export. |
| `app/src/renderer/features/status/laneform.ts` | The guided add/edit form for one lane, including its evidence and next-gate row editors. |
| `app/src/renderer/features/status/state.ts` | Shared state: the store, the Git-refresh routine, add/update/remove, the auto-refresh timer. |
| `app/src/renderer/features/status/store.ts` | The on-disk `status-lanes.json` store: bounded, sanitised, honest about read/write failure. |
| `app/src/renderer/features/status/git.ts` | Runs `git` through the privileged process bridge and turns its output into a `SelfSnapshot`. |
| `app/src/renderer/features/status/model.ts` | The record shape shared with `scripts/report-status.mjs`, the allowed values, the emoji maps. |
| `app/src/renderer/features/status/util.ts` | Small local helpers: path joining, age labels, id generation — kept out of sibling directories on purpose. |
| `app/src/renderer/features/status/strings.ts` | Every string, English and Cantonese, at all five humour levels. |
| `app/src/renderer/features/status/styles.css` | Material Design 3 styling, entirely from tokens. |
| `scripts/report-status.mjs` | The command-line counterpart this feature's record shape mirrors. Not part of this feature's owned directory; read, never edited, by this feature. |

## Configuration

Every setting is in **Settings → Status**, carries its own explanation behind progressive disclosure
and a provenance line naming the real value in use, and is reachable from the command palette with
its live control rendered inline.

| Setting | Default | What it does |
| --- | --- | --- |
| `status.autoRefresh` | `true` | While the Status tab is open, this checkout's record is re-read from Git on a timer in the background. |
| `status.autoRefreshSeconds` | `60` | How often, in seconds, that timer fires. Bounded to 15–3600 seconds. |

## Usage

- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> → *Open Status* (teleports to the results list),
  *Add a status lane…* (teleports to and focuses the Add button), *Search status lanes* (teleports to
  and focuses the search field), *Refresh this checkout from Git*, plus the two settings above with
  their live controls rendered inline.
- Click a lane's chevron to expand it: agent, machine, the verified baseline, the assumption, the one
  worktree entry, every piece of evidence (each with an **Open** action that runs the link through
  `ctx.studio.shell.openExternal`, refusing anything that is not `http(s)`), and every next gate.
- Every list, table and grid in this application carries the full bulk-action contract; this one is
  no exception.

## Failure modes

| Situation | What happens |
| --- | --- |
| Not a Git checkout, or `git` is unavailable | The self lane shows the exact reason and a **Retry** action, rather than crashing or silently showing stale facts as current. |
| `git rev-parse origin/<branch>` fails (no upstream, offline) | The verified-baseline line says plainly that the comparison could not be made, rather than claiming the checkout is confirmed on the remote. |
| The status file cannot be read | The banner area states the exact reason. The self lane's defaults still render, so the tab stays usable rather than blank. |
| The status file cannot be written | The action that triggered the write (add, edit, delete, refresh) reports the exact failure and does not pretend to have succeeded. |
| A stored lane fails validation | That one lane is dropped from the loaded list; the rest of the file loads normally. |
| An export format cannot carry a field | The export panel states exactly which field and why, before anything is written. |
| Opening an evidence link fails | A notification names the exact reason; nothing about the lane's own data changes. |

## Security considerations

- **No network request of any kind.** This feature never calls `ctx.studio.http`, never registers an
  HTTP allow rule, and has no code path that could reach the shared hub.
- **The hub's enrollment token never enters this process.** It is read only by
  `scripts/report-status.mjs`, from an environment variable or from the target container's own
  environment in `--via-host` mode, and is never printed, written to a file, or passed as a
  command-line argument even there. This feature has no access to it and does not need it.
- **Local storage only.** The lane record lives in the application's own data directory, exactly like
  the local version history and the settings file, and is bounded on read so a corrupted or hostile
  file cannot exhaust memory.
- **Evidence links open through the same external-URL boundary as the rest of the application** —
  `ctx.studio.shell.openExternal`, which refuses anything that is not `http(s)`.

## Verification

1. Open the Status tab for the first time. This checkout's lane refreshes automatically; its
   repository, branch and verified baseline populate from real Git state, or the row states plainly
   why they could not.
2. Make an uncommitted change in the working tree and press **Refresh from Git**. The worktree entry
   reports `dirty: true` and the row's summary line updates.
3. Add a status lane with one piece of evidence missing its URL, and try to save. The form reports
   the exact problem inline and does not save.
4. Add a complete lane with two pieces of evidence and two next gates, save it, then reopen it for
   editing. Every field, including the evidence rows and gates, reads back exactly what was saved.
5. Select this checkout's lane and a manually added lane, then try **Delete selected**. Only the
   manual lane is removed; a notification says the checkout's own record was left alone.
6. Filter by a status with zero matching lanes. The chip shows `0` and stays visible; the list shows
   the honest empty state rather than a blank panel.
7. Export the visible list as CSV, then as JSON. Both carry every field; nested evidence and next
   gates read as legible flattened text in both.
8. Disconnect the network (or block it) and reopen the tab. Nothing about the tab's behaviour changes
   — because nothing here was using the network in the first place.

## Language modes, humour and School mode

All copy goes through the shared catalogue in `strings.ts`, so it renders in English, in playful Hong
Kong Cantonese, or bilingually, at whichever humour level each language is set to. Humour styles the
voice and never the facts: at level 5 a bulk-delete confirmation still names the exact lanes, their
exact statuses and exactly what cannot be undone.

This feature exposes no Cantonese-only, bilingual-only, humour, personal-vocabulary or dim-sum
capability of its own, so School mode changes only how its copy reads, through the shared catalogue,
exactly as it does everywhere else.

## Gotchas and limitations

- **`bytes` is always `0`.** Neither this tab nor `scripts/report-status.mjs` measures a working
  tree's real size on disk; inventing a number here that the script does not produce would make the
  two surfaces disagree about a fact neither of them actually knows.
- **The verified-baseline comparison reads a ref this machine already has**, not the actual remote.
  It can be stale until the next `git fetch` — exactly as it is for the command-line script, which
  reads the same local ref the same way.
- **Auto-refresh only runs while the tab is mounted.** Closing the tab stops the timer; reopening it
  shows the last-known state with its honest age, and refreshes once automatically if it has never
  been refreshed this session.
- **This application cannot read the computer's hostname.** The `machine` field on a manually added
  lane is free text for exactly that reason, and the form's supporting text says so.

## Suggested related articles

- [Version history](history.md) — every add, edit and delete this feature makes is recorded there,
  and can be reviewed or restored from that surface.
- [Export](export.md) — the shared export system this feature's export panel is built on, including
  every format and its preflight-loss reporting.
- [Settings](settings.md) — where the two settings above live, and how their provenance line is
  computed.
