import type { DocArticle } from '../../core/registry';

/**
 * The in-application documentation for this feature.
 *
 * These are the same articles as `docs/features/history.md` in the repository,
 * bundled into the build so they are readable with no network at all.
 */

export const HISTORY_DOCS: DocArticle[] = [
  {
    id: 'history.panel',
    title: 'The version history panel',
    category: 'Data and history',
    related: ['history.protected', 'core.history', 'core.export', 'core.regex'],
    body: `# The version history panel

Every recorded change is here, newest first: settings the application wrote, records a
feature created or deleted, restores, prunes and labels. The panel reads the same
append-only store the rest of the application writes to — it does not keep a second copy.

## What an entry is

An entry has an id, a timestamp, the action in words, the feature or core module that
recorded it, and a redacted payload. The action says **what** changed rather than that
something did: "Changed the language mode", never "Updated". An unchanged state records
nothing at all, so the list stays a list of real events.

## Filtering

Three filters apply **together**, and none of them overrides another.

- **Date range.** Two typed fields and an anchored calendar with month and year jumps,
  range selection and named quick ranges. Typing and the calendar stay in step in both
  directions, and a partial or unreadable entry is reported beneath the field without
  clearing what you typed.
- **Action.** Chips built from the actions the history *actually holds*, never a
  hard-coded list. Each chip shows how many entries match under the other filters and how
  many exist in the loaded range, so an action with no current matches is visibly empty
  rather than missing. More than one chip can be active at once.
- **Text.** A search bar with the anchored pattern builder, matching over the id, the
  action, the source, the label and the serialized payload. Plain text is the default and
  a regular expression is an explicit opt-in.

When nothing matches, the message names exactly which filters excluded everything, and
offers to clear them.

## Selection and bulk actions

Every list in this application carries bulk actions, and "select all" here says which all
it means: one control selects the stated number on the current page, another selects the
stated number of matching entries across every page.

- Click a checkbox to select; shift-click to extend a range from the last one you touched.
- With a checkbox focused, <kbd>Shift</kbd> plus <kbd>↑</kbd> or <kbd>↓</kbd> extends the
  same range from the keyboard, and <kbd>Ctrl</kbd>+<kbd>A</kbd> selects every match.
- The bar offers export, export-and-open-in-editor, copy, label, clear labels, compare,
  restore and prune. Each states the exact count before it acts, and the destructive ones
  go through the two-key confirmation gate.

## Labels

The label box in a row is the real control, wired to the same code as the bulk label
action. Write what changed rather than that something did. Labels live beside the history
in the application data folder rather than in the settings file, so editing one does not
produce a second, generic entry in the very list it is annotating. If the label file
cannot be written the panel says so and names the path and the reason, instead of showing
a success it cannot deliver.

## Restoring

Restoring is a **new revision**, never a rewrite. An entry that carries an earlier value —
the shape a settings change records — can be put back; the panel applies the earlier
value, which is itself recorded, so the restore can be restored in turn and that one after
it. An entry that records what happened without keeping the value it replaced says exactly
that, and its restore action is disabled with the reason attached rather than silently
doing nothing.

If the current value already equals the earlier one, nothing is changed and nothing is
recorded.

## Comparing

Select exactly two entries and compare them, or compare one entry with the previous entry
from the same source. The comparison walks both payloads together and reports added,
removed and changed fields at the exact path they differ, rather than diffing two blobs of
text. Each row is labelled in words as well as colour.

## Pruning and retention

The retention window is a setting; the prune action uses it, and an optional startup prune
uses the same window. The bulk action prunes everything older than the oldest entry you
selected. Every prune shows the exact number of candidates first, goes through the
confirmation gate, and is itself recorded — but the entries it removed do not come back.

## Exporting

The export dialog states how many entries will be written, offers every format the
application can carry the data in, reports before writing which fields a chosen format
cannot carry faithfully, and reports how many values redaction replaced. The
export-and-open action writes the file and opens it in your editor; if no editor is found
on this machine it says so and still names the file it wrote.

## Failure modes

- **git is not installed.** The store falls back to an append-only journal in the same
  folder. The status card says which backend is in use, and names the reason.
- **A commit fails.** Entries are still appended; the status card reports that they are
  being kept but not committed.
- **The history cannot be read.** The panel says so with the exact reason and offers to
  open the folder or try again. It does not render an empty list that looks like "nothing
  has happened yet".
- **The label file cannot be written.** The label applies in this window and the panel
  names the path and the failure, so nobody expects it to survive a restart.

## Security considerations

The store is local. There is no remote, nothing is pushed, and no part of this panel makes
a network request. Values under credential-shaped keys are replaced before an entry
reaches disk, and replaced again on the way into an export. The personal vocabulary cache
is never recorded.

## Verification

- Change a setting; an entry appears naming the setting and the values on both sides.
- Restore it; the value returns and a new entry appears. Restore the restore; it goes back
  again. Nothing in the log is ever edited.
- Type \`2026-13-40\` into a date field: the message says it cannot be read and the text
  stays exactly where you left it.
- Pick a day in the calendar: the field updates to that day and the other field is
  untouched.
- Select two entries and compare: the changed fields are listed by path.
- Turn on a filter that excludes everything: the message names the filters rather than
  showing a bare empty box.
`
  },
  {
    id: 'history.protected',
    title: 'The protected mutation log',
    category: 'Data and history',
    related: ['history.panel', 'core.locks', 'core.history'],
    body: `# The protected mutation log

Adding, removing or modifying an authenticator entry, and creating, changing or resetting
the application's display name, each get their own entry — written **before** the
operation reports itself complete.

## Its own credential

This log has its own password or authenticator code. Nothing else in the application
unlocks it, and it unlocks nothing else: there is no master credential and no implicit
inheritance from a lock elsewhere. It starts locked on every launch whatever the unlock
duration is set to.

A wrong attempt says so, names how many attempts remain before a short wait, and changes
nothing. After five wrong attempts there is a thirty-second pause.

**If you forget it, delete the application data folder.** The unlock prompt names the exact
path. That resets this credential along with every other stored preference; the entries
themselves are not a secret and stay readable once the credential is gone.

## What is in an entry, and what is not

An entry carries the kind of mutation, a redacted human label, a summary in words, a
one-way fingerprint of the kind and label, and — when the credential store can hold an
encryption key — an AES-GCM encrypted body.

**No usable secret ever enters an entry.** Before anything is encrypted, the metadata is
scrubbed: any field whose name looks credential-shaped is dropped, and so is any value
that looks like a pairing URI or a shared secret, whatever it is called. The entry states
how many fields were dropped and their names, so the gap is visible rather than silent.
The encrypted body holds metadata only; the key lives in the operating system credential
store and never in a file this application writes.

## Fail-safe and visible

If the credential store cannot hold a key, the mutation is still recorded — with the body
omitted and the exact reason stated on the entry. If the history itself cannot be written,
the recorder reports the failure to whoever asked for it and raises a notification naming
the reason. It never reports a mutation as recorded when it is not on disk, and it never
fails the operation the user actually asked for: a history write that cannot happen is a
gap in the log, not a lost change.

## How a sibling feature records one

The recorder listens for a \`studio:secret-mutation\` event on \`document\`. The emitter
builds the detail with an empty \`pending\` array, dispatches it, then awaits that array
before reporting its own operation complete:

\`\`\`ts
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
const outcomes = await Promise.all(pending);
\`\`\`

Check the outcomes rather than assuming one arrived: if no recorder is installed the array
stays empty, and an emitter that assumes otherwise would report a mutation as logged when
nothing logged it. Never put a secret, a code or a pairing URI in \`metadata\` — the
scrubber drops them, and relying on the scrubber to catch a mistake is not the same as not
making it.

The display name needs no coordination: this feature watches that setting itself.

## Checking the log against the credential store

The verification action compares **account keys only**, never values. It reports accounts
the store holds that no entry mentions, and entries naming accounts the store no longer
holds. Drift is reported rather than quietly written down: a log that invents the entries
it thinks should exist is worse than one with a visible gap, because the gap can be
investigated and the invention cannot be told from the truth.

## Verification

- With no credential set, the log says so plainly rather than pretending to protect
  something.
- Set a password; the log locks. Reopen the application; it is locked again.
- Enter a wrong password; the count of remaining attempts falls and nothing changes.
- Pair an authenticator; the code you type back is checked *before* the pairing is stored,
  so a mistyped secret cannot lock you out of something you just set up.
- Rename the application display name; an entry appears here, with the previous and new
  names inside the encrypted body and neither of them anywhere in the clear.
- Reveal a snapshot: metadata only, and the note beside it says so.
`
  }
];
