import type { DocArticle } from '../../core/registry';

/**
 * The bundled articles for this feature. Markdown only, rendered by the shared
 * renderer, with no remote asset of any kind.
 */

export const LOCK_DOCS: DocArticle[] = [
  {
    id: 'locks.overview',
    title: 'Toy locks',
    category: 'Locks',
    body: [
      'Any rendered element, any tab, any setting and any appearance value can be put behind a password or a one-time code from your own authenticator.',
      '',
      '## It is just for fun, and it says so every time',
      '',
      'A lock here is a speed bump you set for yourself. It is **not security**, **not encryption**, and it is **no protection at all** from anybody else who can use this computer. Every surface that creates or asks for a lock repeats that, at every humour level, because a lock that lets you believe it is protecting something is worse than no lock at all.',
      '',
      '## Every lock carries its own credential',
      '',
      'There is no master password and no inheritance. Unlocking one surface never unlocks another. Locking a tab group does not relock its members under the group\'s credential. A locked appearance value inside a locked tab is two locks with two answers.',
      '',
      'If you want one password everywhere, you get there by deliberately typing the same one into each wizard. The application never assumes it, which is why the bulk route opens a queue with one wizard per item rather than asking once and reusing the answer.',
      '',
      '## What actually enforces a lock',
      '',
      '| What is locked | What refuses |',
      '| --- | --- |',
      '| A tab | Opening it asks for its credential |',
      '| A setting | The settings surface and the command palette both ask |',
      '| An element selector | Clicking, double-clicking, Enter and Space on any matching element ask |',
      '| An appearance value | Changing it while the lock is on puts it straight back |',
      '',
      'A lock whose target nothing in this build enforces is still listed, labelled as a record only. It is never hidden, because a lock you cannot see is a lock you cannot remove.',
      '',
      '## Where the credential lives',
      '',
      'In the operating system credential vault, under a per-lock account key. A password is stored as a verifier and never as the password. A one-time code is standard TOTP against a secret **you** supply through your own authenticator, checked with a small clock-skew window — the application never mails, texts or invents a code.',
      '',
      'No credential enters the settings file, a preset, an export, a history entry, a screenshot, a log or telemetry. The lock list exports without them and the export says so in its own rows.',
      '',
      '## Unlock duration',
      '',
      'Each lock stores its own: this surface only, a number of minutes, or until the application closes. Unlock state is never persisted, so everything is locked again the next time the application starts. Two optional settings shorten it further — relocking when the window loses focus, and relocking after a number of idle minutes.',
      '',
      '## A wrong answer',
      '',
      'It says the answer did not match, it names the recovery route, and it does nothing else. Nothing is wiped, nothing escalates, and after five wrong answers in a row it pauses for ten seconds rather than locking you out further.',
      '',
      '## Locked things stay honest in search',
      '',
      'A locked tab still appears in the tab strip and the four tab searches, marked with a padlock. A locked setting still appears in the settings surface and the command palette. Selecting one prompts to unlock rather than teleporting past the lock or silently doing nothing.'
    ].join('\n'),
    related: ['locks.recovery', 'locks.appearance', 'core.locks']
  },
  {
    id: 'locks.appearance',
    title: 'Locking an appearance value',
    category: 'Locks',
    body: [
      'The per-element appearance editor writes one CSS property at a time against one selector. A lock can be put on exactly that pair, so a value you are happy with stops moving.',
      '',
      '## How to create one',
      '',
      'Open **Locks**, choose **Lock something…**, switch the kind to **Appearance values**, pick the property, then pick the elements. Each chosen pair becomes its own lock with its own credential.',
      '',
      '## How it is enforced',
      '',
      'The value at the moment the lock is created is remembered. While the lock is on, any change to that property on that selector is put straight back and a notification says exactly what was restored and to what. Unlock it and the value moves freely again; the remembered value follows whatever you set while it is unlocked.',
      '',
      '## What it does not do',
      '',
      'It does not stop the appearance editor from opening, and it does not grey the control out. The change is refused after the fact rather than before it, and the notification names the property, the selector and the restored value so the refusal is never mysterious.',
      '',
      '## Scope',
      '',
      'A lock covers one property on one selector. A broad selector such as `.md-btn` covers every button that matches it — which is real, and worth knowing before you choose it.'
    ].join('\n'),
    related: ['locks.overview', 'locks.recovery', 'core.appearance']
  },
  {
    id: 'locks.recovery',
    title: 'Getting back in',
    category: 'Locks',
    body: [
      'Forgetting a password or losing an authenticator is a normal outcome for a toy lock, so recovery is self-service and documented rather than hidden.',
      '',
      '## The one route that always works',
      '',
      'Delete the application data folder. Every lock on this machine goes with it, along with everything else stored locally there — settings, the local history repository and the credential store. The exact path is shown in the Locks destination, in the lock setting, and in the unlock prompt itself, so it is in front of you at the moment you need it.',
      '',
      'The application opens that folder for you and stops there. The deletion is yours to make in your own file manager, because deleting a folder full of your own data is not something an application should do on a hunch.',
      '',
      '## There is no ticket, no account and no support channel',
      '',
      'Nothing here leaves this machine. There is nobody to ask and nothing to reset remotely, and the interface never implies otherwise.',
      '',
      '## Before you get that far',
      '',
      'The Locks destination lists every lock with its own **Remove this lock** action, and that page is deliberately never blocked by an element lock — so a selector broad enough to block the rest of the window can still be removed from the one page whose job is removing it.',
      '',
      'A lock can also have its credential replaced from that list. Replacing one changes that lock and nothing else.'
    ].join('\n'),
    related: ['locks.overview', 'locks.appearance', 'core.locks']
  }
];
