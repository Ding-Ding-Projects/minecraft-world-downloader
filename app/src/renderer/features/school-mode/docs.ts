import type { DocArticle } from '../../core/registry';

/**
 * The in-application article. It is bundled into the build, rendered by the
 * shared markdown renderer and needs no network connection, exactly like every
 * other article.
 */
export function article(): DocArticle {
  return {
    id: 'school-mode.overview',
    title: 'The shared study mode',
    category: 'Getting started',
    body: [
      'The study mode is one switch shared by every application in this suite, not a setting that happens to have the same name in each of them. Its state, its name and which kind of unlock code exists are held in a single JSON record in a shared application-data folder. Turning it on anywhere turns it on everywhere.',
      '',
      '## What it does while it is on',
      '',
      'English is forced, and the Cantonese mode, the bilingual mode, both humour levels, the personal-vocabulary file and every dim sum capability behave as though they were not installed: their controls, copy, palette entries and search results are omitted rather than merely disabled, and the startup surprise is suppressed. Your stored choices for all of them are kept untouched and return the moment the mode goes off.',
      '',
      '## It arrives live, without a restart',
      '',
      'The record is re-read on a bounded interval — two seconds by default, adjustable from one to sixty — and immediately whenever the window regains focus. A change made in another application therefore lands here within that interval, and the interface repaints in place.',
      '',
      'The privileged bridge offers no filesystem watcher, so this is genuinely a poll rather than a push, and the control says so with the exact interval rather than implying something instant. If the record cannot be read or watched at all, the control says that too, names the exact error and the exact path, and states plainly that this application is then showing only its own local copy.',
      '',
      '## Renaming it',
      '',
      'The mode is yours to name. The name travels in the shared record with the state, so renaming it in one application renames it in all of them, and every surface then uses only the name you chose — labels, descriptions, search results, notifications and screen-reader names alike. Once you have chosen a name, no surface prints the original one; the route back to it is a button whose label does not name it.',
      '',
      '## Turning it off',
      '',
      'Turning it off asks for the unlock code. A password or PIN is stored as a PBKDF2 verifier, so the code itself is never written down anywhere; an authenticator pairing stores a standard TOTP secret instead. Either lives in this computer’s credential vault and never appears in the settings file, the shared record, an export, the version history, a log or a screenshot.',
      '',
      'Wrong answers are paced rather than punished: three attempts, then a short wait that grows and is capped at a minute. Nothing is ever wiped, and the recovery route is shown the whole time the prompt is open.',
      '',
      '## It is a user-experience lock, not security',
      '',
      'This is a speed bump you chose to put in your own way. It is not encryption, it protects nothing from anybody else using this computer, and anyone who can reach the disk can undo it. Deleting the shared record folder resets the mode completely, and the surface names that folder rather than hiding it — a lock that pretends to be protection is worse than one that is honest about what it is.',
      '',
      '## Failure modes',
      '',
      '- **The record is missing.** The first application to change the mode creates it; until then each application uses its own local copy and says so.',
      '- **The record is malformed, truncated or from a newer schema.** It is refused whole, nothing from it is applied, and the exact reason is shown. The bridge has no atomic rename, so a write interrupted at the worst possible moment can produce exactly this — and the next successful write repairs it.',
      '- **The folder cannot be written.** The change stays local to this application and is reported as such rather than being claimed as shared.',
      '- **The credential vault is unavailable.** No code can be stored until that is fixed; the buttons say which condition is unmet rather than sitting there inert.',
      '',
      '## Verification',
      '',
      'Turn the mode on, then look at the language settings: the Cantonese and bilingual choices, both humour sliders and the vocabulary control are gone rather than greyed out. Rename it and confirm the new name appears in the tab, the settings section, the command palette and the notifications. Edit the shared record in a text editor and watch the state follow within the configured interval. Delete the shared folder and confirm the mode resets.',
      '',
      '## Suggested articles',
      '',
      '- Language modes and humour levels',
      '- Toy locks and the elements they cover',
      '- Local version history'
    ].join('\n'),
    related: ['core.language', 'core.locks', 'core.history']
  };
}
