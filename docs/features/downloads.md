# Downloads

A small paired browser extension offers a browser download to World Downloader
Studio before the browser starts it. The application opens its own **Start
download** dialog first — nothing transfers until that dialog is confirmed — then
reports the transfer through a separate **Downloading** progress window and an
always-on-top **Download complete** surface, and keeps every transfer in a
searchable, exportable list.

- **Feature id:** `downloads`
- **Destination:** *Downloads* (the receiver card, the list, the add-by-address
  dialog)
- **Settings section:** *Downloads*
- **Command palette:** open the list, add a download by address, start/stop the
  capture receiver, show the browser extension's pairing details, plus the live
  controls for every setting this feature owns
- **Satisfies:** `FEATURE_INVENTORY.md` rows **12.1**, **12.2** and **12.3**

---

## Behaviour

### The capture receiver

The renderer cannot open a network socket or write bytes to disk as they arrive,
so capturing and transferring downloads runs as a small Node.js process, started
and supervised through the application's privileged bridge. It listens on
**one loopback address** — `127.0.0.1` and nothing else — and nothing outside
this machine can reach it.

The Downloads tab's receiver card shows its real, live state: `Stopped`,
`Starting…`, `Listening`, `Listening, with reduced reporting` (a very chatty
session has filled this run's retained output budget; transfers are unaffected),
`Failed` with the exact error, or `Unavailable — Node was not found` when `node`
is not on this machine's `PATH`. **Start**, **Stop** and **Restart** operate the
real process; a restart issues a fresh pairing token and never interrupts a
transfer that is actively moving bytes.

### Pairing the browser extension

The bundled `extension` directory is a Manifest V3 extension, shipped **unpacked
or as a plain ZIP** — never a signed `.crx`, because code signing is permanently
out of scope for this project. **Show pairing details** opens a popover with the
current loopback address and pairing token, each with its own copy button. The
token regenerates on every receiver start; a token that stops working means the
receiver restarted.

### The three surfaces (rows 12.1–12.3)

1. **Start download** (row 12.1) — a genuine decision surface, opened before a
   single byte moves. It shows the file name (editable, sanitized before it is
   ever written), the destination folder (with a native browse control), the
   full destination path recomputed live, the source URL, the referrer, the size
   and type the server declared, and an Overwrite switch. Confirming begins the
   exact transfer shown; cancelling leaves the queue untouched and writes
   nothing. A folder that is not an absolute path is refused with the reason
   shown and everything already typed kept.
2. **Downloading** (row 12.2) — a separate, real floating panel per transfer,
   distinct from the list: draggable by its header, resizable from its edges,
   remembered per slot across restarts, bounded by the viewport and scrolling
   inside itself (the closest accessible equivalent to a second operating-system
   window this platform supports, since the renderer cannot create one). It shows
   the real filename, source, destination, bytes received (with the exact byte
   count alongside the rounded figure), rate, an estimate when one is
   measurable, elapsed time, whether the server accepts a resumed request, and
   controls — pause, resume, retry, cancel, open, reveal — that operate the
   actual transfer engine, never a simulated value.
3. **Download complete** (row 12.3) — an always-on-top completion surface. It
   holds the application above the browser window the download came from until
   it is resolved or dismissed (a shared reference-counted always-on-top hold,
   so a second capture arriving while the first surface is still open does not
   fight it). It reports the honest outcome: a completed file with its real size
   and path and duration, or a failure/cancellation with the real reason and
   however many bytes actually arrived — never a success banner for a file that
   is not there.

### The list

Every download this application has ever captured or been given by address
stays in the list until it is explicitly removed — there is no paging, so
*select all* and *every match currently shown* are always the same claim.

| Capability | How it behaves |
| --- | --- |
| Search | `ctx.createSearchBar`, matching filename, host, URL, destination, state, origin and error; carries its own anchored regular-expression builder |
| Multi-select | The table's own checkbox column, plus shift-click ranges |
| Select all / honest scope | The header checkbox selects every row in the current filtered set; the summary line states the selected count, the shown count and the true total |
| Inverse selection | A dedicated action, computed against the currently filtered rows |
| Bulk retry / pause / resume | Apply only to selected rows in the matching state; reports how many of the selection actually qualified |
| Bulk remove | Goes through the two-key destructive-action gate; a selection that includes a running transfer is named as such, and removing it cancels that transfer (deleting its partial file) first — a file that already finished is never touched |
| Export | Every field the list shows, in every format the application supports, honouring the current selection (or every shown row when nothing is selected), with a preflight that names any field a chosen format cannot carry |
| Row actions | Pause, resume, retry, cancel, open, reveal and "show progress window", shown only where they apply to that row's real state |

### Adding a download by address

Alongside captures from the extension, a download can be added directly by
typing an address — reachable from the Downloads tab and from the command
palette. Only `http:` and `https:` are accepted; anything else is refused with
the exact scheme named. It opens the identical Start download dialog a real
capture gets.

## Configuration

The **Downloads** settings section:

| Setting | Default | What it does |
| --- | --- | --- |
| Download folder | *(empty → the application's own data folder)* | Where a new capture's destination starts, before the Start dialog is answered |
| Start the receiver automatically | Off | Starts the capture receiver as soon as the application launches |
| Receiver port | `43110` | The loopback port the receiver asks to bind; the Downloads tab always shows the real bound address |
| Ask before every capture | On | Off starts a matching capture immediately using the last folder and overwrite choice — the decision is still made by the user, in advance |
| Maximum transfers at once | `3` | Anything past the limit is genuinely queued |
| Keep the application above the browser | On | Held only while a Start or completion surface is actually open |
| Open a progress window automatically | On | Off still runs the transfer; the window can be opened from the list at any time |
| Show the completion surface | On | Off falls back to an ordinary notification |
| Overwrite by default | Off | Only the Start dialog's Overwrite switch's starting position; it is still decided in that dialog every time |
| Reveal in the file manager when finished | Off | Opens the platform file manager at the finished file automatically |
| Restart the capture receiver | *(action)* | Stops and starts the receiver again with a fresh pairing token |
| Show browser extension pairing details | *(action)* | Opens the same pairing popover the Downloads tab shows |

## Failure modes

| Situation | What happens |
| --- | --- |
| `node` is not installed | The receiver reports `Unavailable — Node was not found`; no other route is attempted |
| The chosen port is already bound | Reported as a listen error with the exact system message; the port setting is unchanged, so the same value is retried on the next start |
| No receiver is running when a transfer would start | The record fails with an explicit "Start it from the Downloads tab" message, and a notification says the same |
| A destination folder is not absolute | The Start dialog refuses it inline, keeping what was typed, rather than silently writing somewhere unexpected |
| The application closes mid-transfer | On the next launch, any record that was `downloading`, `connecting` or `queued` is reconciled to `interrupted` with a note explaining why — never silently re-shown as still running |
| The application closes while a Start dialog was open | That capture is reconciled to `cancelled`: nothing had transferred, and nothing pretends otherwise |
| The server does not accept a range request | Resuming restarts from the beginning; the progress window states this plainly rather than claiming the download will resume |
| A very chatty receiver session | Live progress reporting degrades gracefully (`Listening, with reduced reporting`); the transfer itself is never affected, and restarting while nothing is transferring restores full reporting |

## Security considerations

- The capture request the extension sends carries the URL, referrer, suggested
  filename, declared MIME type and declared size — **no cookies, no
  credentials, no page content, no browsing history**.
- Every request to the receiver must carry the current pairing token, generated
  fresh on every start and handed to the receiver process over **standard
  input**, never a command line argument, an environment variable or a settings
  file.
- The extension's own request uses `credentials: 'omit'`, refuses redirects, and
  asks for exactly one host permission: `http://127.0.0.1/*`.
- A captured filename is attacker-influenced text (it comes from the remote
  server's `Content-Disposition` header). Every path separator, traversal
  segment, control character and reserved Windows device name is stripped or
  replaced before it is ever offered as a suggestion; it can never decide a path
  outside the folder chosen in the Start dialog.
- Removing a list entry never deletes a file that already finished downloading;
  it only cancels (and deletes the partial file of) a transfer still in
  progress, and only after the destructive-action gate is confirmed.

See `docs/features/downloads.md`'s in-app counterparts — the **Downloads**,
**The capture receiver**, **Pairing the browser extension** and **Security and
privacy** articles — for the same material as it is presented inside the
application's own documentation browser and on the documentation site.

## Verification

- `cd app && npx tsc --noEmit -p tsconfig.web.json` — clean for every file under
  `app/src/renderer/features/downloads/`.
- Manual: start the receiver, load the bundled extension unpacked in a Chromium
  browser, pair it with the address and token shown in **Show pairing details**,
  trigger a real browser download, confirm the Start dialog, watch the
  Downloading window report real bytes and rate, and confirm the completion
  surface reports the real outcome.
- Manual: add a download by address with a non-http(s) URL and confirm it is
  refused with the exact scheme named; add one with a valid URL and confirm the
  same Start dialog appears.
- Manual: cancel a running transfer and confirm the two-key gate names the
  destination and states that the partial file is deleted; confirm the file is
  actually gone afterward.
- Manual: remove a mixed selection (one finished, one still transferring) from
  the list and confirm the gate calls out the running one by count, that
  cancelling it deletes its partial file, and that the finished file is
  untouched on disk afterward.
- Manual: quit the application mid-transfer and relaunch; confirm the record
  shows `Interrupted` with the explanatory note rather than `Downloading`.

## Suggested related articles

- [Authenticator and QR pairing](authenticator.md) — another feature with its own
  local, bundled QR/pairing surface and no third-party service in the loop.
- [Export](export.md) — the shared export contract this feature's list and Start
  dialog both build on.
- [History](history.md) — where every capture, start, pause, cancel, completion
  and removal this feature performs is recorded.
- [Accessibility and themes](accessibility-themes.md) — the token and
  accessibility rules `styles.css` in this feature follows.
