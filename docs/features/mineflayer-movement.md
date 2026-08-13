# Bot movement: pad, look, ray tracing, walk and follow

Directional controls, sprint, sneak and jump, look-at (a point, an entity, or a
typed angle), a ray-trace target picker, walk-to-coordinates, follow-entity, a
straight-line route preview, and a searchable, bulk-manageable movement log —
operable by keyboard as well as pointer, driving whichever bot session the
`mineflayer` feature publishes.

- **Feature id:** `mineflayer-movement`
- **Destination:** *Bot movement* (one tab: read-out, pad, look, ray tracing,
  walk, follow, preview and log all together)
- **Settings section:** *Bot movement*
- **Command palette:** open, stop everything, and a direct teleport to each
  section (read-out, pad, look, ray, walk, follow, preview, log), plus the live
  controls for every one of its settings
- **Satisfies:** `FEATURE_INVENTORY.md` row **15.4**

---

## Behaviour

### Where the session comes from

This feature never opens a connection itself. At boot it searches for a bot
session module published by the `mineflayer` feature at
`features/mineflayer/index.ts`, accepting any of:

- a named export — `movementSession`, `botSession`, `mineflayerSession`, or
  `session`
- a factory export — `getMovementSession`, `getBotSession`, `getSession`, or
  `activeSession`
- a multi-bot session host — `sessionHost`, `sessions`, `botSessions`, or
  `mineflayerSessions`
- a runtime registration through `window.mineflayerMovement.provideSession(...)`
  or `.provideHost(...)`

Three states are rendered honestly and distinctly: **searching** (still
looking), **unavailable** (no session module found in this build — every place
searched is listed on screen), and **connected/disconnected** (a session exists,
with or without a bot on the end of it). Every control on the tab stays visible
and disabled, with the exact reason "Requires a connected bot", rather than
disappearing when nothing is connected — so what is missing is visible instead
of the surface looking broken.

### Directional controls (the pad)

Forward, back, left, right, jump, sprint and sneak — exactly the seven keys of
`controlState` the vendored `mineflayer` exposes in
`lib/plugins/physics.js`, and typed as the same `ControlName` union
`index.d.ts` declares. Each is held for exactly as long as the pointer or the
key that started it is held, and released the instant that pointer lifts, that
key comes up, the specific button loses focus, the pad loses focus entirely, or
the browser window itself loses focus. See **"Why a held control always lets
go"** (linked below) for the full mechanism — this is the one behaviour this
surface exists to get right.

Keyboard piloting (a setting, on by default) lets W, A, S, D, Space, Shift and
Ctrl drive the pad while the pad itself has focus — scoped to the pad, so
typing those letters into a coordinate field elsewhere on the tab is just
typing. Every button also holds with Space or Enter regardless of that setting.
Escape, while the pad has focus, releases every control at once. **Stop all
movement** releases every held control, cancels a running walk, and stops a
running follow, all in one action.

### Look

Yaw and pitch are typed in degrees and converted to the radians
`bot.look(yaw, pitch, force)` takes. "Look at a point" and "look at an entity"
compute `yaw = atan2(-dx, -dz)`, `pitch = atan2(dy, sqrt(dx² + dz²))` — the
exact formula the library's own `bot.lookAt` uses — so the numbers shown and
the real turn never disagree. The **"send the exact angle"** switch passes
`force` through to the library, skipping the smooth server-side turn; useful
before dropping an item or shooting, unnecessary for ordinary walking.

### Ray-trace target picker

Casts from the bot eye along its current facing using `blockAtCursor` and
`entityAtCursor` from `lib/plugins/ray_trace.js`, at a configurable maximum
distance (the library's own defaults, 256 m and 3.5 m, are the settings'
starting points). A session that has not wired up a ray-trace route disables
the relevant button with that exact reason rather than firing into nothing.
Whatever the ray hits can be copied straight into the walk target or the
look-at-a-point coordinates with one click, so a target found by looking never
has to be typed.

### Walk to coordinates

A **straight-line walk, not a navigated path**: the bot faces the target and
walks, re-aiming on a configurable tick (also the read-out's refresh rate), and
hopping over a one-block step whenever it stops making measurable progress
(when the "jump when stuck" setting is on). It stops itself, reporting the
metres remaining, on:

- **arrival** — within the arrive-radius setting, measured on X and Z only, so
  a target one block overhead still counts
- **cancellation** — the user pressed "Cancel the walk"
- **stuck** — no measurable progress for longer than the stuck-timeout setting
- **timeout** — the walk-timeout setting was exceeded regardless of progress
- **lost session** — the bot disconnected mid-walk

Only one walk or one follow may run at a time; starting the other is refused
with the exact reason ("a follow is running" / "a walk is running").

### Follow an entity

Holds a chosen distance (a setting) to a nearby entity picked from the bot's
live entity list: walks when further away than that distance, stands still
when closer, and stops itself — reporting why — the moment the entity leaves
the entity list, rather than continuing to chase a target that is gone.

### Route preview

A top-down diagram of the running walk or follow: start, target, the bot's
current position, and the ground already covered (bounded to a configurable
trail length so the diagram never grows without bound). The vendored library
ships forty-one plugins and none of them plans a route, so unless a session
genuinely exposes a `pathfinder`, the line drawn is always the literal straight
line the bot is attempting — the preview says this plainly. When a
`pathfinder` is present, its own reported waypoints are drawn instead and named
as such. The preview can be switched off in settings; doing so changes nothing
about how the bot moves.

### The movement log

Every control press and release, look, walk start/finish/cancel/failure,
follow start/stop/loss, and ray-trace result is recorded as it genuinely
happens — nothing here is predicted or simulated. The log is a full list
surface: a search field with the anchored pattern builder, multi-select with an
honestly scoped select-all (*the N currently shown* vs. *all N, search-hidden
ones included*), an inverse selection, bulk delete behind the destructive-
action confirmation gate, and export in every format the application supports,
with a preflight showing exactly what a lossy format cannot carry. The log is
bounded to a configurable entry count; when the oldest entries are dropped to
stay under that limit, the drop is reported rather than silent.

---

## Configuration

All under **Settings → Bot movement**:

| Setting | Default | What it does |
| --- | --- | --- |
| Arrive radius | 1.5 m | Horizontal distance (X/Z only) at which a walk counts as arrived |
| Follow distance | 3 m | Distance the bot tries to hold while following |
| Sprint while walking | off | Holds sprint for the duration of a walk or a follow |
| Jump when it stops progressing | on | Taps jump when a walk's measured distance stops shrinking |
| Stuck timeout | 6 s | Seconds without measurable progress before a walk stops itself |
| Walk timeout | 120 s | Total seconds a single walk may run before it stops itself regardless |
| Control tick | 100 ms | Milliseconds between re-aims while walking/following, and the read-out's refresh rate |
| Block ray distance | 64 m | Maximum metres passed to the block ray-trace (library default is 256 m) |
| Entity ray distance | 3.5 m | Maximum metres passed to the entity ray-trace (the library's own default) |
| Keyboard piloting | on | Lets W/A/S/D/Space/Shift/Ctrl drive the pad while it has focus |
| Show the route preview | on | Draws the top-down diagram; never changes how the bot moves |
| Trail length | 240 points | How many recent positions the preview keeps as the travelled trail |
| Movement log limit | 500 entries | How many log entries are kept before the oldest are dropped |

Every setting carries its own explanation and a provenance line stating
whether the current value is the compiled-in default or something the user
set, and every one of them is also reachable and live-editable from the
command palette (`Ctrl+Shift+F`).

---

## Failure modes

| Situation | What happens |
| --- | --- |
| No `mineflayer` session module in this build | Banner reads "no bot session module is present", lists every place searched; every control stays visible, disabled, with that reason |
| Session present, no bot connected | Banner reads "a bot session exists but no bot is connected"; controls disabled with "requires a connected bot" |
| `setControlState`/`clearControlStates` call throws | The control's local held-state is not trusted; the failure is written to the movement log with the real error text |
| `blockAtCursor` / `entityAtCursor` not implemented by the session | The relevant trace button disables with "this session does not expose the ray-trace route", never fires silently |
| A walk's target is unreachable in a straight line | The stuck timeout stops it and reports the metres remaining — it never retries silently or claims arrival |
| The bot disconnects mid-walk or mid-follow | Both stop themselves immediately and log the metres or the entity lost, rather than continuing to hold `forward` against nothing |
| The movement log exceeds its configured limit | The oldest entries are dropped and a notification states exactly how many |
| An export format cannot carry a field faithfully | The preflight names the exact field and reason before anything is written |

---

## Security considerations

- **No network access of any kind.** This feature only ever calls methods on
  the `MovementBotSession` object handed to it; it never makes an HTTP request,
  never touches `ctx.studio.http`, and registers no allow-rule.
- **No credentials pass through this surface.** Connection details belong to
  the `mineflayer` feature; this one only drives movement on an already-
  connected bot.
- **The movement log records positions, not secrets.** Nothing written to the
  log — detail text or position — is ever a password, token, or other
  credential; it is purely movement telemetry the bot itself reported.
- **Destructive log actions are gated.** Bulk-deleting log entries goes through
  the two-key destructive-action confirmation, naming the exact entries
  affected, before anything is removed.

---

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` — this feature's files compile clean.
- Manual: with no `mineflayer` session module present, confirm the banner names
  every place searched and every control stays visible and disabled.
- Manual: hold a directional control with the pointer, drag off the button
  before releasing, and confirm the read-out shows it released.
- Manual: hold a control with Space, then Tab away without releasing the key;
  confirm it releases.
- Manual: hold a control with the pad focused, Alt+Tab to another application,
  and confirm every control shows released on return.
- Manual: start a walk toward a wall; confirm it stops itself at the stuck
  timeout and reports the metres remaining rather than hanging forever.
- Manual: search the movement log, use "select all, including hidden", delete,
  and confirm the exact confirmed count is removed and the drop is recorded in
  local history.

---

## Suggested related articles

- [Why a held control always lets go](../../app/src/renderer/features/mineflayer-movement/docs.ts) — the in-app article `mineflayerMovement.holdRelease`, reachable from Help → Documentation inside the application.
- Bot connection and session (`features/mineflayer`) — publishes the session this feature drives.
- Bot chat (`features/mineflayer-chat`) — the sibling surface for chat, whisper and pattern-matched rules.
- Bot world query and entities (`features/mineflayer-world`) — nearby-entity detail, attack, and block interaction beyond ray-trace picking.
