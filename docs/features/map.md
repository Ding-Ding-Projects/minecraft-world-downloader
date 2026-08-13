# Live map (desktop)

> The desktop application's own viewer for the region tiles the downloader's headless overview renderer writes to disk — a reader, not a renderer, with layer controls, a coordinate readout and user-saved markers.

## What it does

While the downloader runs, its bundled overview renderer (`game.data.map.OverviewMap`, documented in [`live-map.md`](live-map.md)) blits every loaded chunk into 512×512-block region tiles under `<world output>/overview/`, plus a small `meta.json` index naming which tiles exist, the player's last known position and when the index was last written. The desktop application's **Live map** tab (`app/src/renderer/features/map/`) reads that same folder directly through the privileged file-system bridge and draws it on a plain 2D canvas — no map library, no tile server and no HTTP request of any kind. It is the exact same on-disk contract the Flask web console's `/map` page reads, implemented as a native desktop surface instead of a browser page.

The feature is deliberately a **consumer** of the renderer's output, never a renderer itself: every pixel on screen came from a PNG file the Java process wrote a few seconds earlier, and disappears from the view the moment that file does. Rendering the world — turning chunk data into pixels — happens entirely on the Java side; this feature never touches a chunk, a block palette or a network socket.

## How it works

### Reading tiles

`source.ts` (`TileSource`) resolves the configured folder against two candidates, in order: the folder itself, and an `overview` subfolder inside it — because a user might reasonably point the setting at either the world's output folder or the `overview` folder the renderer actually writes into. Once resolved, it re-reads `meta.json` on a timer (default every three seconds, matching the renderer's own flush interval) and decodes region PNGs lazily: a tile that has not been requested yet is never fetched, and a tile that is already in the bounded LRU cache (default 96 entries, roughly 96 MB decoded) is never re-fetched unless the index's `updated` timestamp says the renderer wrote a new version of it. A frame is never allowed to block on disk: `TileSource.tile()` returns the cached image or `null` immediately and schedules a background read, redrawing once it resolves.

### Drawing

`canvas.ts` (`MapCanvas`) owns a `<canvas>` sized to its container, reads the current Material color tokens for its palette (surface, outline, marker colors), and draws visible region tiles, the region grid, the player marker and the user's own markers, in that order. It caps how many region tiles a single frame will request — a view zoomed out far enough to ask for more than 4,096 tiles skips drawing terrain that frame rather than blocking, and the status line says so. Every camera operation (pan, zoom, jump, fly-to) is reachable identically from the pointer, the wheel, touch (drag and pinch) and the keyboard (arrow keys pan, Shift plus an arrow key pans one small step, `+`/`-` and Page Up/Page Down zoom, Home resets), and every path updates the same pointer and centre coordinate readouts.

### Markers

`markers.ts` (`MarkerStore`) persists a bounded list (2,000 entries) of user-created markers inside this application's own settings document — never inside the downloaded world folder — and records every creation, edit, visibility change and deletion as its own local-history entry through `ctx.history`. Restoring deleted markers (offered on the deletion notification) is itself a new history entry, so an undo can be undone in turn.

### The Worldlens card

A small status card imports the typed contract `features/worldlens/endpoint.ts` publishes (`currentMapEndpoint` / `subscribeMapEndpoint`) and reports, honestly, whether the separate Worldlens companion application is currently serving a fuller render of the same world over loopback. It never embeds, proxies or re-renders that output; it only names what is being served and offers to open it in the user's default browser through the privileged `shell.openExternal` bridge, which refuses anything that is not `http(s)`. See `docs/features/worldlens.md` (owned by that feature) for how the render itself is driven.

## Configuration

Every setting lives under **Settings → Live map**:

| Setting | Default | Purpose |
| --- | --- | --- |
| World output folder | (none) | The folder the downloader writes the world into. Either the world folder or its `overview` subfolder is accepted. |
| Re-read the index automatically | On | Whether the index is polled on a timer. |
| Seconds between re-reads | 3 | How often the (small) index is re-read. The renderer itself only flushes roughly every 3 seconds, so a shorter interval asks more often without tiles arriving any faster. |
| Render mode at start-up | Surface | Which of the renderer's two modes (`normal` / `caves`) the viewer opens on. |
| Follow the player | On | Re-centres on the player's reported position; turns itself off the moment the view is panned or zoomed by hand. |
| Your markers / Player marker / Region grid / Centre crosshair | On / On / Off / On | Independent layer visibility toggles. Turning one off never deletes anything. |
| Smooth when zoomed out | On | Interpolates tile pixels below one pixel per block; above that, tiles are drawn pixel-for-pixel. |
| Tiles kept in memory | 96 | The bound on the decoded-tile LRU cache. |
| Show the tile folder | (action) | Opens the resolved tile folder in the operating system's file manager. |

## Failure modes

Four different reasons a map might not be showing are reported as four distinct, honest states rather than one blank rectangle:

1. **No folder chosen yet** — the default, first-run state, with a direct action to choose one.
2. **The chosen folder does not exist** — states plainly that this viewer has deleted nothing, and offers to choose again.
3. **The folder exists but has no index yet** — names both paths that were checked and explains the render-map / disable-map-render flags that gate the renderer producing one.
4. **The index exists but could not be read or parsed** — names the exact path and the operating system's or parser's own error text; a parse failure is almost always the renderer mid-write, and the recovery action is simply to refresh again.

A view zoomed out past the per-frame tile cap draws nothing new that frame (existing tiles remain visible) and the status explains why, rather than hanging the renderer trying to decode thousands of tiles at once.

## Security considerations

- **No network access of any kind.** Tiles and the index are read exclusively through the privileged `studio.fs` bridge, which only ever touches the local filesystem. The only network-adjacent action in this feature is the Worldlens card's "open in browser," which opens a `http(s)` loopback URL through the operating system's own browser — refused entirely by the bridge if it is not `http(s)`.
- **Path safety.** Every dimension name that reaches a file path (`tilePath()` in `model.ts`) is validated against the exact character class the Java renderer's own path sanitiser produces (`[A-Za-z0-9._-]+`) before it is used. Anything outside that set is dropped during index parsing rather than passed through, because refusing an unsafe value is checkable and escaping one is a guess.
- **Bounded reads.** The index is capped at 8 MB and a single tile at 4 MB before either is even attempted, so a corrupted or hostile file cannot exhaust memory.
- **Local-only markers.** Markers, the remembered camera position and every setting stay inside this application's own local settings file; none of it is ever exported, logged, or transmitted anywhere except through the explicit, user-initiated export action.

## Verification

- Point **World output folder** at a world the downloader is actively capturing with overview rendering on (automatic in headless/`--no-gui` mode, forceable with `--render-map`) and confirm tiles populate as chunks load, roughly every three seconds.
- Exercise pan (drag, arrow keys), zoom (wheel, pinch, `+`/`-`, Page Up/Down), Home, dimension and render-mode switching, and follow-player turning itself off on manual movement.
- Create, rename, recolour, move, hide, delete and restore a marker; confirm each is its own local-history entry and that deletion goes through the two-key destructive-action gate with an accurate preview.
- Search and bulk-select markers, and export the current filtered set in each of the ten supported formats, confirming the preflight loss report before anything is written.
- Point the folder setting at a folder that does not exist, an existing folder with no `overview/meta.json`, and a folder mid-write, and confirm each honest state and its recovery action.
- With Worldlens not running, confirm the card reports the idle state and its "Open in browser" action is disabled with a stated reason; with a render being served, confirm the card names the world and URL and the button opens it.
- `npx tsc --noEmit -p tsconfig.web.json` from `app/` is clean for this feature.

## Suggested related articles

- [`live-map.md`](live-map.md) — the Java-side headless overview renderer and the Flask web console's own `/map` page, which write and serve the exact same on-disk tile contract this feature reads.
- `docs/features/worldlens.md` — pairing with the separate Worldlens companion application and its headless renderer (owned by `features/worldlens`).
- `docs/features/history.md` — the local version-history store every marker change is recorded into.
- `docs/features/export.md` — the export surface markers are written through.
- [`world-download.md`](world-download.md) — the downloader whose overview renderer produces the tiles this feature reads.
