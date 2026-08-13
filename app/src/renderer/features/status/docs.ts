import type { DocArticle } from '../../core/registry';

/**
 * The in-application article for the Status tab. Bundled into the build like
 * every other article; nothing here fetches anything.
 */

const STATUS_OVERVIEW: DocArticle = {
  id: 'status.overview',
  title: 'The Status tab',
  category: 'Status',
  body: [
    "This tab is this application's own status board. It shows the same record shape `scripts/report-status.mjs` sends to the shared status hub — the same status values, the same evidence states, the same fields — so a person reading either surface can never come away with a different idea of what \"landed\" or \"verified\" means.",
    '',
    '## It is local, on purpose',
    '',
    "The tab never makes a network request. It reads and writes one plain JSON file inside this application's own data directory, and it never reads, stores or displays the shared hub's enrollment token — that token exists only for the command-line script, resolved on the machine or container that actually posts to the hub, and this tab has no code path that could touch it even by mistake.",
    '',
    'This means the tab can never claim the hub is "unreachable" in the way a network client would, because it never tries to reach it. What it does instead is state plainly, in the banner at the top, that this is a local record — and it puts an honest age on every row, so a record that has not been refreshed in three days reads as three days old rather than as current.',
    '',
    '## The first row is always this checkout',
    '',
    'One lane is special: this checkout\'s own record, refreshed by running real `git` commands through the application\'s privileged process bridge — `git rev-parse HEAD`, `git status --porcelain`, `git rev-parse origin/<branch>` — exactly the commands the command-line script runs, so the two can never disagree about whether this checkout is dirty or whether its branch is actually on the remote. That comparison proves the claim by SHA rather than asserting it.',
    '',
    'A packaged build usually is not a Git checkout at all, and that failure is reported honestly on the row itself, with a Retry action, rather than treated as a crash. The "last refresh attempt" line and the record\'s own "updated" line are deliberately different things: an attempt that fails still gets a timestamp, but the last-known-good facts keep the date they actually last changed, so a failed refresh can never make an old fact look freshly confirmed.',
    '',
    'This lane can be edited — its status, summary, assumption, evidence and next gates are yours to set by hand — but Git-derived facts (repository, branch, the verified baseline) can only change by pressing **Refresh from Git**, never by typing over them, so the two things a person might trust never quietly drift apart.',
    '',
    '## Everything else is yours to add',
    '',
    'Every other row is a lane you added by hand with **Add a status lane** — a second project, an earlier session, anything whose last-known state is worth keeping somewhere you will actually look. Each one carries the same fields the hub understands: a status, a summary, an assumption, evidence items with their own state and link, and a list of next gates.',
    '',
    'Evidence needs a real `http` or `https` link before it is accepted, exactly as the command-line script requires — a piece of evidence with no link to check is not evidence.',
    '',
    '## Filtering, selecting and acting in bulk',
    '',
    'The search field carries the anchored pattern builder like every search field in this application, and searches every text field on every lane at once, including its evidence labels and next gates. The status chips filter by the five status values, each with its own emoji and a live count, and compose with the search rather than overriding it.',
    '',
    'Every lane can be selected with a checkbox — click one, shift-click another for the range — and the bulk bar that appears offers select all, invert, clear, export and delete. Delete asks for confirmation, lists exactly what will be removed, and automatically excludes this checkout\'s own record from the batch: it cannot be removed, only edited, and the bar says so rather than silently skipping it.',
    '',
    '## Export',
    '',
    'Anything shown can be exported, in every format this application supports, from either the whole visible list or just the current selection. Nested fields — evidence and next gates — are flattened into readable text before writing, so every format carries them exactly the same way rather than one flattening them differently from another.'
  ].join('\n'),
  related: ['history.panel', 'export.surface']
};

const STATUS_RECORD: DocArticle = {
  id: 'status.record',
  title: 'The status record shape',
  category: 'Status',
  body: [
    'This tab and `scripts/report-status.mjs` share exactly one record shape, described here so the two can be checked against each other.',
    '',
    '## Status values',
    '',
    '`running` 🏃, `waiting` ⏳, `blocked` 🧱, `landed` ✅, `failed` ❌ — the same five words the script accepts for `--status`. The emoji is decoration for scanning the list at a glance; it never upgrades what it labels, so a `failed` lane still gets an emoji rather than being dressed down.',
    '',
    '## Evidence',
    '',
    'Each piece of evidence has a label, a real `http` or `https` link, and one of four states: `pending` 🕓, `running` 🏃, `verified` ✅, `failed` ❌ — the same states the script\'s `--evidence "state|label|url"` accepts, and the same bar: an evidence item with no working link is refused rather than silently accepted with a broken one.',
    '',
    '## The one worktree entry',
    '',
    'The script always reports exactly one worktree — the checkout that ran it — with its byte size fixed at `0`, because measuring a working tree\'s real size needs a recursive walk neither surface performs. This tab keeps that same convention for its own checkout\'s lane rather than inventing a number the script cannot check.',
    '',
    '## What this tab adds that the script does not track',
    '',
    'Everything else here — the list of manually added lanes, their titles, and when a record last changed versus when it was last attempted — is local bookkeeping this tab keeps for its own list view. None of it is sent anywhere, and none of it changes what the shared record shape itself means.'
  ].join('\n'),
  related: ['status.overview', 'core.export']
};

export const STATUS_DOCS: DocArticle[] = [STATUS_OVERVIEW, STATUS_RECORD];
