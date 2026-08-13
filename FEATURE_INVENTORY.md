# Feature completeness inventory

This is the hand-written, per-surface inventory of every feature contract this project must carry.
It is deliberately hand-written rather than derived from what already exists: a list that validates
only the features it has already discovered cannot detect a feature that disappeared entirely.

Two surfaces carry every row independently:

- **App** — the desktop application at `app/`.
- **Site** — the documentation website at `site/`.

Neither surface may satisfy a row by delegating it to the other, hiding it, replacing it with a
placeholder, or deferring it to a future release. Where a row genuinely cannot apply literally to a
surface, the reason is named in that row's **Notes** and the closest accessible, testable equivalent
ships instead.

`app/src/renderer/features/<id>/` is the directory that owns each app row. A feature owns its own
directory and registers itself; it never edits a shared registration file.

## Status legend

| Mark | Meaning |
| --- | --- |
| ✅ | Implemented, documented, localized, and registered |
| 🏗️ | Implementation in progress |
| ⬜ | Not started |

---

## 1. Language, voice, and text

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Three language modes: English, playful Hong Kong Cantonese, bilingual. Persisted. Bilingual keeps the primary label prominent and the secondary compact. | `core/i18n.ts` | yes | ⬜ | Validated at narrow widths where bilingual labels are longest. |
| 1.2 | Two independent funny-level sliders, 1–5, one per language, wired to rendered copy at every level. | `core/i18n.ts` + `features/language` | yes | ⬜ | Applies to every message category including destructive, security, and error copy. Voice changes; facts never do. |
| 1.3 | Funny-level disclosure at first run and in the setting itself. | `features/language` | yes | ⬜ | States plainly that the level styles all messages including errors and warnings. |
| 1.4 | "Show emojis in dialogs and message boxes" toggle. | `features/language` | yes | ⬜ | Emoji never appear in buttons, action labels, field labels, or accessible names. |
| 1.5 | School mode: one shared switch across every application, live propagation without restart, user-renamable, unlocked by a locally verified PIN, password, or passkey. | `features/school-mode` | yes | ⬜ | Forces English and makes Cantonese, bilingual, funny levels, personal vocabulary, and all dim-sum capability behave as if not installed. A user-experience lock, not a security boundary; resettable by deleting the shared data record. |
| 1.6 | Personal-vocabulary JSON upload control, always visible even before a file exists. | `features/vocabulary` | yes | ⬜ | No built-in mappings, samples, or templates ship. Local-only, bounded, versioned schema, fail-closed to original wording. |
| 1.7 | Spoken narrator for app events. Off by default. English, Cantonese, or Both (serialized). | `features/narrator` | yes | ⬜ | Debounced, per-category cooldown, one utterance at a time, yields to an active screen reader. |
| 1.8 | Narrator voice picker, one per narrated language, listing the voices the machine actually has. | `features/narrator` | yes | ⬜ | Default is "Choose automatically"; no named voice ships as a default. Persists stable voice identity, not display name. Handles late enumeration. Reports uninstalled, network-backed, and no-voice states. Rate and pitch adjustable. |

## 2. Appearance and Material Design 3

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 2.1 | Full Material Design 3 conformance: tokens, typography, shape, elevation, motion, component anatomy. No legacy elements. | `core/theme.ts`, `styles/` | yes | ⬜ | Functional data colours are exempt as data, not chrome. |
| 2.2 | Runtime appearance controls: light and dark theme, density, seed colour, full font customization with live preview and CJK-safe fallback. | `features/appearance` | yes | ⬜ | Applied live, not only after restart. |
| 2.3 | Per-element appearance editor reachable from every element's context menu and a keyboard equivalent, opening non-modally anchored beside that element. | `core/appearance.ts` | yes | ⬜ | Shift+right-click opens it directly where the modifier can be distinguished. |
| 2.4 | Infinite colour picker with a bidirectional colour translator across named, HEX, HEX8, RGB(A), HSL(A), HSV, HWB, LAB, LCH, OKLab, OKLCH, and CMYK. | `core/appearance.ts` | yes | ⬜ | Continuous spectrum plus numeric entry. Alpha preserved, gamut warning, contrast readout. |
| 2.5 | Word-depth typography editor covering family, size, variable axes, weight, italic, underline, strikethrough, overline, capitalization, super/subscript, colour, highlight, outline, shadow, spacing, line height, baseline offset, direction, alignment. | `core/appearance.ts` | yes | ⬜ | Unsupported properties stay visible with a capability explanation rather than disappearing. |
| 2.6 | Named presets and user themes, exportable and importable as a file. | `features/appearance` | yes | ⬜ | Per-property, per-element, and global reset. |
| 2.7 | User-renamable application display name. | `features/app-identity` | yes | ⬜ | Changes display only. Never moves the data directory, package identity, installer identity, or update feed. Diagnostics keep the shipped name. |
| 2.8 | App-logo customization: shipped presets plus a local custom-image upload with crop, fit, focal point, background, and safe local conversion. | `features/app-logo` | yes | ⬜ | Local-only processing, bounded and validated. Never rewrites installed identity. |

## 3. Navigation and discovery

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Browser-style tabbed navigation, dockable to left, right, top, or bottom, left by default, persisted per surface. | `core/tabs.ts` | yes | ⬜ | Orientation change, not rotation: labels are never rendered sideways. `aria-orientation` and arrow keys follow the axis. |
| 3.2 | Overflow surface when tabs exceed the available space. Never silently clipped. | `core/tabs.ts` | yes | ⬜ | The overflow surface measures height rather than width on a vertical strip. |
| 3.3 | Tab reordering, pinning with a stable dedicated region, and grouping with name, colour, order, and collapse. | `core/tabs.ts` | yes | ⬜ | Order, pinned order, groups, group order, collapsed state, and membership all persist. |
| 3.4 | All four tab searches: current strip, inside each group, across groups by name, and a master search across every open tab. | `core/tabs.ts` | yes | ⬜ | Each has its own anchored regex builder and its own query, pattern, flags, and mode. |
| 3.5 | "Close tabs containing text" and "Close tabs not containing text", with a reviewable preview and honest counts. | `core/tabs.ts` | yes | ⬜ | Pinned tabs excluded by default; the inverse action negates the same predicate. |
| 3.6 | Settings surfaces are themselves tabbed, carrying the full tab feature set. | `features/settings` | yes | ⬜ | Separate from, and additional to, the settings search bar. |
| 3.7 | Move-into-group is a searchable anchored picker, never an inline list of group menu items. | `core/tabs.ts` | yes | ⬜ | Carries its own search bar and regex builder, keyboard-operable end to end. |
| 3.8 | Command palette on Ctrl+Shift+F listing every command, destination, setting, article, and appearance control. | `core/palette.ts` | yes | ⬜ | Rich rows render live controls inline. Selecting a result teleports to the exact element. Bounded-card and full-window sizes, persisted, card by default. |
| 3.9 | Right-click menus display the keyboard shortcut that actually works in that context. | `core/menu.ts` | yes | ⬜ | Derived from the same source that registers the binding. Exposed to assistive technology as a shortcut. |
| 3.10 | Every dropdown, select, picker, autocomplete, menu button, and context menu opens with a keyboard-focusable filter field and its own anchored regex builder. | `core/components.ts` | yes | ⬜ | No exemption for short menus. Filtering never changes an item's action. |

## 4. Search and regular expressions

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 4.1 | A full regex builder: guided construction, raw editor, flags, sample text, live matches, capture groups, syntax feedback, copy and export. | `core/regexbuilder.ts` | yes | ⬜ | Names the real engine and dialect. Bounded evaluation guards against catastrophic backtracking. |
| 4.2 | Every search bar exposes that builder, anchored beside the field it belongs to. | `core/searchbar.ts` | yes | ⬜ | Plain text is the default; regex is an explicit opt-in. Query, pattern, flags, validation, and mode synchronize bidirectionally. |
| 4.3 | Every settings, preferences, properties, and appearance surface carries its own search bar wired to the builder. | `features/settings` | yes | ⬜ | Reports when a match sits on a different tab. |

## 5. Messaging, safety, and confirmation

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 5.1 | Non-blocking corner-anchored notifications that stack, auto-dismiss, and carry title, body, actions, and links. | `core/notifications.ts` | yes | ⬜ | Errors and warnings persist until dismissed. Modal dialogs are reserved for decisions the user must make before continuing. |
| 5.2 | A notification centre keeping dismissed notifications reviewable, with the full bulk-action contract. | `features/notification-centre` | yes | ⬜ | Multi-select, honestly-scoped select-all, inverse selection, bulk dismiss, gated bulk delete, filtered bulk export. |
| 5.3 | Destructive-action super confirmation: two independent keys, then a full-range slider, with progress and completion animation and an always-available emergency exit. | `core/confirm.ts` | yes | ⬜ | Facts stay unambiguous at every language and funny level. Keyboard-operable, screen-reader named, reduced-motion aware. |
| 5.4 | No purchase, licence, subscription, trial, or paywalled capability anywhere. | project-wide | yes | ⬜ | No donation, sponsorship, review, rating, or upgrade nagging. Upstream projects receive any funding link, labelled as going to them. |
| 5.5 | Long operations report real progress in the surface that started them, disable the submitting control, and refuse re-entry. | `core/progress.ts` | yes | ⬜ | A bare spinner is indistinguishable from a hang. Expensive optional phases are offered as a real choice. |
| 5.6 | Failed operations offer their recovery route at the surface where the failure is discovered. | `core/recovery.ts` | yes | ⬜ | Includes direct re-authentication when a credential or scope is refused. |

## 6. Data, history, and portability

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 6.1 | Local Git-backed version history in the application's own data directory, never a repository inside a user folder. | `core/history.ts` | yes | ⬜ | Append-only: restoring is a new revision, so an undo can itself be undone. Site equivalent uses local browser storage and says so. |
| 6.2 | History covers every user-managed record, not only documents: accounts, credentials, connected services, rules, and settings. | `core/history.ts` | yes | ⬜ | Settings belong in the same snapshot as the records they configure. |
| 6.3 | History panel with an advanced date picker, filter by the real recorded actions with counts, text search with regex builder, diff, restore, label, prune, and redacted export. | `features/history` | yes | ⬜ | Filters compose rather than override. Honest no-match message. |
| 6.4 | Secret and display-name mutation history: one commit per add, edit, remove, rename, reset, and restore, behind its own credential. | `features/history` | yes | ⬜ | No usable secret ever enters a commit in plaintext. Fail-safe and visible when the vault or repository is unavailable. |
| 6.5 | Export everything, in every format that can faithfully represent it: JSON, JSONL, YAML, TOML, XML, CSV, TSV, Markdown, HTML, SQL, and language-source forms. | `core/export.ts` | yes | ⬜ | States encoding, line endings, and schema version. Warns before a format drops a field. |
| 6.6 | Archive export as ZIP and 7z, exposing the full 7z option set. | `features/export` | yes | ⬜ | LZMA2/LZMA/PPMd/BZip2/Deflate, levels, dictionary and solid-block sizes, threading, split volumes, AES-256 with encrypted headers. Never presents an archive as protected while leaving filenames in the clear. |
| 6.7 | Bulk actions on every list, table, grid, and collection. | `core/bulk.ts` | yes | ⬜ | Multi-select, shift-ranges, keyboard equivalent, honestly-scoped select-all, inverse selection, and the full action set — never a token subset. Says what will happen before it happens. |
| 6.8 | Blank-slate editors offer presets derived strictly from the application's real defaults. | `core/presets.ts` | yes | ⬜ | Each preset states exactly what it sets. Applying one is a normal recorded, undoable action. |
| 6.9 | Open in an external editor, with Visual Studio Code as the first-class target for every export. | `features/external-editor` | n/a | ⬜ | Site cannot launch a local editor; it offers download and copy instead, and says so. |

## 7. Scheduling and external sources

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 7.1 | Scheduled settings: language, theme, density, accent, fonts, motion, and every other appearance value, on native date and time pickers. | `features/scheduled-settings` | yes | ⬜ | Optional start and end date, start and end time, every day or explicit weekdays. States the timezone and daylight-saving behaviour. |
| 7.2 | Versioned, bounded schedule schema with stable rule ids, deterministic precedence, migration, and recorded history. | `features/scheduled-settings` | yes | ⬜ | Cross-midnight windows, date boundaries, equal start and end, and invalid partial input all have explicit tested semantics. |
| 7.3 | A rule may source its value from local data, a validated versioned HTTPS API, or a Home Assistant boolean entity. | `features/scheduled-settings` | yes | ⬜ | Network access lives behind the privileged boundary. Redirects and embedded credentials refused. Failure is non-blocking and fails safe. |

## 8. Locks, credentials, and the authenticator

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 8.1 | Toy locks on every rendered element and every appearance value, each with its own independently managed credential. | `features/locks` | yes | ⬜ | Password or one-time code. No master credential and no implicit inheritance. Described honestly as for fun, never as security or encryption. |
| 8.2 | An anchored lock wizard per element, naming the exact target, and an enumerable, searchable, individually removable lock list. | `features/locks` | yes | ⬜ | Locked items still appear in every search and the palette, labelled as locked. Excluded from bulk closes by default. |
| 8.3 | Recovery by deleting the application data folder, stated in the setting and in the unlock prompt, naming the actual folder. | `features/locks` | yes | ⬜ | Site equivalent clears the site's own storage and says so. |
| 8.4 | "Support Tickets": the recovery route dressed as a local support desk whose resolution opens the data folder in the file manager. | `features/support-tickets` | yes | ⬜ | One plain unstyled line states nothing is sent anywhere and nobody is reading it. Never impersonates a real organization's support. |
| 8.5 | One-time-code registration renders a locally drawn QR encoding a standard `otpauth://totp/` URI, with the manual secret beside it. | `features/authenticator` | yes | ⬜ | Drawn in-process; no third-party QR service. Pairing is confirmed with a live code before the factor arms. |
| 8.6 | A built-in authenticator holding the user's own arbitrary entries, with live codes, countdown, next-code peek, and a searchable manageable list. | `features/authenticator` | yes | ⬜ | RFC 6238 over RFC 4226, SHA-1/256/512, 6–8 digits, arbitrary period. Local only. Ordinary exports omit secrets and say so. Clock skew reported. |

## 9. Documentation and change records

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 9.1 | Offline in-app documentation browser with every feature article bundled at build time. | `features/docs-browser` | n/a | ⬜ | Article-to-article links resolve in-app. Own search bar with regex builder. A build guard fails when an article on disk is missing from the bundle. |
| 9.2 | Changelog viewer covering every released version, with an advanced date filter, regex-capable search, export and copy, and a commit link per entry. | `features/changelog` | yes | ⬜ | Entries are factual; a version with no recorded changes says so. Referenced commits are validated so no dead link ships. |
| 9.3 | Provider-authored text is rendered as the markup it is, through one shared isolated renderer. | `core/markdown.ts` | yes | ⬜ | Release notes, issue bodies, commit messages. Honest empty state rather than an empty renderer. |
| 9.4 | Landing page and full documentation site presenting every feature, with per-feature articles and suggested articles. | n/a | yes | ⬜ | Every asset bundled locally. Mobile friendly from 320px upward. |

## 10. Forms, controls, and layout

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 10.1 | Guided forms: pickers populated from real data, sanitized suggested defaults, inline plain-words validation, and a named reason on every disabled control. | `core/forms.ts` | yes | ⬜ | Free text stays available but is never the only path when a real list of valid values exists. |
| 10.2 | Every path text box carries a native browse control, and browsed values run through the same validation as typed ones. | `core/forms.ts` | n/a | ⬜ | Site has no filesystem picker for host paths; it says so and accepts typed values with the same validation. |
| 10.3 | Expert tuning knobs are matched by an honest novice-level control mapped onto the same real values, with a documented mapping and an explicit Custom state. | `features/performance` | yes | ⬜ | The level reproducing the shipped defaults is the default level. Displaying Custom never overwrites the advanced values. |
| 10.4 | Rich controls preferred wherever a value is shown: list rows, table cells, menu items, search results, detail panels, cards. | `core/components.ts` | yes | ⬜ | A rich control is the real control, wired to the same code. Long lists virtualize. |
| 10.5 | Every settings element carries its full explanation behind progressive disclosure and a truthful default-provenance line. | `core/settings-ui.ts` | yes | ⬜ | Provenance names the real value rather than the opaque word "default". Coverage guarded by an explicit hand-written list. |
| 10.6 | Overlays paint their own surface, stay bounded by the viewport, scroll internally, and never cover their anchor. | `core/overlay.ts` | yes | ⬜ | Panels resize from edges and corners; floating panels drag by header. Size and position persist with a reset and a keyboard path. |
| 10.7 | Filters, search rows, and statistics panels are collapsible, and descriptive ones start collapsed. | `core/collapse.ts` | yes | ⬜ | A collapsed row never silently excludes results without saying so. |
| 10.8 | Accessibility throughout: keyboard reachability, visible focus, correct roles, names and states, contrast, reduced motion, and sensible structure. | `core/a11y.ts` | yes | ⬜ | Treated as a completion blocker, not polish. |
| 10.9 | No clipping and correct element sizing at every supported window size, density, and display scale, in every language mode. | project-wide | yes | ⬜ | Validated at 100/125/150/200% and at the longest bilingual strings. |

## 11. Conversion and local model tooling

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 11.1 | Universal file converter with a categorized, searchable adapter catalog covering Documents/PDF, Images, Audio, Video, Archives, Structured Data, Code/Text, and Binary Encodings. | `features/converter` | yes | ⬜ | Every category has its own search and anchored regex builder. Unavailable formats are listed and disabled with the exact missing dependency, never hidden. |
| 11.2 | Enabled adapters are bundled, offline, sandboxed, bounded, and validated after write. | `features/converter` | yes | ⬜ | PATH discovery or a developer-machine tool must never make a format appear enabled. |
| 11.3 | PDF inspect, split, merge, extract, reorder, rotate, and metadata tools with post-write reopen validation. | `features/converter` | yes | ⬜ | Atomic writes; a mismatch removes temporary output and reports the failure without leaking paths or content. |
| 11.4 | An unlimited-length conversion queue with paged discovery, bounded concurrency, constant-memory backpressure, and durable pause, resume, and cancel. | `features/converter` | yes | ⬜ | Per-file bounds remain mandatory. Never loads all paths or bytes into memory. |
| 11.5 | Local model suite manager over the documented local HTTP API: runtime health, installed and running models, pulls, deletes, copies, and capability metadata. | `features/models` | yes | ⬜ | Never calls an unofficial proxy or embeds a cloud service. |
| 11.6 | Exhaustive catalog at each verified refresh, with source revision, timestamp, page count, completeness verdict, and stale and offline behaviour. | `features/models` | yes | ⬜ | Never curated. Combines the catalog with locally installed tags without hiding either. |
| 11.7 | Conservative evidence-backed hardware-fit verdicts: Runs well, Runs with limits, Unlikely, Unknown. | `features/models` | yes | ⬜ | Never inferred from a model name. Missing metadata produces Unknown, never zero. |
| 11.8 | Batch pull queue with bounded parallelism, durable state, byte-accurate progress, cancel, retry, resume, and honest partial outcomes. | `features/models` | yes | ⬜ | No price, purchase, checkout, account, or payment semantics anywhere. |
| 11.9 | Local chat session surface with streaming, parameters, history, search, export, and capability-gated attachments. | `features/models` | yes | ⬜ | Bounded resources. Chats stay local. |
| 11.10 | Allowlisted harness launch with preflight, reviewable preview, snapshot, restore, and automatic rollback on failure. | `features/models` | yes | ⬜ | Never accepts an arbitrary shell command. Secrets stay in the credential vault. |

## 12. Downloads and updates

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 12.1 | Browser-extension download capture opens a real Start download dialog before any transfer begins. | `features/downloads` | n/a | ⬜ | Confirm begins the actual queued download; cancel leaves the queue unchanged. |
| 12.2 | Each transfer has its own separate Downloading progress surface reporting truthful filename, source, destination, bytes, rate, ETA, and state. | `features/downloads` | n/a | ⬜ | Controls operate the real transfer, not a simulated value. |
| 12.3 | Start and completion surfaces stay above the originating windows until resolved. | `features/downloads` | n/a | ⬜ | The completion surface names the completed file and the honest outcome. |
| 12.4 | Automatic updates over the unsigned Squirrel feed, with a persistent non-blocking ready banner and an explicit restart action. | `features/updates` | n/a | ⬜ | Enabled by default, with a manual check command and visible current, update, and failed states. Never claims authenticity or signature verification. |

## 13. The product itself

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 13.1 | World downloader: connection settings, live status, chunk progress, activity log, and start/stop, driving the bundled Java core. | `features/downloader` | documented | ⬜ | Replaces the previous separate desktop manager. |
| 13.2 | Live map viewer with layer controls, coordinate readout, and markers, rendering what the companion renderer produces. | `features/map` | documented | ⬜ | Local tiles served over loopback only; no remote map service. |
| 13.2a | Pairing with Worldlens, the companion Minecraft world renderer and 3D map viewer. | `features/worldlens` | yes | ⬜ | Detects an installed Worldlens, hands a downloaded world straight to it, and drives its headless renderer over loopback for the in-app map. Absence is an honest state with a real install route, never a faked map. The two applications are deliberately complementary: this one produces worlds, that one renders them. |
| 13.3 | Server and container manager: container list with state, log stream, and gated start, stop, and restart. | `features/server` | documented | ⬜ | Destructive container actions run through the super-confirmation gate. |
| 13.4 | Chat scraper bot runner: profiles, run controls, and a captured-message table with bulk actions. | `features/bot` | documented | ⬜ | |
| 13.5 | The web console's capabilities surfaced in-app rather than requiring a separate browser session. | `features/console` | documented | ⬜ | |

## 14. Release and build

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 14.1 | `build.bat` and `build.sh`: touchless dependency install and build from a bare machine, with a silent mode and honest per-phase reporting. | repo root | n/a | ⬜ | Idempotent, user-scoped, never installs credentials or a signing certificate. |
| 14.2 | `build-installer.bat` and `build-installer.sh`: the real Squirrel installer through the same packaging path CI uses, verified and hashed. | repo root | n/a | ⬜ | States plainly that the installer is unsigned. Never publishes, tags, or pushes. |
| 14.3 | One release workflow that builds, packages, and publishes the desktop application, and nothing else. | `.github/workflows/release.yml` | n/a | ⬜ | No test, lint, type, coverage, or capture gate anywhere in the pipeline. |
| 14.4 | Every release carries the project's line count, produced by the committed counter at the tagged commit. | `scripts/count-lines.mjs` | n/a | ⬜ | Broken down by area, stating exclusions, separating generated from hand-written, and reporting agent versus human authorship per surviving line. |
| 14.5 | Every release carries end-to-end workflow timing and a dim sum photo asset with the dish named. | `.github/workflows/release.yml` | n/a | ⬜ | Timing measured, never estimated. |
| 14.6 | An executable negative regression that removes one asserted item at a time from this inventory and must turn red. | `app/tests/inventory.test.ts` | n/a | ⬜ | Uses exact boundaries, never a descendant selector or a substring a rename can satisfy. |
| 14.7 | This project is registered with the shared status hub, reporting its repository, branch, current state, evidence and next gates. | `scripts/report-status.mjs` | n/a | ✅ | Registered and confirmed by a `200` response. The enrollment token is read on the host where the hub runs and used in place — never printed, never written to a file, never entered into chat. |
| 14.8 | The application ships its own status surface carrying the same states, evidence and honesty rules as the shared hub. | `features/status` | yes | ⬜ | A user looking at the application sees what the hub sees without leaving it. Emoji-bearing states, evidence behind every claim, and a check that has not run reported as unrun rather than passed. |

## 15. The bot control surface

The vendored bot library at `vendor/mineflayer` (version 4.37.1, 41 plugins) is a **code** API: every
capability it has is a method you call or an event you subscribe to. This section turns all of it
into an interface, so a person who cannot write JavaScript can do everything the library can do.

"Everything, but in graphical form" is the whole requirement, and it is enumerated below rather than
summarised, because a summary is exactly how three of these quietly fail to ship. Each row names the
library plugin it covers, so a plugin gaining a capability upstream has a row to grow into.

| # | Feature | App module | Site | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 15.1 | Connection and session: host, port, version, username, authentication mode, proxy, view distance, chat settings, and reconnect policy — as a guided form, never a blank box where an enumeration exists. | `features/mineflayer` | yes | ⬜ | Covers `settings`, `game`, `kick`. Credentials go to the credential vault, never to settings, exports, logs or history. Disconnect reasons are shown verbatim with a real recovery route. |
| 15.2 | Live bot state: health, food, saturation, breath, experience level and progress, gamemode, dimension, position, velocity, yaw and pitch, and held item. | `features/mineflayer` | yes | ⬜ | Covers `health`, `breath`, `experience`, `physics`, `game`. Every value is the real event value; nothing is simulated while disconnected. |
| 15.3 | Chat: a full chat surface with history, sender filtering, whisper, the message-position channels, and a pattern-matching rule editor built on the project's regex builder. | `features/mineflayer-chat` | yes | ⬜ | Covers `chat`, `title`, `tablist`, `boss_bar`, `scoreboard`, `team`. The chat log is a list, so it carries the full bulk-action contract and export in every format. |
| 15.4 | Movement: directional controls, sprint, sneak, jump, look-at, walk-to-coordinates, follow-entity, and a path preview — operable by keyboard as well as pointer. | `features/mineflayer-movement` | yes | ⬜ | Covers `physics`, `ray_trace`. Continuous controls report that they are held, and releasing focus releases the control rather than leaving the bot walking. |
| 15.5 | Inventory: the real window contents as a grid, drag and keyboard move, split and merge stacks, equip to each slot, drop and drop-stack, and quick-move. | `features/mineflayer-inventory` | yes | ⬜ | Covers `inventory`, `simple_inventory`. Item icons come from bundled resources; no remote texture fetch. |
| 15.6 | Container windows: chest, dispenser, dropper, hopper, shulker, ender chest, and barrel — opened, browsed, transferred and closed. | `features/mineflayer-inventory` | yes | ⬜ | Covers `chest`, `block_actions`. Withdraw-all and deposit-all are bulk actions with an exact count and a preview. |
| 15.7 | Crafting: a recipe browser searchable by result and ingredient, showing what is craftable now from current inventory and what is missing, with and without a table. | `features/mineflayer-inventory` | yes | ⬜ | Covers `craft`. Never claims a recipe is craftable without checking the real ingredient count. |
| 15.8 | Workstations: furnace, blast furnace, smoker, anvil, enchanting table, brewing, and grindstone — each with its real slots, progress and fuel state. | `features/mineflayer-inventory` | yes | ⬜ | Covers `furnace`, `anvil`, `enchantment_table`. Enchantment choices show their real cost and the real level requirement. |
| 15.9 | Villager trading: the trade list with inputs, outputs, uses remaining, disabled trades, and the profession and level. | `features/mineflayer-inventory` | yes | ⬜ | Covers `villager`. A trade that cannot be made says which condition fails. |
| 15.10 | Block interaction: dig with tool selection and real progress, place, activate, and use-on, plus a target picker driven by ray tracing rather than typed coordinates alone. | `features/mineflayer-world` | yes | ⬜ | Covers `digging`, `place_block`, `place_entity`, `generic_place`, `block_actions`, `ray_trace`. Digging reports real progress, and the control refuses re-entry while a dig is in flight. |
| 15.11 | World query: block lookup at a position, find-blocks by type within a radius with results as a rich list, and a block-state inspector. | `features/mineflayer-world` | yes | ⬜ | Covers `blocks`. Results are a list, so bulk actions and export apply. |
| 15.12 | Entities: a live list of nearby entities with type, name, distance, health and equipment, with attack, mount, dismount, and use-on-entity. | `features/mineflayer-world` | yes | ⬜ | Covers `entities`. Attacking is gated when the target is a player, because that is a consequential action against another person. |
| 15.13 | Fishing, sleeping, waking, spawn point, and respawn. | `features/mineflayer-world` | yes | ⬜ | Covers `fishing`, `bed`, `spawn_point`. Sleep failures report the real reason the game gave, not a generic message. |
| 15.14 | Book writing and signing, with a page editor and a real character and page limit shown before it is hit. | `features/mineflayer-world` | yes | ⬜ | Covers `book`. |
| 15.15 | Creative mode: give item, set block, fly, and instant break, clearly separated and disabled with a stated reason when the server is not in creative. | `features/mineflayer-world` | yes | ⬜ | Covers `creative`. |
| 15.16 | World ambience read-outs: time of day, weather, sounds, particles, explosions, and command-block editing. | `features/mineflayer-world` | yes | ⬜ | Covers `time`, `rain`, `sound`, `particle`, `explosion`, `command_block`. |
| 15.17 | Resource packs: the server's request surfaced honestly with accept and decline, and what each choice means. | `features/mineflayer-world` | yes | ⬜ | Covers `resource_pack`. Never accepts on the user's behalf. |
| 15.18 | An event inspector listing every library event as it fires, with filtering, a regex-capable search, pause, and export. | `features/mineflayer` | yes | ⬜ | The honest catch-all: a capability with no dedicated control is still reachable and observable here. Bounded buffer with a stated retention. |
| 15.19 | Saved bot profiles, multi-bot sessions, and a per-bot tab, so several bots run at once without their state mixing. | `features/mineflayer` | yes | ⬜ | Profiles are a list with the full bulk-action contract. Deleting one goes through the destructive-action gate. |
| 15.20 | A coverage guard asserting every plugin in `vendor/mineflayer/lib/plugins` is named by a row in this section. | `scripts/check-mineflayer-coverage.mjs` | n/a | ⬜ | Driven by the directory listing, so a plugin added upstream fails the guard until it is given a home. This is the reverse direction from the inventory guard and is needed for the same reason. |

---

## How this inventory is enforced

A project-changing task fails closed when any row above is absent, stale, unimplemented,
undocumented, unlocalized, or untested. Optional language in a row describes a choice the user makes
at runtime — an narrator disabled by default, for instance — and never makes the implementation,
documentation, localization, accessibility, persistence, or tests optional.
