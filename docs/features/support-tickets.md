# Support Tickets

> The recovery route out of a toy lock, dressed as a support desk. It plays the part properly — a ticket form, a locally generated ticket number, a severity nobody honours, a status that advances, and a canned first reply from a service desk that has read the manual once — and then the "resolution" does the only thing that actually works: it opens the application data folder in the platform's own file manager so the user can delete it themselves.

Module: `app/src/renderer/features/support-tickets/`
Destination id: `supportTickets.desk`
Settings section id: `supportTickets`
Documentation articles: `supportTickets.overview`, `supportTickets.recovery`
Satisfies: **FEATURE_INVENTORY row 8.4**

---

## What it does

A toy lock (see `features/locks`) is a self-imposed speed bump, not security and not
encryption. Forgetting its password or losing the authenticator that holds its one-time
code is a normal outcome, so recovery has to be self-service: delete the application data
folder and every toy lock goes with it.

Support Tickets is that recovery route, wearing a lanyard.

- **A ticket form.** A category, a severity, and a description. Every control is the
  application's own component-kit control, so both pickers carry their filter field and
  their anchored pattern builder like every other dropdown in the product.
- **A locally generated ticket number** in the form `WDS-482913`, drawn from
  `crypto.getRandomValues`, checked for collision against the tickets already stored, and
  meaningful on this machine and nowhere else.
- **A severity nobody will honour.** It is stored with the ticket. Nothing anywhere in the
  application reads it to decide anything, and the field's own supporting text says so in
  as many words at every humour level.
- **A status that advances**, one step per deliberate user action: Received → Triaged →
  Escalated → Resolution issued → Closed. It advances when the user presses **Chase this
  up**, never on a timer — a timer would imply somebody is working on it.
- **A canned first response**, generated on this machine at the moment the ticket is
  raised, plus one further canned reply at each status step.
- **The resolution**: the exact application data folder, shown in a read-only field, with a
  copy action beside it and a button that opens that folder in the platform's own file
  manager.

### The one plain line

One sentence on the surface sits **outside the comedy and unstyled by the funny level**:

> Nothing here is sent anywhere. No ticket exists outside this computer, no network request
> is made, no data is collected, and nobody is reading it. This is the application talking
> to itself, and no reply is coming.

It lives in `disclosure.ts` and is deliberately **not** routed through `t()`. A key with a
five-rung humour ladder is exactly the thing this must not become. It does honour the
language mode — a Cantonese reader needs this sentence more than any other, not less — so
it is written once per language, exactly, and rendered exactly, at every level from 1 to 5.
In bilingual mode both halves render, one under the other, with neither compressed into a
footnote.

### What it never does

- **It never deletes anything for the user.** The resolution opens the folder and stops
  there. There is no code path anywhere in this feature that removes that directory.
  Deleting it is the user's own action in their own file manager, and the surface says so.
- **It never impersonates anybody.** The desk is this application's own and fictional. It
  borrows no company's name or branding, invents no representative's name, references no
  real case-management system, and quotes no response time. A line naming it as fictional
  renders above every entry point.
- **It never makes anybody wait for the joke.** The resolution card is available
  immediately and unconditionally, at the top of the surface, whatever status any ticket
  happens to be in. Somebody locked out of their own application is not made to scroll past
  a bit to reach the thing that fixes it.
- **It never sends anything.** There is no `http` call, no fetch, no queue, no outbox and no
  retry loop in this feature. The privileged bridge's HTTP surface is never touched.

### Where it is reachable from

| Route | How it is wired |
| --- | --- |
| The **Forgotten your password?** link in a toy-lock unlock prompt | `adopt.ts` — see *Adoption of the unlock prompt* below |
| The **Support Tickets** destination in the tab strip | `TabDefinition` with id `supportTickets.desk` |
| The lock setting / the Support Tickets settings section | The `supportTickets.openDesk` action control, and the `supportTickets.folder` custom control which carries the same path, copy action and open action |
| Help, and the command palette (`Ctrl+Shift+F`) | Six palette entries: the destination, a new-ticket command that teleports to the form, a destination that teleports to the resolution card, three live setting rows, plus three commands registered at `init` (open the folder, copy the path, open the anchored desk) |

### Adoption of the unlock prompt

The unlock prompt's *Forgotten your password?* link is rendered by the core lock service
(`core/locks.ts`), which opens a short built-in recovery note of its own. That note is
correct as far as it goes — same folder path, same open action — but it is not the full
desk, and this feature owns the full desk.

A feature module may not edit a file outside its own directory, so it cannot change where
that link points. Instead `adopt.ts` installs a narrow `MutationObserver` on the direct
children of the single overlay layer (`#md-overlay-layer`), recognises that surface by the
accessible name the core gives it (`Support Tickets`), and fills its body with the complete
desk. A desk this feature opened itself is skipped, because that one is already complete.

This is a setting (`supportTickets.adoptUnlockPrompt`, on by default). With it off, the
built-in note is left exactly as the core wrote it — which still shows the same path and the
same open action, so recovery works either way.

> A cleaner wiring exists and is preferable if the core is ever changed: have
> `core/locks.ts` dispatch a `studio:support-tickets` window event carrying the anchor, and
> fall back to its inline note only when nothing handled it. That is a one-line change in a
> file this feature does not own; see *Known limitations*.

---

## The list

The ticket list is a first-class list and carries everything a list in this application
carries.

- **Search** through `createSearchBar`, so it has its own anchored regex builder, with plain
  text as the default and regular expressions an explicit opt-in. The haystack is the ticket
  number, the description, and the localized category, severity and status labels.
- **Filters** for status and category, each a component-kit `select` and therefore each
  carrying its own filter field and builder.
- **Multi-select** with real checkboxes: click to toggle, **Shift**-click to extend a range
  from the anchor, **Shift+Space** to extend from the keyboard, **Ctrl/Cmd+A** to select
  every match, and **Arrow Up / Arrow Down** to move between row checkboxes without tabbing
  through every control on every row.
- **Honestly scoped select-all.** There is no single ambiguous "select all". There are three
  buttons, each naming its own exact count: *Select the N shown*, *Select all M matching,
  including the H not shown*, and *Select every one of the T stored tickets*. The middle one
  is disabled, with a stated reason, when every match is already on screen.
- **Inverse selection**, scoped explicitly to the current matches and saying so in its label.
- **Bulk actions**: advance the status, close, reopen, set the severity, export, copy, and
  delete. Each non-destructive action opens a reviewable preview first, distinguishing
  *"42 selected"* from *"42 will change"* and listing every skipped ticket with the exact
  reason it was skipped (already closed; not closed; already that severity). The Apply
  button is disabled, with a stated reason, when nothing would change.
- **Delete goes through the destructive-action super-confirmation gate** — two keys and a
  slider — with every affected ticket number listed and the irreversibility named. This
  deletes rows in the settings document; it never touches the folder.
- **Rich controls in rows.** A row renders the ticket's **live severity select**, wired to
  the same store method the bulk action uses, and a **Chase this up** button that is disabled
  with a stated reason once a ticket is closed. The correspondence sits behind progressive
  disclosure with a correct `aria-expanded` and a label that changes with the state.
- **Windowed rendering.** The list builds `supportTickets.pageSize` rows (25 by default) and
  offers *Show N more*. Five hundred tickets never instantiate five hundred live severity
  controls up front.
- **Honest empty states.** "No tickets yet" — with a real creation path that focuses the
  description field — is a different state from "Nothing matched", which names how many
  tickets are stored and offers to clear the search and both filters.

### Export

Every format the shared exporter offers (JSON, JSONL, YAML, TOML, XML, CSV, TSV, Markdown,
HTML, SQL) with three explicit scopes: the current selection, everything matching the search
and filter, or every stored ticket. The preflight runs **before** anything is written and
names any field the chosen format cannot carry faithfully, or states plainly that the format
carries every field. A saved file offers *Open in editor* through the shared editor bridge,
and the clipboard copy appends the disclosure sentence so a pasted export still says where
it came from and where it did not go.

---

## Configuration

| Setting id | Kind | Default | What it does |
| --- | --- | --- | --- |
| `supportTickets.defaultSeverity` | select | `urgent` | Preselects one severity in the form. Every severity behaves identically, so this changes the wording of a new ticket and nothing else. |
| `supportTickets.pageSize` | number (5–200) | `25` | How many rows the list builds before offering *Show more*. |
| `supportTickets.adoptUnlockPrompt` | switch | `true` | Whether the unlock prompt's *Forgotten your password?* link opens the full desk or keeps the core's short built-in note. |
| `supportTickets.openDesk` | action | — | Opens the Support Tickets destination. |
| `supportTickets.folder` | custom | — | Shows the exact application data folder, read-only, with copy and open actions. Marked `lockable: false` with a stated reason: it is the recovery route out of every other lock, and locking it would make a lockout unrecoverable. |
| `supportTickets.prune` | custom | — | Choose a date, see exactly how many tickets were raised before it, then delete them through the destructive-action gate. Nothing prunes automatically and nothing is removed on a schedule. |

Every one of these carries its progressive-disclosure explanation and its truthful
default-provenance line, because they are rendered by the shared `renderSettingRow`, which
names the real compiled-in value rather than the word "default".

### Storage and bounds

Tickets live in the application's own settings document under `supportTickets.records`.

| Bound | Value | Behaviour at the limit |
| --- | --- | --- |
| Stored tickets | 500 | Raising another is refused with the exact stored count. The oldest is never silently dropped. |
| Description length | 4000 characters | Refused with the exact count and the exact limit. What the user typed is not lost. |
| Retained replies per ticket | 40 | Oldest first out. |

Every stored record is re-validated on read (`sanitizeTicket`). A malformed entry — a
category or status this build does not know, a missing timestamp — is dropped rather than
guessed at, so a hand-edited or downgraded settings file cannot render a broken row.

---

## Failure modes

| Failure | What happens |
| --- | --- |
| The file manager cannot be opened | `revealUserData` is tried first, then `shell.openPath` as a fallback. If both are refused, the exact error from both and the exact path are shown in an error status, announced assertively, and raised as a persistent error notification. The path is on screen and selectable throughout, so the folder is still reachable by hand. |
| The clipboard refuses the copy | The exact error and the exact path are shown. The read-only path field is still selectable, so the path can be copied by hand. |
| The store is at its ceiling at startup | A warning notification names the limit once at boot, rather than only surprising the user at the moment they press Submit. |
| The description is empty or too long | Refused inline with the exact reason, announced assertively, focus returned to the field. Nothing is written and nothing typed is lost. |
| A bulk action would change nothing | The preview says so, listing every skipped ticket with its reason, and Apply is disabled with that reason as its explanation. |
| The export is cancelled at the save dialog | Reported as *no destination was chosen, so nothing was written* — never as a success. |
| The settings write fails | The settings store logs the failure; the ticket list still reflects the in-memory state, and the folder resolution is unaffected because it reads from the privileged bridge, not from storage. |
| A history write fails | The recorder logs it and never fails the user's operation, per the shared history contract. |
| The overlay layer does not exist yet | The adoption observer waits on `document.body` for the layer to be created by the first overlay of the session, then narrows to watching that layer's direct children and disconnects the wider observer. |

---

## Security and privacy considerations

- **No network, ever.** This feature makes no HTTP request and registers no allow-list rule.
  There is nothing to intercept, because nothing leaves the machine.
- **No secrets are read, written, described or implied.** The feature never touches the
  credential vault. It never displays, hints at, or characterises a stored lock password or
  one-time-code secret — not its value, not its length, not its composition. The recovery it
  offers is deleting the folder, not recovering the credential.
- **It cannot be used to delete anything.** The only destructive capability it has is
  removing its own ticket rows, and that is behind the two-key gate. It has no delete-folder
  path, so it cannot be tricked into one.
- **The recovery control is deliberately not lockable.** `supportTickets.folder` sets
  `lockable: false` with a stated reason. A toy lock placed on the route out of every other
  toy lock would turn a for-fun speed bump into an unrecoverable state, which is the one
  thing this whole area of the application must never do.
- **Ticket text is user content and is treated as such.** Descriptions are rendered as text
  nodes, never as markup, and are excluded from the notification bodies. The exported
  payload is generated by the shared exporter, which escapes per format.
- **Nothing here is a security boundary and nothing claims to be.** The word "security" does
  not appear on the surface, and the copy never describes a toy lock as protecting,
  securing, or encrypting anything.

---

## Accessibility, language and layout

- All copy passes through `t()` with English and playful Hong Kong Cantonese ladders at all
  five humour levels — except the disclosure sentence, deliberately, as described above.
- Facts never move with the humour level: the ticket number, the folder path, the counts,
  the limits, the error text and the sentence naming what a delete cannot undo read
  identically at level 1 and level 5.
- Emoji appears only through the shared dialog decoration path (`{ dialog: true }`), so it
  reaches overlay and notification titles when the emoji switch is on and never reaches a
  button label, a field label or an accessible name.
- **School mode needs no special handling here.** This feature exposes no Cantonese-only
  control, no funny-level control, no personal-vocabulary control and no dim-sum capability
  of its own; its copy goes through `t()`, which already suppresses those capabilities while
  the mode is on.
- Every interactive element is keyboard reachable with a visible focus ring, has an accessible
  name distinct from its row's label, and is built by the component kit, which asserts a
  44×44 minimum target in development builds.
- Status changes, selection counts, copy and open results, and bulk outcomes are announced on
  the shared live regions — politely for progress, assertively for failures.
- Wide content scrolls inside its own container; rows wrap rather than clip, so the longest
  bilingual labels at 200% display scale reflow instead of truncating.
- The anchored desk is a resizable, draggable overlay with persisted geometry
  (`supportTickets.desk`), bounded by the viewport, scrolling internally, and never covering
  its own anchor — all inherited from the shared overlay service.

---

## Local history

Every user-visible state change is recorded through the shared recorder under the source
`supportTickets`, so each is browsable, filterable and undoable alongside every other change
in the application:

`Raised a support ticket` · `Advanced support tickets` · `Closed support tickets` ·
`Reopened support tickets` · `Changed the severity of support tickets` ·
`Deleted support tickets` · `Exported support tickets` ·
`Opened the application data folder`

Payloads carry ticket ids, counts and lengths — never the description text, and never a
credential.

---

## Verification

Manual verification against a real build:

1. **The route from a lock.** Lock any element, reload, trigger the unlock prompt, press
   *Forgotten your password?* → the full desk opens anchored beside it, with the resolution
   card first. Turn `supportTickets.adoptUnlockPrompt` off and repeat → the core's short
   built-in note appears instead, still showing the same path and open action.
2. **The disclosure is unstyled by humour.** Set the English funny level to 1, read the
   sentence, set it to 5, read it again → byte-identical. Switch to Cantonese → the Cantonese
   sentence, also identical across levels. Switch to bilingual → both, stacked.
3. **The resolution works.** Press *Open that folder* → the platform file manager opens at
   the path shown in the field. Press *Copy the path* → the clipboard holds exactly that
   path. Confirm the folder is unchanged afterwards: this application opened it and did
   nothing else.
4. **Nothing leaves the machine.** With the developer tools network panel recording, raise a
   ticket, chase it up, export it and open the folder → zero requests.
5. **The workflow.** Raise a ticket → status Received with one canned reply. Chase it up four
   times → Triaged, Escalated, Resolution issued, Closed, one reply each. Chase again → the
   button is disabled and its reason says the ticket is already closed.
6. **Bounds.** Paste 4001 characters → refused, naming 4001 and 4000, with the text intact.
7. **Bulk honesty.** Select five tickets of which two are closed, press *Close* → the preview
   reads "3 of the 5 selected will change. 2 will be skipped" and names the two with the
   reason.
8. **The gate.** Select tickets, press *Delete the selection* → the two-key gate lists every
   affected ticket number. Cancel → nothing changed. Complete it → exactly those rows are
   gone and the folder is untouched.
9. **Keyboard only.** Tab to the first row checkbox, Arrow Down through rows, Space to
   toggle, Shift+Space to extend, Ctrl+A to select every match, then reach and operate every
   bulk action without a pointer.
10. **The palette.** `Ctrl+Shift+F`, type "support" → the destination, the new-ticket command,
    the resolution destination, the three live setting rows and the three commands all
    appear; selecting the resolution destination teleports to and highlights the resolution
    card.
11. **Layout.** At 320 px, and at 100/125/150/200% display scale, in bilingual mode: nothing
    clips, the page does not scroll sideways, and the overlay stays inside the viewport.

Type checking: `npm run typecheck` in `app/` reports no error in
`src/renderer/features/support-tickets/`.

---

## Known limitations

- **The unlock-prompt route is adopted rather than wired.** `core/locks.ts` calls its own
  local `openSupportTickets` directly, so this feature intercepts the resulting overlay
  instead of being called. It works and is bounded, but the honest fix is a one-line change
  in a file this feature does not own: dispatch a `studio:support-tickets` window event
  carrying the anchor and let the inline note be the fallback when nothing handled it.
- **Tickets are cleared by exactly the folder deletion they point at.** This is intentional
  and stated on the surface. Whether it is a design flaw or the funniest part of the whole
  thing depends on where the humour slider is.

---

## Suggested related articles

- [Toy locks and the unlock prompt](locks.md) — what Support Tickets is the recovery route *for*.
- [Local version history](history.md) — where every ticket change is recorded and undone.
- [Export](export.md) — the shared exporter, its formats and its preflight.
- [Accessibility & themes](accessibility-themes.md) — the language modes and funny levels this surface obeys.
