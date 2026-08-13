# Dim sum — the startup surprise and the release code name

Two small features share one public data source and one rule about photographs.

The **startup surprise** is a card that appears on roughly one launch in ten, naming a Hong Kong dim
sum dish in both English and Traditional Chinese and showing its photograph. The **release code
name** gives every build a dish of its own, used once per project, so two builds are never referred
to by the same name in conversation.

Neither of them stores a photograph in this repository, and neither invents a dish.

---

## The photograph rule, first

The sole source of dim sum photographs and dish metadata is the public catalogue project
[`Ding-Ding-Projects/dim-sum-photos`](https://github.com/Ding-Ding-Projects/dim-sum-photos).

- **Dish metadata** comes from
  `https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json`.
- **Photographs** come only from that project's published `catalog-v1*` release assets.
- **Nothing in this repository generates, vendors, downloads-and-commits, or mirrors a photograph.**
  No PNG, no JPEG, no base64 blob wearing a constant's name. If the catalogue has no published image
  for a dish, the image is omitted and the gap is reported; it is never filled locally.
- The catalogue is not copied here as a second authority either. What is bundled is a small
  **metadata snapshot** — text only — with the source URL and the fetch date recorded beside it.

### What the catalogue index actually looks like

Read on 2026-08-13. The observed field names, rather than a guess at them:

| Field | Meaning |
|---|---|
| `schemaVersion` | `"1.0.0"` |
| `catalogStatus` | `"in-progress"` — the catalogue is still growing |
| `title` | `"Hong Kong dim sum and dish catalog"` |
| `total` | `2866` dishes at the time of reading |
| `imageSpecification` | `format`, `mediaType`, `quality`, `minimumWidth`, `minimumHeight`, `generationMode` |
| `dishes[]` | the records themselves |
| `indexes` | `byId`, `bySlug`, `byCategory` lookup maps |

Each `dishes[]` record carries:

| Field | Example |
|---|---|
| `id` | `hk-dish-0001` |
| `slug` | `classic-har-gow` |
| `name.en` | `Classic Har Gow` |
| `name.zhHant` | `蝦餃` |
| `jyutping` | `haa1 gaau2` |
| `category` / `subcategory` | `steamed-dim-sum` / `steamed shrimp dumpling` |
| `description.en` / `description.yue` | prose, both languages |
| `ingredients[]`, `dietaryTags[]`, `allergens[]` | lists |
| `image.path` | `images/hk-dish-0001-classic-har-gow.png` |
| `image.alt.en` / `image.alt.yue` | alternative text, both languages |
| `imagePrompt` | the generation prompt, used by the catalogue project only |

`name.en` and `name.zhHant` are authoritative for a release code name. `image.alt.en` and
`image.alt.yue` are authoritative for alternative text.

### Where a photograph lives

The asset filename is the basename of `image.path`. The release it lives in was observed to be:

| Dish numbers | Release tag | Assets |
|---|---|---|
| `hk-dish-0001` – `hk-dish-0995` | `catalog-v1` | 990 photographs plus five `catalog-v1.7z.00N` archive volumes |
| `hk-dish-0996` – `hk-dish-1985` | `catalog-v1-part-002` | 990 photographs |
| `hk-dish-1986` and upward | `catalog-v1-part-003` | 943 photographs |

A download URL is therefore
`https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/<tag>/<assetFileName>`.

A `HEAD` request against that URL, with redirects left unfollowed, is the cheap existence proof:
**302** means the asset is published (GitHub is handing the request to its signed download host) and
**404** means it is not there. No image bytes move either way.

---

## The startup surprise

Implemented in `app/src/renderer/core/dimsum.ts`.

### What happens

The main process draws once per launch — `app/src/main/index.ts`, `drawDimSum()` — and sends a
`dimsum:surprise` event carrying `won`, `roll`, `probability` and `selector`. The roll and the
probability travel with the event so the odds are auditable rather than asserted; the renderer never
re-rolls, so the surprise can neither fire twice in a launch nor more often than the stated one in
ten.

`selector` picks the dish from the bundled snapshot. The renderer owns the dish list, so the
catalogue never has to exist in the main process.

### It cannot be turned off

There is no setting, no hidden flag and no environment variable that disables it, and none will be
added. Any stored preference from an older build that tried to is simply ignored, so an old profile
rejoins the draw.

That is only polite because of how carefully the surface behaves, and each of these is a real
condition in the code rather than an intention:

- **It never gates startup.** The event is sent 1.5 s after the first paint. The application is
  usable before the card exists, and would be usable if the card never appeared.
- **It never steals focus.** The card is `role="status"` with `aria-live="polite"`. Nothing is
  focused, nothing is scrolled, and the keyboard position the user had is the keyboard position they
  keep. The announcement reaches a screen reader without taking their place away from them.
- **It dismisses itself** after 12 seconds, and carries a dismiss button for anyone who would rather
  not wait.
- **It never appears on a first run.** The first launch writes a marker file
  (`<userData>/dim-sum/first-launch-complete.json`) and shows nothing. A marker that cannot be read
  or written is treated as a first run: staying quiet is the safe direction to fail in.
- **It never appears on an error path.** The module installs `error` and `unhandledrejection`
  listeners at import time, so a failure that happened *before* the draw arrived still suppresses it,
  and it stays suppressed for the rest of that launch.
- **It never appears mid-task.** An open `dialog[open]` or any `[aria-modal="true"]` surface — which
  is what a modal dialog and the destructive-action gate both are — suppresses it.
- **It never appears during an update, or any other flow that owns the user's attention.** Such a
  flow calls `suppressDimSum('update')` on entry and calls the returned function on exit.

```ts
import { suppressDimSum } from '../../core/dimsum';

const release = suppressDimSum('update');
try {
  await installUpdate();
} finally {
  release();
}
```

`dimSumSuppressedBy()` returns the reasons currently holding it back, so a status surface can report
the real state rather than guessing at it.

### School mode

While the named study mode is on, every dim sum capability behaves as though it were not installed:
no card, no copy, no photograph request, no trace anywhere. The check is `i18n.schoolModeActive()`
and it runs before anything else, including before the network. This is the one suppression that is
not about timing — it is a capability being absent, not deferred.

### Languages and humour

`nameDish()` names the dish in **both** languages, always. The active language mode decides which one
leads:

| Mode | Primary line | Secondary line |
|---|---|---|
| `en` | `Classic Har Gow` | `蝦餃` |
| `yue` | `蝦餃` | `Classic Har Gow` |
| `both` | `Classic Har Gow` | `蝦餃` |

Half of a Hong Kong dish's name is the Chinese one, so both are shown; what the mode decides is
which a reader is asked to parse first.

The per-language funny level styles the copy **around** the dish — the title, the lede, the reason a
photograph is missing — across all five rungs, in both languages. It never touches the dish's own
name, which is printed from the catalogue record verbatim at every level and in every mode. A joke
that renames the food has stopped being a joke about the food.

### Alternative text

`altTextFor()` builds the alternative text from the catalogue's own `image.alt` for the active
language, with the bilingual name appended, so a screen-reader user is told which dish they are
looking at and not merely that there is a photograph. When the photograph is unavailable the emoji
placeholder takes an `aria-label` that names the dish and says plainly that the picture could not be
fetched.

### The photograph, and what happens when there isn't one

`loadDishPhoto(dish)` resolves the picture **after** the card is already on screen and already
complete. The card never waits for the network.

1. **Cache first.** `<userData>/dim-sum/<dish-id>.photo.json` holds `{ assetUrl, mediaType,
   fetchedAt, base64 }`. The record is used only if its `assetUrl` matches the URL being asked for
   and its payload still looks like base64, so a stale or corrupt file is a miss rather than a
   crash.
2. **Then the public asset.** Outbound HTTP is deny-by-default, so the feature registers its own
   allow rules first, naming itself and its reason: `github.com` for the asset URL, and
   `.githubusercontent.com` because that URL redirects to a signed download host. The redirect is
   followed only because that host is allowed **in its own right** — each hop is re-checked against
   the allow rules, never trusted because a redirect said so.
3. **Then the cache is written.** At most one file per dish that has actually been shown, which is at
   most one per launch. There is no pruning schedule and none is needed; deleting the application
   data directory clears it, exactly as it clears everything else.

When the picture cannot be had, the card says so and shows the dish's real name:

| Situation | What the card says |
|---|---|
| The machine is offline | "the photograph could not be fetched … this computer is offline" |
| The asset answered 404, or a rule refused the request | "… the catalogue answered `404 Not Found`" |
| The download was cut short | "… the download was cut off before the picture was complete" |

**No substitute picture is ever shown.** A different dish's photograph, a generic dumpling, or a
generated image would all be a lie about which dish this is.

### Supporting changes elsewhere

Two small, additive changes were needed to fetch a binary file behind a redirect, and both keep the
existing security posture:

- `HttpRequest.responseEncoding?: 'utf8' | 'base64'` — a PNG decoded as UTF-8 text is a destroyed
  PNG. `HttpResponse.bodyEncoding` reports which was used, and `finalUrl` reports where the body
  actually came from.
- `HttpRequest.maxRedirects?: number`, capped at 4 and defaulting to 0 — every hop is re-validated
  against the allow rules by `validateTarget()`, so following a redirect can never reach a host a
  direct request would have been refused for.

### Verification

- `npx tsc --noEmit -p tsconfig.web.json` from `app/` type-checks the module.
- The 168 snapshot rows were each verified with a `HEAD` request against their published asset on
  2026-08-13; all 168 answered 302.
- Behaviour worth exercising by hand: a won draw and a lost draw; a first launch and the launch after
  it; a launch with the study mode on; a launch with the machine offline; a launch with a corrupt
  cache file; a suppression held across the draw; a modal dialog open when the draw lands; all three
  language modes; both funny levels at 1 and 5; keyboard-only dismissal; and a screen reader hearing
  the dish name.

---

## The release code name

`scripts/pick-dim-sum-codename.mjs` resolves the next unused dish for a release.

```
node scripts/pick-dim-sum-codename.mjs [--repo owner/name] [--offline] [--pretty]
```

### How it stays cheap

Choosing one name must not cost thousands of API calls, so:

1. **Prior release bodies are read once**, with `gh api repos/:owner/:repo/releases --paginate`,
   which returns the bodies alongside the list. If that call is refused it falls back to
   `gh release list` plus `gh release view` per release, and reports which route it used.
2. **The catalogue index is read once.**
3. **The catalogue's photo *releases* are listed — never their assets.** There are three release
   records today and several thousand assets inside them, and only the tags are needed to build a
   URL.
4. **One `HEAD` per candidate** confirms the next unused dish's photograph is actually published.
   The first candidate normally settles it: a typical run reports `"probes": 1`.

### Which dishes count as used

Two signals, because release notes have carried both forms:

- the catalogue identifier, `hk-dish-\d{4,}`, which is exact; and
- the dish's **English name**, bounded by a non-letter on each side so `Har Gow` does not swallow
  `Scallop Har Gow`; and its **Chinese name**, bounded by a non-ideograph on each side, because 蝦餃
  sits inside 帶子蝦餃 and a plain substring test would spend the shorter name every time the longer
  one was mentioned.

Both boundary rules err toward *skipping* a dish rather than reusing one. Spending a spare name out
of a catalogue of 2,866 is cheap; two releases that cannot be told apart is not.

### Output

One JSON object on stdout:

```json
{
  "ok": true,
  "id": "hk-dish-0002",
  "slug": "scallop-har-gow",
  "nameEn": "Scallop Har Gow",
  "nameZhHant": "帶子蝦餃",
  "codeName": "Scallop Har Gow · 帶子蝦餃",
  "assetFileName": "hk-dish-0002-scallop-har-gow.png",
  "releaseTag": "catalog-v1",
  "downloadUrl": "https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/hk-dish-0002-scallop-har-gow.png",
  "priorReleasesRead": true,
  "usedCount": 38,
  "probes": 1,
  "notes": []
}
```

`notes` is where the script is honest about what it could not do — release bodies it failed to read,
a catalogue index that was unreachable and fell back to the bundled snapshot. When any of those
happen the code name may repeat, and the note says so rather than the number quietly being wrong.

### Exit codes, and why a failure is not a release blocker

| Exit | Meaning |
|---|---|
| `0` | a code name was resolved |
| `3` | no code name could be resolved — pool exhausted, or the catalogue was unreachable |

**Exit 3 means "publish this release without a code name", never "fail the release".** The code name
is decoration with a purpose; a release must not be blocked, delayed or renamed because a catalogue
was unavailable.

### Using the code name

A code name is used **once per project**. Show it and a link to the public dish photograph wherever
the release is presented — the release notes, the changelog viewer entry, the landing page's release
section, the application's About surface — using the public asset URL or an ordinary application-data
cache. Never copy the photograph into this repository, never attach a duplicate release asset, and
never invent a dish that is not in the public catalogue.

The dish's names stay factual at every funny level and in every language mode, exactly as the
surprise requires. Alternative text names the dish so the code name reaches screen-reader users too.

### `--offline`

Uses the bundled snapshot in `app/src/renderer/core/dimsum.ts` instead of the live index. The rows
are parsed out of that TypeScript source rather than duplicated in the script, so the two cannot
drift. It is a genuine subset of the catalogue, not a second authority.

---

## Files

| Path | What it is |
|---|---|
| `app/src/renderer/core/dimsum.ts` | Metadata snapshot, provenance, photo cache, suppression API, the card |
| `app/src/main/index.ts` | The per-launch draw and the `dimsum:surprise` event |
| `app/src/main/services/net.ts` | Deny-by-default outbound HTTP; base64 responses and re-validated redirects |
| `app/src/shared/api.ts` | `DimSumDraw`, `HttpRequest`, `HttpResponse` |
| `app/src/renderer/styles/material.css` | `.md-dimsum` and its photograph, name and lede elements |
| `scripts/pick-dim-sum-codename.mjs` | The release code-name resolver |

## Suggested articles

- [Language modes and humour levels](language.md) — how the copy around the dish is styled, and why
  the dish's own name is never styled
- [School mode](school-mode.md) — the mode that makes every dim sum capability behave as if it were
  not installed
- [Accessibility & themes](accessibility-themes.md) — the announcement, focus and contrast rules this card obeys
- [Deployment, CI & installer](deployment-ci.md) — where the code name is attached to a release
