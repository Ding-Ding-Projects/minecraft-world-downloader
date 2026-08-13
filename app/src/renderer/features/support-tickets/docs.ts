import type { DocArticle } from '../../core/registry';
import { MAX_DESCRIPTION, MAX_TICKETS } from './model';

/**
 * The bundled documentation articles.
 *
 * They are plain Markdown strings compiled into the build, so the in-application
 * documentation browser works with no network connection. No article references
 * a remote image, a remote stylesheet or an external service.
 */

const OVERVIEW = `# Support Tickets

Support Tickets is a local support desk with one honest job: to open the folder
that actually resolves a lockout, and to let you fill in a form on the way there
if you feel like it.

**Nothing here is sent anywhere.** No ticket exists outside this computer, no
network request is made, no data is collected, and nobody is reading it. That
sentence appears on the surface itself, outside the humour setting, so it reads
identically whether the application is being cheerful or terse. A person who
cannot get back into their own application must never sit waiting for a reply
that was never coming.

The desk is **this application's own, and fictional**. It does not name, imitate
or imply any real company, product, person or case-management system, it never
quotes a response time, and it never suggests a human is looking at anything.

## What it does

* Raises a ticket with a category, a severity and a description.
* Gives it a **locally generated ticket number**, in the form \`WDS-482913\`,
  unique on this machine and meaningful nowhere else.
* Records a **status** that advances one step at a time when you chase it up:
  Received, Triaged, Escalated, Resolution issued, Closed.
* Adds a **canned reply** from the desk at each step. The replies are canned,
  they say so, and they are generated on this machine at the moment you ask.
* Shows the **resolution**: the exact application data folder, copyable, with a
  button that opens it in your platform's own file manager.

## What it never does

It **never deletes anything for you**. The resolution opens the folder and stops
there. Deleting it is your own action, in your own file manager, and the surface
says so at every humour level.

It never treats one severity differently from another. The severity is stored
with the ticket and honoured by nobody, which the field says in as many words.

It never blocks the resolution behind the workflow. The folder controls are
available immediately, whatever status any ticket happens to be in.

## Where to reach it

* The **Forgotten your password?** link in any toy-lock unlock prompt.
* The **Support Tickets** destination in the tab strip.
* The command palette, under \`Ctrl+Shift+F\`, by name.
* The Support Tickets settings section.

## Bounds

* At most **${MAX_TICKETS}** stored tickets; beyond that, raising another is
  refused with the exact count rather than silently dropping the oldest.
* At most **${MAX_DESCRIPTION}** characters in one description, refused with the
  exact count and the exact limit, without losing what you typed.
* At most forty retained replies per ticket, oldest first out.

## Suggested articles

* [Recovering from a toy lock](supportTickets.recovery)
* [Toy locks](core.locks)
* [Local version history](core.history)
`;

const RECOVERY = `# Recovering from a toy lock

A toy lock is a self-imposed speed bump, not security and not encryption. It
protects nothing from anybody else with access to this computer, and forgetting
its password or losing its authenticator is a normal outcome rather than a
disaster. Recovery is therefore self-service, documented, and needs no account,
no ticket and no support channel.

## The recovery, in one sentence

Delete this application's data folder. Every toy lock goes with it.

The exact path is shown in three places: in the unlock prompt, in the lock
setting, and on the Support Tickets surface, where it sits in a read-only field
beside a copy action and a button that opens the folder in your file manager.

## What else goes with it

Everything this application stores locally beside those locks: settings,
appearance overrides, authenticator entries, notification history — and the
support tickets themselves, which is either a design flaw or the funniest part
of the whole thing, depending on where the humour slider is.

It does **not** touch anything outside that folder. Your worlds, your exports and
your own documents live wherever you put them and are unaffected.

## Doing it

1. Open Support Tickets, from the unlock prompt's *Forgotten your password?*
   link or from the tab strip.
2. Read the exact folder path. Copy it if you would rather navigate by hand.
3. Press **Open that folder**. The platform's own file manager opens there.
4. Close this application.
5. Delete the folder yourself, in your file manager.

Step five is yours. This application will not do it, will not offer to do it,
and has no code path that does it. If a future version ever did offer an
in-application delete, it would go through the two-key destructive-action gate
like every other irreversible action — never behind a joke button.

## When the folder will not open

The button reports the exact error and repeats the exact path, so the folder is
still reachable by hand. This is more common than it sounds on a locked-down
machine where the shell integration is restricted; the path is the part that
matters, and it is always on screen and always selectable.

## Deleting tickets without deleting the folder

Ticket records can be deleted individually or in bulk from the list, which shows
the exact count and every affected ticket number before anything happens, then
goes through the destructive-action gate. That removes rows from this
application's settings document. It does not touch the folder.

## Suggested articles

* [Support Tickets](supportTickets.overview)
* [Toy locks](core.locks)
* [Export](core.export)
`;

export const supportTicketsDocs: DocArticle[] = [
  {
    id: 'supportTickets.overview',
    title: 'Support Tickets',
    category: 'Locks and recovery',
    body: OVERVIEW,
    related: ['supportTickets.recovery', 'core.locks', 'core.history']
  },
  {
    id: 'supportTickets.recovery',
    title: 'Recovering from a toy lock',
    category: 'Locks and recovery',
    body: RECOVERY,
    related: ['supportTickets.overview', 'core.locks', 'core.export']
  }
];
