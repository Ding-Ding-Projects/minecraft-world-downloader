# Test inventory

Hand-written on purpose. A list generated from the tests that exist can only confirm the tests
that exist — it cannot notice a suite that was never written. This file is the contract; the
suites are what discharge it. Every row below is either **written and run**, with its real,
observed result, or **not yet written**, with the exact reason and what it would need. No row is
silently dropped.

## Test runner

**Vitest 4.1.10**, not Node's built-in `node:test`. `node:test` was tried first, per the standing
preference for no new heavyweight dependency, and it fails at the very first import: this renderer
is written throughout against Vite's "bundler" module resolution — extensionless relative imports
(`import { settings } from '../../core/settings'`, no `.ts`), `.css` side-effect imports, and the
`@core`/`@shared` path aliases declared in `electron.vite.config.ts`. Plain Node ESM resolution
requires an explicit file extension on every specifier and has no concept of those aliases, so
`node --test` throws `ERR_MODULE_NOT_FOUND` on the second line of `core/i18n.ts`, before a single
test body runs. (Node 26's built-in TypeScript type-stripping itself works fine in isolation — see
`app/vitest.config.ts`'s own comment for the one-file proof — the resolver is what fails, not the
type stripping.) Rewriting every relative import across 35 feature directories and 27 core modules
to satisfy a different resolver, just to avoid one devDependency, would have been a larger and
riskier change than the tests themselves, and would have fought the project's own Vite toolchain
for no benefit. Vitest sits directly on that toolchain, resolves the source tree exactly as
electron-vite does, and needed zero changes to application source to run against it.

- Config: `app/vitest.config.ts` — jsdom environment, `@core`/`@shared` aliases matching
  `electron.vite.config.ts`, CSS processing on (several feature `index.ts` files `import
  './styles.css'`).
- Setup: `app/tests/setup.ts` — polyfills `window.matchMedia` (a class-field initializer in
  `core/theme.ts` reads it the moment the module is imported) and installs a fake `window.studio`
  bridge (every method resolves an honest `{ ok: false }`; nothing in these suites exercises real
  file I/O, settings persistence or a child process).
- Command: `npm --prefix app run test` (or `cd app && npx vitest run`).
- Added devDependencies: `vitest@4.1.10`, `jsdom@27.4.0`.

## Suites

| # | Suite | Command | Scope | Evidence |
|---|-------|---------|-------|----------|
| 1 | Localization ladders | `npx vitest run tests/unit/i18n.test.ts` | Every catalogue entry — the core catalogue (`core/i18n.ts`'s `CORE`) and all 35 feature `strings.ts` catalogues — has a 5-rung `FunnyLadder` in English AND Cantonese, every rung a non-empty string. Includes a positive self-test that feeds the checker a fabricated broken catalogue and asserts it is actually rejected (a guard nobody has watched fail proves nothing), and a check that no feature catalogue shadows a `core.*` key. | **PASS — 5/5 tests.** Real result: the application's localization is genuinely complete; the mechanical scan found zero missing rungs across the core catalogue and all 35 feature catalogues. |
| 2 | TOTP / RFC 6238 + RFC 4226 | `npx vitest run tests/unit/totp.test.ts` | `core/totp.ts`'s `totp()`/`hotp()`/`verifyTotp()` against the RFC 6238 Appendix B published test vectors (SHA-1/SHA-256/SHA-512 × 8-digit, plus the derived 6-digit values) and the RFC 4226 Appendix D 6-digit HOTP vectors; clock-skew window behaviour; base32 round-trip against the RFC 4226 known encoding. | **PASS — 52/52 tests.** Every published vector matched exactly — real, independent confirmation the authenticator's cryptographic core is correct, not merely "looks right." |
| 3 | Colour round-trips & tonal palette | `npx vitest run tests/unit/color.test.ts` | RGB → {Lab, LCH, OKLab, OKLCH, HSL, HSV, HWB, CMYK} → RGB round-trips within tolerance for 11 sample colours (black, white, grey, primaries, the app's own default seed, and near-boundary tones); the translator's `formatColor`/`parseColor` round-trip for every representation; named-colour table; **calls the real `theme.apply()`** (not a re-implementation) in jsdom and reads the actual CSS custom properties it writes onto `document.documentElement`, comparing that real generated set against `tokens.css`'s declared `--md-sys-color-*` tokens. | **PASS — 237/237 tests.** The generated-vs-declared token check found the real, non-alias generated set is **37 tokens**, not the 35 estimated in this task's brief — `tokens.css` declares 45 `--md-sys-color-*` tokens total, 8 of which (`success`/`warning` and their `on-`/`-container` siblings) are static aliases theme.ts does not regenerate; 45 − 8 = 37, and `theme.apply()` writes exactly those 37, no more, no fewer. Corrected the count against reality rather than the estimate. |
| 4 | Regex builder bounds | `npx vitest run tests/unit/regexbuilder.test.ts` | `compile()`/`evaluate()`/`escapeLiteral()`: match cap (500), sample-size cap (20,000 chars), zero-width match advancement, capture groups (numbered and named, including an unmatched optional group), non-global-pattern handling, literal escaping round-tripped through the real engine, and the stated 250ms time budget against a catastrophically backtracking pattern. | **FAIL — 16/17 tests pass; 1 known, unfixed, real defect** — see "Defects found" below. |
| 5 | Export format writers | `npx vitest run tests/unit/export.test.ts` | `core/export.ts`'s `serialize()`/`preflight()` for all 10 formats (json, jsonl, yaml, toml, xml, csv, tsv, markdown, html, sql): each format's own encoding/schema-version header, CSV/TSV quoting and column-count correctness, JSON/JSONL validity and round-trip, XML/HTML entity escaping, SQL identifier sanitization and value quoting, Markdown pipe-escaping and table shape, and that `preflight()` reports every nested-field loss for a flat format before anything is written. | **PASS — 31/31 tests.** |
| 6 | Packaging configuration | `npx vitest run tests/unit/packaging.test.ts` | `electron-builder.yml` targets `squirrel`, carries no NSIS target and no legacy `setupExe`/`noMsi` keys, declares a non-empty HTTPS `squirrelWindows.iconUrl`, has `forceCodeSigning: false` and `signExecutable: false` (and explicitly NOT `signAndEditExecutable: false`, which the file's own comment records once shipped the framework's default icon by accident), carries no `CSC_*` reference, and `publish: null`; `app/package.json` has a non-empty, non-placeholder `author`. | **PASS — 12/12 tests.** |
| 7 | Setting-id uniqueness & FeatureModule shape | `npx vitest run tests/unit/registry.test.ts` | Imports every one of the 35 real `features/*/index.ts` modules (not just their `strings.ts`) through the real `core/registry.ts`, asserts every module's default export has the required `FeatureModule` shape (non-empty `id`/`name`/`description`, `id` matching its own directory, every tab has a `mount` function, every custom/action/select setting has the field its `kind` requires), registers all 35 through the real registry with zero id collisions, then independently recomputes uniqueness directly from every module's declared setting ids (not trusting the registry's own bookkeeping alone). Includes a positive self-test proving the registry genuinely throws on a real duplicate id. | **PASS — 4/4 tests.** Real result: all 35 features import cleanly, every FeatureModule shape check passes, and the application has well over 50 settings with zero id collisions anywhere. |
| 8 | Accessibility of the rendered component kit | `npx vitest run tests/unit/accessibility.test.ts` | Renders real DOM through `core/components.ts`'s actual factory functions (not mocks): `button`/`iconButton` accessible names and disabled-reason exposure; `switchControl`/`checkbox` role="switch", label association via `for`/`id`, state changes firing `onChange`; `textField` label association, real `<textarea>` vs `<input>`, native `min`/`max`/`step`, the live-vs-committed (`input` vs `change`) event distinction; `select`'s `aria-haspopup="listbox"`/`aria-expanded`; `sectionHeading`'s progressive-disclosure toggle; and `core/a11y.ts`'s live-region announcements, roving-tabindex (including the horizontal/vertical axis distinction and wrap-around), focus trap (Tab/Shift+Tab wrap, skipping disabled elements), `reducedMotion()`, and `assertTouchTarget()`'s non-throwing behaviour on an unlaid-out element. Deliberately does NOT assert on-screen pixel geometry or contrast ratios — jsdom has no layout engine, so `getBoundingClientRect()` is always 0×0 and any assertion built on it would be vacuous; that boundary is stated in the suite's own header comment. | **PASS — 33/33 tests.** Found and fixed one real defect in `iconButton()` along the way — see "Defects found and fixed" below. |
| 9 | Documentation-bundle & changelog freshness | `npx vitest run tests/unit/docs-freshness.test.ts` | Wraps the project's own committed verifiers as real subprocesses (not a re-implementation of their comparison logic, for the same reason the packaging suite reads YAML as text rather than parsing it: a second implementation of the same freshness check is just a second thing that can drift from the first): `scripts/check-docs-bundle.mjs` (every `docs/features/*.md` file is bundled into `features/docs-browser/generated.ts`, content-hash matched, nothing stale) and `scripts/validate-changelog.mjs` (every changelog commit id resolves). | **PASS — 2/2 tests.** Found and fixed a real staleness defect along the way — see below. |
| 10 | `FEATURE_INVENTORY.md` completeness | `node scripts/check-inventory.mjs` (pre-existing, repo root) | Every one of 114 inventory rows resolves to a real path; every named feature directory has a documentation article and a default export; every `Site: yes` row has site coverage. | **PASS.** 114 rows, 15 sections, 35 feature directories, all satisfied — re-verified in this session. |
| 11 | Site coverage | `node scripts/check-site-coverage.mjs` (pre-existing, repo root) | Every `docs/features/*.md` article is bundled into `site/assets/articles.js`; every `Site: yes` inventory row is carried by an article or a landing-page card. | **PASS.** 56 articles on disk and bundled, 94 "Site: yes" rows, 114 distinct card ids — re-verified in this session. |
| 12 | Mineflayer plugin coverage | `node scripts/check-mineflayer-coverage.mjs` (pre-existing, repo root) | Every vendored Mineflayer plugin is named by an inventory row in section 15. | **PASS.** 41 plugins, 20 rows — re-verified in this session. |
| 13 | Inventory negative regression | `node scripts/check-inventory-negative.mjs` (pre-existing, repo root) | Deliberately breaks one thing at a time (deletes a named core module, neutralises a feature's default export, blanks a status mark, adds an unlisted feature directory, removes the documentation site, deletes an installer build script) and asserts the guard above catches every one, then restores it. | **PASS — 8 caught, 0 missed, 0 skipped** — re-verified in this session. |

**Total, this session's new suites (1–9):** 393 tests run, **392 passed, 1 failed** (the one honest,
documented, unfixed defect below — never silenced, never skipped to make the number look better).

**Total, pre-existing repo-root guards (10–13):** all four re-verified green in this session.

## Not yet written

| Row (from the task brief) | Status | Reason |
|---|---|---|
| A wider accessibility sweep of every individual feature panel (all 35), beyond the shared component kit | **Not written.** | Each feature's `mount(host, ctx)` needs a real `AppContext` (settings, i18n, notify, history, confirm, tabs, palette, docs, theme, appearance, locks, overlay, a11y, components, exporter, `studio`, `dimSum` — the full interface in `core/types.ts`), not just the fake `window.studio` bridge this session built. That is a substantial fixture-building effort (essentially a lightweight app-context test harness) rather than a single test file, and is scoped out of this suites-writing pass. `tests/unit/accessibility.test.ts` covers the shared kit every feature is built from, which is the highest-leverage 90% of this; the remaining 35-panel sweep is real follow-up work, named here rather than silently dropped. |
| A true end-to-end/integration run of the packaged Electron app (real window, real IPC, real settings file) | **Not written.** | Out of scope for a Vitest unit suite; needs the headless-desktop capture harness this project already uses elsewhere for screenshot verification, not `node:test`/Vitest. Named here so it is not mistaken for "covered." |

A row that cannot honestly be marked "written and run" stays in this table rather than being
dropped from it.

## Defects found

### 1. Unfixed, real: `evaluate()`'s time budget does not protect against a single catastrophically backtracking `exec()` call

**File:** `app/src/renderer/core/regexbuilder.ts`, `evaluate()` (the loop starting at line 54).
**Test:** `app/tests/unit/regexbuilder.test.ts`, `evaluate(): time budget`.
**Status: FAILING, left failing on purpose** — see the note on "never skipped to make a number look
better" below.

The elapsed-time check (`performance.now() - started > TIME_BUDGET_MS`) runs only **between**
iterations of the match loop, immediately before each `runner.exec(text)` call. It never interrupts
an `exec()` call already in progress. JavaScript is single-threaded and V8's native `RegExp` engine
has no cooperative yield point mid-match, so a single call to `exec()` on a pathological pattern can
itself run for an unbounded time — the 250ms budget is never consulted again until that one call
returns.

Measured directly, twice, independently, on this machine:

```
/^(a+)+$/.exec('a'.repeat(28) + '!')   via evaluate()   ->   13,894 ms   (first run)
                                                              13,815 ms   (full-suite re-run)
```

against a stated 250ms budget, for a 29-character sample — well inside every size cap this module
enforces (`MAX_SAMPLE_CHARS = 20,000`, `MAX_MATCHES = 500`). Those caps protect a *different* failure
mode (many matches over a large input); neither does anything for a single call that never returns
promptly. This is exactly the class of defect the project's own contract calls out by name: "protect
the host from catastrophic backtracking and regex denial of service." A user typing a handful of
characters into the pattern builder's own sample field can freeze the renderer's main thread for
double-digit seconds.

**Why it is not fixed in this pass:** a correct fix has to interrupt a hung synchronous `exec()` call
from *outside* the thread running it. In a browser/Electron renderer that means moving evaluation
into a Web Worker with a hard `worker.terminate()` on timeout, which changes `evaluate()` from a
synchronous call to an asynchronous one and touches its one real caller — `regexbuilder.ts`'s own
`update()`, which currently calls it synchronously on every keystroke to redraw the match list. That
is a real architecture change to the regex builder's execution model, not a test fix, and sits
outside this lane's scope (writing and running the test suite). It is reported here, with an exact
reproduction and root cause, rather than silently loosened to a value large enough to stop failing —
the task's own instruction is explicit that "a failure you cannot fix is reported with its exact
cause, never silenced, never skipped to make a number look better," and loosening the assertion to
accept 14 seconds would be exactly that.

### 2. Found and fixed: `iconButton()` silently stripped its own tooltip

**File:** `app/src/renderer/core/components.ts`, `iconButton()`.
**Test:** `app/tests/unit/accessibility.test.ts`, `iconButton(): requires and renders an accessible
name distinct from the icon`.
**Status: FIXED.**

`iconButton()` set `title` in its initial `attrs`, then unconditionally called `applyDisabled(node,
options.disabled === true, options.disabledReason)`. `applyDisabled`'s enabled branch does
`element.removeAttribute('title')` (it uses `title` to carry the disabled-reason explanation, and
clears it when there is nothing to explain) — which, for every icon button that is not disabled
(the overwhelming majority of them), immediately erased the hover tooltip the button had just set.
The accessible name (`aria-label`, set separately via `setAttribute` and untouched by
`applyDisabled`) survived, so a screen reader was unaffected — but every sighted mouse user lost the
"what does this icon do" hover hint on every enabled icon button across the entire application.
Confirmed with a direct test: `node.title` was `''` immediately after construction, where
`'Close dialog'` was expected.

**Fix:** moved the `title` assignment to after the `applyDisabled()` call, applied only when the
button is not disabled (when it *is* disabled, `applyDisabled`'s own title — the disabled-reason
explanation — is more useful and is left as-is). See the comment left at the fix site explaining why
the ordering matters, so it does not regress the same way again.

### 3. Found and fixed: the in-app documentation bundle was stale (26 articles missing, 2 stale)

**File:** `app/src/renderer/features/docs-browser/generated.ts` (generated; source of truth is
`docs/features/*.md`, generator is `app/scripts/bundle-docs.mjs`).
**Test:** `app/tests/unit/docs-freshness.test.ts`.
**Status: FIXED (regenerated).**

Before this session's `node scripts/bundle-docs.mjs` run, `scripts/check-docs-bundle.mjs` reported
57 Markdown files in `docs/features/` against only 31 bundled — 26 articles (including
`authenticator.md`, `bot.md`, `console.md`, `converter.md`, `downloader.md`, and 21 more) were
entirely missing from the shipped, offline, in-application documentation browser, and two more
(`appearance.md`, `export.md`) had changed on disk since the bundle was last written. This is a
generated-artifact drift with no source-code cause; the fix is the mechanical regeneration the
checker's own error message names (`node scripts/bundle-docs.mjs`), not a hand edit. Re-verified
clean immediately after (`57 articles bundled, 57 files on disk, contents and manifest match`), and
regenerated a second and third time mid-session after concurrent edits to
`docs/features/desktop-manager.md` and then `docs/features/deployment-ci.md`, each from another lane
working in this same shared worktree — see the note on concurrent activity below. Because those
edits are ongoing and outside this session's control, the bundle may go stale again between this
report being written and being read; `node scripts/bundle-docs.mjs` followed by `node
scripts/check-docs-bundle.mjs` is the fix each time, and `tests/unit/docs-freshness.test.ts` is what
will keep catching it.

## A note on concurrent activity in this worktree

This session ran in `C:/Users/cntow/Documents/GitHub/mwd-herng-ha`, a worktree that other agents
were actively committing to throughout. Partway through, `git status` showed this session's own
`core/i18n.ts` edit (the `export { CORE, ... }` addition needed so the localization suite could
import the core catalogue), `vitest.config.ts`, `tests/setup.ts` and six of the nine new test files
already present in `HEAD` (commit `a70f8bd`, already pushed to `origin/feat/herng-ha-app`) — this
session never ran `git commit` or `git push` itself. That commit also carried a large amount of
unrelated work from other lanes (README, site assets, deleted images, `docs/features/desktop-manager.md`).
Nothing from this session was lost; the remaining local diff at the end of this pass was exactly two
files — the `iconButton()` fix and the re-regenerated documentation bundle — both described above.
