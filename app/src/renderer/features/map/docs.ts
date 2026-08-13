import type { DocArticle } from '../../core/registry';

/**
 * The in-application articles for this feature.
 *
 * These mirror `docs/features/map.md` in the repository, bundled into the build
 * so they read with no network connection at all — appropriate for a feature
 * whose entire point is that it never makes one.
 */

export const MAP_DOCS: DocArticle[] = [
  {
    id: 'map.overview',
    title: 'The live map',
    category: 'The product',
    related: ['map.markers', 'core.overview', 'core.export', 'core.history'],
    body: `# The live map

This viewer draws whatever the downloader's own headless overview renderer has
already written to disk. It is a **reader**, not a renderer: nothing on this
screen is drawn from a chunk, a block or a network request. Every pixel came
from a PNG file the downloader wrote, and every pixel disappears the moment
that file does. There is no map library, no tile server and no request that
ever leaves this machine.

## Where the tiles come from

While the downloader runs, its bundled overview renderer blits every loaded
chunk into 512×512-block region tiles under \`<world output>/overview/\`, plus a
small \`meta.json\` index describing which tiles exist, the player's last known
position, and when the index was last written. That renderer flushes roughly
every three seconds. Overview rendering turns on automatically in headless
mode, can be forced on with the \`--render-map\` flag, and can be turned off
entirely with \`--disable-map-render\`.

Point this feature's **World output folder** setting at either the world
folder itself or the \`overview\` folder inside it — both are checked, in that
order, before the viewer reports that no index was found.

## Reading the surface

- **The canvas** pans by dragging or the arrow keys, zooms by scrolling, the
  plus and minus keys, or Page Up and Page Down, and resets with Home. Every
  one of those paths updates the same coordinate readout the pointer does.
- **Layers** choose the dimension and render mode (surface or caves) that are
  drawn, and toggle the region grid, the player marker, your own markers, the
  centre crosshair and edge smoothing independently. Turning a layer off never
  deletes anything; it only stops drawing it.
- **Follow the player** re-centres the view every time the index reports a new
  player position, and turns itself off the moment you pan or zoom by hand —
  so a deliberate look elsewhere is never yanked back.
- **Go to coordinates** centres the view on a typed X and Z (with Y recorded
  onto a marker, though the plan view is drawn from directly overhead and never
  shows height).
- **Markers** are places you save yourself. They live in this application's own
  settings, never in the world folder, so nothing you do with them can corrupt
  a download. They support multi-select with shift-ranges and a keyboard path,
  an honestly-scoped select-all, bulk show/hide/delete behind the destructive-
  action gate, and export in every supported format.
- **Worldlens** is a *separate* companion application (see the related article)
  that can render this same world into a full, browsable 3-D-style map. The
  small card on this tab only reports what Worldlens is currently serving over
  loopback and offers to open it in your browser; it never draws that map
  itself.

## Configuration

Every setting lives under **Settings → Live map**: the world output folder,
whether the index re-reads itself automatically and how often, the render mode
the viewer opens on, whether it follows the player, each layer's default
visibility, edge smoothing, how many decoded tiles stay in memory, and a
shortcut to reveal the tile folder in the file manager.

## Honest states

Four different reasons a map might not be showing are reported as four
different states, each with its own recovery action, rather than one blank
rectangle that could mean any of them: no folder chosen yet, the chosen folder
does not exist, the folder exists but has no index yet, and the index exists
but could not be read or parsed (almost always because the renderer was
mid-write, in which case a second refresh works).

## Failure modes

- **A missing or unreadable index** reports the exact path and the operating
  system's own error text, with a refresh action.
- **A folder that has vanished** never gets treated as "nothing has changed
  here" — the viewer says plainly that nothing has deleted it and offers to
  choose the folder again.
- **A view wide enough to ask for thousands of region tiles in one frame** is
  capped rather than drawn: the status line says the view is wider than one
  frame will draw and asks you to zoom in, so a single frame can never become
  unbounded.

## Security considerations

Every dimension name that reaches a file path is validated against the exact
character class the renderer's own path sanitiser produces before it is used;
anything outside that set is refused rather than escaped, because refusing is
checkable and escaping is a guess. Reads are capped at a generous but finite
byte ceiling per file. Markers, the remembered camera position and every
setting stay local; nothing here ever makes a network request, and the
Worldlens card only ever opens a **loopback** address the user's own machine is
already serving.

## Verification

Point the World output folder setting at a world the downloader is actively
rendering with overview rendering on, confirm tiles appear as chunks load, and
exercise pan, zoom, dimension and mode switching, follow-player, marker
creation/edit/delete/restore/export, and every honest-state path by pointing
the setting at a missing folder, an empty folder, and a folder holding a
partially-written index.
`
  },
  {
    id: 'map.markers',
    title: 'Map markers',
    category: 'The product',
    related: ['map.overview', 'core.export', 'core.history'],
    body: `# Map markers

Markers are places you save on the live map — a base, a village, a stronghold
entrance. They are stored with this application's own settings, bounded at
2,000 entries, and are never written into the downloaded world folder, so
nothing you do with them can corrupt or interfere with a download.

## What is recorded

Each marker has a name (up to 120 characters), a dimension, X/Y/Z coordinates,
a colour chosen from the same six roles used across the application, a note
(up to 512 characters) and a visibility flag. The dimension a marker was
created in is shown against it, and a marker for a dimension other than the one
currently on screen says so plainly rather than pretending to be here.

## Adding, editing and removing

**Add a marker here** drops one at the centre of the current view; **go there
and add a marker** does the same after centring on typed coordinates. Every
field commits on blur or Enter and is recorded as its own local-history entry
naming exactly what changed — a rename, a move, a recolour, a visibility
change or a note edit are each their own event, not one generic "updated".

Deletion goes through the two-key destructive-action gate, previews every
marker by name and location, and offers **Put them back** on the notification
that follows — restoring is itself a new history entry, so an undo can be
undone in turn.

## Searching, selecting and bulk actions

The search field carries the full anchored pattern builder and matches a
marker's name, dimension, coordinates and note. Selection supports shift-range
extension and a keyboard path; **select the N shown** and **select every
marker (N)** are two separate, honestly-labelled actions rather than one
ambiguous button, and **invert the selection** and **clear the selection** are
both one click away. Bulk show, hide and delete apply to the current
selection, and export writes whichever subset the current search has left
visible, in any of the ten supported formats, with a loss preview shown before
anything is written.
`
  }
];
