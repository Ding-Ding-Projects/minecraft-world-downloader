import type { DocArticle } from '../../core/registry';
import { VOCABULARY_CONTRACT, blankTemplate } from './schema';

/**
 * The in-application documentation for this feature.
 *
 * Bundled into the build, rendered by the shared markdown renderer, and readable
 * with no network connection — the same words as `docs/features/vocabulary.md`
 * in the repository, so a reader inside the application and a reader on the
 * documentation site are told the same thing.
 *
 * The example in here is the blank template. It carries no replacements,
 * because a documented "sample vocabulary" would be a shipped vocabulary with a
 * different name on it.
 */

const limits = `| Rule | Limit |
| --- | --- |
| Complete payload | ${VOCABULARY_CONTRACT.maxBytes} bytes |
| Replacements in one file | ${VOCABULARY_CONTRACT.maxEntries} |
| Key length (the text replaced) | 1 to ${VOCABULARY_CONTRACT.maxKeyLength} characters |
| Value length (the text shown instead) | 0 to ${VOCABULARY_CONTRACT.maxValueLength} characters |
| JSON nesting depth | ${VOCABULARY_CONTRACT.maxDepth} levels |
| Schema versions understood | ${VOCABULARY_CONTRACT.supportedVersions.join(', ')} |`;

export const VOCABULARY_DOCS: DocArticle[] = [
  {
    id: 'vocabulary.overview',
    title: 'Personal vocabulary',
    category: 'Language and text',
    related: ['vocabulary.schema', 'vocabulary.privacy', 'core.language'],
    body: `# Personal vocabulary

This application lets you replace its wording with your own. You supply one JSON
file from this computer; every user-facing string the application renders is
passed through your replacements before it is displayed, including the names
screen readers announce.

## What ships with the application

Nothing. There are no built-in mappings, no samples and no templates with real
values anywhere in this build. Until you supply a valid file, every surface
renders exactly the wording the application shipped with, and the replacement
step is the identity function.

The upload control is present regardless. It is on this destination and in the
language section of the settings surface, before any file has ever existed —
a control that only appears once a vocabulary is loaded is a control nobody can
use to create the first one.

## Loading a file

1. Open **Personal vocabulary** from the tab strip, or press the command-palette
   shortcut and search for it.
2. Choose **Choose a JSON file**. The platform's own file picker opens.
3. The file is read locally and validated completely before anything changes.

If the file passes, its replacements are applied immediately and cached in this
application's data folder so they survive a restart. If it fails, **nothing from
it is applied** — not even the part that was valid — and whatever was loaded
before stays exactly as it was. The reason is shown on this destination, in a
notification, and recorded in local history as a rule name with no fragment of
the file in it.

## Working with what is loaded

The list shows every replacement in the loaded file, searchable through the
usual search field with its regular-expression builder attached. Rows can be
selected one at a time, in a range with shift-click or shift-arrow, a page at a
time, or across every current search match — and the toolbar states which of
those scopes each button means rather than saying "select all" and leaving you
to guess.

Three actions are available on one row or on a whole selection:

- **Suppress** stops a replacement being applied. It stays in the loaded copy and
  can be restored at any time. Your file is not touched.
- **Restore** puts a suppressed replacement back into use.
- **Remove** takes replacements out of the loaded copy on this computer. Your
  file is not touched, so loading it again brings them back. This goes through
  the destructive-action gate.

The toolbar shows what each action would actually change before you use it.
"42 selected" and "42 will change" are different numbers whenever part of a
selection is already in the state you are asking for, and both are shown.

## Clearing

**Clear and restore the original wording** deletes the cached replacements from
this computer and returns every surface to the shipped wording immediately. It
goes through the destructive-action gate.

Version history records that a vocabulary was cleared and how many replacements
it held, but never the replacements themselves — so this cannot be undone from
history. Loading your file again is the way back, and the confirmation says so
rather than implying an undo that does not exist.

## Suggested reading

- **Personal vocabulary file format** — the exact schema, every limit and every
  reason a file is refused.
- **What personal vocabulary data never leaves** — where the data lives, and the
  complete list of places it is deliberately absent from.
- **Language and humour** — the language modes and humour levels this feature
  sits beside.`
  },
  {
    id: 'vocabulary.schema',
    title: 'Personal vocabulary file format',
    category: 'Language and text',
    related: ['vocabulary.overview', 'vocabulary.privacy'],
    body: `# Personal vocabulary file format

A vocabulary file is a JSON object with exactly two fields.

- **\`version\`** — a whole number naming the schema version. This build
  understands ${VOCABULARY_CONTRACT.supportedVersions.join(', ')}.
- **\`replacements\`** — an object whose member names are the text to look for and
  whose values are the text to render instead. Every value must be a JSON string.

Any other field refuses the file. This is deliberate: a document with a field
this build does not understand may well mean something the build cannot honour,
and silently ignoring it would apply a file that does not do what it says.

## A blank file

\`\`\`json
${blankTemplate().trim()}
\`\`\`

That is the whole shape. It contains no replacements because this application
ships no vocabulary of its own; **Save a blank template** on the vocabulary
destination writes exactly this file for you to fill in.

## Limits

${limits}

An empty value is allowed and means "render nothing here", which is how a word is
removed rather than replaced.

## Why a file is refused

Every check runs over the complete payload before a single replacement is
accepted, so a file that is good for four hundred entries and wrong on the four
hundred and first applies none of them.

| Reason | What it means |
| --- | --- |
| \`byte-limit\` | The payload is larger than the limit above. |
| \`empty-file\` | The file has no content. |
| \`malformed-json\` | The parser refused it. The exact syntax error is shown. |
| \`not-an-object\` | The top level is an array, a number or a string. |
| \`depth-limit\` | The document nests deeper than a vocabulary file ever needs to. |
| \`duplicate-key\` | Two members of one object share a name. JSON keeps only the last, so the file does not mean what it appears to mean. |
| \`unknown-field\` | A field outside the schema. |
| \`missing-version\`, \`unsupported-version\` | No version, a non-integer version, or a version this build does not understand. |
| \`missing-replacements\`, \`replacements-not-an-object\` | The replacements field is absent or is not an object. |
| \`entry-limit\` | More replacements than the limit above. |
| \`reserved-key\` | A key JavaScript reserves for its own object machinery. |
| \`empty-key\`, \`whitespace-key\` | An empty key, or one made only of whitespace — the second would rewrite every space in the application. |
| \`key-length\`, \`value-length\` | A key or value beyond its limit. |
| \`value-not-a-string\` | A replacement value that is a number, an object, an array, \`true\`, \`false\` or \`null\`. |

Rejection messages name the rule, the limit and the position — "replacement 12",
never the replacement itself. That is not caution for its own sake: a rejection
reason is rendered on screen, announced to a screen reader and written into local
history, and a reason that quoted your words would put them in a durable record.

## Applying order

Replacements are applied longest key first, so a longer phrase is never broken
apart by a shorter key that happens to sit inside it. Matching is exact and
case-sensitive: this is a literal text substitution, not a pattern language.

Replacement happens at the point text is rendered. Commands, URLs, identifiers,
code, file paths, exact error text from another program and the factual content
of external records are not user-facing copy and are not touched.

## Suggested reading

- **Personal vocabulary** — loading, listing, suppressing and clearing.
- **What personal vocabulary data never leaves** — the privacy boundary.`
  },
  {
    id: 'vocabulary.privacy',
    title: 'What personal vocabulary data never leaves',
    category: 'Language and text',
    related: ['vocabulary.overview', 'vocabulary.schema'],
    body: `# What personal vocabulary data never leaves

Your word list is yours. This article is the complete account of where it goes
and, more usefully, where it deliberately does not.

## No network, at any point

This feature makes no network request. Not to validate, not to load, not to
report an error, not to check for an update to the schema. There is no CDN, no
remote font, no analytics and no telemetry in it. The file is chosen through the
platform's own picker, read through the application's scoped file reader,
validated in this window, and cached locally.

## Where the data is

The validated replacements are cached in this application's own data folder,
alongside its settings. That is the only copy this application keeps.

**The file itself is not stored, and neither is its name or its location.** After
a successful load the application knows the replacements and the time it loaded
them, and nothing else about where they came from.

## Where the data is deliberately not

- **Logs.** No replacement, key, value, file name or path is ever written to a
  log line.
- **Exports.** The settings export skips the whole \`vocabulary.\` namespace and
  states in the exported file that it did so. Nothing else exports the terms.
- **Version history.** History records that a vocabulary was loaded, refused,
  cleared, suppressed, restored or had entries removed, with counts and a rule
  name for a refusal. It never records a term, and it never records the file's
  name or path. This is why clearing cannot be undone from history: there is
  nothing in there to restore from, by design.
- **Crash reports and diagnostics.** A diagnostic report names the shipped
  product and the build; it carries no vocabulary data.
- **Screenshots taken by this application's own capture tooling.** These are
  taken from a fresh profile with no vocabulary loaded.

The one place your terms are shown is on screen, in this application, to you. If
that is one place too many — somebody else can see the screen — turn off **Show
the loaded replacements** on the vocabulary destination. The replacements keep
working and only a count is displayed.

## Failing closed

Anything unexpected ends at the wording this build shipped with, never at a
half-applied state:

- A refused file applies nothing.
- A cache that stops passing validation is dropped, the shipped wording returns,
  and the destination says the cache was dropped rather than quietly using it.
- Clearing purges the cache and restores the shipped wording immediately.
- While the named study mode is on, the whole capability behaves as though it
  were not installed: the destination is removed from the tab strip, its
  commands leave the command palette, and no replacement is applied. Your file
  and your choices are kept and return when the mode is turned off.

## Suggested reading

- **Personal vocabulary** — the destination and what you can do there.
- **Personal vocabulary file format** — the schema and every refusal reason.`
  }
];
