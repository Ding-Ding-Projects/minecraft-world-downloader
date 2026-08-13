import type { DocArticle } from '../../core/registry';

/**
 * The in-application articles for this feature.
 *
 * They are bundled into the build, rendered by the shared Markdown renderer and
 * reachable with no network connection. Each one ends with the articles worth
 * reading next, so a reader is never left at a dead end.
 */

export const EXPORT_DOCS: DocArticle[] = [
  {
    id: 'export.surface',
    title: 'The export surface',
    category: 'Data',
    body: [
      'Everything this application owns can be written to a file: settings and their provenance, the local version history, the notification centre, the tab strip and its groups, the command palette inventory, the documentation, the appearance overrides, the toy locks, the machine facts, and whatever any other feature has registered.',
      '',
      'The tab lists one row per exportable thing. Each row chooses its **own** format, because tabular data belongs in CSV and a nested record does not.',
      '',
      '## Selecting',
      '',
      'Rows support multi-select with the mouse and from the keyboard. <kbd>Space</kbd> toggles the focused row and <kbd>Shift</kbd>+<kbd>Space</kbd> extends the selection from the last row you touched. A shift range covers only the rows the search is currently showing, so a range never quietly reaches through hidden rows.',
      '',
      'There are two select-alls and they carry their real counts: *Select the N shown* takes what the search has left visible, and *Select every source (N)* takes the lot. They are separate controls rather than one ambiguous button because the two are different actions the moment a search is active.',
      '',
      '## What is written, and what is not',
      '',
      'Every file states its encoding, its line endings and its schema version in its own header, so it is readable by something other than this application.',
      '',
      'No secret is ever exported. The credential vault contributes its account **keys** and nothing else — not a value, not a length, not a hash. Sources that touch anything of that kind carry an omission line saying exactly what they leave out, and the surface repeats that line before a byte is written.',
      '',
      '## Before it runs',
      '',
      'Preview a row to see the real serialized text, the format\'s purpose, and precisely which fields that format cannot carry faithfully. Nothing is guessed: the loss report comes from the same writer that produces the file.',
      '',
      'If a run would replace a file that already exists, the two-key destructive-action gate opens first with the exact list of paths. Replacing a file cannot be undone from inside this application, and the gate says so.',
      '',
      '## While it runs',
      '',
      'A long export reports real progress — how many of how many, and which source is being written — and stays cancellable. Cancellation is checked between sources, so a cancelled run never leaves half a file behind: whatever exists is complete. The result says how many were written, skipped, failed and cancelled, one row each, and a source that failed to load fails on its own row rather than taking the run down.',
      '',
      'Every written file is read back with a `stat` before it is called written, so *written* means the bytes are on the disk rather than that a write call returned without complaining.'
    ].join('\n'),
    related: ['export.formats', 'export.archives', 'export.vscode', 'core.export']
  },
  {
    id: 'export.formats',
    title: 'Formats, encoding and what a format cannot carry',
    category: 'Data',
    body: [
      'Fifteen formats are offered, and which of them a row can use depends on the shape of its data rather than on a preference set somewhere else.',
      '',
      '| Family | Formats | Carries nesting |',
      '| --- | --- | --- |',
      '| Interchange | JSON, JSONL/NDJSON, YAML, TOML, XML | yes |',
      '| Tabular | CSV, TSV, SQL | no |',
      '| Human | Markdown, HTML | no |',
      '| Language source | TypeScript, JavaScript (ESM), Python, Go | yes |',
      '| Schema | JSON Schema | describes only |',
      '',
      '## Chosen per datum',
      '',
      'A tabular source offers the spreadsheet formats first; a prose source offers Markdown and HTML; a structured source offers the formats that have nesting. A format that would misrepresent a shape is not offered for it at all.',
      '',
      '## Nothing is dropped silently',
      '',
      'A flat format asked to carry a nested field cannot do it faithfully. Rather than quietly flattening, the surface reports the exact fields and the exact reason **before** the export runs, and the preview shows the same report. Choosing CSV for records with nested objects is a perfectly reasonable thing to do; discovering afterwards that a column became JSON text inside one cell is not.',
      '',
      'The JSON Schema form is a deliberate omission rather than a loss, and it says so in its own words: it describes the shape of the records and contains none of them.',
      '',
      '## Encoding and line endings',
      '',
      'Files are UTF-8. Line endings are LF by default and CRLF on request, and the choice is stated in the file\'s own header rather than left to be inferred. A UTF-8 byte-order mark is off by default and available for the one case that genuinely needs it — a spreadsheet mangling accented characters in a CSV. Leave it off for anything a program will parse.',
      '',
      '## Round trips',
      '',
      'JSON is the safest way back in. The language-source forms carry nesting natively and lose nothing; the flat forms are for consumers that want flat data and should not be used when the file has to come back unchanged.'
    ].join('\n'),
    related: ['export.surface', 'export.archives', 'core.export']
  },
  {
    id: 'export.archives',
    title: 'ZIP and 7z archives',
    category: 'Data',
    body: [
      'Selected exports can be bundled into one archive. Both formats are offered and the 7z options are exposed in full rather than hidden behind one hard-coded default.',
      '',
      '## Every option',
      '',
      '- **Method** — LZMA2, LZMA, PPMd, BZip2, Deflate and Copy for 7z; Deflate, BZip2, LZMA, PPMd and Copy for ZIP.',
      '- **Level** — 0 store, 1 fastest, 3 fast, 5 normal, 7 maximum, 9 ultra.',
      '- **Dictionary size** — 64 KiB to 1536 MiB. For PPMd this sizes the model memory instead (`-mmem`); for BZip2 it is the block size.',
      '- **Word size** — 8 to 273. For PPMd this control sets the model order instead.',
      '- **Solid** — on or off, with a solid block size from 1 MiB to 64 GiB or one block for everything.',
      '- **Threads** — off, a specific count, or the archiver\'s own choice.',
      '- **Split volumes** — 10 MiB through 4 GiB, or one file.',
      '- **Encryption** — AES-256, with a password held only for the length of one run.',
      '- **Encrypted headers** — 7z only, hiding the file names as well as the contents.',
      '',
      'Every choice states what it costs in time and memory, with real figures: the LZMA family needs roughly 10.5 times the dictionary to compress and roughly the dictionary itself to extract, and each additional compressing thread keeps its own buffers.',
      '',
      'A control that cannot apply is disabled **and says why**. Deflate has a fixed 32 KiB window; ZIP compresses each entry separately and so has no solid mode; Copy has no dictionary at all.',
      '',
      '> [!IMPORTANT]',
      '> ZIP cannot encrypt its central directory. An encrypted ZIP hides the contents of its entries and leaves their **names** readable to anybody. The encrypt-names control is therefore disabled for ZIP with that exact reason on it, and the surface never describes such an archive as protected. Choose 7z when the names must be hidden.',
      '',
      '## Relative paths, always',
      '',
      'Entries are written into one root folder and the archiver runs with its working directory set to that folder\'s parent, so no entry can carry a drive letter, a leading separator or a `..` segment. Extracting the archive cannot write outside the directory you extract it into.',
      '',
      'A `MANIFEST.md` is written into the archive naming every entry, what it is, and exactly how the archive was made. The password appears in it as `********` and nowhere else.',
      '',
      '## The password',
      '',
      'The password is handed to the archiver on its command line. It is never stored, never logged, never exported and never recorded in the version history. On a shared machine another process could read that command line while the archive is being written, and the surface says so rather than implying a guarantee it cannot make.',
      '',
      '## When no archiver can be reached',
      '',
      'The archiver is an external program. This application asks the privileged bridge to start it and reports exactly what came back, including a refusal, with the list of commands that were tried. When it cannot be started, the *Write the archive contents as a folder* action produces the same entries at the same relative paths in a plain folder with the same manifest, and the exact command line is shown for you to run yourself.',
      '',
      'The staged folder is left in place beside a created archive, because this application has no route to delete a file. Remove it yourself if you do not want it.'
    ].join('\n'),
    related: ['export.surface', 'export.vscode', 'export.formats']
  },
  {
    id: 'export.vscode',
    title: 'Opening an export in Visual Studio Code',
    category: 'Data',
    body: [
      'Every export can be handed to Visual Studio Code in one action, either from the run that produced it or from the result row it came from.',
      '',
      '## Folders open as a workspace root',
      '',
      'Opening a folder opens it as a workspace root so the file tree is usable, rather than opening one lonely file with no context around it. When the chosen editor cannot do that, the handoff is refused with the reason instead of quietly opening the file instead.',
      '',
      '## Detection',
      '',
      'The `code` command is looked for on PATH first, then the usual per-user and machine-wide install paths, then Insiders and VSCodium. When more than one is present you choose which to use.',
      '',
      '## When it is not installed',
      '',
      'The surface says so plainly, names what was looked for, and offers the download page. It never fails silently, and it never opens some other editor in its place — a Notepad window appearing instead is a worse outcome than nothing happening, because nothing about it explains itself.'
    ].join('\n'),
    related: ['export.surface', 'export.archives']
  }
];
