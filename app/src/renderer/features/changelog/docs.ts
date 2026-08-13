import type { DocArticle } from '../../core/registry';

/**
 * The in-application documentation for the changelog viewer.
 *
 * It is the same text as `docs/features/changelog.md` in the repository, kept
 * here so the offline documentation browser can render it without a network
 * request or a file read.
 */

export const CHANGELOG_DOCS: DocArticle[] = [
  {
    id: 'changelog.viewer',
    title: 'The changelog viewer',
    category: 'Data',
    body: [
      'Every version this project ever tagged is listed here, newest first — not only the most recent one — along with the work that has landed since the newest tag, which is shown separately as **Unreleased** so it is never mistaken for something that shipped.',
      '',
      'Each change carries the commit that made it, rendered as a short clickable reference such as `a1b2c3d`. Selecting it opens that commit on the project\'s own forge in your browser.',
      '',
      '## Where the entries come from',
      '',
      'The changelog is not written by hand and is not editable in the application. It is generated at build time from the repository\'s real commit history by `app/scripts/generate-changelog.mjs`:',
      '',
      '- a **version** is a git tag, and its **date** is that tag\'s own recorded date;',
      '- a **change** is a commit in the range between that tag and the one before it, with its subject copied verbatim;',
      '- a **category** — Added, Fixed, Security and the rest — is derived from the commit\'s own words, and a commit whose subject matches no rule is filed as **Other** and shown in full so you can judge it rather than being given a guess.',
      '',
      'Nothing is invented. A tag that points at the same commit as the tag before it has no changes to report, and the viewer says exactly that instead of quietly dropping the version or filling it with something plausible.',
      '',
      '## Why a wrong link would be worse than none',
      '',
      'Before the application is built, `app/scripts/validate-changelog.mjs` resolves every commit id in the bundle against the repository. A single id that does not resolve fails the build and names the release and the entry that carries it. It also refuses a short reference that is not a prefix of its full id, a commit URL template that is not https or has no `{sha}` placeholder, a duplicate version, a date that does not parse, and an entry that claims to summarize more commits than it lists.',
      '',
      'There is no way to skip it. If git is not available the validator cannot prove anything, so it fails and says so.',
      '',
      'Where the repository has no recognisable forge, commit ids are rendered as selectable text with the reason stated once at the top of the page, rather than as links that would resolve to nothing.',
      '',
      '## Entries that stand for several commits',
      '',
      'When several commits in one release carried the same subject, they become **one** entry. It says how many commits it stands for, links the commit that **completed** the change, and lists every commit in the group beneath it — so the single link is never presented as the whole story.',
      '',
      '## Filtering',
      '',
      'The date range, the search field, the category chips, **Breaking changes only** and **Released versions only** all compose. None of them overrides another: narrowing to a year and then typing a word gives you the changes in that year that match the word.',
      '',
      'One asymmetry is deliberate. The date range and the released switch apply to a **version**; the categories and the breaking switch apply to a **change**. Typing a version number therefore shows you that whole version rather than nothing, because what matched was the version itself.',
      '',
      'The search field is plain text by default. The affordance beside it opens the full pattern builder anchored to that field, and switching to a pattern is always an explicit act.',
      '',
      '## Copying and exporting',
      '',
      'Copy puts the current view on the clipboard as Markdown or plain text, whichever the setting says. Export writes the same thing to a file, or writes one row per change in any of the data formats the application supports.',
      '',
      'Every export honours the active filter and selection, so the file matches what you were looking at, and states the exact version range, the filter that produced it, the language it was written in and the commit the bundle was generated from. Commit ids survive as text in every format, so a changelog pasted into an issue three weeks later is still traceable.',
      '',
      'Each export shows a reviewable preview with the exact counts before anything is written.',
      '',
      '## Selecting versions',
      '',
      'Every version has a checkbox. Shift-clicking one selects the whole range between it and the last one you touched, and Space toggles whichever version has focus. **Select the versions shown** and **Select all matching versions** are different actions and say so: the first takes what is currently rendered, the second takes everything the filter accepts including the versions further down.',
      '',
      'With nothing selected, Copy and Export act on everything the filter matches. The line beneath the selection controls always states which of the two is about to happen, with the counts.',
      '',
      '**Open every commit in the browser** goes through the two-key confirmation gate. Nothing is deleted and nothing on disk changes, but a browser handed thirty pages cannot be told to take them back, so the gate names the exact number first.',
      '',
      '## Failure modes',
      '',
      '- **The bundle is missing.** The viewer renders an empty state naming the generator command rather than an empty list that looks like a project with no history.',
      '- **The clipboard refuses.** The asynchronous clipboard is tried first and the older selection route second; when both refuse, the reason is reported and no success message is shown.',
      '- **The browser refuses a commit page.** The count that actually opened is reported alongside the count that did not, with the reason.',
      '- **A commit message was too long.** Messages are capped in the bundle at a stated ceiling; a capped entry says so and points at the commit for the whole text.',
      '',
      '## Security considerations',
      '',
      'The viewer makes no network request. A commit URL is handed to the operating system through the privileged bridge, which accepts only `http` and `https`, and the template it is built from is proven to be https before the build finishes.',
      '',
      'Nothing in the bundle is treated as markup. Summaries and commit messages are inserted as text, so a commit subject containing angle brackets renders as the characters somebody typed. The remote URL recorded in the bundle has any user or credential component stripped by the generator.',
      '',
      '## Verification',
      '',
      '- `node scripts/generate-changelog.mjs --check` fails when the committed bundle no longer matches the repository.',
      '- `node scripts/validate-changelog.mjs` fails when any commit reference does not resolve, and has been checked by deliberately corrupting a commit id, a short reference, the URL template and a summary count, one at a time.',
      '- The viewer is exercised in all three language modes, at both funny-level extremes, with a keyboard only and with a screen reader; every control has an accessible name, the counts are announced on a live region, and no text clips at narrow widths or at 200% display scale.'
    ].join('\n'),
    related: ['core.export', 'core.history', 'core.regex']
  }
];
