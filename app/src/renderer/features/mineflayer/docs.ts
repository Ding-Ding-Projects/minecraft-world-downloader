import type { DocArticle } from '../../core/registry';

const OVERVIEW = `
This feature runs [mineflayer](https://github.com/PrismarineJS/mineflayer) — the
Minecraft bot library — in a sandboxed Node process behind an allow-listed
method surface, and gives you the connection form, the live state read-out,
and saved multi-bot profiles.

## Why a separate process

The renderer has no \`require\`, no \`process\` and no TCP sockets, and the bot
library needs all three: it opens a real connection to a real Minecraft
server. \`bot-host.js\` is written into this application's own data directory
and launched with \`node\` through the privileged, allow-listed process bridge.
Everything the renderer can ask that process to do is one of a fixed list of
methods — there is no route from a Minecraft chat message, a server plugin, or
anything else on the other end of that connection back into arbitrary code on
your machine.

## Connecting

Every field on the connection form is validated before it reaches the bot
library: host, port, username, authentication mode, an optional Minecraft
version (leave it blank to let the server tell the bot which version to
speak), an optional SOCKS5 proxy, view distance, chat visibility, main hand,
and a reconnect policy. Settings → **Bot connection defaults** pre-fills new
profiles; nothing is guessed at connect time that was not either typed by you
or set as a default you chose.

Three authentication modes:

- **Offline** — no credential is used at all. This is what a cracked or
  LAN-only server expects.
- **Microsoft account** — the library opens a device sign-in flow. The code
  and the sign-in URL arrive as a real, persistent notification and are also
  shown on the bot's own detail card, because that is the one thing you
  genuinely have to act on outside this application.
- **Legacy Mojang account** — an email and password. The password never
  enters a saved profile, an export, a log or local history: it is written
  straight to the operating system credential vault the moment you save it,
  and read back out only for the instant a connection is actually made.

## Live state

Health, food, saturation, oxygen, experience, game mode, dimension, position,
velocity, facing, on-ground state, held item, time of day, weather, and
player/entity counts — every value is the bot's own last reported reading.
Nothing here is simulated: a field reads "—" until the library has genuinely
reported it, never a guessed zero.

## Multiple bots

Up to eight bots can run at once from the one runtime process (the same limit
the host itself enforces). Each gets its own row, its own live state, and its
own event log; connecting a second bot never resets or mixes in the first
one's. Whichever bot is selected in the list is the *active* bot — the one the
movement, chat, inventory and world companion features drive.

## Failure modes

- **Library not found** — the runtime searches a short, fixed list of
  candidate locations (shown in full, verbatim, under "Every path the runtime
  searched") for the vendored copy of \`mineflayer\`. In a packaged build this
  can fail if the vendored library was not bundled as an application
  resource; see this feature's completeness notes for the exact gap.
- **A dropped connection** — the reconnect policy decides what happens next:
  disabled, a bounded number of attempts with exponential backoff, or
  unlimited attempts, optionally including a reconnect after being kicked
  rather than only after a dropped socket.
- **A kicked or disconnected session** shows the server's own reason,
  verbatim, never paraphrased.

## Security

Nothing outside this feature's allow-listed method list and event list can be
reached from the connected server or from a sibling feature. Outbound HTTP is
never used by this feature. The child process's own stdout is only ever
parsed one sentinel-prefixed line at a time, so nothing the Minecraft server
sends the bot — including chat text — can be mistaken for a runtime protocol
message.
`.trim();

const EVENTS = `
Every event the vendored \`mineflayer\` library actually emits — not just the
ones a dedicated control somewhere else in this feature or its siblings
happens to read — is forwarded here as it fires. This is the honest catch-all:
if a capability has no purpose-built surface yet, it is still observable in
this list.

## What is covered

The event list is not copied from the library's shipped \`index.d.ts\` alone —
that file is missing five real events on this vendored version
(\`blockPlaced\`, \`entityPlaced\`, \`weatherUpdate\`, \`title_times\` and
\`title_clear\`), found instead by reading every \`bot.emit(...)\` call in
\`vendor/mineflayer/lib/plugins\`. \`scripts/check-mineflayer-coverage.mjs\`
guards this from the other direction: it fails the moment a new plugin lands
in that directory without a row in this project's feature inventory naming it.

## Rate limiting

A very chatty server can emit hundreds of \`move\`, \`physicsTick\` or
\`entityMoved\` events a second. The runtime enforces a 200-events-per-second
budget per bot; anything past it is dropped and the drop is reported as a
visible \`events dropped\` marker in the log rather than silently vanishing.
High-frequency events (\`move\`, \`physicTick\`, \`physicsTick\`,
\`entityMoved\`, \`entityUpdate\`, \`entityAttributes\`, \`blockUpdate\`,
\`chunkColumnLoad\`, \`chunkColumnUnload\`, \`particle\`) are off by default for
exactly this reason — the toggle on this tab turns every one of them on.

## Retention

The log is a bounded ring buffer per bot; its size is **Settings → Bot
connection defaults → event log buffer size**. Once full, the oldest entries
are dropped to make room for new ones — this is the buffer's stated retention,
not a leak.

## Searching, pausing and exporting

The search field carries this project's full pattern-matching builder and
matches against both the event name and its serialized payload text. Pausing
freezes the visible list without stopping the underlying subscription — new
events keep arriving into the buffer, you simply stop watching them scroll.
Export writes the currently filtered set as JSON Lines, one event per line.
`.trim();

export const MINEFLAYER_DOCS: DocArticle[] = [
  {
    id: 'mineflayer.overview',
    title: 'Minecraft bots: connecting and live state',
    category: 'Minecraft bots',
    body: OVERVIEW,
    related: ['mineflayer.events']
  },
  {
    id: 'mineflayer.events',
    title: 'Minecraft bots: the event inspector',
    category: 'Minecraft bots',
    body: EVENTS,
    related: ['mineflayer.overview']
  }
];
