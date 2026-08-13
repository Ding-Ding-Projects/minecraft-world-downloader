import type { DocArticle } from '../../core/registry';
import { WORLDLENS_RELEASES_URL, WORLDLENS_SITE_URL } from './probe';

/**
 * The in-application articles for this feature.
 *
 * These mirror `docs/features/worldlens.md` in the repository, bundled into
 * the build so they read with no network connection at all.
 */

export const WORLDLENS_DOCS: DocArticle[] = [
  {
    id: 'worldlens.overview',
    title: 'Rendering a world with Worldlens',
    category: 'Worldlens',
    related: ['map.overview', 'core.overview', 'core.export', 'core.history'],
    body: `# Rendering a world with Worldlens

This feature is a **pairing**, not a renderer of its own. It finds a world
this application has already downloaded, finds a companion product called
Worldlens (a separate, freely installable desktop application), and hands one
to the other. Nothing here draws a single pixel — that is Worldlens's job,
either through its desktop application or through the headless command-line
renderer it ships alongside every release.

## Two separate things it looks for

A machine can have either of these without the other, so they are reported
separately rather than folded into one "is Worldlens here" verdict:

- **The Worldlens desktop application.** Installed through Squirrel under the
  local application-data directory, alongside every other Squirrel-installed
  product on the machine. Detected automatically; a path can be set by hand in
  settings when detection cannot see it (a portable copy, for instance).
- **The headless command-line renderer.** A separate file — either the
  renderer \`.jar\` every Worldlens release attaches (run with \`java\`), or the
  \`@worldlens/cli\` package's \`dist/index.js\` (run with \`node\`). This is what
  actually draws the in-app map on the **Render and serve** section of the
  Worldlens tab; the desktop application cannot be driven that way, because it
  takes no world path on its own command line.

Neither is bundled with this application, and neither is downloaded on your
behalf. The **Get Worldlens** action opens its releases page in your own
browser, where you choose and run its installer yourself.

## Handing a world to the desktop application

Worldlens's desktop application accepts no world path on its command line and
registers no link scheme this application could use to tell it what to open.
Handing off a world is therefore: launch Worldlens, copy the world's folder
path to the clipboard, and say so — the world still has to be pasted into
Worldlens's own world picker by hand. That is stated plainly in the
notification the handoff raises, rather than pretended away.

## Rendering here instead

Setting the headless renderer's path lets this tab render a world itself,
without switching to the Worldlens desktop application at all:

1. Point **Headless renderer** at the renderer \`.jar\` or \`dist/index.js\`.
2. Point **Worlds folder** at wherever your downloads land, and **Render
   output folder** at wherever the render should write.
3. Select exactly one world in the table, tick the dimensions to render, and
   choose **Render and serve**.

The renderer writes its own configuration folder inside the output directory
— \`core.conf\`, \`webserver.conf\`, \`webapp.conf\` and one map file per
dimension — and is driven as a child process, with its real progress and its
own log lines shown as they arrive. When it reports itself listening, **Open
the map in the browser** opens the served map.

## The map server never leaves this computer

The web server's listen address is pinned to \`127.0.0.1\` in every
configuration this feature writes, regardless of what the renderer's own
default would have been. The map is reachable from this computer and nowhere
else, for as long as the renderer keeps running. Turning on **Keep watching
the world after rendering** keeps it running and redrawing after the first
pass — useful while a download is still writing into the same world — and it
keeps using processor time until it is stopped.

## Which world versions Worldlens claims to read

Worldlens states it reads Minecraft ${'`1.12.2`'} through ${'`26.x`'}. Every world in
the table is checked against that range and marked supported, older, newer,
or unknown (when its version string cannot be parsed as a numbered release).
A world outside the range can still be opened — the check is informative, not
a gate — and the desktop application or the renderer itself will say what it
actually makes of it.

## Network use

The only network request this pairing can ever make is Worldlens's own,
opt-in **Let the renderer download Minecraft client files**, off by default.
On, the renderer may fetch Minecraft's client files from Mojang while a
render is running, for block textures it does not already have locally. Off,
it uses whatever is already on the machine and stops with a message when it
cannot, rather than reaching the network. The releases page opened by **Get
Worldlens** is the one other network-adjacent action here, and it only opens
your own browser to a public URL — it never downloads anything into this
application.

## Where to get Worldlens

- Installer releases: ${WORLDLENS_RELEASES_URL}
- Project site: ${WORLDLENS_SITE_URL}

Both links open in your own default browser, never inside this application,
and neither is fetched, embedded or bundled by it.
`
  }
];
