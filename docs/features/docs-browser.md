# Offline documentation browser

> Every feature article compiled into the application at build time and read inside it, with no
> network connection, no cache to warm and no first-run download. Article-to-article links land on
> the linked article instead of opening a browser; the search bar carries the same anchored
> regular-expression builder as every other search field in the product; and a build guard fails the
> build when a file on disk is missing from the bundle.

Owned by `app/src/renderer/features/docs-browser/`. Two build scripts belong to it:
`app/scripts/bundle-docs.mjs` writes the bundle and `app/scripts/check-docs-bundle.mjs` refuses to
let a stale or incomplete one through.

This is distinct from, and additional to, the documentation website. The website is for somebody
deciding whether to install the application; this is for somebody already using it, quite possibly
on a machine with no connection at all.

## What it does

### The library

**Documentation** is a destination in the tab strip. It has two panes with a real splitter between
them:

- **The index**, grouped by category, with one row per article. Each row carries a live **Read**
  checkbox and a **Bookmark** toggle — the actual controls, wired to the same stored state and the
  same history recorder as the article view, not a printed summary of them. The row also shows the
  article's reading-time estimate and its size.
- **The article**, rendered as formatted prose through the application's one shared Markdown
  renderer. Above it sits an **On this page** outline built from the article's own headings; below it
  sits **Suggested articles**.

The splitter is draggable with the pointer and operable from the keyboard: focus it and use the left
and right arrow keys, <kbd>Home</kbd> and <kbd>End</kbd>. Its position is persisted, and
**Reset the layout** puts it back.

### Links resolve inside the application

A link from one article to another — `[Toy locks](locks.md)` — opens that article in this pane. It
does not open a browser, and it does not silently do nothing.

Three kinds of link target are treated differently, and each says which it is:

| Target | What happens |
| --- | --- |
| Another bundled article (`locks.md`, `./locks.md`, `locks.md#the-list`) | Opens it here, and adds it to the back history. |
| An article registered by a feature module rather than bundled from a file | Opens it here as well; both sets live in one index. |
| Anything else — `../../AGENTS.md`, an `https://` address, a path outside the bundle | Reported by name in a notification. The reader is told exactly where the link pointed rather than being handed a control that appears broken. |

**Back** and **Forward** walk the trail of articles read in this session, exactly as a browser would.

### Search

One search bar covers **titles and bodies**. Plain text is the default; the builder affordance beside
the field opens the anchored regular-expression builder, and a pattern applies to the same search.
The result count is announced, and each matching row states how many times the term occurs in that
article's body so the biggest match is obvious before opening anything.

Body search can be turned off in settings, which makes the search title-only. The reason to want
that is stated on the setting rather than left to be discovered: with bodies included, a common word
matches almost every article, which is a longer list rather than a more useful one.

### Suggested articles, always

Every article ends with suggested reading, so nothing is a dead end:

- **Suggested articles** — the ones this article actually links to, plus any named in its
  `<!-- docs-browser: related: … -->` marker.
- **Also in this category** — the neighbouring articles, shown when the first list is short.

The two are labelled separately because they are not the same claim: one is the author's link, the
other is the bundle's neighbour.

### Bulk actions

The index is a list, so it behaves like every other list in the application. Multi-select with the
pointer, <kbd>Shift</kbd> for a range and the keyboard equivalent; a select-all that says plainly
whether it means *the articles currently shown* or *every article in the bundle*; an inverse
selection; and every action available in bulk that exists singly:

- **Mark read** / **Mark unread**
- **Bookmark** / **Remove bookmark**
- **Copy as Markdown** — the selected articles, concatenated, on the clipboard
- **Export…** — through the standard exporter, in any format it supports

Each one states the exact count before it runs, and reports what it actually did rather than what it
intended to do.

**Clear every read mark and bookmark** is the one irreversible-looking action, so it goes through the
two-key confirmation gate and names precisely what it clears. It is recorded in local history like
every other change, which is what makes it recoverable.

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| `docs-browser.startArticle` | Continue where I left off | Which article opens when the destination is first shown. The list is populated from the real bundle, so every choice names an article that exists. |
| `docs-browser.searchBodies` | On | Whether the search matches article bodies as well as their titles. |
| `docs-browser.showSource` | Off | Shows each article's source path (`docs/features/locks.md`) beneath its title. |
| `docs-browser.showOutline` | On | Shows the **On this page** heading outline above the article. |
| `docs-browser.verifyOnStart` | On | Re-verifies the bundle's own integrity at boot. |
| `docs-browser.splitWidth` | 320 | Width of the index pane in pixels. Normally set by dragging the splitter. |

Two actions sit alongside them: **Verify the bundle now**, which reports the result as a
notification, and **Export the article index**, which writes the index through the standard exporter.

## How the bundle is built

`node scripts/bundle-docs.mjs` reads every `*.md` file in `docs/features/` and writes
`app/src/renderer/features/docs-browser/generated.ts`. For each file it records the body verbatim,
the title (the first level-one heading), the category, the headings, the outbound links, a
reading-time estimate, the byte length, a SHA-256 and a 32-bit FNV-1a checksum.

Categories come from the real index. `docs/features/README.md` already groups every article under a
heading in a table that links to the file, so the group in that table is the category in the
application. A file the index has not listed falls back to **Feature guides**, which is stated rather
than silently invented.

Two optional markers let an article override that:

```markdown
<!-- docs-browser: category: Mapping -->
<!-- docs-browser: related: live-map, bluemap -->
```

Article ids are `manual.<file-name-without-extension>`, so `docs/features/locks.md` becomes
`manual.locks`. The prefix keeps them from colliding with the article ids feature modules register
for themselves.

## Failure modes

**An article is added and the bundle is not regenerated.** The guard fails the build, naming the
file. This is the failure the guard exists for, and it is the one that is invisible at runtime: a
missing article leaves no gap behind it, so the browser looks complete.

**An article is edited and the bundle is not regenerated.** The guard compares SHA-256 hashes and
fails, printing the first twelve characters of each so the mismatch is checkable.

**The generated file is truncated or hand-edited after the build.** The application itself catches
this. At boot it recomputes each article's checksum and byte length from the bundled body and
compares them with the recorded values. A mismatch raises a warning notification naming the exact
article, and **Verify the bundle now** repeats the check on demand. The browser keeps working — a
corrupted checksum is a reason to distrust one article, not to hide the other twenty.

**A `related` id names an article that does not exist.** The guard fails the build. In the running
application such an entry is rendered with an honest label rather than a link that goes nowhere.

**The docs directory is empty or missing.** The bundler refuses to write an empty bundle, because a
documentation browser with nothing in it is never a correct outcome.

**The clipboard is unavailable.** **Copy as Markdown** reports the refusal by name. It does not
report success it cannot prove.

## Security considerations

**No network, at all.** Nothing in this feature fetches anything: no article, no image, no font, no
stylesheet, no analytics. The bundle is a compiled-in TypeScript module. There is no allow rule
registered against the privileged HTTP boundary because there is no request to make.

**Article text is data, never markup.** The shared renderer builds DOM nodes and never assigns to
`innerHTML`, so nothing in a Markdown file can inject an element or a script. An `https://` link
inside an article is rendered as a button that hands the address to the operating system's browser;
a link to any other scheme is rendered as plain text with its target visible rather than made
clickable.

**Article text is data, never instruction.** These files are checked into the repository and are
treated as content to display. Nothing in them is executed, and nothing in them configures the
application.

**Nothing private is stored.** The only state this feature persists is which articles you have read,
which you have bookmarked, the last article opened and the width of the index pane. No article
content is written back out, and no secret ever passes through here.

## Verification

Build-time:

```
node scripts/bundle-docs.mjs        # writes the bundle
node scripts/check-docs-bundle.mjs  # fails when it does not match docs/features/
```

To watch the guard actually fail rather than assuming it would — which is the only thing that proves
a guard — add a file to `docs/features/` without regenerating, and confirm the checker exits
non-zero naming that file. Then regenerate and confirm it goes green. A guard nobody has seen fail is
a decoration.

In the application:

- Open **Documentation**, follow a link from one article to another, and use **Back**.
- Click a link that points outside the bundle and confirm the notification names the target.
- Search for a word that appears in a body but in no title, with body search on and then off.
- Switch the search to a regular expression through the builder and confirm the same rows match.
- Select several articles, mark them read in bulk, and confirm the change appears in local history.
- Run **Verify the bundle now** and read the reported article count.
- Read it in bilingual mode at humour level 5 in both languages, and confirm the chrome still names
  the article count, the category and the source file exactly.

## Suggested articles

- [The settings surface](settings.md) — where this feature's own settings are rendered, and the
  place to change the starting article.
- [Toy locks](locks.md) — a long article with plenty of internal links, which makes it the useful one
  to test link resolution and the heading outline against.
- [Feature handoff — index](README.md) — the index this browser derives its categories from.
