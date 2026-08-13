# Version history

> The local, append-only version history: a browsing surface with an advanced date-range picker, an
> action filter built from the history itself, regex-capable text search, comparison, labels,
> restore, retention pruning and redacted export — plus the separately protected log of secret and
> display-name mutations.

## What it does

Every change the application records ends up in one local, append-only store: settings that were
written, records a feature created or deleted, restores, prunes and labels. `core/history.ts` owns
the plumbing — a git repository inside the application's own data directory, with a journal fallback
when `git` is not installed. This feature is the surface a person actually uses.

Two destinations ship:

| Tab | What it holds |
| --- | --- |
| **Version history** (`history.panel`) | Everything recorded, newest first, with the filters, comparison, restore, labels, prune and export. |
| **Protected mutation log** (`history.protected`) | Authenticator-entry and display-name mutations, behind that log's own credential. |

Restoring is a **new revision**, never a rewrite. An undo can be undone, and that undo undone in
turn, because nothing in the store is ever edited in place.

## How it works

### Loading and filtering

One pipeline runs on every change, and each stage narrows the one before it:

1. **Date range** is pushed down to the store as a query bound, together with a ceiling on how many
   entries may be read into the window at once.
2. **Text search** runs in the window over the id, the action, the source, the label and the
   serialized payload, using the search bar's own predicate so a regular expression works exactly as
   the pattern builder previewed it.
3. **Action counts** are computed from the result of stages 1 and 2, which is why each chip can show
   both how many entries match right now and how many exist in the loaded range.
4. **Action filter** narrows again, to whichever chips are active.

None of the three overrides another, and the summary line above the list names every filter that is
currently applied. When nothing matches, the empty state names the filters that excluded everything
and offers to clear them, rather than showing a bare box that reads as "nothing has ever happened".

### The date-range control

Two typed fields and an anchored calendar, kept in step in both directions:

- The calendar has a month jump, a year jump, previous/next month, range selection and named quick
  ranges (today, last 7/30/90 days, this month, last month, this year, every date).
- Typed dates are accepted in plain ISO **and** in this machine's own numeric order, which is read
  from `Intl.DateTimeFormat` rather than assumed. A date written with month names goes to the
  platform parser.
- A partial entry — somebody four characters into a date — is reported as "keep going". An
  unreadable one is reported as unreadable. **In both cases the typed characters stay exactly where
  they were.**
- A start after the end is reported plainly, because nothing can fall between them.
- The grid is keyboard-operable: arrows move a day, <kbd>PageUp</kbd>/<kbd>PageDown</kbd> move a
  month, <kbd>Home</kbd>/<kbd>End</kbd> move to the ends of the week.

### The list

Rows are windowed: only the rows near the viewport exist in the DOM, so a page of a thousand entries
scrolls without a thousand live controls being constructed. Row nodes are cached by entry id, so
scrolling away from a row and back does not discard a label being edited.

Each row carries the **real** label control rather than a printout of one, wired to the same code as
the bulk label action.

### Selection and bulk actions

- Click a checkbox to select; shift-click extends a range from the last one touched.
- With a checkbox focused, <kbd>Shift</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> extends the same range from
  the keyboard, and <kbd>Ctrl</kbd>+<kbd>A</kbd> selects every match.
- Select-all is offered twice and says which all it means: *the N on this page* and *all M matching
  entries*, with both numbers stated.
- Inverse selection, clear selection, export, export-and-open-in-editor, copy, label, clear labels,
  compare, restore and prune are all available in bulk. Each states the exact count first; the
  destructive ones go through the two-key confirmation gate.

### Comparison

The comparison walks both payloads together rather than diffing serialized text, so a nested change
is reported at the exact path it happened and a key that merely moved does not read as an edit. Each
row is labelled in words (`Added` / `Removed` / `Changed`) as well as by colour.

### Restore

An entry whose payload carries an earlier value — the shape a settings change records — can be put
back. The earlier value is applied, which is itself recorded, and a summary entry names which
entries the values came from. An entry that records what happened without keeping the value it
replaced says so, and its restore action is disabled with that reason attached.

If the current value already equals the earlier one, nothing changes and nothing is recorded.

### The protected mutation log

Adding, removing or modifying an authenticator entry, and creating, changing or resetting the
application's display name, each get their own entry, written **before** the operation reports
itself complete.

- **Its own credential.** A password or an authenticator code, stored in the operating system
  credential store. Nothing else in the application unlocks it and it unlocks nothing else. It
  starts locked on every launch whatever the unlock duration is set to. Five wrong attempts earn a
  thirty-second pause; each wrong attempt says how many remain and changes nothing.
- **No usable secret in an entry, ever.** The payload holds the kind, a redacted label, a summary, a
  one-way fingerprint and — when the credential store can hold a key — an AES-GCM encrypted body.
  Before encryption the metadata is scrubbed of any credential-shaped field name and of any value
  that looks like a pairing URI or a shared secret. The entry states how many fields were dropped
  and which.
- **A pairing is confirmed before it is stored.** One live code has to verify against a new
  authenticator secret before that secret becomes the credential, so a mistyped or mis-scanned
  pairing cannot lock somebody out of a thing they just set up.
- **Checking against the credential store** compares account keys only, never values, and reports
  drift rather than quietly writing down the entries it thinks should exist.

Sibling features record a mutation by dispatching an event and awaiting the collector:

```ts
const pending: Array<Promise<SecretMutationOutcome>> = [];
document.dispatchEvent(
  new CustomEvent('studio:secret-mutation', {
    detail: {
      kind: 'authenticator.added',
      target: 'GitHub (personal)',
      summary: 'Added the authenticator entry for GitHub (personal).',
      metadata: { account: 'totp.github.personal', issuer: 'GitHub', digits: 6 },
      pending
    }
  })
);
const outcomes = await Promise.all(pending); // check these; do not assume one arrived
```

`announceSecretMutation()` in `protected.ts` wraps that shape. The display name needs no
coordination at all: this feature watches that setting itself.

## Key files

| Path | What lives there |
| --- | --- |
| `app/src/renderer/features/history/index.ts` | The feature module: tabs, settings, palette entries, documentation, startup prune. |
| `app/src/renderer/features/history/panel.ts` | The version-history surface: filters, windowed list, bulk actions, restore, prune, export. |
| `app/src/renderer/features/history/daterange.ts` | The advanced date-range control and its typed-date parser. |
| `app/src/renderer/features/history/managerpanel.ts` | The protected log surface and the credential wizard. |
| `app/src/renderer/features/history/protected.ts` | Recording, scrubbing, encryption, the log's own credential, vault drift check. |
| `app/src/renderer/features/history/store.ts` | Labels and panel state, in a sidecar file beside the history. |
| `app/src/renderer/features/history/diff.ts` | The structural payload comparison. |
| `app/src/renderer/features/history/state.ts` | Shared state, setting ids, the honest record helper, export redaction. |
| `app/src/renderer/features/history/strings.ts` | Every string, English and Cantonese, at all five humour levels. |
| `app/src/renderer/features/history/styles.css` | Material Design 3 styling, entirely from tokens. |

## Configuration

Every setting is in **Settings → Version history**, carries its own explanation behind progressive
disclosure and a provenance line naming the real value in use, and is reachable from the command
palette with its live control rendered inline.

| Setting | Default | What it does |
| --- | --- | --- |
| `history.retentionDays` | `365` | The retention window used by the prune action and by the startup prune. |
| `history.autoPruneAtStartup` | `false` | Runs one prune at launch, using that window, reporting the exact number removed. Off by default because a deletion nobody reviewed is a deletion nobody reviewed. |
| `history.pageSize` | `200` | Entries per page. Select-all names this number, so its scope is never ambiguous. |
| `history.maxLoad` | `5000` | Ceiling on entries read into the window at once. When it is reached the panel says so. |
| `history.redactExports` | `true` | Replaces credential-shaped field values with a marker on the way out, and states how many. |
| `history.exportFormat` | `json` | The format the export dialog opens on; every other format stays available there. |
| `history.protected.unlockMinutes` | `15` | How long an unlock of the protected log lasts. It always starts locked at launch. |
| `history.protected.setCredential` | — | Opens the credential wizard for the protected log. |
| `history.protected.removeCredential` | — | Deletes the stored verifier, behind the confirmation gate. The entries are untouched. |

Labels and the filter panel's expanded state live in `history-annotations.json` in the application
data directory, not in the settings file. Putting labels in settings would make every label edit
produce a second, generic entry in the very list it is annotating.

## Usage

- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> → *Open the version history*, *Search the version
  history*, *Filter the history by date*, *Export the version history*, *Prune the version history*,
  *Open the protected mutation log*, *Protected log credential*.
- Right-click a row for details, comparison with the previous entry from the same source, restore,
  copy, export and the per-element appearance editor. Menu items show the shortcut that genuinely
  works in that context.
- Every search field on both surfaces carries the anchored pattern builder; plain text is the
  default and a regular expression is an explicit opt-in.

## Failure modes

| Situation | What happens |
| --- | --- |
| `git` is not installed | The store appends to a journal in the same folder. The status card names the backend and the reason. |
| A commit fails | Entries are still appended; the status card says they are being kept but not committed. |
| The history cannot be read | The panel states the exact reason and offers to open the folder or try again, rather than rendering an empty list. |
| The label file cannot be written | The label applies in this window; the panel names the path and the failure so nobody expects it to survive a restart. |
| The label file is corrupt | Labels start empty in this window, the reason is stated, and the entries themselves are unaffected. |
| The credential store cannot hold a key | Protected mutations are still recorded, with the encrypted body omitted and the exact reason on the entry. |
| A protected mutation cannot be written | The caller is told it failed and a notification names the reason. The user's own operation is never failed by a history write. |
| Prune fails | Nothing is removed and the reason is reported. |
| No editor is installed | Export-and-open writes the file and says the editor could not be found, naming the file it wrote. |

## Security considerations

- **Local only.** No network request is made by any part of this feature. The store has no remote
  and nothing is ever pushed.
- **Two redaction passes.** Values under credential-shaped keys are replaced by the store before an
  entry reaches disk, and replaced again on the way into an export, which states how many.
- **Nothing usable in the protected log.** Secrets, codes, passwords, PINs and pairing URIs are
  dropped by name and by shape before anything is encrypted; the encrypted body holds metadata only,
  and its key lives in the operating system credential store rather than in any file this feature
  writes.
- **The protected log's export is always redacted**, including the encrypted body, so an export
  cannot carry it off the machine.
- **The toy-lock honesty rule applies.** The protected log's credential is a user-experience lock,
  not an encryption boundary for the entries: deleting the application data folder resets it, and the
  unlock prompt says so with the exact path.
- **The personal vocabulary cache is never recorded**, by the store's own rule.

## Verification

1. Change a setting. An entry appears naming the setting and the values on both sides.
2. Restore it from the row menu. The value returns; a new entry appears; the original entry is still
   there, unedited. Restore the restore — it goes back again.
3. Type `2026-13-40` into a date field. The message says it cannot be read and **the text stays**.
   Type `2026-08` — the message says to keep going, and the text still stays.
4. Pick a day in the calendar. The field it belongs to updates; the other field is untouched.
5. Turn on a filter that excludes everything. The message names the filters rather than showing an
   empty box.
6. Select two entries and compare. The changed fields are listed by path, labelled in words.
7. Shift-click a range, then <kbd>Ctrl</kbd>+<kbd>A</kbd>. The bulk bar states both the page count
   and the match count on its two select-all controls.
8. Export as CSV with nested payloads. The dialog states, before writing, which fields the format
   cannot carry faithfully and how many values redaction replaced.
9. Prune. The count of candidates is shown first, the two-key gate runs, the removal is recorded and
   the exact number removed is reported.
10. Open the protected log with no credential set. It says so plainly rather than pretending to
    protect something.
11. Set a password, then reopen the application. The log is locked again.
12. Pair an authenticator and type a wrong confirmation code. The pairing is **not** stored and the
    log is unchanged.
13. Rename the application display name. An entry appears in the protected log; the previous and new
    names are inside the encrypted body and nowhere in the clear.

## Language modes, humour and School mode

All copy on both surfaces goes through the shared catalogue, so it renders in English, in playful
Hong Kong Cantonese, or bilingually, at whichever humour level each language is set to. Humour
styles the voice and never the facts: at level 5 a prune warning still names the exact cutoff, the
exact number of entries and exactly what cannot be undone.

This feature exposes **no** Cantonese-only, bilingual-only, humour, personal-vocabulary or dim-sum
capability of its own — it has no control that would have to disappear — so School mode changes only
how its copy reads, through the shared catalogue, exactly as it does everywhere else. There is
nothing here for that mode to omit.

## Gotchas and limitations

- The store prunes by **age**, so the bulk prune action is honestly named: it removes everything
  older than the oldest entry selected, rather than removing the selected entries themselves. There
  is no id-based deletion in the privileged bridge, and inventing one in the renderer is not
  possible.
- `maxLoad` bounds how much of a very long history reaches the window at once. When it is hit the
  panel says so and asks for a narrower date range rather than quietly showing less.
- The vault drift check can compare account keys only. A modified authenticator entry that keeps the
  same account key is invisible to it, which is why the recording contract asks emitters to announce
  the modification rather than relying on reconciliation.

## Suggested related articles

- [Locks](locks.md) — the per-element toy locks and Support Tickets, which the protected log is
  deliberately *not* built on: it has its own credential, and no lock elsewhere opens it.
- [Settings](settings.md) — where every history setting lives, and how provenance is reported.
- [App identity](app-identity.md) — the user-renamable display name whose every change this feature
  records.
- [School mode](school-mode.md) — what a surface must omit rather than disable while that mode is on.
- [Notification centre](notification-centre.md) — where this feature's honest failure reports land.
