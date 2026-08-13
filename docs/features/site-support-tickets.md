# Support Tickets (site)

> The site's own recovery route out of a toy lock, dressed as a support desk. It plays the part
> properly — a ticket form, a locally generated ticket number, a severity nobody honours, a status
> that advances, and a canned first reply from a service desk that has read the manual once — and
> then the "resolution" does the only thing a static page actually can: it walks the visitor through
> clearing this site's own browser storage, and offers to do it for them, in place, behind the
> destructive-action gate.

Module: `site/assets/site.js` (`Studio.support`, section 21 of that file's own internal numbering;
section 20 of [`SITE_API.md`](../../site/SITE_API.md))
Wired from: `site/settings.html` (the Locks tab and the Storage tab), and `site/assets/site.js`'s own
unlock prompt and command palette
Storage key: `wds.tickets` (see [`SITE_API.md` §3](../../site/SITE_API.md#3-storage--studiostore))
Satisfies: **FEATURE_INVENTORY row 8.4**, and is the concrete site-side mechanism behind row 8.3's
"Site equivalent clears the site's own storage and says so" note.

This article documents the site's implementation specifically. For the desktop application's
version of the same feature — which opens a real file-manager window on a real application-data
folder, because it has one — see
[`docs/features/support-tickets.md`](support-tickets.md). The two are deliberately not identical:
a browser tab has no folder to open, so the site's resolution is the honest browser-storage
equivalent, not a copy of the desktop flow with the words changed.

---

## What it does

A toy lock on this site (see [`locks.md`](locks.md)) is a self-imposed speed bump, not security and
not encryption, exactly as the desktop application's locks are. Forgetting its password or losing
the authenticator that holds its one-time code is a normal, expected outcome, so recovery has to be
self-service. On a static page there is no server account to reset and no support inbox behind it —
the only thing that actually reverses a lockout is clearing this browser's storage for this origin,
which removes every lock along with everything else the site has remembered.

Support Tickets is that recovery route, wearing a lanyard.

- **A ticket form.** A category picker and a description field. The category picker is
  `Studio.createSelect`, so — like every dropdown on this site — it carries its own keyboard-focusable
  filter field and its own anchored pattern builder, even though the list is short.
- **A locally generated ticket number**, in the form `WDS-482913`, drawn from `Math.random()` at the
  moment the ticket is raised. It is not a secret and not a credential — it exists only so a visitor
  can tell two tickets apart on this one browser — so it does not need `crypto.getRandomValues`, and
  it is never checked against, or meaningful on, any other machine.
- **A severity nobody will honour.** Every ticket is filed as `Critical`, unconditionally, and
  nothing anywhere reads that field to decide anything. It is theatre, and the surface's own
  disclosure line says so.
- **A status that advances**, one step per deliberate press of **Chase it up**, never on a timer —
  a timer would imply somebody is working on it. The ladder is *Received → Triaged → Assigned to an
  engineer → Awaiting your reply → Resolved*, with one further canned reply appended at each step.
- **A canned first response**, composed on this machine at the moment the ticket is raised.
- **The resolution**, available on every ticket that has reached the last step: this site's own
  origin, shown in a copyable field, a short explanation of how to clear a site's stored data through
  ordinary browser settings, and a **Clear this site's stored data now** button that performs the
  clear itself, in place, behind the destructive-action confirmation gate
  (`Studio.confirm`, [`SITE_API.md` §14](../../site/SITE_API.md#14-destructive-confirmation--studioconfirm)).

### The two routes, and which is which

The resolution offers exactly two things, and they are different in kind:

1. **Do it yourself, in your browser's own settings.** A sentence naming the general path (Settings,
   then Privacy, then site data, then this site) plus this site's exact origin in a copyable field, so
   the visitor can paste it into their browser's own site-data search box. This changes nothing by
   itself — it is instructions, not an action — and it works even with JavaScript refused, because it
   never depends on this page running at all.
2. **Let the page do it.** The **Clear this site's stored data now** button calls
   `Studio.store.clearAll()` directly, from this page, immediately, for every key this site owns. It is
   irreversible, so it sits behind the two-key destructive-confirmation gate, which names the exact
   action, the exact origin, and states plainly that language, funny levels, theme, tabs, locks,
   tickets, history and authenticator entries all go.

Both routes end at the same place — this origin's storage is empty — so a visitor who distrusts the
in-page button, or whose browser has JavaScript off, is never stuck: route 1 works regardless of
whether route 2 is trusted or even available.

### The one plain line

One sentence on the surface sits **outside the comedy and unstyled by the funny level**, rendered as
`<p class="note--plain">` with no emoji and no theme accent:

> Nothing is sent anywhere. No ticket exists outside this browser. No network request is made. No
> data is collected. Nobody is reading this.

It is defined with `Studio.i18n.define('tickets.plain', …)` like every other piece of copy on this
site, but — deliberately — **all five funny-level variants are byte-identical, in both languages**.
A five-rung humour ladder is exactly the thing this one sentence must never become: it exists so a
visitor who has just locked themselves out is not left wondering whether a reply is coming. It is not
routed around the language system, the way the desktop application's disclosure sentence is (see that
feature's own article) — the site keeps it inside `t()` so it still honours the *language* choice
(English, Cantonese, bilingual) while refusing to honour the *funny-level* choice. Read the source at
`site/assets/site.js` lines 596–606 to see the identical five variants stated explicitly, with a
comment explaining why.

### What it never does

- **It never deletes anything the visitor did not ask it to.** The `Clear this site's stored data now`
  button is a real, working action — unlike the desktop application, a browser tab genuinely can
  perform this deletion itself, so this route does not stop at "show you where to click" the way the
  desktop version's folder-open action does. It is still never triggered without the visitor pressing
  it and then completing the two-key gate.
- **It never impersonates anybody.** The desk is this site's own and fictional. It borrows no
  company's name or branding, invents no representative's name, references no real case-management
  system, and quotes no response time that implies a human is involved. The canned replies say so in
  as many words ("A member of nobody will be with you shortly").
- **It never makes anybody wait for the joke.** Every ticket's resolution card renders as soon as that
  ticket reaches `Resolved`, and the origin-and-clear controls are available the moment the panel
  opens — a visitor locked out of their own settings is not made to scroll past correspondence to
  reach the thing that fixes it.
- **It never sends anything.** There is no `fetch`, no `XMLHttpRequest`, no `navigator.sendBeacon`,
  and no third-party script anywhere in this feature or on this page. The plain-line disclosure above
  is a fact about the code, not merely a claim in the copy: see
  [`Studio.privacy.networkRequests()`](../../site/SITE_API.md#29-privacy--studioprivacy), which lists
  the *only* request this whole site can ever make (the optional dim sum dish photo), and it has
  nothing to do with this feature.

---

## Where it is reachable from

| Route | How it is wired | Verified at |
| --- | --- | --- |
| The **Forgotten your password?** link in a toy-lock unlock prompt | `Studio.locks.promptUnlock` closes the unlock dialog and calls `support.open(anchor)` directly | `site/assets/site.js`, `locks.promptUnlock`, the button at line 4968–4971 |
| The **Locks** settings tab | A `Forgotten your password?` text button beside `Manage every lock`, calling `S.support.open(e.currentTarget)` | `site/settings.html`, lines 1889–1898 |
| The **Storage** settings tab (where the rest of the "what is stored / clear everything" controls live) | A **Support Tickets** button beside `Export everything` and `Clear everything this site stored`, calling `S.support.open(e.currentTarget)` | `site/settings.html`, lines 2420–2436 |
| The command palette (`Ctrl+Shift+F`), from any page | `cmd.tickets`, titled with `Studio.t('tickets.title')`, keywords `support help locked out reset`, running `support.open(document.body)` | `site/assets/site.js`, `registerCoreCommands`, lines 6693–6694 |

Every one of these four routes calls the exact same `Studio.support.open(anchor)` — there is one
implementation, opened from four places, never four copies that could drift apart. The palette
route is this site's stand-in for a dedicated "Help" destination: there is no separate Help page on
this site, so discoverability runs through the palette's keyword index instead, and `help` is one of
the words that finds it.

---

## The list

The ticket list inside the desk panel is a real list and gets the contract every list on this site
gets, with one confirmed gap (see *Known limitations*):

- **Bulk-manageable**, through `Studio.bulk.attach`: multi-select with click, Ctrl/Cmd-add,
  Shift-range, and Space/Enter from the keyboard; an **Export** action that runs every selected ticket
  through `Studio.exportDialog`; and a **Delete** action marked `destructive: true`, so it is routed
  through the same two-key confirmation gate as the storage-clearing action above, before any ticket
  row is removed.
- **Exportable** in every format `Studio.exportData` supports (JSON, JSONL, YAML, TOML, XML, CSV, TSV,
  Markdown, HTML, SQL), with the export dialog's own preflight naming any field a chosen format cannot
  carry.
- **Correspondence behind progressive disclosure.** Each ticket's canned replies sit inside a native
  `<details>`/`<summary>` pair, so the list stays scannable and a visitor opens only the tickets they
  want to read.
- **Honest empty state.** `No tickets yet.` when the list is genuinely empty, distinct from a real
  ticket list.
- **Cleared by exactly the same storage-clearing route it points at.** Tickets live under the
  `wds.tickets` key like every other piece of state, so `Studio.store.clearAll()` — whether reached
  through this feature's own button or through the Storage tab's `Clear everything this site stored` —
  removes every ticket along with every lock, which is either a design flaw or the funniest part of
  the whole thing, depending on where the humour slider sits.

---

## Storage

Tickets live in this browser's `localStorage`, under `wds.tickets`
([`SITE_API.md` §3](../../site/SITE_API.md#3-storage--studiostore)), as a plain JSON array. There is
no separate bound on ticket count, description length, or reply count beyond whatever this browser's
overall storage quota allows — unlike the desktop application's counterpart, which enforces an
explicit 500-ticket / 4000-character / 40-reply ceiling with a stated reason at the limit. See
*Known limitations*.

Each stored ticket carries: `id` (`WDS-######`), `category`, `description`, `severity` (always
`Critical`), `state` (an index into the five-step ladder), `at` (an ISO timestamp), and `responses`
(the growing array of canned replies).

---

## Failure modes

| Failure | What happens |
| --- | --- |
| `localStorage` is refused (private browsing, a strict cookie policy, storage full) | `Studio.store` falls back to an in-memory value for the whole session and reports it honestly via `Studio.store.ok()` / `Studio.store.status()`; the site-wide boot sequence already raises `Studio.t('msg.storageOff')` as a persistent warning toast. Raising, chasing and viewing tickets keeps working for the rest of that page load; none of it survives a reload. |
| The clipboard copy is refused | `Studio.copy()` degrades to the browser's own failure signal; the origin stays visible and selectable in the field regardless, so it can be copied by hand. |
| The visitor cancels the destructive-confirmation gate | `Studio.confirm(...)` resolves `false`; nothing is cleared, and no ticket, lock or setting is touched. |
| A bulk export or delete is attempted with nothing selected | `Studio.bulk` disables the action until at least one row is selected, per the shared bulk contract. |

---

## Security and privacy considerations

- **No network, ever.** Confirmed by reading the module: no `fetch`, no `XMLHttpRequest`, no beacon,
  no image-tag exfiltration trick. `Studio.privacy.networkRequests()` is the authoritative, *computed*
  answer for the whole site and never lists this feature.
- **No secrets are read, written, described, or implied.** This feature never touches a lock's stored
  credential. It does not display, hint at, or characterise a password's or a one-time code's value,
  length, or composition — the recovery it offers is clearing the storage that holds the credential,
  never recovering the credential itself.
- **The only destructive capability is the visitor's own storage**, and it is always behind the
  two-key gate. There is no route from this feature to any other origin's data — browser storage is
  already origin-scoped, so "this site's data" is, by construction, all this feature can ever touch.
- **Ticket text is treated as visitor content.** Categories and descriptions render as text nodes
  through `Studio.el`, never as injected markup.
- **Nothing here is a security boundary and nothing claims to be.** The resolution panel's copy and
  the plain-line disclosure both avoid the words "secure", "protect" and "encrypt" — this is a
  convenience lock's recovery route, stated as exactly that, everywhere it appears.

---

## Accessibility, language and layout

- The desk overlay is `Studio.overlay`-backed (draggable, resizable, `persistKey: 'support-tickets'`),
  so it inherits the shared overlay contract: it paints its own surface, stays bounded by the
  viewport and scrolls internally, never covers its own anchor, and returns focus to the control that
  opened it on close.
- `tickets.title` and `tickets.plain` are both defined with the required five English and five
  Cantonese variants (`site/assets/site.js` lines 591–606) and rendered through `Studio.t()`, so the
  panel's title and its one unmissable line both honour the site's language setting.
- The description field carries both a visible `field__label` and an `aria-label` with the same text;
  a screen reader announces the `aria-label`, which duplicates rather than losing the visible label,
  but a single `aria-labelledby` pointing at the visible label would be the cleaner form (see *Known
  limitations*).
- Wide content is not at risk here — the panel's content is a form and a list of short rows, nothing
  that can force sideways scrolling — and the overlay itself is bounded per the shared overlay
  contract described above.

---

## Local history

`Studio.history.record('tickets', …)` fires when a ticket is **raised**, so opening one is browsable,
filterable and restorable alongside every other change on this site, per the shared append-only
history contract ([`history.md`](history.md)). Advancing a ticket's status and deleting tickets in
bulk do **not** currently call `Studio.history.record`; see *Known limitations*.

---

## Verification

This article documents the shipping implementation as read from `site/assets/site.js` and
`site/settings.html` at the commit this file was written against, not a proposed design. The checks
below were performed by reading the source directly (function bodies, call sites and their exact line
numbers are cited throughout this article) and by running `node --check site/assets/site.js`, which
completed with no syntax error. This is static verification, not a live-browser capture; a follow-up
pass should drive the built site with the project's own capture harness and record the real overlay
states (`empty`, `one ticket at each status`, `resolution card`, `destructive-confirmation gate`)
before this feature is marked verified in `FEATURE_INVENTORY.md`.

Confirmed by source reading:

1. **All four entry points call the same function.** `locks.promptUnlock` (site.js line 4970),
   the Locks tab (`settings.html` line 1896), the Storage tab (`settings.html` line 2433), and the
   command palette (`site.js` line 6694) each call `support.open(anchor)` / `S.support.open(anchor)` —
   the identical object exposed as `Studio.support`, since `site.js` assigns it by reference
   (`support: support,` at line 6790), not by copying methods.
2. **The plain line is funny-level-invariant.** All five pipe-separated variants passed to `D('tickets.plain', …)` at site.js lines 597–601 (English) and 602–606 (Cantonese) are textually identical within each language.
3. **The severity is inert.** `create()` hardcodes `severity: 'Critical'` (site.js line 5086); no other function in the module reads `.severity`.
4. **The status ladder advances only on explicit action.** `advance(id)` is called exclusively from the `Chase it up` button's `onclick` (site.js line 5158); nothing calls it on a timer or on open.
5. **No network call exists in the module.** A full read of `site/assets/site.js` lines 5066–5195 contains no `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, or `<img>`-based network primitive.
6. **The destructive action is gated.** The `Clear this site's stored data now` button's `onclick` (site.js line 5134) calls `Studio.confirm(...).then(...)` and only calls `store.clearAll()` inside the `then` branch guarded by `if (!ok) return;` (lines 5140–5144).

---

## Known limitations

These are gaps found against the contract in [`SITE_API.md` §20](../../site/SITE_API.md#20-support-tickets--studiosupport) and this project's shared instructions while writing this article. `site/assets/site.js` is a shared runtime file this article's author does not own and must not edit, so each item below is recorded here, precisely, for whoever next edits that file — rather than worked around from outside it.

- **The ticket list has no search bar.** Every other list on this site (locks, notifications, history) filters through `Studio.createSearchBar` so it carries its own anchored regex builder; the ticket list in `support.open()` (site.js, inside the `render` function starting at line 5118) renders every stored ticket unconditionally. The fix is the same pattern already used by `locks.manage` (site.js lines 4986–4994): construct a `createSearchBar({ ariaLabel: 'Search support tickets', storageKey: 'tickets', onChange: render })`, and filter `tickets` through `search.matcher()` against each ticket's id, category, description and localized status before building the `<ul>`.
- **Most of the panel's copy is hardcoded English rather than routed through `Studio.i18n.define()` / `Studio.t()`.** Only `tickets.title` and `tickets.plain` are defined. Everything else — the category label and its four option strings, the description field's label, `No tickets yet.`, the four canned status-advance replies plus the initial response, `Resolution`, the clearing-instructions paragraph, both button labels (`Copy this site's address`, `Clear this site's stored data now`), the destructive-confirmation `action` and `detail` text, the post-clear success toast, `Correspondence`, and `Chase it up` — is a plain JavaScript string literal today (site.js lines 5085–5191 throughout). A visitor in Cantonese mode reads this entire panel in English. Each needs a `D('tickets.<name>', 'en 1|en 2|en 3|en 4|en 5', 'zh 1|zh 2|zh 3|zh 4|zh 5')` definition alongside the existing ones at lines 591–606, and each call site needs to become `t('tickets.<name>')`.
- **The clearing instructions are generic, not per-browser.** The paragraph at site.js line 5128 says "On most browsers that is Settings, then Privacy, then site data, then this site" — true in outline, but not the "precise, copyable, per-browser instructions" this surface's contract calls for. Chrome/Edge, Firefox and Safari each use different menu paths (for example Chrome/Edge: `chrome://settings/content/siteDetails?site=<origin>`; Firefox: Settings → Privacy & Security → Cookies and Site Data → Manage Data…; Safari: Settings → Privacy → Manage Website Data…). The fix is to replace the single sentence with three short, labelled, copyable instruction blocks — one per browser family — leaving the in-page `Clear this site's stored data now` button exactly as it is today as the fourth, automatic option.
- **Advancing or deleting a ticket does not call `Studio.history.record`.** `create()` records an entry (site.js line 5091); `advance()` (lines 5094–5108) and the bulk `delete` action (lines 5167–5170) do not. The fix mirrors the existing call: `history.record('tickets', 'Support ticket ' + tk.id + ' reached ' + TICKET_STATES[tk.state], { id: tk.id, state: tk.state })` inside `advance()`, and an equivalent call before `tickets = tickets.filter(...)` in the bulk delete action.
- **The description field's label is doubled rather than referenced.** It carries both a visible `field__label` span and a separate, identical `aria-label` (site.js line 5116 and 5182). Neither is wrong, but the cleaner and more consistent form used elsewhere on this site is a single visible label connected with `aria-labelledby`.
- **No explicit storage bound.** Unlike the desktop application's 500-ticket / 4000-character ceiling, the site accepts tickets and descriptions of any length up to whatever this browser's storage quota allows, and reports no bound explicitly on the surface.

None of the above make the feature non-functional or unsafe: every entry point works, the plain-line
disclosure is honoured at every language and funny-level setting, the destructive action is properly
gated, and nothing leaves the browser. They are localisation and list-contract completeness gaps in a
file this article's author is not permitted to edit, recorded here so they can be closed in one pass
by whoever next has `site/assets/site.js` open.

---

## Suggested related articles

- [Toy locks and the unlock prompt](locks.md) — what Support Tickets is the recovery route *for*, and this site's per-element locking contract.
- [Local version history](history.md) — the append-only history contract referenced above, and where a raised ticket is recorded.
- [Export](export.md) — the shared exporter, its formats and its preflight, used by this feature's bulk **Export** action.
- [Support Tickets (desktop application)](support-tickets.md) — the same recovery-route idea, built against a real application-data folder instead of browser storage.
