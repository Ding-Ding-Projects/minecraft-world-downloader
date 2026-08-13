# Roadmap

This roadmap tracks the unification of `minecraft-world-downloader`'s five separate surfaces (Java
proxy, Flask web console, WPF desktop manager, Node chat-scraper, Python BlueMap pipeline) into one
Electron desktop application at `app/`, built to full Material Design 3 conformance, alongside a
documentation website at `site/` and a single release-only GitHub Actions workflow.

**`FEATURE_INVENTORY.md` is the authoritative source for what "done" means.** It hand-lists every
feature contract across 14 categories, one row per feature, with a status mark and a note per row for
each of the two surfaces (app and site). This file gives the shape of the effort and an honest read on
where things stand; that file is what actually gets checked off.

Status marks below follow the inventory's own legend: ✅ done, 🏗️ in progress, ⬜ not started.

## Where things stand right now

| Area | Status | Evidence |
| --- | --- | --- |
| Legacy Java proxy, web console, WPF desktop manager, scraper, BlueMap pipeline | ✅ shipped, still live | `src/`, `web/`, `desktop/`, `scraper/`, `bluemap/` all present and buildable; see `HANDOFF.md` §2–3 for the full legacy feature list. |
| Electron application shell | 🏗️ scaffolded only | `app/package.json`, `electron-vite.config.ts`, `electron-builder.yml` (Squirrel target configured) exist. `app/src/renderer/core/` has three files; `app/src/renderer/features/` exists but is empty — no feature module has landed yet. |
| Material Design 3 design system | 🏗️ scaffolded only | `design-system/` has `app/`, `components/`, `foundations/`, `patterns/`, and `site/` subdirectories with tokens and references, not yet wired into `app/`'s renderer. |
| Feature contract (`FEATURE_INVENTORY.md`, ~90 rows across 14 categories) | ⬜ not started | Every row in the inventory is currently ⬜. This is the bulk of the remaining work. |
| Documentation website (`site/`) | ⬜ not started | The directory does not exist yet. |
| Single release-only workflow | ⬜ not started | Six workflows still exist under `.github/workflows/`: `build.yml`, `desktop-release.yml`, `docker-base.yml`, `docker-image.yml`, `maven-publish.yml`, `release.yml`. None has been consolidated or retired yet. |
| `build.bat` / `build.sh` / `build-installer.bat` / `build-installer.sh` | ⬜ not started | None exist at the repository root yet. |

## Milestone 1 — Application shell and design system foundation

- [ ] Wire `design-system/` tokens into `app/`'s renderer as the live theme source (colour, typography,
  shape, elevation, motion), replacing any placeholder styling.
- [ ] Stand up `app/src/renderer/core/` modules for the cross-cutting systems every feature depends on:
  i18n, theme, appearance, tabs, palette, regex builder, search bar, notifications, confirm, progress,
  recovery, history, export, bulk actions, presets, markdown rendering, overlay, collapse, a11y, forms,
  components, settings-ui, menu.
- [ ] Establish the per-feature module convention: each feature under
  `app/src/renderer/features/<id>/` owns and registers itself, never editing a shared registration
  file — per `FEATURE_INVENTORY.md`'s own stated convention.
- [ ] Land the first real feature end-to-end (implementation + localization + accessibility + tests +
  its own `docs/features/` article) as the pattern every subsequent feature follows.

## Milestone 2 — Feature contract build-out

Work through `FEATURE_INVENTORY.md` category by category. Each row needs, independently for both the
app and the site (except where a row's notes name a specific, argued exemption):

- the real implementation,
- localization across all three language modes and both funny-level sliders,
- accessibility (keyboard, screen reader, contrast, reduced motion),
- persistence where the row calls for it,
- a `docs/features/` article,
- a focused test suite, and
- a real built-artifact interaction capture once the surface exists to capture.

The 14 categories, roughly in dependency order (later categories lean on earlier ones — appearance
customization needs the overlay/menu system, the command palette needs tabs and settings to exist,
and so on):

1. Language, voice, and text
2. Appearance and Material Design 3
3. Navigation and discovery (tabs, palette, menus)
4. Search and regular expressions
5. Messaging, safety, and confirmation
6. Data, history, and portability
7. Scheduling and external sources
8. Locks, credentials, and the authenticator
9. Documentation and change records
10. Forms, controls, and layout
11. Conversion and local model tooling
12. Downloads and updates
13. The product itself — world downloader, live map, server/container manager, bot runner, console
14. Release and build

Category 13 is where the legacy surfaces' actual functionality (proxy control, live map, container
management, bot runner, web-console parity) gets rebuilt natively in the unified app — it's the
functional heart of the migration, not a finishing touch, and every other category exists to give it a
consistent, complete shell.

## Milestone 3 — Documentation website

- [ ] Create `site/` and ship it to the same Material Design 3, tabbed-navigation, and full feature-
  contract standard `FEATURE_INVENTORY.md` requires of it — this is not a lighter-weight surface.
- [ ] Bundle every feature's article, with suggested-articles cross-links, mirroring `docs/features/`.
- [ ] Wire the site's own instance of every "site: yes" row in the inventory (search + regex builder,
  appearance editor, tabs, command palette, locks, authenticator, bulk actions, export, local browser-
  storage-backed history, changelog viewer, dim-sum surprise, and the rest).
- [ ] Set the repository's GitHub homepage field to the published site once it exists.

## Milestone 4 — Single release workflow and build scripts

- [ ] Consolidate `.github/workflows/` down to exactly one workflow that builds, packages via
  Squirrel.Windows, and publishes the unified app — no test, lint, type-check, or coverage gate
  anywhere in it.
- [ ] Retire `build.yml`, `desktop-release.yml`, `docker-base.yml`, `docker-image.yml`, and
  `maven-publish.yml` once the unified app supersedes what each one built, and only once nothing else
  still depends on them.
- [ ] Add `build.bat` and `build-installer.bat` at the repository root per the standing build-script
  contract (see `AGENTS.md` §8): touchless dependency bootstrap, silent mode, honest per-phase
  reporting, unsigned-artifact verification with a reported SHA-256.
- [ ] Wire the release's required line-count report, workflow timing, and dim-sum photo asset into that
  one workflow.

## Milestone 5 — Legacy retirement

- [ ] Once the unified app has verified parity with a legacy surface's functionality (per Milestone 2,
  category 13), retire that surface: remove its source, its workflow steps, and its now-superseded
  documentation, updating `README.md` and `HANDOFF.md` in the same change.
- [ ] This is deliberately last. Legacy surfaces stay live, buildable, and documented until there is
  something real to replace them — the repository does not go through a period where a user-facing
  capability exists in neither surface.

## What is explicitly out of scope right now

Per the maintainer's standing scope override, TUI work (if any is ever proposed for this project),
non-Windows release targets, and code-signing of any kind are out of scope until the maintainer
explicitly reopens them. See `AGENTS.md` §7 for the signing prohibition specifically.
