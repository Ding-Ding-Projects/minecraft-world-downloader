# Chunk operations from the map (desktop)

> Copies or removes chunks in a downloaded world from a real occupancy grid read off the actual region files on disk, rewriting every absolute position a copied chunk carries and recording every edit as a real world-vault commit.

## What it does

The **Chunk operations** tab (`app/src/renderer/features/world-vault-edit/`) shows a keyboard- and pointer-operable grid of chunks for one dimension of a downloaded world, coloured by whether that chunk actually has data — read directly from the region file's own 4 KiB location table, not guessed from a rendered tile. From there a user can:

- **Select** one chunk or a rectangle of chunks (click, Shift-click, Ctrl/Cmd-click, or entirely from the keyboard).
- **Copy** the selection to another coordinate. A chunk's NBT is not self-contained the way a picture would be: its own coordinates (`xPos`/`zPos`) are stored inside it, and so is every block entity's and every entity's absolute position. Copying raw bytes into a new region-file slot would produce a chunk that renders in the wrong place or that the game refuses to load, so every one of those positions is rewritten before the copy is written.
- **Remove** the selection, clearing each chunk's entry so the game treats it as never generated and rebuilds it the next time it loads.

Every successful edit is recorded as a real commit in the world's own vault (`kind: 'edit'`), so it is covered by the vault's unlimited undo exactly like a downloaded snapshot — restore it from the World vault tab. This feature also keeps its own local, searchable log of what it did, with a link to the exact commit each edit produced, distinct from (and a convenience index into) the vault's own commit timeline.

## How it works

### Reading the format, not guessing it

The byte layout this feature reads and writes is taken directly from this project's own region-file writer rather than reasoned about from memory of the Anvil spec: `src/main/java/game/data/region/McaFile.java` (the 8 KiB header — a 4096-byte location table, a 4096-byte timestamp table, then 4096-byte sectors), `ChunkBinary.java` (each sector's 4-byte big-endian length, 1-byte compression type, then zlib-compressed NBT), `Chunk.java`'s `addGeneralLevelTags` (`xPos`/`zPos` are chunk coordinates, at the level compound), and `ChunkEntities.java` (block entities carry absolute `x`/`y`/`z`; the separate `entities/*.mca` companion file's root carries a chunk-unit `Position` IntArray).

### The privileged worker

The renderer's privileged bridge (`ctx.studio`) has no channel for raw binary file writes — `fs.readBase64` reads binary, but there is no binary write, and adding an IPC channel would mean editing files outside this feature's own directory. What is already sanctioned is `studio.process.spawn({ command: 'node', ... })` (`node` is on the application's allow-listed command list). So the actual Anvil/NBT surgery — reading a chunk's compressed sector, decompressing it, parsing its NBT, rewriting every absolute position, recompressing, and rebuilding the region file's sector layout — runs as a small, dependency-free CommonJS script (`worker-source.ts`'s `REGION_EDIT_WORKER_SOURCE`), materialised to a real file with `studio.fs.writeText` and spawned as a real `node` child process. Every write is atomic: the new bytes go to a temporary file first, that temporary file is read back fresh from disk and verified (destination coordinates match what was asked for; for a removal, the cleared slot is confirmed absent), and only on a clean verification is it renamed over the real file. A write that does not verify leaves the original file completely untouched.

The canonical, independently tested TypeScript implementation of the same algorithm lives at `app/src/main/features/world-vault-edit.ts` — read there for the full reasoning and citations. It is not wired into the Electron main process bundle (only `src/main/index.ts`'s own import graph is built), so it is not itself the thing that runs; it is the reference the worker script is a deliberate, line-by-line transliteration of, and both are verified independently against real fixtures so a divergence between them fails a test rather than shipping silently.

### The permission check

Before any write, this feature asks the world vault whether the region file it needs is safe to touch (`requestRegionAccess` on `ctx.studio.worldVault`, reached through the typed contract `features/world-vault/contract.ts` publishes). A region file the downloader (or another edit) may still be writing to is refused outright, naming the exact region and the reason — never queued to run later, because editing a region mid-write is a race that can corrupt the world. A copy checks every source and destination region and entities file involved; a removal checks every region and entities file the selection touches. If any one of them is refused, nothing is written at all.

### Recording the edit

On success, `commitEdit` (also from `features/world-vault/contract.ts`) stages and commits the change into the world's own Git-backed vault with `kind: 'edit'`, so `git log` inside the world folder — and the World vault tab's own commit timeline — shows exactly what happened and can restore it. The panel's own edit log then records a summary entry pointing at that commit's short hash.

## Configuration

Every setting lives under **Settings → World vault: chunk operations**:

| Setting | Default | Purpose |
| --- | --- | --- |
| World folder | (none) | The downloaded world's folder. Defaults to whatever world the World vault tab already has open, and stays in sync with it live. |
| Dimension | Overworld | Which dimension's region files the grid reads: Overworld, Nether, End, or a custom path for a modded/plugin dimension. |
| Custom dimension folder | (empty) | The path under the world folder for a modded dimension, when Dimension is set to "Custom path…". |

## Failure modes

- **No world folder chosen** — the grid explains it needs one and offers the folder picker.
- **No vault for this world yet** — copy and remove stay disabled with the exact reason, pointing at the World vault tab; there is nowhere for an edit to commit into without one.
- **A region file is mid-write** — the exact operation is refused, naming the region and why, before anything is touched.
- **The destination already has data** — copying over an occupied chunk is treated as destructive and goes through the same two-key confirmation as removal, naming both coordinates and how many of the selection are overwrites.
- **A worker write fails to verify** — reported as a failure for that specific chunk (or region, for a bulk removal); every other chunk in the same batch that already succeeded is unaffected, and the failure is named in both the notification and the edit log.
- **The selection is too large** — bulk operations are capped (4,096 chunks); a larger selection is refused with the exact count and bound rather than attempted.

## Security considerations

- **No new IPC surface.** Every privileged capability this feature uses — `studio.fs`, `studio.process.spawn('node', …)`, `ctx.studio.worldVault.*` — already exists on the sanctioned bridge; nothing outside this feature's own directory (and the small shared `features/world-vault/contract.ts`) was edited to build it.
- **Bounded, allow-listed process spawning.** `node` is on the application's fixed command allow-list (`app/src/main/services/processes.ts`); no shell is involved, and the worker script's own arguments are a single JSON operation file path, never user-supplied text interpolated into a command line.
- **Atomic, verified writes.** Every region-file write goes to a temporary file, is re-read from disk, and is verified before it is ever renamed over the original — a failed verification leaves the source data exactly as it was.
- **Never a race with the downloader.** Every mutating call is gated on the world vault's own permission check first; nothing here ever writes to a region file without asking.
- **Local only.** Nothing leaves the machine. The worker script and every operation file it reads live under the application's own user-data directory, never inside the world folder itself.

## Verification

- `cd app && npx tsc --noEmit -p tsconfig.web.json` — clean.
- `cd app && npx vitest run tests/unit/world-vault-edit-main.test.ts` — the canonical TypeScript implementation: Anvil region parse/rebuild, NBT round-tripping, coordinate rewriting (chunk `xPos`/`zPos`, block-entity `x`/`z` with `y` untouched, entity `Pos[0]`/`Pos[2]` with `Pos[1]` untouched, UUID regeneration on copy, the separate entities-file `Position`), end-to-end `copyChunk`/`removeChunks` against real files with real re-read verification, and `atomicWriteAndVerify`'s all-or-nothing behaviour.
- `cd app && npx vitest run tests/unit/world-vault-edit-worker.test.ts` — the actual deployed worker script, written to a real file and spawned as a real `node` child process, verified through the independent TypeScript reader.
- Point the world folder at a real downloaded world, select a rectangle of existing chunks, copy it to an unoccupied destination, and confirm the destination renders correctly next time the world is loaded — including any chests, signs or mobs the selection carried.
- Attempt an edit while the downloader is actively streaming the same region and confirm it is refused, naming the region, rather than queued.
- Confirm a removal clears the selected chunks (verified absent from the region file) and that the World vault tab can restore them from the resulting commit.

## Suggested related articles

- [`world-vault.md`](world-vault.md) — the version-controlled vault this feature commits every edit into and reads its permission check from (owned by `features/world-vault`).
- [`world-vault-renders.md`](world-vault-renders.md) — the per-commit map render that lets two moments in the world, including one produced by an edit here, be compared visually.
- [`world-download.md`](world-download.md) — the downloader whose region files this feature edits, and whose active writes the permission check refuses to race.
- [`map.md`](map.md) — the desktop live-map viewer this feature's occupancy grid is a companion surface to.
- `docs/features/history.md` — the application's own local history, which every edit also records an entry into.
