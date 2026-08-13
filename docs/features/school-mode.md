# Shared study mode

> One switch, shared by every application in the suite through a single JSON record in a shared
> application-data folder. Turning it on forces English and makes the Cantonese mode, the bilingual
> mode, both humour levels, the personal-vocabulary file and every dim-sum capability behave as
> though they were not installed. Turning it off asks for a code held in the operating system's
> credential vault. It is a user-experience lock, not a security boundary, and the surface says so.

- **Module** — `app/src/renderer/features/school-mode/`
- **Feature id** — `school-mode`
- **Inventory row** — 1.5 (language, voice and text)
- **Tab** — `school-mode.main`, titled with the user's chosen name
- **Settings section** — `school-mode.settings`, order 120

## What it does

The mode is not a per-application setting that happens to carry the same name in several
applications. It is a single switch, and the authority for its value is a file on disk that every
application in the suite reads and writes:

```
<shared application-data folder>/school-mode.json
```

The shared folder is derived as a sibling of each application's own data directory — the parent of
`userDataDir`, plus `shared-app-settings` — so every application in the suite lands on the same
place without any of them having to know about the others. A user whose applications share a
different location can point the feature at it with the **Shared record folder** setting.

While the mode is on:

| Capability | What happens |
| --- | --- |
| Cantonese language mode | Removed from every surface, not merely disabled |
| Bilingual language mode | Removed from every surface, not merely disabled |
| Humour levels (both languages) | Removed; every message renders at level 1, in English |
| Personal-vocabulary file | Removed; replacements stop applying and the cache is untouched |
| Dim sum surprise | Suppressed at startup |

Every stored choice behind those capabilities is kept exactly as it was and returns the moment the
mode goes off. The mode's own control always stays discoverable — a lock whose control disappears is
a lock with no route out of it.

## The record

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "name": "Study mode",
  "credentialMethod": "password",
  "updatedAt": "2026-08-13T09:41:02.517Z",
  "updatedBy": "world-downloader-studio"
}
```

`credentialMethod` names which *kind* of unlock code exists (`none`, `password` or `totp`). No part
of the code itself, and nothing from which its length or shape could be inferred, is ever written
into the record.

Validation is bounded and fails closed. The reader refuses anything over 64 KiB, anything that is
not a JSON object, a schema version other than 1, a non-boolean `enabled`, a `name` that is empty,
longer than 60 characters or carrying a control character, a `credentialMethod` outside the three
permitted values, and an `updatedAt` that is not a parseable ISO-8601 timestamp. A refused record is
refused **whole**: nothing from it is applied, and the exact reason is shown beside the exact path.

## How the change arrives live

The privileged bridge exposes no filesystem watcher, so the record is polled:

- every **N** seconds, where N is the user's own setting (default 2, range 1–60), and
- immediately whenever the window regains focus or becomes visible again.

Each quiet cycle costs one `stat`; the file is only read and parsed when its modification time or
size actually moved. When the content genuinely changed, the mirror in this application's settings
file is updated, the language machinery is told, and the interface repaints in place — no restart,
and no reopening of anything.

The control states the interval in words rather than implying something instant, and if the watch
cannot be established at all it says so and names the reason.

### Why there is a mirror at all

The language machinery reads the mode synchronously while it renders, so it cannot wait on a
filesystem round trip. This feature therefore keeps a mirror of the state and the name in the
application's own settings file, and the direction of travel is always the same: the record is read,
and the mirror follows. Every route that changes the mode writes the record first and then lets the
same code that handles another application's change handle its own — which is what makes a change
made anywhere arrive everywhere, and why the mirror cannot quietly disagree with the record.

The state control says this in as many words, so the generic provenance line beneath it — which
describes the local mirror — is not mistaken for a claim about the authority.

### The guard

The shipped language settings carry their own switch for this mode and know nothing about the unlock
code. Turning the mode off there would otherwise walk straight past the code the user set, so this
feature watches the mirror: a value turned off without the code is put straight back, and the unlock
prompt opens instead — which is what the user was trying to do anyway.

## Renaming

The mode is the user's to name, and the name travels in the shared record with the state, so
renaming it in one application renames it in all of them. Names are 1–60 characters with no control
characters; a rejected name changes nothing and says why.

Once a name has been chosen, **no surface prints the shipped name**. This is enforced structurally
rather than by discipline: the settings surface resolves a control label with no interpolation
values, so a `{name}` placeholder would render as literal braces. The name-bearing copy is therefore
built at runtime and re-registered whenever the name changes, in either application. The route back
to the original name is a button whose label does not name it.

## Turning it off

The unlock prompt is anchored beside the control that was operated, returns focus there on every
exit, and states the recovery route the whole time it is open.

- **Password or PIN** — stored as a PBKDF2-SHA-256 verifier (210,000 iterations, 16-byte random
  salt) under the vault account `school.unlock`. The code itself is never written down, and nothing
  in the application displays, hints at, or characterises a stored code.
- **Authenticator** — a standard RFC 6238 TOTP secret (SHA-1, 6 digits, 30-second period) under the
  vault account `school.unlock.totp`. Pairing draws its QR **in this process** from the local secret
  — a remote QR service would receive the secret on its way to being rendered — shows the secret as
  copyable text as well, because a QR is useless to somebody who cannot see it and useless again to
  somebody pairing on the very device displaying it, and stores nothing until a current code proves
  the pairing worked.

Setting one method clears the other, so exactly one code is ever in effect.

Wrong answers are paced, not punished: three attempts, then a wait that doubles from five seconds
and is capped at a minute, held in memory for the life of the window so that closing and reopening
the prompt does not reset it. Nothing is ever wiped, nothing escalates, and the recovery line is
visible throughout.

If no code was ever set, the prompt says so plainly and offers the switch itself rather than
pretending to ask for something that does not exist. Turning the mode **on** without a code first
asks for confirmation, naming the folder that resets it, and offers to set a code instead.

## Security considerations

- **This is a user-experience lock, not a security boundary.** It is not encryption, it protects
  nothing from anybody else using the computer, and anyone who can reach the disk can undo it.
  Deleting the shared record folder resets the mode completely. The surface names that folder rather
  than hiding it.
- **Credential material never leaves the vault.** Neither the verifier nor the TOTP secret appears in
  the settings file, the shared record, an export, the local version history, a log line, a
  notification or a screenshot. The version-history payload records the state, the chosen name and
  the credential *method* only.
- **A password is verified against a stored hash, never against a stored password.**
- **The record is not a trust boundary either.** It is validated as untrusted input on every read:
  bounded in size, strictly typed, refused whole on any failure.
- **No network.** Nothing in this feature makes an HTTP request, loads a remote font or reaches a
  CDN. The QR, the TOTP arithmetic and the PBKDF2 derivation all run locally.

## Failure modes

| Situation | What the user sees, and what happens |
| --- | --- |
| No record exists yet | Stated with the exact path; this application creates it at startup, or on the first change |
| Record unreadable (permissions, a locked file) | The exact error and path; the application says it is showing its own local copy only |
| Record malformed, truncated or a newer schema | Refused whole with the exact reason; nothing from it is applied |
| Folder cannot be written | The change stays local to this application and is reported as such, never claimed as shared |
| Watch cannot be started | Stated with the reason; a manual **Re-read the shared record now** action remains |
| Credential vault unavailable | The set-code buttons are disabled and name that exact unmet condition |
| Code forgotten | The recovery route — deleting the named folder — is on the prompt, the setting and this page |

The bridge offers no atomic rename, so a write interrupted at exactly the wrong moment can leave a
short file. That is precisely the case the whole-record refusal covers, and the next successful write
repairs it.

## Surfaces

- **Tab** (`school-mode.main`) — state, the shared record's status, renaming, unlocking, the capability
  list and the activity list.
- **Settings section** (`school-mode.settings`) — the same state, name and credential panels, built by the
  same code, plus the shared-folder path, the watch interval and two actions.
- **Command palette** — the destination, a toggle command, a re-read command, an open-the-folder
  command, a set-the-code command and the documentation article. Every setting this feature
  registers already reaches the palette as a live inline control through the registry, so they are
  not listed twice.
- **Lists** — the capability list and the activity list both carry the full bulk contract:
  multi-select with shift-click ranges and a keyboard equivalent, a select-all that says whether it
  means this page or every match, an inverse selection, a reviewable preview with the exact count
  before anything runs, honest reporting of exclusions, and export in every format the exporter
  offers. Pruning history goes through the two-key destructive gate.

## Accessibility

Every control is keyboard reachable with a visible focus ring; list rows use roving tabindex along
the vertical axis, with <kbd>Space</kbd> and <kbd>Enter</kbd> toggling and <kbd>Shift</kbd> extending
a range. The unlock prompt, the pairing editor and every preview trap focus and return it to their
anchor on close. State changes are announced on the shared live region. The QR carries a real text
alternative naming what it pairs and its parameters. Rows are at least 48 CSS pixels tall at every
density, paths scroll inside their own container rather than widening the page, and the layout has
been written for the longest bilingual strings at narrow widths and high display scales.

## Verification

1. **Live propagation.** Open the tab, edit `school-mode.json` in a text editor, and watch the state
   follow within the configured interval without touching the application.
2. **Suppression.** Turn the mode on and confirm the Cantonese and bilingual choices, both humour
   sliders and the vocabulary control are *gone* from the language settings rather than greyed out,
   and that the startup surprise does not appear.
3. **Restoration.** Turn it off and confirm every previous choice returns exactly as it was.
4. **Rename.** Rename the mode and confirm the new name appears in the tab, the settings section, the
   palette and the notifications, and that the shipped name appears nowhere.
5. **Unlock.** Set a password, turn the mode on, try a wrong code three times and confirm the pace
   begins; then unlock with the right one.
6. **The guard.** With a code set, turn the mode off from the shipped language settings switch and
   confirm the value goes back and the unlock prompt opens instead.
7. **Pairing.** Pair an authenticator, confirm the code it shows is accepted, and confirm a wrong
   code stores nothing.
8. **Recovery.** Delete the shared record folder and confirm the mode resets.
9. **Refusal.** Write `{"schemaVersion": 99}` into the record and confirm it is refused whole with the
   exact reason and that the previous state is untouched.
10. **Bulk actions.** Select rows across two pages of the activity list, use both select-all scopes,
    invert, export in more than one format and confirm the preview count matches what is written.

## Suggested articles

- [Language modes and humour levels](language.md) — what this mode removes and restores
- [Toy locks](locks.md) — the same honesty about a lock that exists for fun
- [Local version history](history.md) — where this feature's activity entries are recorded
- [Personal vocabulary](vocabulary.md) — one of the capabilities the mode removes
