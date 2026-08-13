# Toy locks

> Any rendered element, tab, setting or appearance value in the desktop application can be put behind a password or a one-time code, each lock carrying its own independently managed credential. It is a self-imposed speed bump and every surface says so: not security, not encryption, and no protection at all from anybody else who can use the same computer.

Owned by `app/src/renderer/features/locks/`. The lock service itself lives in the core
(`app/src/renderer/core/locks.ts`) because a locked tab has to be refused by the tab strip and a
locked setting by the command palette before any feature has loaded; this feature owns everything
around it — the enumerable list, the anchored picker, the queue that gives each chosen thing its own
credential, the guard that makes element and appearance locks genuinely refuse something, the
settings, and the recovery route that names the actual folder.

## What it does

### Creating a lock

Two routes, both keyboard-reachable:

- **From the element itself.** Right-click any element (or press <kbd>Shift</kbd>+<kbd>F10</kbd> /
  the context-menu key with it focused) and choose **Lock this element…**. A non-modal wizard opens
  anchored beside that exact element, names the exact target, offers a password or a one-time code,
  creates that element's own credential, asks for the unlock duration, states the for-fun disclosure
  and the recovery route, and returns focus to the element on completion or cancellation.
- **From the Locks destination.** **Lock something…** opens an anchored picker listing four kinds of
  target — tabs, settings, elements currently on screen, and appearance values — each searchable
  through the standard search bar with its own anchored regular-expression builder. Selecting several
  and continuing opens a queue.

### One credential each, including in bulk

There is no master credential and no inheritance. Unlocking one surface never unlocks another.
Locking a group does not relock its members under the group's credential. A locked appearance value
inside a locked tab is two locks with two answers.

The bulk route therefore does **not** ask for one credential and reuse it. It opens a queue with one
row per chosen target and one wizard per row, so each lock is created separately with its own
credential. A user who wants one password everywhere gets there by deliberately typing the same one
into each wizard — a decision, never a default. Progress is read back from the stored records, so a
wizard that was cancelled shows as still unlocked rather than being counted as done.

### The list

The **Locks** destination is a real list, not a log:

- **Search** with plain text by default and regular expressions as an explicit opt-in, through the
  shared search bar and its anchored builder.
- **Per row:** what it covers in words, which credential method unlocks it, how long an unlock lasts,
  when it was created, and which part of the application actually enforces it. Live actions on the
  row itself: unlock, replace this credential, go to what it locks, copy the target, remove it.
- **Multi-select** with click, <kbd>Shift</kbd>+click ranges, <kbd>Space</kbd> and
  <kbd>Shift</kbd>+<kbd>Space</kbd> from the keyboard, and roving arrow-key navigation.
- **Honestly scoped select-all:** *Select the N on this page* and *Select every one of the N matches*
  are separate actions that name their own counts, alongside invert and clear.
- **Bulk removal** states the exact count, lists every affected lock, and then goes through the
  two-key destructive-action gate. Failures are reported per item rather than folded into a success.
- **Export** in every format the shared exporter carries, with a preflight warning for any field the
  chosen format cannot represent. No credential is in the file, and one row of the export says so.

### What enforces a lock

| Locked thing | What refuses, and where |
| --- | --- |
| A tab (`core.settings`) | `core/tabs.ts` asks for the credential before opening it |
| A setting (`language.mode`) | The command palette row and this feature's guard on the settings row |
| An element selector (`[data-appearance-id="chrome:titlebar"]`) | This feature's guard, on click, double-click, <kbd>Enter</kbd> and <kbd>Space</kbd> |
| An appearance value (`appearance:.md-btn\|border-radius`) | This feature's guard restores the value if it changes while locked |

A target nothing in this build enforces is still listed, labelled *record only*. It is never hidden:
a lock nobody can see is a lock nobody can remove.

### Marking

Every element a lock covers is marked with a padlock and a screen-reader description, so a blocked
control reads as *locked* rather than as *broken*. The marker is a setting, on by default.

## Configuration

All ids live under `locks.` in the settings file. Each carries its explanation behind progressive
disclosure and the truthful provenance line naming the real shipped value.

| Setting id | Kind | Ships as | What it does |
| --- | --- | --- | --- |
| `locks.badge` | switch | `true` | Marks every element a lock covers with a padlock and an accessible description. |
| `locks.relockOnBlur` | switch | `false` | Relocks everything currently unlocked when the window loses focus. |
| `locks.idleMinutes` | slider, 0–120 | `0` (off) | Relocks everything after that many minutes with no pointer or keyboard activity in the window. |
| `locks.recovery` | custom | — | Names the application data folder, opens it, and copies its path. |
| `locks.relockNow` | action | — | Clears every unlock immediately, whatever duration it was given. |
| `locks.manage` | action | — | Opens the Locks destination. |

Stored lock records live under `locks.records`, written by the core lock service. This feature reads
them and never writes that key.

Unlock durations are per lock and chosen in the wizard: *this surface only*, a number of minutes, or
*until the application closes*. Unlock state is held in memory only, so a restart always starts
locked.

## Failure modes

| Situation | What happens |
| --- | --- |
| Wrong password or code | The prompt says it did not match, names the recovery route, and does nothing else. Nothing is wiped and nothing escalates. |
| Five wrong answers in a row | The prompt pauses for ten seconds, then accepts attempts again. |
| The credential vault is unavailable when creating a lock | The wizard says the credential could not be stored, and **no lock is created**. A lock without a credential would be unopenable. |
| The stored credential cannot be read when unlocking | The prompt says so and names the folder that resets every lock. |
| A one-time code was mis-scanned | The wizard requires a current code before the lock is created, so a mis-paired secret cannot lock anything. |
| A stored selector no longer compiles | The guard skips it rather than throwing on every click, and the row still lists and removes normally. |
| A selector broad enough to block most of the window | Overlays, menus, dialogs, the palette, toasts and the Locks destination are never blocked, so the unlock prompt and the removal route both stay reachable. |
| An appearance value is changed while locked | It is put straight back and a notification names the property, the selector and the restored value. |
| Locked out entirely | Delete the application data folder. The path is shown in the Locks destination, in the setting, and in the unlock prompt. |

## Security considerations

**This is not a security boundary and must never be described as one.** It is a user-experience lock
in exactly the sense the study mode is, and the copy says so at every humour level and in every
language mode.

- Credentials live in the operating system credential vault under a per-lock account key. A password
  is stored as a verifier, never as the password. A one-time code is standard TOTP (RFC 6238) against
  a secret the **user** supplies through their own authenticator, checked with a small clock-skew
  window; the application never mails, texts or invents a code.
- No credential — and nothing that could stand in for one, such as a hash, a length or a hint —
  enters the settings file, a preset, an export, a history entry, a screenshot, a log or telemetry.
  The exported list carries an explicit row saying so.
- Lock *configuration* changes are recorded in local history: created, removed, removed in bulk. The
  credential is never in the payload.
- Deleting the application data folder removes every lock. That is documented rather than hidden,
  because a lock that pretends to be protection is worse than one that is honest about being a speed
  bump.
- Nothing in this feature makes a network request.

## Verification

- **Create:** lock a tab, a setting, an element and an appearance value. Each asks separately for its
  own credential.
- **Independence:** unlock one and confirm the others stay locked.
- **Password:** wrong answer reports honestly and changes nothing; right answer unlocks for exactly
  the stored duration.
- **One-time code:** a wrong confirmation code refuses to create the lock; a correct one creates it; a
  code from the previous or next window is accepted, one further out is not.
- **Duration:** *this surface only*, a minute count and *until the application closes* each behave as
  labelled; a restart starts locked in every case.
- **Element guard:** a locked selector refuses click, double-click, <kbd>Enter</kbd> and
  <kbd>Space</kbd>, and does not refuse the unlock prompt, the palette, a menu, a dialog or the Locks
  destination.
- **Appearance guard:** change a locked property from the appearance editor and confirm it returns
  with a notification naming the restored value; unlock, change it, and confirm the new value sticks
  and becomes the remembered one.
- **Search:** plain text and a regular expression both filter the list; an invalid pattern reports its
  error and matches nothing rather than silently hiding every row.
- **Bulk:** shift-range selection, both select-all scopes, invert, clear, and a removal that shows the
  exact count and every affected row before the destructive gate.
- **Export:** every format; the credential row is present and no credential is in the file.
- **Recovery:** the folder named in the setting, in the list and in the unlock prompt is the same
  folder the button opens.
- **Language:** all three modes and both funny levels at 1 and 5 — the disclosure still names the
  folder, the target and the fact that this protects nothing.
- **Accessibility:** keyboard-only creation, selection and removal; visible focus throughout; the
  padlock marker exposed as a description rather than as text inside the control's name.
- **Layout:** narrow widths and 100/125/150/200% display scale with the longest bilingual strings; the
  list scrolls inside its own container and the page never scrolls sideways.

## Known gaps

- **Bulk closes do not exclude locked tabs.** `core/tabs.ts` excludes pinned tabs from *Close tabs
  containing text* and its inverse, but not locked ones. The exclusion belongs in that shared
  predicate rather than in this feature, so it is recorded here rather than worked around.
- **Relocking is all-or-nothing.** The lock service exposes `lockAll()` and no per-target relock, so
  the *Lock again* action says plainly that it relocks every unlocked surface rather than only the
  selection.
- **Replacing a credential replaces the whole lock.** Re-running the wizard for an existing target
  stores a new credential and a new duration for that one lock; there is no route that changes the
  duration alone, and the surface says so before it opens.

## Suggested articles

- [Accessibility & themes](accessibility-themes.md) — the theming and accessibility surfaces the
  appearance values in this article belong to.
- [Desktop manager](desktop-manager.md) — the surrounding application: tabs, settings, palette and
  notifications, each of which a lock can cover.
- In-application: **Toy locks**, **Locking an appearance value** and **Getting back in**, bundled into
  the build and readable offline from the Documentation destination.
