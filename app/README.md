# World Downloader Studio

The desktop application for this project: the proxy that downloads a Minecraft
world while you play, the tools that operate on the result, the live map
pipeline, the web console and the automation around them — all in one window,
built with Material Design 3.

<details>
<summary><strong>Contents</strong></summary>

- [What it is](#what-it-is)
- [Running it](#running-it)
- [Building the installer](#building-the-installer)
- [How it is put together](#how-it-is-put-together)
- [Adding a feature](#adding-a-feature)
- [Where your data lives](#where-your-data-lives)
- [What this build deliberately does not do](#what-this-build-deliberately-does-not-do)

</details>

---

## What it is

An Electron application written in TypeScript. The renderer is plain TypeScript
and DOM — no framework — over a shared Material Design 3 component kit, and the
whole colour scheme is generated at runtime from one seed colour in both light
and dark.

Every capability is available to everyone who runs it. There is no purchase, no
licence, no subscription, no trial and no feature held behind an unlock.

**The things worth knowing on the first run:**

- **`Ctrl+Shift+F`** opens the command palette. It searches every command, every
  destination and every setting; a setting result carries its real live control
  inline, so you can change it without leaving the palette.
- **Three language modes** — English, playful Hong Kong Cantonese, and bilingual
  — with **two independent humour sliders** from 1 to 5, one per language. The
  level styles the voice and never the facts.
- **Tabs, not scrolling.** The strip docks to any edge and defaults to the left,
  because a screen is wider than it is tall and so is a tab label.
- **Right-click anything** for **Edit appearance…**, which opens an anchored
  editor with word-processor typography depth and an infinite colour picker that
  translates between fourteen colour representations.
- **Everything is local.** No CDN, no web font, no analytics, no telemetry.
  Outbound HTTP is deny-by-default and a feature must register an allow rule
  naming itself and its reason before it can reach a host.

---

## Running it

From this directory:

```sh
npm install
npm run dev
```

If your package manager blocked install scripts — increasingly the default — the
Electron runtime binary will be missing and `npm install` will have said nothing
about it. `npm run dev` heals that automatically, or run it yourself:

```sh
npm run ensure-electron
```

That script verifies the already-downloaded archive against the SHA-256 recorded
in the `electron` package's own `checksums.json`, extracts it, and proves
`require('electron')` resolves to a real file afterwards. It never downloads
anything, and it names the exact file it was looking for when the cache is empty.

Other commands:

```sh
npm run build       # bundles main, preload and renderer into out/
npm run start       # runs the built bundles
npm run typecheck   # tsc over both projects, no emit
```

---

## Building the installer

```sh
npm run dist
```

This produces the Windows installer with electron-builder, target **squirrel**
(Squirrel.Windows), into `release/`.

**The installer is unsigned, deliberately and permanently.** Code signing is out
of scope for this project: there is no certificate, no signing key and no signing
step anywhere in the build, and `forceCodeSigning`, `signExecutable` and
`signAndEditExecutable` are all set to `false` explicitly so nothing can quietly
discover one. Windows will show an unknown-publisher or SmartScreen warning when
the installer runs. That is expected and is not a defect.

---

## How it is put together

```
app/
├── electron.vite.config.ts     three builds: main, preload, renderer
├── electron-builder.yml        Squirrel.Windows packaging, signing off explicitly
├── src/
│   ├── shared/                 types both processes agree on
│   │   ├── api.ts              the complete privileged surface
│   │   └── channels.ts         the IPC allow-list
│   ├── main/
│   │   ├── index.ts            frameless window, session hardening, lifecycle
│   │   ├── ipc.ts              typed registry; every channel wrapped in Result<T>
│   │   ├── paths.ts            data directories, pinned to the package identity
│   │   └── services/           settings, vault, processes, history, net, editor
│   ├── preload/index.ts        the one contextBridge object, `window.studio`
│   └── renderer/
│       ├── main.ts             boot sequence and feature discovery
│       ├── index.html          no external resource of any kind
│       ├── styles/             Material Design 3 tokens and components
│       ├── core/               registry, i18n, theme, components, and the rest
│       └── features/           one directory per feature
└── INTEGRATION_CONTRACT.md     what a feature author is handed
```

**Security posture.** `contextIsolation` on, `nodeIntegration` off, `sandbox` on,
a Content Security Policy applied both as a response header and as a meta tag,
every permission request refused, navigation kept inside the application, links
handed to the user's own browser, and no `webview`. The preload bridge names
every channel literally, so a feature cannot reach a channel that file did not
choose to expose.

**Child processes** run without a shell and only from a fixed command allow-list
(`java`, `node`, `docker`, `git`, and a handful of others). Retained output is
bounded and truncation is reported rather than silent.

---

## Adding a feature

Create one directory:

```
src/renderer/features/<your-feature-id>/index.ts
```

Default-export a `FeatureModule`. The boot sequence globs
`./features/*/index.ts`, registers every default export and calls each module's
`init`. There is no list to append to and no switch statement to extend, which is
what lets many features be written in parallel without touching each other.

A module contributes tabs, settings sections, command-palette entries,
documentation articles and its own copy catalogue. Read
**[INTEGRATION_CONTRACT.md](./INTEGRATION_CONTRACT.md)** first — it is the exact
contract: every import path with its exported names and signatures, every CSS
custom property, and the checklist a feature must satisfy.

---

## Where your data lives

One folder inside your application data directory, named after the **package
identity** and never after the display name you choose in settings:

- Windows — `%APPDATA%\world-downloader-studio`
- macOS — `~/Library/Application Support/world-downloader-studio`
- Linux — `~/.config/world-downloader-studio`

Inside it:

| Path | What it holds |
| --- | --- |
| `settings.json` | every preference, with the provenance of each |
| `history/` | the local, append-only version-history repository |
| `vault.bin` | credentials, encrypted by the operating system's own service |
| `window-state.json` | the remembered window geometry |
| `logs/` | application logs |

**Renaming the application changes the display name and nothing else.** The data
directory, the installer identity and the update feed all stay put, because a
data directory derived from a mutable display name orphans every stored profile
the moment somebody types a new title. A diagnostic report still names the
shipped product, so a reader knows what software they are looking at.

**Deleting that folder is the reset.** It clears every toy lock, every stored
preference and the local history. That is documented rather than hidden, because
the locks in this application are for fun and not security, and a user who has
locked themselves out needs a route back that does not involve anybody else.

The history repository is local only. There is no remote, and nothing in it is
ever pushed anywhere.

---

## What this build deliberately does not do

- **It is never signed.** See above.
- **It never asks for money.** No purchase, no donation prompt, no upgrade nag,
  no rating request, no startup interruption.
- **It never fetches an asset at runtime.** Every script, style, font and icon is
  compiled into the build. The icon set is inline SVG rather than an icon font,
  so nothing needs a network and no icon name can leak into rendered text.
- **It does not turn the dim sum surprise off.** Ten launches in a hundred show a
  dish. There is no setting for it, which is exactly why the surface never gates
  startup, never steals focus and dismisses itself.
