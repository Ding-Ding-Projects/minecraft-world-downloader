import type { DocArticle } from '../../core/registry';

/**
 * The in-application documentation for the notification centre.
 *
 * The same material is written out at greater length in
 * `docs/features/notification-centre.md`; this is the copy the offline
 * documentation browser bundles, so it must stand on its own without a network.
 */

export const NOTIFICATION_CENTRE_DOCS: DocArticle[] = [
  {
    id: 'notification-centre',
    title: 'The notification centre',
    category: 'Messaging',
    body: [
      'A notification that only ever appeared in the corner and then vanished is a message nobody can check. The centre keeps every notification the application has raised — including the ones already dismissed — as a reviewable, searchable, exportable list that survives closing the window.',
      '',
      '## What a row holds',
      '',
      'The timestamp (exact, plus a readable "four minutes ago"), the severity, the feature that raised it, the title, the body, any link it carried, and any actions it carried.',
      '',
      'An action is a **real button** for as long as this session still holds its callback. A callback is code rather than data, so it cannot be written to a file: a row restored from an earlier session lists the action names and says plainly that they cannot be run from here, instead of rendering a button that would do nothing. A link is only data, so a link keeps working across restarts.',
      '',
      '## It is a list, so it carries the whole list contract',
      '',
      '- Multi-select by clicking a row or its checkbox, and shift-click to take a range.',
      '- The keyboard equivalent: arrow keys move between rows, <kbd>Space</kbd> toggles, <kbd>Shift</kbd> with an arrow extends the range, <kbd>Ctrl</kbd>+<kbd>A</kbd> selects every match, <kbd>Escape</kbd> clears the selection and <kbd>Delete</kbd> deletes what is selected.',
      '- Two select-alls that say which scope they mean, with the count in the label: **the rows on this page**, and **every record the search and filters allow**.',
      '- An inverse selection, computed over the matches rather than the page.',
      '- Bulk dismiss, bulk delete and bulk export.',
      '',
      '## Nothing is skipped silently',
      '',
      'Only a notification still on screen can be dismissed. Dismissing a selection that mixes live and historical rows reports exactly how many were dismissed and how many were left alone, rather than claiming the whole batch changed state.',
      '',
      'Before any bulk action, the collapsible **Records a bulk action would affect** panel lists exactly what is selected. Deleting goes through the two-key confirmation gate as well, which names the count, lists the records item by item, and states that the removal cannot be undone from inside the application.',
      '',
      '## Search and filters compose',
      '',
      'The search bar carries the anchored pattern builder like every other search field in the application; plain text is the default and regular expressions are an explicit opt-in. It searches the title, the body, the source, the severity and the timestamp.',
      '',
      'Beside it are filters for severity and for source, each with its live count, and a state filter for still-showing against dismissed. Filters narrow the search result rather than replacing it: the two always apply together.',
      '',
      '## A collapsed control that is hiding rows says so',
      '',
      'The filter row collapses, and the statistics panel starts collapsed because it only describes the log rather than changing it. While the filter row is collapsed **and a filter is still excluding records**, its header says how many of how many are hidden. A list quietly shorter than it should be is exactly how somebody concludes their data has gone missing.',
      '',
      '## Exporting honours the filter',
      '',
      'The export panel offers three scopes with their exact counts — the selection, everything the current search and filters allow, or the whole stored log — and defaults to the filtered set rather than dumping everything. Every format the application supports is available, and the panel reports what a chosen format cannot carry faithfully **before** anything is written.',
      '',
      '## Where the log lives',
      '',
      'A file inside the application data directory, holding the newest records up to the retention setting. It is validated on every read: a bounded size, a known schema version and a checked shape per record, so a corrupt file degrades to an empty log rather than to a broken window. When the file cannot be read or written, the status line at the top of the centre carries the exact reason and this session is still listed below it.',
      '',
      'Deleting records and clearing the log are both recorded in local version history, so the fact that a deletion happened survives the deletion itself.'
    ].join('\n'),
    related: ['core.export', 'core.history', 'core.regex']
  }
];
