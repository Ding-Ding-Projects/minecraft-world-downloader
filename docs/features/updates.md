# Automatic updates

> Checks the application's own release feed, verifies a candidate package against the digest the
> feed states, transfers and stages it in the background, and installs only on an explicit restart.
> The feed and every package it names are unsigned; nothing in this feature claims otherwise.

## What it does

The `updates` feature (`app/src/renderer/features/updates/`) reads a Squirrel `RELEASES` document,
decides whether a newer, installable package exists, downloads and verifies it, and stages it on
disk under the application's own data directory. Nothing installs until the user explicitly asks
for a restart.

Two destinations carry the surface:

| Surface | What it holds |
| --- | --- |
| **Updates** tab (`updates.main`) | The full status card, every action, and the searchable, exportable check log. |
| **Ready banner** | A persistent, non-blocking corner card that appears only once a verified package is staged. |

A settings section (`updates`) holds every configurable number and switch, plus a **Check for
updates now** action and a live read-out of the current phase.

## The one fact that never changes

**This build is not code-signed.** The SHA-1 digest recorded in the release feed proves that the
downloaded bytes are the bytes the feed named. It proves nothing about who published them — there is
no publisher identity check anywhere in this project. Every surface that mentions the update —
the status card, the ready banner, the confirmation dialog shown before a restart — states this in
the same words, because two surfaces describing one security-adjacent fact differently is exactly
how somebody ends up believing more than what was actually verified. Windows will show an
unknown-publisher warning when the installer runs, and the copy says so rather than leaving it as a
surprise.

## How it works

### Phases

The engine (`updater.ts`) is a single state machine, observed by every surface through one
`onChange` subscription:

```
idle / disabled / unconfigured
        │
        ▼
    checking ──► upToDate
        │
        ▼
    available ──► downloading ──► verifying ──► staging ──► ready ──► installing
        │              │              │             │
        ▼              ▼              ▼             ▼
                              failed (named code + machine detail)
```

1. **Checking** fetches the `RELEASES` text, parses it (`feed.ts`), and picks the newest package
   that is not older than the installed version — honouring the "accept prerelease" and "allow
   downgrade" settings. A malformed feed, an unreachable host, or a feed answering a non-2xx status
   is a named failure, never a silently ignored one.
2. **Downloading** transfers the chosen package in bounded byte-range HTTP requests. The privileged
   bridge caps a single response body, so a single request cannot carry a whole installer; chunking
   is not an optimization, it is the only way the transfer is possible at all. Each chunk boundary is
   also a cancellation point, and the progress bar reports real bytes transferred against the real
   total — when a server ignores the range header and returns the whole file in one response, the
   surface says exactly that instead of animating a percentage nobody can trust.
3. **Verifying** computes the SHA-1 of the fully assembled bytes and compares it against the digest
   the feed stated for that file. A mismatch writes nothing to disk and reports the two digests that
   disagreed.
4. **Staging** writes the verified bytes (base64-encoded, because the privileged bridge exposes a
   text write and no binary write) into `updates/` under the application's own user-data directory,
   beside a manifest that repeats the digest and states plainly that the package is unsigned. Unless
   "Re-read and re-hash the staged file" is turned off, the file is then read straight back and
   hashed again — the one step that actually catches a file that was written incorrectly or damaged
   afterward.

Once staging succeeds the phase is **ready**, the banner appears, and the engine does nothing
further until the user restarts.

### Restart and the privileged installer bridge

Nothing in the renderer process can run an installer: there is no Node integration, and the
privileged bridge's process allow-list carries no installer executable. The feature therefore probes
for an optional `window.studio.updater.installStaged` bridge. When it is present, restarting hands
the staged package and its digest to it and the platform updater takes over. When it is absent — the
common case for this build — the restart action is disabled with the exact reason stated
("This build has no privileged installer handover…"), and the status card and banner both say the
verified package can be installed by hand from the path shown.

Restarting always goes through a real confirmation dialog first. It names the exact version, repeats
the unsigned-installer statement, and — critically — lists every surface currently on screen that
declares `data-unsaved-work="…"`, so a restart can never quietly discard someone's editing.

### The ready banner

A persistent, non-blocking, corner-anchored card, following the same rules as every other
notification in this application: it never steals focus, never blocks a click anywhere else in the
window, and stays on screen (through `role="status"` / `aria-live="polite"`) until the user restarts
or asks for it "Later". "Later" hides the banner for a configurable number of hours — the staged
package underneath is completely untouched; only the banner's visibility changes, and it returns
automatically once the snooze period lapses (checked on a one-minute tick so it does not need a fresh
engine event to reappear).

### The check log

Every check — whichever of `startup`, `schedule`, `manual` or `retry` triggered it — writes one row
naming the trigger, the outcome, the version involved, the exact machine detail, and how long it
took. The log carries:

- Its own search field (`ctx.createSearchBar`) with the anchored regex builder, matching across every
  visible column.
- Full multi-select with a keyboard path, a select-all that states plainly whether it means the rows
  on the current page or every row matching the search, and an inverse selection.
- Export in every format the application's exporter supports, honouring the current selection or
  filtered set, with a preflight step naming anything a chosen format cannot carry faithfully.
- A bulk delete behind the two-key destructive-action confirmation gate, listing exactly which rows
  will be removed.
- Paging, sized by the "Check log rows per page" setting, with an honest empty state pointing at the
  **Check for updates** action when nothing has run yet.

### Settings

| Setting | What it bounds |
| --- | --- |
| Check for updates automatically | Master switch. Off stops the feed from being contacted at all; the manual check still works. |
| Release feed address | Must be `https`, or `http` on a loopback host for local testing. |
| Release notes address | Opened externally only; never fetched. |
| Check once shortly after startup / wait before it | When the one-shot startup check fires, deliberately after the window is usable. |
| Hours between background checks | How often the feed — a small text request — is re-read while the app is open. |
| Download an update as soon as one is found | Off stops at "available" and waits for an explicit **Download and verify**. |
| Accept prerelease versions | Whether a version with a prerelease tail is ever selected. |
| Allow installing an older version | Rollback protection. Off refuses (and reports) a feed offering something older than installed. |
| Largest package to stage | Refused before any bytes transfer; also bounds the in-memory hashing buffer. |
| Transfer chunk size | Byte-range request size; smaller means finer progress and a faster cancel. |
| Re-read and re-hash the staged file | The only check that catches on-disk corruption after a successful write. |
| Hours the ready banner stays hidden | What "Later" actually means. |
| Check log rows per page | Also what "select the rows on this page" selects. |

Every numeric setting's `validate` bound matches the ceiling the transfer engine itself enforces
(`updater.ts`'s `clampNumber` calls), so a rejected value and an engine-side clamp can never quietly
disagree about what is actually allowed.

## Failure modes

Every failure carries one of a fixed set of codes (`types.ts`'s `UpdateFailureCode`), each mapped to
exactly one sentence a user can act on (`presentation.ts`):

| Code | Meaning |
| --- | --- |
| `not-configured` | No feed address is set. |
| `offline` | The computer reports itself offline; the feed was never contacted. |
| `feed-unreachable` | The feed request failed or answered a non-2xx status. |
| `feed-invalid` | The feed was read but is not a usable `RELEASES` document. |
| `downgrade-blocked` | The feed's newest package is older than installed, and rollback protection refused it. |
| `too-large` | The candidate package exceeds the configured staging ceiling. |
| `transfer-failed` | A chunk request failed, timed out, or decoded incorrectly. |
| `size-mismatch` | The bytes received do not total what the feed stated. |
| `hash-mismatch` | The transferred bytes do not hash to the feed's stated digest; nothing was written. |
| `write-failed` | The staging directory or file could not be written. |
| `asset-corrupt` | The staged file, read back, does not hash to what was written. |
| `cancelled` | The user cancelled an in-flight transfer. |
| `install-unavailable` | This build has no privileged installer bridge. |
| `install-failed` | The installer bridge itself reported a failure. |

There is deliberately no generic "something went wrong" code: a code nobody can act on is not
useful, and every one of the codes above names a real next step (fix the feed address, free disk
space, check the network, install by hand, and so on).

## Security considerations

- **No signature verification exists anywhere in this feature**, and none of its copy claims
  otherwise at any language mode or funny level — the unsigned statement is deliberately excluded
  from the humour ladder's voice changes and stays word-for-word factual at every level.
- The SHA-1 digest check is a **transport-integrity** control: it proves the bytes that arrived are
  the bytes the feed named. It is not a substitute for publisher authenticity, and an attacker who
  can rewrite the feed can rewrite the digest it names.
- Outbound HTTP is denied by default across the whole application. This feature registers exactly the
  allow rules it needs — the feed's own host, plus GitHub's content-redirect host when the feed lives
  on `github.com` — each with a stated reason, and nothing else.
- Redirects on the feed and package requests are bounded (`MAX_REDIRECTS`), and every response body
  is bounded (`FEED_MAX_BYTES` for the feed itself, and the chunk size plus a small margin for each
  transfer request), so neither request can be used to exhaust memory.
- The staged payload and its manifest live under the application's own private data directory, never
  inside a user-selected folder, and the manifest explicitly records `signed: false`.
- Downgrade is refused by default (rollback protection) and is only ever honoured when the user has
  explicitly turned "Allow installing an older version" on.

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` — the `updates` feature type-checks cleanly against the
  application's shared component kit, settings store, and privileged-bridge types.
- Every phase, every failure code, and every setting has a five-rung humour ladder in English and
  Cantonese (`strings.ts`); the unsigned-artifact statement is a `flat()` entry, deliberately outside
  the ladder, so it reads identically at every funny level.
- The check log, the status card and the ready banner all read from the one engine instance
  (`updater.ts`'s exported `updater` singleton), so there is exactly one place that decides what
  "ready" or "failed" means — no surface can disagree with another about the current state.
- The restart confirmation is exercised through `ctx.components.dialog`, and the discard action
  through `ctx.confirm.request`, matching the application's destructive-action gate used everywhere
  else.
- Manual verification: with `updates.feedUrl` pointed at a small local `RELEASES` file served over
  `http://127.0.0.1`, a full check → download → verify → stage → restart cycle can be driven from the
  Updates tab without a real network connection, and every phase transition is visible on the status
  card as it happens.

## Suggested articles

- [Version history](history.md) — every update check, download, discard and restart this feature
  performs is written into the same local, append-only history.
- [The settings surface](settings.md) — how the `updates` settings section is rendered, searched and
  exported alongside every other feature's settings.
- [Non-blocking notifications](notification-centre.md) — the shared contract the ready banner and
  every toast this feature raises both follow.
- [Export everything](export.md) — the format contract the check log's export action uses.
