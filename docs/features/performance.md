# Performance tuning: the Speed level and the six advanced settings

> Six real advanced settings — chunk batch size, worker concurrency, map tile resolution, log
> retention, refresh interval, animation level — plus an honest Speed picker mapped onto exactly
> those values, with a checkable table and an explicit Custom state.

This is the same article shipped inside the application (Settings → Performance → the `?` beside
each control, and the bundled documentation browser), generated from
`app/src/renderer/features/performance/docs.ts`.

## What it does

Settings → Performance holds six real, independently adjustable values, plus one novice-level
control — **Speed** — that sets all six of them together.

### The six advanced settings

These are the actual tuning knobs. Each one is a normal setting: it has its own id, its own
compiled-in default, its own inline validation, its own reset, and it shows up in every search, the
command palette, and the generic settings export exactly like any other setting in the application.

| Setting | Id | Range | What it does |
| --- | --- | --- | --- |
| Chunk batch size | `performance.chunkBatchSize` | 8–256, steps of 8 | How many world chunks the downloader processes together in one batch. A larger batch uses more memory and disk I/O at once, but completes sooner. |
| Worker concurrency | `performance.workerConcurrency` | 1–8 | How many download workers run at the same time. More workers can finish a session faster, but they compete for the same network connection and disk. |
| Map tile resolution | `performance.mapTileResolution` | 128 / 256 / 512 / 1024 px | The pixel size of each rendered map tile. Higher looks sharper on a large display, and costs more render time and memory per tile. |
| Log retention | `performance.logRetentionDays` | 1–90 days | How many days of *runtime performance logs* are kept before older entries are pruned. This is a separate, operational log from the version history in the History tab, which is never pruned by this setting. |
| Refresh interval | `performance.refreshIntervalMs` | 100–5000 ms | How often live views such as connection status and the map poll for new data. A shorter interval feels more live and does more background work. |
| Animation level | `performance.animationLevel` | off / minimal / standard / full | How much decorative motion this application's own surfaces use. This never overrides the operating system's reduced-motion preference, which is always respected regardless of this value. |

### The Speed control

**Speed** is a picker for five documented levels, numbered 1 to 5. Moving it writes all six
advanced settings above to that level's exact values in one step, and records the change in local
history as a single entry, so it can be undone like any other recorded change.

It is not a second, independent setting that can drift from the six real values. There is nothing
named "the current speed level" stored anywhere — every time the application needs to know what
level is active, it re-reads the six real settings and checks them against the table below. That is
also why changing one of the six advanced settings directly, anywhere — through its own row, through
the command palette, through an imported settings file — is reflected in the Speed control
immediately, with no extra step and no possibility of the two disagreeing.

#### Exactly what each level sets

| Level | Chunk batch size | Worker concurrency | Map tile resolution | Log retention | Refresh interval | Animation level |
| --- | --- | --- | --- | --- | --- | --- |
| **1 — Battery saver** | 16 chunks per batch | 1 worker | 128 px | 3 days | every 4000 ms | Off |
| **2 — Light** | 32 chunks per batch | 2 workers | 256 px | 7 days | every 2000 ms | Minimal |
| **3 — Balanced** (shipped default) | 64 chunks per batch | 4 workers | 256 px | 14 days | every 1000 ms | Standard |
| **4 — Fast** | 128 chunks per batch | 6 workers | 512 px | 30 days | every 500 ms | Standard |
| **5 — Maximum** | 256 chunks per batch | 8 workers | 1024 px | 60 days | every 250 ms | Full |

Level 3 — Balanced is the level that reproduces this application's shipped defaults: it is what a
fresh install has before anyone touches a single knob.

This table is generated in-app from the same array (`SPEED_LEVELS` in
`app/src/renderer/features/performance/model.ts`) that the running application reads to detect the
current level and writes when a level is applied. There is no second, hand-typed copy of the numbers
anywhere that could quietly drift from what the application actually does.

### The Custom state

If the six real values do not match any row in that table — because a value was changed directly,
imported from a settings file, or set by an older version of this application that shipped different
defaults — the Speed control shows an explicit **Custom** state. It never guesses which level was
"probably meant" and never silently snaps the values to the nearest level. Merely displaying Custom
changes nothing: the six advanced values are read, never written, whenever the application only
needs to *show* the current level. Only a deliberate move of the Speed picker, or the "Use the
shipped default" action, writes anything.

## Configuration

- Every one of the six advanced settings and the Speed control is reachable from Settings →
  Performance, from the settings search bar, and from the command palette (`Ctrl+Shift+F`).
- The Speed control also offers **Export current performance values**, which writes the six raw
  values plus either the matching level number and name or `"custom"` to a JSON file through the
  application's normal export path — so the export is checkable against the table above.
- Every one of the six settings participates in the application's normal generic settings export
  and import, at every supported format, exactly like any other setting.

## Verification

- Move the Speed picker through every level and confirm all six advanced settings' rows update to
  the documented values, and that local history gains one new entry per move.
- Change one advanced value directly (for example, drag Worker concurrency by one step away from a
  level's documented value) and confirm the Speed control immediately shows **Custom**, with no
  button appearing pressed.
- Set the six advanced values back to an exact level's documented numbers by hand and confirm the
  Speed control immediately shows that level again, with no page reload.
- Reload the settings tab, or reopen the application, with the values left in a Custom combination,
  and confirm the Custom state is shown again rather than silently reset to a level.
- Export "current performance values" from the Speed control and confirm the exported file names
  either the matching level or `"custom"`, plus the six raw values.
- `cd app && npx tsc --noEmit -p tsconfig.web.json` is clean for every file under
  `src/renderer/features/performance/`.

## Failure modes

- If a stored value for one of the six settings is outside its declared range (for example, an
  edited settings file on disk), inline validation refuses it the next time it is set through this
  application and the field reports the exact valid range; the application does not crash or
  silently clamp a value that was never actually written through the validated path.
- If local history is unavailable when a level is applied, the six advanced settings are still
  written — the application never refuses a real, in-scope change because an audit trail could not
  be recorded — and the failure to record is reported as a separate notification rather than
  silently swallowed.

## Security considerations

None of these six values is a secret, a credential, or a path. They are bounded numbers and a closed
set of enumerated strings, validated on every write. No network request is made anywhere in this
feature.

## Suggested articles

- [Settings](../../app/src/renderer/features/settings/docs.ts) — the tabbed settings surface every
  section, including this one, renders inside.
- [World download](../../app/src/renderer/features/downloader) — the downloader whose batch size and
  worker concurrency this feature tunes.
- [Live map viewer](../../app/src/renderer/features/map) — the map surface whose tile resolution and
  refresh interval this feature tunes.
- [Version history](history.md) — where every applied Speed level, and every direct edit to one of
  the six advanced settings, is recorded and can be restored.
