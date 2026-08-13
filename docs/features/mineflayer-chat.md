# Bot chat

> A full chat surface for the connected bot: the message log with sender filtering and bulk
> actions, a composer for public messages, whispers and commands, a pattern-matching rule editor
> built on the project's own regex builder, and the server text surfaces — tab list, boss bars,
> scoreboards, teams and titles — drawn outside the chat box.

## What it does

This feature owns no bot connection of its own. The `mineflayer` feature owns the live session and
publishes it through a small contract in `session.ts`; this feature attaches to whichever session
comes into focus and detaches cleanly when it goes away, so two features can never appear to the
server as two players. While no session is published, or while the published session is not
connected, every panel here renders its honest empty or disconnected state — nothing is simulated.

Three destinations ship, grouped together in the tab strip:

| Tab | What it holds |
| --- | --- |
| **Bot chat** (`mineflayer-chat.chat`) | The message log, its channel filter and search, bulk actions, and the composer. |
| **Pattern rules** (`mineflayer-chat.rules`) | The rule list, its bulk actions, and the rule editor. |
| **Server text surfaces** (`mineflayer-chat.server`) | Tab list, boss bars, scoreboards, teams, title/subtitle and the action bar. |

## How it works

### Formatting

A chat line from the library arrives in one of two shapes, and neither is plain text: an older
server sends a string carrying section-sign codes (`§c`, `§l`, `§r`); a newer one sends a
`prismarine-chat` component tree whose nodes carry `color`, `bold`, `italic`, `underlined`,
`strikethrough` and `obfuscated`, with children inheriting from their parent. `format.ts` reduces
both to a list of styled runs — depth- and length-bounded, because a component tree arrives from a
remote server — which the renderer draws as real DOM with real CSS classes, never a wall of
section signs or raw JSON. The text content of a run is exactly the text the server sent; this
module changes how a message looks, never what it says.

The sixteen vanilla colours are declared as CSS custom properties in `styles.css` rather than baked
into `format.ts` as literals, so they stay reachable from the per-element appearance editor like
any other colour, while still being the game's own colours rather than following the user's seed
colour. Obfuscated text keeps its real words in the DOM at all times; the scramble is a CSS flicker
that stands down completely under `prefers-reduced-motion`.

Every raw string that can carry the game's formatting — chat, titles, the action bar, tab list
header/footer, boss bar titles, scoreboard titles and item names, team names/prefixes/suffixes — is
rendered through the same `renderRuns` / `renderFormatted` path, so the whole feature draws
formatting consistently rather than only in the chat log.

### The message log

Every message is bound to a `ChatChannel`: `chat` and `system` and `game_info` are the library's
own message-position strings; a fourth channel, `outgoing`, is not a server channel at all — it is
this surface's own record of what it asked the bot to say, kept apart so it can never be mistaken
for something the server echoed back. The log (`model.ts`'s `ChatLog`) is held in memory only,
bounded by a retention setting (100–20000, default 2000); when full, the oldest message is dropped
and the dropped count is shown above the log rather than disappearing silently.

The log is a real list, so it carries the full bulk-action contract: multi-select through the
shared data table, a channel filter with a live per-channel count, a search bar with the anchored
regex builder, select-all scoped honestly two ways ("shown" vs "everything in the log, filter or
no filter"), inverse selection, copy, export (through `ctx.exporter`, in every registered format,
with a preflight naming any field a format cannot carry), and delete behind the two-key gate.

### The composer

Sends a public message, a whisper to one player, or a command — always through whichever bot is
connected right now (`session.chat` / `session.whisper`). A whisper's recipient is offered from the
server's own tab list, with a plain text field beside it for a player the tab list does not (yet)
name. A command gets a leading slash added automatically if it is missing, and a persistent inline
warning states plainly that the application cannot undo whatever the server does with it. The
character counter follows the session's own `chatLengthLimit()`; going over it does not block
sending — it says how many separate lines the library will split the message into.

### Pattern rules

A rule (`model.ts`'s `ChatRule`) matches an incoming message's plain text (formatting stripped)
against a compiled regular expression and takes one action: `notify`, `reply`, `command`, or
`stop` (which skips every rule after it for that message). Two things stop a reply rule from
answering itself forever: the `outgoing` channel is never matched, and a message from the bot's own
username is never matched (`ChatStore.runRules` in `store.ts`).

A rule whose action speaks (`reply` or `command`) carries a cooldown that cannot go below two
seconds, and every speaking rule together draws on one shared reply budget — a messages-per-minute
ceiling, independent of each rule's own cooldown, that raises a warning instead of sending once
spent. The rule editor computes and shows exactly what a rule will do — the channels, the
cooldown-clamped timing, the literal text it will send — before it can be saved, and every reply or
command a rule actually sends is written to local history. Bulk-enabling a selection that includes
a speaking rule goes through the confirmation gate, naming which of the selected rules will speak.

The pattern field opens the project's shared regex builder (`ctx.createRegexBuilder`), seeded with
the most recent messages in the log as sample text, so a rule can be composed and tried against
real text before it is saved.

### Server text surfaces

`ServerTextState` in `store.ts` mirrors the connected session's tab list, boss bars, scoreboards,
teams, title, subtitle, title timing and action bar, resynchronising the whole collection whenever
the library reports any one of them changed (rather than trying to patch a local copy that could
drift). Every value shown is the real event value; a manual **Re-read the server state** action asks
the session for its current state in one pass.

## Key files

| Path | What lives there |
| --- | --- |
| `app/src/renderer/features/mineflayer-chat/index.ts` | The feature module: tabs, settings, palette entries, documentation, initialization. |
| `app/src/renderer/features/mineflayer-chat/session.ts` | The contract this surface follows: `BotChatSession`, `BotSessionHost`, and the runtime handoff the `mineflayer` feature publishes through. |
| `app/src/renderer/features/mineflayer-chat/store.ts` | `ChatStore`: the message log, pattern-rule engine, reply budget, and the mirrored server text state. |
| `app/src/renderer/features/mineflayer-chat/model.ts` | `ChatLog`, `ChatRecord`, `ChatRule` and their persistence/coercion helpers. |
| `app/src/renderer/features/mineflayer-chat/format.ts` | Legacy and component chat-formatting parsers, and the styled-run renderer. |
| `app/src/renderer/features/mineflayer-chat/state.ts` | `ChatFeatureState`: the shared `ChatStore` instance and the palette-command hook registry. |
| `app/src/renderer/features/mineflayer-chat/chatpanel.ts` | The "Bot chat" tab: log, filters, bulk actions, composer. |
| `app/src/renderer/features/mineflayer-chat/rulepanel.ts` | The "Pattern rules" tab: rule list, bulk actions, rule editor. |
| `app/src/renderer/features/mineflayer-chat/serverpanel.ts` | The "Server text surfaces" tab. |
| `app/src/renderer/features/mineflayer-chat/docs.ts` | The in-app documentation articles. |
| `app/src/renderer/features/mineflayer-chat/strings.ts` | Every string, English and Cantonese, at all five humour levels. |
| `app/src/renderer/features/mineflayer-chat/styles.css` | The vanilla colour custom properties, run styling, and Material Design 3 layout. |

## Configuration

Every setting is in **Settings → Bot chat**, carries its own explanation behind progressive
disclosure and a provenance line, and is reachable from the command palette with its live control
rendered inline.

| Setting | Default | What it does |
| --- | --- | --- |
| `mineflayer-chat.retention` | `2000` | Messages kept in the in-memory log (100–20000). Live changes apply immediately, not only after a restart. |
| `mineflayer-chat.timestamps` | `true` | Shows a time column in the message log. |
| `mineflayer-chat.autoScroll` | `true` | Follows the newest message; scrolling up by hand suspends it until you return to the bottom. |
| `mineflayer-chat.rulesEnabled` | `true` | The master switch for every pattern rule, independent of each rule's own enabled state. |
| `mineflayer-chat.replyBudget` | `6` | Messages every rule together may send per minute (0–30). Zero silences every speaking rule while notify rules keep working. |
| `mineflayer-chat.exportFormat` | `json` | The format the export dialog opens on; every other registered format stays available there. |

The channel filter and the pattern rules themselves are stored settings (`mineflayer-chat.channels`,
`mineflayer-chat.rules`) but are edited through their own panels rather than the Settings screen,
the same way version history's labels are edited through its own list rather than a generic form.

## Usage

- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> → *Open bot chat*, *Send a message through the bot*,
  *Chat pattern rules*, *Server text surfaces*, *Export the chat log*, *New chat pattern rule*.
- Right-click a run of chat text, a row, a card or a control for **Edit appearance…** and **Lock
  this element…**, exactly as everywhere else in the application.
- Every search field carries the anchored pattern builder; plain text is the default, a regular
  expression is an explicit opt-in.

## Failure modes

| Situation | What happens |
| --- | --- |
| No bot runtime has published a session | Every panel states plainly that the connection is owned by the bot control surface, and stays honestly empty rather than simulating anything. |
| The published session is not connected | Sending is disabled with the exact reason attached to the control; the log, search and export of what already arrived keep working. |
| A rule's pattern does not compile | The rule editor refuses to save and names the exact problem; a saved rule that somehow holds an invalid pattern is treated as matching nothing. |
| A rule that speaks matches while disconnected | The message is not sent; a notification names the rule and says why. |
| The reply budget is spent | The match is not acted on; a notification names the rule, the budget, and where to raise it. |
| A whisper has no recipient | Sending is refused with an inline notice; nothing is sent. |
| The tab-complete request fails | The exact failure reason is reported; the message field is left exactly as typed. |
| An export format cannot carry a field | The export dialog states which field and why, before anything is written. |
| The server sends an unrecognised or deeply nested chat component | Depth and run-count bounds in `format.ts` stop the parse rather than the window locking up; whatever was parsed before the bound is still shown. |

## Security considerations

- **No network access of its own.** Every outbound byte goes through the `BotChatSession` the
  `mineflayer` feature already owns and has already connected under the user's own credentials;
  this feature never opens a socket, and registers no `ctx.studio.http` allow rule because it makes
  no HTTP request.
- **A rule that speaks is disclosed before it can be armed.** The editor's "What this rule will do"
  text and speak-warning banner state the exact channels, the exact text (with capture groups
  substituted from a live sample where possible) and the exact minimum interval, in unambiguous
  words, at every humour level.
- **Every autonomous message is attributable.** A reply or command a rule sends is recorded to
  local history with the rule id, its name, and exactly what was sent, so what happened while a
  user was away from the keyboard is auditable afterwards.
- **A command a rule or the composer sends is opaque to this application.** Nothing here interprets
  or restricts what a command does server-side; the warning is explicit that this is the server's
  business and cannot be undone from here.
- **No credential of any kind passes through this feature.** Authentication belongs entirely to the
  `mineflayer` feature's own connection settings.

## Verification

1. With no bot connected, open **Bot chat**. Every panel states plainly that no session is
   published, and the composer is disabled with that reason attached.
2. Connect a bot elsewhere and send a chat message from another player. It appears in the log with
   the right channel, sender and styled colours; searching for a word in it narrows the log to
   exactly the matching messages.
3. Toggle a channel chip off. Its messages leave the visible log and its count is still shown on the
   chip; toggling it back returns them.
4. Select several messages, use **Select all shown**, then **Select all in the log**, then invert
   the selection. The counts on every button stay accurate throughout.
5. Delete the selection. The two-key gate names the exact count and previews the affected messages;
   after confirming, a local history entry records the deletion.
6. Export the log as CSV, then as JSON. The dialog states before writing whether CSV loses any
   field; both files, once written, are readable.
7. Create a rule matching `hello`, action **Reply in chat**, and try it against a recent message in
   the pattern builder before saving. The "What this rule will do" text names the channels, the
   literal reply text and the cooldown; the speak-warning banner is visible.
8. Send a matching message from another player. The rule fires once, respects its cooldown on a
   second matching message sent quickly after, and a history entry records what was sent.
9. Set the reply budget to `0` and repeat step 8. Nothing is sent; a notification names the rule and
   the spent budget.
10. Turn off "Run the pattern rules" in settings. No rule fires until it is turned back on, and no
    individual rule's own enabled state changes.
11. Open **Server text surfaces** while a scoreboard, a boss bar and a team are active on the
    server. Each renders with its formatting intact; disconnecting empties every panel honestly.

## Language modes, humour and School mode

All copy goes through the shared catalogue in `strings.ts`, so it renders in English, in playful
Hong Kong Cantonese, or bilingually, at whichever humour level each language is set to
independently. Humour styles the voice and never the facts: at level 5, the warning that a rule
speaks on the user's behalf still names the exact channels, the exact text and the exact interval —
the joke is in the delivery, not in what the reader is told will happen.

This feature exposes no Cantonese-only, bilingual-only, humour, personal-vocabulary or dim-sum
capability of its own, so School mode changes only how its copy reads, through the shared
catalogue, exactly as it does everywhere else.

## Gotchas and limitations

- The message log and the pattern rules render through the shared data table without additional
  virtualization of their own. A retention setting left at its upper bound (20000) will render more
  slowly than the default; the retention setting exists precisely so this trade-off is the user's to
  make rather than a fixed ceiling.
- A rule only ever watches `chat`, `system` and `game_info` — never `outgoing` — and this is
  enforced in `model.ts`'s own coercion of a rule read back from the settings file, not only in the
  editor, so a hand-edited settings file cannot smuggle a self-matching rule past the guard.
- The tab-complete action asks the *server*, through the library's own `bot.tabComplete`; it is not
  a local completion of previously sent messages or commands.

## Suggested related articles

- [Notification centre](notification-centre.md) — where this feature's warnings (spent budget,
  disconnected send, failed tab-complete) land and stay reviewable.
- [Export](export.md) — the shared export contract the chat log and the rules list both use.
- [History](history.md) — the local version history that records every rule created, edited,
  deleted, and every autonomous reply or command a rule actually sent.
