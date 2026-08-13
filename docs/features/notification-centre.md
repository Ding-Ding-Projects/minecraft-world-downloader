# The notification centre

**Feature id:** `notification-centre`
**Module:** `app/src/renderer/features/notification-centre/`
**Inventory row:** 5.2 — *A notification centre keeping dismissed notifications reviewable, with the full bulk-action contract.*

A notification that appeared in the corner for four seconds and then vanished is a message
nobody can check. The centre is the durable other half of the notification service: every
notification the application has raised, including the ones already dismissed, kept as a
reviewable, searchable, filterable, exportable list that survives closing the window.

---

## Behaviour

### Where the centre appears

The centre renders into the shell's notifications destination. Rather than registering a
second tab beside the one the shell already owns, this module installs its implementation
into the notification service's own `mountCentre`, so the application has exactly one
notification centre instead of two tabs showing the same log. The shell's original
placeholder stays bound as a fallback: if this module's durable half ever fails to start,
the placeholder still renders rather than leaving an empty panel.

Every id the command palette teleports to lives on a real element inside the centre:

| Palette entry | Element | What it reveals |
| --- | --- | --- |
| Open the notification centre | `notification-centre-root` | The whole surface |
| Search notifications | `notification-centre-search` | The search field and its pattern builder |
| Filters | `notification-centre-filters` | The collapsible filter row |
| Statistics | `notification-centre-statistics` | The collapsible statistics panel |
| Notification centre (list) | `notification-centre-list` | The rows themselves |

### What a row holds

The exact timestamp and a readable relative one, the severity, the feature that raised it,
the title, the body, the recorded progress value where the notification carried one, any
link, and any actions.

An action is a **real, working button** for as long as the running session still holds its
callback. A callback is code rather than data, so it cannot be written to a file: a row
restored from an earlier session lists the action names it carried and says plainly that
they belonged to a session that has ended, instead of rendering a button that would do
nothing. A link is only data — a label and an `https` URL — so a link stays operable across
restarts and opens through the privileged bridge.

A body longer than 220 characters is shortened with a **Show the whole message** control
rather than truncated silently.

### Selection, and the full bulk-action contract

It is a list, so it carries what every list in this application carries.

- **Pointer:** click a row or its checkbox to toggle it; hold <kbd>Shift</kbd> and click to
  take the whole range from the last row you touched.
- **Keyboard:** <kbd>↑</kbd>/<kbd>↓</kbd> move between rows (roving tabindex),
  <kbd>Space</kbd> toggles the focused row, <kbd>Shift</kbd> with an arrow extends the range,
  <kbd>Ctrl</kbd>+<kbd>A</kbd> selects every match, <kbd>Escape</kbd> clears the selection,
  and <kbd>Delete</kbd> deletes what is selected through the confirmation gate.
- **Two select-alls that name their scope**, each carrying its live count in the label:
  *Select the N on this page* and *Select every match (M)*. Which one you pressed is never
  ambiguous.
- **Invert the selection**, computed across every match rather than only the visible page.
- **Bulk dismiss**, **bulk delete** and **bulk export**.

Before any bulk action, the collapsible **Records a bulk action would affect** panel lists
exactly what is selected — the title, the source, the timestamp and whether it is still on
screen — capped at 25 rows with an explicit "and N more" line. Deleting additionally goes
through the two-key destructive gate, which names the count, lists the records item by item
and states that the removal cannot be undone from inside the application.

### Nothing is skipped silently

Only a notification still on screen can be dismissed. Dismissing a selection that mixes live
and historical rows reports exactly how many were dismissed and how many were left alone,
rather than reporting a whole batch as changed. Where nothing in the selection was
dismissable, the result says that too, with the count.

A record whose session ended while it was still showing is labelled **Still showing when
that session ended**. It is never given a fabricated dismissal timestamp to make the data
look tidier than it is.

### Search and filters compose

The search bar is built through the shared `createSearchBar`, so it carries the anchored
pattern builder like every other search field in the application. Plain text is the default
and regular expressions are an explicit opt-in. It searches the resolved title, the title
key, the resolved body, the source, the severity name, the raw severity and both the ISO and
the localized timestamp.

Beside it sit filters for **severity** and for **source**, each chip carrying its live count,
plus a state filter for *All* / *Still showing* / *Dismissed*. Filters narrow the search
result rather than replacing it — the two always apply together — and a source that no longer
appears anywhere in the log stops filtering it automatically, so the list can never sit
mysteriously empty with no visible cause.

### Collapsible rows that stay honest

The filter row is collapsible and opens expanded by default. The statistics panel is
collapsible and starts **collapsed**, because it only describes the log rather than changing
it and must not push the list itself off the screen.

While the filter row is collapsed **and a filter or search is still excluding records**, its
header states how many of how many are hidden. A list quietly shorter than it should be is
exactly how somebody concludes their data has gone missing. The statistics panel never
carries such a note, because it never excludes anything.

### Statistics

Total stored, still showing, dismissed, raised this session, the newest and oldest
timestamps, proportional bars by severity and by source, and the retention ceiling currently
in force. Every figure is counted from the real log.

### Export honours the active filter

The export panel offers three scopes with their exact counts:

1. the current selection,
2. everything the current search and filters allow (**the default**), and
3. the whole stored log.

Every format the application's export service supports is offered, and the panel reports what
a chosen format cannot carry faithfully **before** anything is written. The exported record
carries both the ISO and the localized timestamp, the title key and the resolved title, the
link, and the action labels — with a plain statement that the action callbacks are not
exported, because a callback is code and not data.

### Paging

Each row carries live controls, so the centre renders a bounded page rather than several
thousand rows at once. The page size is a setting, and the pager is hidden when everything
fits on one page.

---

## Configuration

All of these live under **Notification centre** in settings, each with its progressive
disclosure explanation and its truthful default-provenance line, and each reachable from the
command palette with its real control rendered inline.

| Setting id | Kind | Default | What it does |
| --- | --- | --- | --- |
| `notificationCentre.persist` | switch | `true` | Writes the log to a file in the application data directory so it survives a restart. Turning it off only stops the writing; the file already on disk is left alone. |
| `notificationCentre.retention` | number | `500` (25–10000) | How many of the newest records are kept. A new arrival past the ceiling drops the oldest. |
| `notificationCentre.pageSize` | number | `50` (10–500) | How many rows the centre renders at once. |
| `notificationCentre.filtersExpanded` | switch | `true` | Whether the filter row opens expanded. |
| `notificationCentre.statisticsExpanded` | switch | `false` | Whether the statistics panel opens expanded. |
| `notificationCentre.exportFormat` | select | `json` | Which format the export panel opens on. |
| `notificationCentre.clear` | action | — | Deletes every stored record, behind the two-key gate. |
| `notificationCentre.reveal` | action | — | Opens the folder holding the log file. Nothing is deleted. |

### Where the log lives

`<userDataDir>/notification-centre/archive.json`, schema version 1, UTF-8. The directory is
derived from the package identity through `studio.info.userDataDir`, never from the display
name the user chose for the application, so renaming the application cannot orphan the log.

---

## Failure modes

Every one of these degrades to a state the surface reports out loud rather than to a silent
wrong answer.

| Condition | What happens |
| --- | --- |
| No file yet (first run) | Not an error. The log starts here, and the status line says the file has not been written yet this session. |
| The file cannot be read | The exact reason appears in the status line, styled as an error. This session's notifications are still listed. Nothing on disk is deleted or overwritten by a failed read. |
| The file is not valid JSON | Reported with the parser's own message. The file is left untouched. |
| The schema version is unknown | Reported, naming the version found and the version this build reads. The file is left untouched, so a downgrade cannot destroy a newer log. |
| The file exceeds 8 MiB | Not read. The ceiling and the actual size are reported. Nothing is deleted. |
| An individual record is malformed | That record is refused; the rest load. The count of refused records is reported in the status line. |
| A write fails | The exact reason replaces the "kept in …" line. The centre never claims a write that did not happen. |
| Persistence is switched off | The status line says so and states that these records end when the window does. |
| The clipboard refuses a copy | Reported as an error notification with the reason. |
| A link cannot be opened | Reported with the bridge's reason; the record is untouched. |
| An action callback throws | Caught and surfaced as an error notification naming the action, rather than breaking the centre. |
| The durable half fails to start | Logged, and the shell's placeholder centre remains available through the retained fallback. |

---

## Security considerations

- **No network, ever.** The centre reads and writes one local file through the privileged
  bridge and opens links through the platform browser. It makes no HTTP request, loads no
  remote font, script or image, and reports nothing anywhere.
- **The stored file is parsed defensively even though the application wrote it.** Bounded file
  size, a required schema version, and a checked shape per record — title, body, source and
  URL lengths all capped, timestamps validated as real dates, severity checked against the
  known set, progress clamped to 0–1. A corrupt file degrades to an empty log rather than to a
  broken window.
- **Only `http` and `https` links survive a round trip.** A stored link with any other scheme
  is dropped on load rather than offered as a button the bridge would refuse anyway.
- **The log holds what a notification already displayed on screen and nothing more.** It adds
  no new collection: no credentials, no vault contents, no personal-vocabulary data, no
  settings values. A feature that must not have something written to disk must not put it in a
  notification title in the first place.
- **Deletions are recorded, not the deleted content.** The local-history entry carries the
  count, the affected ids and the file path — never the record bodies — so the fact that a
  deletion happened survives the deletion without recreating what it removed.
- **The service wrapper restores what it found.** Wrapping `notify.show` to retain action
  callbacks keeps the original bound and restores it on disposal, so the wrapper can never be
  stacked twice on one method.

---

## Verification

### Behaviour to exercise by hand

1. Raise notifications of each severity, with and without actions and a link. Confirm each
   appears in the centre with the right severity, source and timestamp.
2. Dismiss one from its toast; confirm the row's state changes to dismissed with its time.
3. Press an action **from the centre** and confirm it runs the same code the toast would have.
4. Restart the application. Confirm earlier records are listed, marked *From an earlier
   session*, that a link still works, and that a row whose actions are gone says so instead of
   showing dead buttons.
5. Select rows by click, by shift-click range, and by keyboard (<kbd>Space</kbd>,
   <kbd>Shift</kbd>+arrow, <kbd>Ctrl</kbd>+<kbd>A</kbd>, <kbd>Escape</kbd>).
6. Press each select-all and confirm the count in the label matches what becomes selected.
7. Dismiss a mixed selection and confirm the result names both the dismissed and the skipped
   counts.
8. Delete a selection; confirm the gate lists the records, the deletion happens only after
   both keys and the slider, and the local-history entry appears.
9. Collapse the filter row with a filter active and confirm the header states how many records
   are hidden.
10. Export at each scope and in several formats; confirm the preflight reports losses before
    the file is written and the file matches the scope chosen.
11. Corrupt `archive.json` deliberately and restart; confirm the status line reports it and
    the session still lists its own notifications.

### States a capture matrix should cover

Empty log · records of every severity · a selection with the preview panel open · the filter
row collapsed while excluding records · the statistics panel expanded · the export panel with
its preflight losses · the destructive gate mid-confirmation · a read failure reported in the
status line · narrow width · light and dark, at 100% and 200% display scale.

### Accessibility

Rows are reachable by roving tabindex with a visible focus ring and an accessible name that
opens with the severity. The severity icon is decorative rather than named, so a screen reader
does not read the severity twice. A control that cannot act keeps `aria-disabled` and its
reason in `title` and `aria-description` instead of becoming an unreachable rectangle.
Selection changes, filter resets and page changes announce on the shared live region. Touch
targets hold at 44 CSS pixels, the layout reflows to a single column below 720 px, and the
chevron transition is disabled under `prefers-reduced-motion`.

### Localization

Every string resolves through the catalogue in `strings.ts`, in English and in playful Hong
Kong Cantonese, at all five humour levels for each language independently. The humour styles
the voice only: counts, timestamps, sources, file paths, severity names and the destructive
gate's statement of what cannot be undone are interpolated values or fixed facts and never
move. Dynamic text — a live count, a feature id, a format token — is written onto the node
directly rather than handed to the translator as though it were a key.

### School mode

This feature exposes no Cantonese-only, humour-only, personal-vocabulary or dim-sum
capability of its own, so it has nothing to omit while the study mode is on. Its copy follows
whatever the mode forces, exactly like the rest of the application.

---

## Suggested articles

- **Exporting anything** (`core.export`) — the formats, the headers and the preflight the
  export panel uses.
- **Local version history** (`core.history`) — where deletions and dismissals are recorded,
  and how an undo can itself be undone.
- **The pattern builder** — the anchored regex builder the centre's search field carries.
- **Non-blocking notifications** — the toasts this centre keeps a record of.
- **The command palette** — how every destination and setting listed above is reachable by
  name.
