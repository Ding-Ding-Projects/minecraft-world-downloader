import type { DocArticle } from '../../core/registry';

/**
 * The in-application articles for this feature.
 *
 * They are bundled into the build, so the documentation browser works with no
 * network connection at all, and they carry no remote asset of any kind.
 */

export const ARTICLES: DocArticle[] = [
  {
    id: 'app-identity.rename',
    title: 'Renaming the application',
    category: 'Identity',
    body: [
      'You can change the name this application shows you. Open **About**, type a name into **Display name**, and the title bar, the notifications and this surface follow it immediately. Leave the field empty, or press **Restore the shipped name**, and it goes back to the name it shipped with — one action, no dialog to negotiate with.',
      '',
      '## What a rename changes',
      '',
      'The display name, and nothing else. It is a label the application reads when it introduces itself:',
      '',
      '- the window title bar',
      '- the title the operating system shows for the window',
      '- notifications that name the application',
      '- the About surface itself',
      '',
      '## What a rename never changes',
      '',
      'The package identity, the application data directory, the version history repository, the log directory, the settings file, the installer identity and the update feed. Every one of those is derived from a compiled-in constant in the main process, never from a setting.',
      '',
      'That separation is the whole reason renaming is safe to offer. A data directory derived from a mutable display name orphans every stored profile, credential and history entry the moment somebody types a new title — and the person who typed it has no way to know that is what happened.',
      '',
      '## The checks are real',
      '',
      'The **What a rename does not move** card does not simply assert this. Each line is evaluated when the surface opens and when you press **Run the checks again**, against the paths and the settings store this window is actually using:',
      '',
      '- the final segment of the data directory is compared with the package identity',
      '- the history directory, the log directory and the settings file are tested for containment inside the data directory',
      '- every settings key is scanned for one holding your chosen name, and the result is listed by key',
      '- the settings store is checked for any key that could move the package identity',
      '- the shipped name is confirmed to be present for anything that has to be exact',
      '',
      'The evidence beside each verdict is the value that was read, not a description of it. A check that cannot decide says **Inconclusive** rather than guessing in either direction.',
      '',
      '## Diagnostics keep the shipped name',
      '',
      'A diagnostic report, a crash log and anything you file as an issue identify this software by its **shipped** name, not the one you chose. Nobody reading a bug report has heard of your name for it, and a report nobody can place is a report nobody can act on. The rename editor says so directly beneath the field.',
      '',
      'If you want your local name mentioned as well, turn on **Note the local display name in diagnostic reports** in settings. The shipped name stays in the report either way.',
      '',
      '## Limits',
      '',
      'A display name is at most 80 characters, because a title bar cuts off anything longer. Invisible control and formatting characters are refused: they render as nothing or as a small box, and a name that looks empty is worse than no name at all. A refused name changes nothing — the previous name is still in force and the field tells you exactly what was wrong.',
      '',
      '## History',
      '',
      'Every rename and every restore is recorded in the local version history as its own entry, with the name before and the name after. History is append-only, so a restore can itself be undone by typing the earlier name again, and the earlier name is readable in the history panel rather than being gone.'
    ].join('\n'),
    related: ['app-identity.about', 'core.appearance', 'core.history']
  },
  {
    id: 'app-identity.about',
    title: 'The About surface',
    category: 'Identity',
    body: [
      'About collects everything that answers "what exactly am I running, and whose work is it built on".',
      '',
      '## Identity values',
      '',
      'A searchable table of every identity value this build holds, with a **Kind** column that is the point of it:',
      '',
      '- **Constant** — compiled in, and no setting can reach it. The package identity, the shipped product name, the version and the licence.',
      '- **Display** — the one value a rename moves.',
      '- **Path** — derived from the package constant: the data directory, the version history repository, the logs and the settings file.',
      '- **Runtime** — reported by the running process: platform, architecture, Electron, Chromium, Node, V8, whether the build is packaged, and when it started.',
      '',
      'The table carries the full list contract: a search field with its pattern builder, multi-select with shift ranges and a keyboard path, a select-all that says whether it means what is shown or everything there is, an inverse selection, per-row copy, bulk copy with a preview, and export in every format that can carry the rows. Choosing a format shows what that format cannot carry faithfully **before** anything is written.',
      '',
      '## Release code name',
      '',
      'Every release carries a dim sum code name beside its version number. The code name is a label and never a replacement for the version: the version number is what identifies a build to a person or a machine.',
      '',
      'The photograph of the dish lives in the public catalogue and is deliberately not bundled here, so this surface links to the catalogue rather than shipping a picture. If no code name has been recorded for your build, the surface says so plainly instead of inventing one; the release notes hold the authoritative name, and you can record it here so this window agrees with them.',
      '',
      'While the named study mode is on, this card behaves as though it is not installed: it is omitted from the surface entirely rather than shown and disabled.',
      '',
      '## Licence, cost and credits',
      '',
      'The licence is stated with a link to its full text. The cost is nothing, in any direction: no purchase, no fee, no subscription, no lapsing trial, no capability held back, and no payment of any kind routed through this project.',
      '',
      'This application is built on a great deal of other people\'s work, so the credits list every project it depends on with a link to that project\'s **own** page. If you want to fund any of it, fund them: anything they accept goes to them, and no link here passes through this project. Whether a given project accepts money at all is stated on their page and is deliberately not guessed at here.',
      '',
      '## Diagnostic report',
      '',
      'A plain-text report you can paste straight into an issue. It is headed with the shipped name, lists the versions and the paths, and records what the identity checks actually found. Paths are shortened to the application directory by default — everything above it is your account name and the shape of your machine, and a report is perfectly useful without either. Turn the shortening off in settings if a reader needs the full path.',
      '',
      'The report can be copied to the clipboard, saved to a file, and then opened in an external editor. **Open the report in an editor** stays disabled until the report has been saved, and says why: an editor opens files, not clipboards.'
    ].join('\n'),
    related: ['app-identity.rename', 'core.export', 'core.overview']
  }
];
