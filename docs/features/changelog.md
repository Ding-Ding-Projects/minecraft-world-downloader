# Changelog viewer

> Every version this project ever tagged — not only the newest — with its date, its categorized changes, and the commit behind each one rendered as a short clickable reference. The record is generated from the repository's real commit history at build time and every commit id in it is resolved against the repository before the application is built, so an entry that links nowhere fails the build instead of shipping.

Owned by `app/src/renderer/features/changelog/`. Two build-time scripts belong to it:

| Script | What it does |
| --- | --- |
| `app/scripts/generate-changelog.mjs` | Reads the repository's tags and commits and writes the bundled record at `app/src/renderer/features/changelog/generated.ts`. |
| `app/scripts/validate-changelog.mjs` | Resolves every commit id in that bundle against the repository and fails closed if one does not exist. |

---

## What it does

### Covers every released version

The destination lists every git tag as a version, newest first, each with the date the tag itself
records. Work committed after the newest tag appears in its own **Unreleased** section, labelled and
dated from the commit, so it is never mistaken for something that shipped.

A version whose tag points at the same commit as the tag before it has nothing in its range. It is
still listed, and it says exactly that:

> No changes are recorded for this version. Its tag points at the same commit as the version before it.

That is a real state in this repository — sixteen of the current tags are in it — and hiding those
versions would make the list disagree with `git tag` for no stated reason.

### One commit link per change

Each change carries the commit that made it, rendered as a short reference such as `a1b2c3d` beside
the summary. Selecting it hands the commit's page on the project's own forge to the operating
system's browser through the privileged bridge.

The forge is resolved at generation time from the repository's own remote — GitHub, GitLab,
Bitbucket, Gitea and Codeberg are recognised — and reduced to an `https` URL template containing
`{sha}`. Any user or credential component in the remote is stripped before it is written.

**Where no forge is recognised, there is no link.** Commit ids render as selectable text that copies
on activation, and the reason is stated once at the top of the page rather than repeated beside every
id. A link that resolves to nothing is worse than no link, because the reader cannot tell it was
never checked.

### Entries that summarize several commits

When several commits in one version carried the same subject, they become **one** entry. It says how
many commits it stands for, links the commit that **completed** the change — the last one in the
range — and lists every commit in the group beneath it, each with its own reference. The single link
is never presented as the whole story.

### Categories from the commit's own words

Every change is filed under Added, Changed, Fixed, Removed, Security, Performance, Documentation,
Maintenance, Reverted, Merged or Other. The category comes from the commit subject and body, in this
order: a merge, a revert, an explicit security word, a conventional-commit prefix (`feat:`, `fix:`,
`docs:` …), a leading verb, and — because `Scope: what it did` is common in this history — the verb
after the first colon.

A subject that matches none of those is filed as **Other** and shown with its full text and a line
saying why, so the reader judges it. The generator never guesses a category to make the list look
tidier.

---

## Filtering

The date range, the search field, the category chips, **Breaking changes only** and **Released
versions only** all **compose**. None overrides another. Narrowing to a year and then typing a word
gives the changes in that year that match the word, which is the only reading of "both filters are
on" that is not a lie.

One asymmetry is deliberate and stated in the interface:

- the **date range** and the **released** switch apply to a **version**;
- the **categories** and the **breaking** switch apply to a **change**.

So typing a version number shows that whole version rather than nothing, because what matched was the
version itself.

### The date picker

The shared advanced calendar: month and year jump, range selection, the standard presets, and typed
dates accepted in the locale's format as well as plain ISO. Invalid or partial input is reported
inline **without discarding what was typed**.

### The search field

Plain text by default. The affordance inside the field opens the full pattern builder anchored to
that exact field, and switching to a regular expression is always an explicit act. Query, pattern,
flags, validation and mode stay synchronized in both directions. An empty result is an honest
no-match message naming what to widen.

The search looks through the version, the date, the summary, the commit message, the author, the full
and short commit ids, and the category.

---

## Selecting versions, and acting in bulk

Every version card has a checkbox.

- **Click** toggles one. **<kbd>Shift</kbd>+click** takes the whole range between it and the last one
  touched. **<kbd>Space</kbd>** toggles whichever version has focus.
- **Select the N versions shown** and **Select all N matching versions** are different actions with
  different counts, and each button states its own number. The first takes what is currently
  rendered; the second takes everything the filter accepts, including versions further down.
- **Invert the selection** and **Clear the selection** operate over everything the filter matches.

With nothing selected, Copy and Export act on everything the filter matches. The line under the
selection controls always states which of the two is about to happen, with the exact counts.

**Open every commit in the browser** goes through the two-key destructive-action gate. Nothing is
deleted and nothing on disk changes, but a browser handed thirty pages cannot be told to take them
back, so the gate names the exact number and lists what will open first. A partial result is reported
honestly: how many opened, how many were refused, and why.

---

## Copying and exporting

**Copy** puts the current view on the clipboard as Markdown or plain text, whichever
`changelog.copyFormat` says.

**Export** writes the same thing to a file, and additionally offers one row per change in any format
the application's exporter supports — JSON, JSONL, YAML, TOML, XML, CSV, TSV, Markdown, HTML and SQL
— with the format's own preflight report of anything it cannot carry faithfully shown before the file
is written.

Every export:

- **honours the active filter and selection**, so the file matches what was on screen;
- **states its own range**: the product and version, the exact version span, the counts, the filter
  that produced it, the language mode it was written in, the commit the bundle was generated from and
  the command that regenerates it;
- **keeps commit ids as text** in every format, so a changelog pasted into an issue three weeks later
  is still traceable;
- **shows a reviewable preview** with the exact counts before anything is written.

A version with no recorded changes still gets a row in a data export, so a spreadsheet of the export
cannot quietly lose a released version.

---

## Language, humour and School mode

Every string goes through the shared catalogue in English and playful Hong Kong Cantonese at all five
funny levels, and bilingual mode shows both. The funny level styles the **voice** and never the
**facts**: a version number, a date, a commit id, a category name and the sentence "this version has
no recorded changes" read identically at level 1 and level 5.

That includes security fixes and breaking changes. A breaking change is flagged at every level and
the flag's explanation says the same thing at every level.

The viewer exposes no Cantonese-only, funny-level, personal-vocabulary or dim-sum capability of its
own, so School mode has nothing here to omit; while it is on, the shared catalogue renders every
string in English exactly as it does everywhere else.

---

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| `changelog.pageSize` | `12` | How many versions are rendered before the list continues on scroll. |
| `changelog.groupByCategory` | `true` | Groups a version's changes under Added, Fixed and the rest instead of commit order. |
| `changelog.showBodies` | `false` | Expands every commit message inline instead of leaving each behind its own disclosure. |
| `changelog.copyFormat` | `markdown` | Which text shape Copy puts on the clipboard. |
| `changelog.rememberView` | `true` | Restores the plain-text search, date range, categories and both switches next time. |
| `changelog.view` | none | The persisted filter itself, written by the viewer rather than by a visible control. |

Each control carries its explanation behind progressive disclosure and the shared settings surface
states where the current value came from, naming the real value rather than the word "default".

**A regular expression is deliberately not restored.** The shared search bar cannot be switched into
pattern mode from outside it, so restoring a pattern would leave the field reading as plain text while
the list filtered as a pattern — two surfaces disagreeing about what is being searched for, with no
way for the reader to tell. The setting's own explanation says so.

`changelog.view` is a real settings key, which means it survives a restart, appears in a settings
export, and — like every other settings change — is recorded in the local append-only history. That
is what makes returning to an earlier view an undoable action rather than something that silently
overwrites itself. Copying and exporting are recorded there too, with the counts, the destination and
the filter that produced them.

---

## Reaching it

- The **Changelog** tab in the tab strip.
- The command palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>): the destination itself, and
  commands to copy the current view, export it as Markdown or plain text, jump to the newest version
  and focus the search. Each of the feature's settings also appears by name and renders its live
  control inline.
- **Settings → Changelog → Open the changelog.**

A palette command that acts on "the current view" needs a current view. When the destination is not
open, it is opened first and the reason is stated, rather than the command failing quietly or acting
on a guess.

---

## How the record is built

`node scripts/generate-changelog.mjs`, run from `app/`:

1. reads every tag with `git tag --sort=creatordate`, taking the dereferenced commit for an annotated
   tag and the object itself for a lightweight one;
2. reads every commit once with a single `git log --all` using ASCII unit and record separators, so a
   subject or body containing any ordinary punctuation cannot break the parse;
3. for each tag, takes `previous..tag` with `git rev-list --reverse` — commits after the newest tag
   become the Unreleased section;
4. folds commits sharing a subject into one entry linked to the last of them;
5. writes `generated.ts` with one release per line, so regenerating produces a reviewable diff rather
   than half a megabyte on a single line.

`node scripts/generate-changelog.mjs --check` rebuilds the record and fails when the committed bundle
no longer matches the repository, ignoring only the generation timestamp.

Commit messages are capped in the bundle at 4,000 characters. A capped entry says so and points at
the commit for the whole text; the ceiling is recorded in the bundle so the truncation is auditable.

`commitsExamined` is the sum of the commits in every release range. It is deliberately **not** a
repository total: where tags do not sit on one straight line of history, two ranges can legitimately
contain the same commit and it is counted in both. The viewer says exactly that behind the
explanation affordance next to the figure.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| A commit id in the bundle does not resolve | `validate-changelog.mjs` fails the build, naming the id, the release and the entry that carries it, and says a shallow clone will not contain the history. |
| git is unavailable to the validator | It fails closed and says why. It cannot prove anything without the repository, and there is no switch to skip it. |
| The bundle is missing or malformed | The viewer renders an honest empty state naming the generator command, with an action that copies it — never an empty list that looks like a project with no history. |
| The repository has no recognised forge | Commit ids render as text that copies on activation, with the reason stated once at the top. |
| The clipboard refuses | The asynchronous clipboard is tried first, then the older selection route. When both refuse, the reason is reported and no success message is shown. |
| The browser refuses a commit page | The number that opened is reported alongside the number that did not, with the reason. |
| A commit message exceeded the ceiling | The entry says it was cut, names the ceiling, and points at the commit for the rest. |
| The stored view is corrupt or from an older build | Every field is validated on read — dates against `YYYY-MM-DD`, flags against the legal regular-expression flags, categories against the known set — and anything unrecognised is dropped rather than putting the viewer into a state it cannot render. |

---

## Security considerations

- **No network request.** The viewer fetches nothing. A commit URL is handed to the operating system
  through `shell.openExternal`, which accepts only `http` and `https`, and the template it is built
  from is proven to start with `https://` and to contain `{sha}` before the build finishes.
- **Nothing in the bundle is treated as markup.** Summaries, commit messages, author names and version
  strings are inserted as text nodes, never as HTML, so a commit subject containing angle brackets
  renders as the characters somebody typed.
- **No credentials in the artefact.** The generator strips any user or credential component from the
  remote before recording it, and the validator refuses a bundle whose recorded remote still contains
  an `@`.
- **The stored view is bounded.** Search text and pattern are capped at 2,000 characters on read, and
  flags are accepted only from the legal set, so a hand-edited settings file cannot make the viewer
  compile something unbounded.
- **The bundle is data, not code.** It is a JSON literal in a generated module with a fixed shape,
  checked against `ChangelogData` by the compiler.

---

## Verification

```bash
cd app
node scripts/generate-changelog.mjs           # write the bundle
node scripts/generate-changelog.mjs --check   # fail if it is stale
node scripts/validate-changelog.mjs           # fail if any commit id does not resolve
npm run typecheck
```

The validator has been checked by breaking it on purpose, one fault at a time, and confirming each
turns it red and that restoring the bundle turns it green again:

| Injected fault | Result |
| --- | --- |
| A commit id changed to one that does not exist, keeping a matching short prefix | Fails, naming both references to it and telling the reader a shallow clone will not contain the history |
| A short reference that is not a prefix of its full id | Fails, quoting both |
| `{sha}` removed from the commit URL template | Fails, saying every entry would link to the same page |
| An entry marked as summarizing four commits while listing one | Fails, saying the viewer would tell the reader something untrue |

Exit codes were read from the process rather than from the tail of a pipe, because a wrapper shaped
`command | head` reports the status of `head`.

The viewer itself is checked in all three language modes, at both funny-level extremes, with a
keyboard only and with a screen reader. Every control has an accessible name, counts and copy results
are announced on a live region, the commit reference and every button clear 44 CSS pixels, wide
content — commit messages and export previews — scrolls inside its own container so the page never
scrolls sideways, and nothing clips at narrow widths or at 100/125/150/200% display scale with the
longest bilingual strings.

---

## Suggested reading

- [`settings.md`](settings.md) — the settings surface that renders this feature's five controls, their
  explanations and their provenance lines.
- [`language.md`](language.md) — the three language modes and the two funny levels that style every
  string on this surface.
- [`docs-browser.md`](docs-browser.md) — the offline documentation browser, where the in-application
  copy of this article is rendered.
- [`locks.md`](locks.md) — putting the changelog, or any element on it, behind its own credential.
- The **local version history** and the **export** documents, when they land: the first records every
  copy, export and settings change made here; the second describes the data formats the export dialog
  offers and the preflight that reports what a format cannot carry.
