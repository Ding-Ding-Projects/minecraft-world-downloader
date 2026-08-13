# Local model suite manager (documentation site)

A local model runtime manager built into the documentation site itself, at
`models.html`. It talks to a local, Ollama-compatible HTTP API at a loopback
address, shows exactly what is installed and currently loaded, gives a
conservative, evidence-backed hardware fit verdict, runs a batch pull queue,
and hosts a local chat surface — all from a plain browser tab, with no
account, no price and no cloud model service anywhere in it.

- **Feature id:** `site-models`
- **Surface:** `site/models.html`, backed by `site/assets/models.js`
- **Tabs:** *Connection*, *Catalog*, *Pull queue*, *Chat*, *Harness launch*
- **Command palette:** the page itself, each tab as a destination, and the
  runtime address as a live setting
- **Satisfies:** `FEATURE_INVENTORY.md` rows **11.5**, **11.6**, **11.7**,
  **11.8**, **11.9** and **11.10**, for the **Site** surface

---

## The one honest limitation this whole page is built around

This site makes exactly one network request beyond the local runtime: the
dim-sum dish photo, and that one is switchable off. It makes **no other
network request of any kind** — no remote model catalog, no proxy, no
telemetry, nothing. That is a site-wide contract, not a decision specific to
this page.

Ollama's full browsable model library lives on its website and registry, not
on the local runtime's own HTTP API. A desktop application, running outside a
browser's sandbox, can reach that library directly. This page, running inside
one, genuinely cannot — and it does not pretend to. Every surface on this
page that would normally show "the catalog" says, in words, that it can only
ever show what the **reachable local runtime itself reports**: installed
models and currently loaded ones. That is still exhaustive and never curated
— every installed model and every page the runtime returns is followed — it
is just exhaustive over a smaller, honestly-stated set than the desktop
application's own catalog manager can offer.

Where the page cannot verify something (a hardware fit verdict, whether a
typed model name actually exists before it is pulled, a model's real
capabilities), it says **Unknown**, or shows a plainly labelled, unverified
bundled hint, rather than guessing.

## Connection

The *Connection* tab holds the runtime address (defaulting to
`http://127.0.0.1:11434`, editable and stored only in this browser) and a
**Check connection** control. A browser's `fetch()` cannot, on its own, tell
"nothing is listening" apart from "something is listening but has not been
told to allow this page's origin" — both simply reject the request. The page
disambiguates the two with a second request in `no-cors` mode, which skips
the CORS check entirely: if that one resolves, something really did answer,
so the first failure must have been a CORS block rather than a dead port.
The two failures get two different, actionable messages — including the
exact `OLLAMA_ORIGINS` value to set — instead of one generic "could not
connect."

Loopback addresses (`127.0.0.1`, `localhost`) are treated as secure contexts
by every current browser, so reaching one from this page (served over
`https`) is not blocked as mixed content the way a real remote `http` address
would be. That boundary is stated in the tab itself.

## Catalog

The *Catalog* tab lists every installed model the reachable runtime reports,
combined with which of them are currently loaded (`/api/ps`), at the
variant level (an installed tag such as `llama3.2:3b-instruct-q4_0` *is* the
variant). Refreshing records the exact timestamp, how many response pages
were followed (the loop keeps following a `next` cursor if the runtime ever
adds one, rather than assuming one page is everything), and a completeness
note. When the runtime is unreachable, the tab keeps showing the **last
verified snapshot** with its age, and says plainly that it is not live —
never a guessed new entry.

The list carries its own search bar (plain text by default, with the site's
shared anchored regex builder), filters for family and quantization drawn
from the real data, a running-only switch, sort, and a working group-by-family
toggle. Every row shows a **hardware fit** badge (below) and full bulk
actions — export, copy the names, and delete through the destructive-action
super-confirmation gate, with an honest per-item outcome if some deletes
fail.

The **guided "add to pull" form** at the bottom of the tab populates its
suggestion list from two sources, both clearly labelled: models already
installed (real, verified), and a small bundled list of common Ollama family
names (not verified, not fetched from anywhere, stated as such). Typing an
exact `family[:tag]` name is validated live against Ollama's own naming
syntax before it can be queued; the page cannot confirm a brand-new name
exists ahead of time, and says so.

## Hardware fit

Every catalog row's fit badge opens a panel naming the exact evidence behind
it. A browser has, at best, `navigator.deviceMemory` (a coarse, rounded
bucket Firefox and Safari never report at all) and
`navigator.hardwareConcurrency` — no VRAM, no GPU model, no free disk space,
ever. Missing evidence produces **Unknown**, never a verdict inferred from
the model's name and never a value treated as zero. When memory evidence
*is* available, the verdict compares it conservatively against the model's
reported on-disk size and reports **Runs well**, **Runs with limits** or
**Unlikely** with the reasoning spelled out, alongside a standing note that
the desktop application can see the real hardware and give a real answer.

## Pull queue

The *Pull queue* tab runs pulls through the real `/api/pull` streaming
endpoint, two at a time by default, with byte-accurate progress whenever the
runtime reports totals. Queue state is durable in this browser's storage: a
page reload cannot resume an in-flight network stream, so an item that was
mid-pull at reload time is marked **interrupted** — honestly, not silently
relabelled success or failure — with a note that the runtime may have kept
pulling in the background and a retry action. Cancel (via `AbortController`),
retry and remove are all real, individual, per-item actions, plus the usual
bulk contract; a failed item never turns the rest of the batch green.

## Chat

The *Chat* tab is a local, multi-session chat surface against `/api/chat`,
streaming token-by-token. Each session keeps its own model choice (drawn
only from installed models — nothing else can actually be chatted with), an
editable system prompt, and documented, bounded parameters (temperature,
`top_p`, `top_k`, context length, `repeat_penalty`) with live validation.
Stop aborts the in-flight stream; Regenerate replays the last user message.
Sessions are searchable, bulk-exportable and bulk-deletable through the
confirm gate.

Image attachments are offered only when the selected model's **runtime-
reported** capability list actually includes `vision` (read from
`/api/show`); otherwise the control stays visible but disabled, naming the
exact reason — including the honest case where the runtime simply did not
report a capability list at all, which is treated as "unknown, so off" and
never as "probably fine."

## Harness launch

The *Harness launch* tab lists the same kind of allowlisted local-process
launch the desktop application offers, and disables every single entry with
one exact, spelled-out reason: a browser page cannot start a process on the
visitor's machine, in any browser, because that capability exists only
outside a browser's sandbox. Nothing here pretends otherwise.

## Storage and privacy

Everything this page keeps — the runtime address, the last verified catalog
snapshot, the pull queue and every chat session — lives in this browser's
own storage, under the site's shared `wds.` prefix, exactly where a desktop
application would instead use an operating-system credential vault or an
application-data folder. Clearing this site's storage is the reset for all
of it, stated in the page itself. No chat content, no queue state and no
catalog snapshot ever leaves this browser.

## Verification

`node --check site/assets/models.js` passes. The module's pure logic (byte
and duration formatting, model-name validation, base-URL normalisation, the
hardware-fit evidence-vs-verdict logic, pull-queue enqueue/cancel/retry,
chat-session CRUD, capability gating, and the harness listing) was exercised
directly in a plain Node process against a minimal `window`/`navigator`
shim, confirming in particular that a missing `navigator.deviceMemory`
produces `Unknown` rather than a guess, that a missing on-disk size produces
`Unknown` rather than being treated as zero, that an invalid model name is
rejected before it can be queued, and that unknown model capabilities never
default to "available."

`site/models.html` was rendered through a real, headless browser
(`msedge --headless --dump-dom`, with verbose console logging enabled) at
its real file location, loading the real `site/assets/site.js` and
`site/assets/models.js`. The render produced no console errors of any kind,
`document.title` updated correctly, every tab painted its real content
(including the connection scope note, the empty pull queue and chat states,
and every harness row's disabled reason, each in its rendered — not
source — form), confirming the page's own script actually ran rather than
only having valid syntax.

### A site-wide defect this verification found

`Studio.ready(fn)` cannot safely be called from a page's own plain inline
`<script>` block placed after `<script defer src="assets/site.js">`, which
is the exact pattern `SITE_API.md` documents as "every page starts like
this" and which every existing page on this site currently uses verbatim.

A `defer` script executes only after the browser has finished parsing the
*entire* document — after any later, ordinary (non-deferred) inline script,
regardless of where that inline script sits in the file. The page's own
trailing `<script>` therefore runs **before** `site.js` has executed at all,
so the bare identifier `Studio` does not exist yet. This was reproduced with
a minimal two-file test and then confirmed against the real, unmodified
`site/settings.html`: headless-rendering it produced
`Uncaught ReferenceError: Studio is not defined` at the exact line calling
`Studio.ready(...)`, and its `#tabs-host` element was left completely empty
— none of that page's own initialisation code ever ran.

`site/models.html` avoids this by waiting for `DOMContentLoaded` (which
fires only after every deferred script, `site.js` included, has already
run) before calling `Studio.ready(...)`:

```html
<script>
window.addEventListener('DOMContentLoaded', function () {
  Studio.ready(function (S) { /* page code */ });
});
</script>
```

This defect could not be fixed as part of this feature: `site.js` and every
other existing page (`index.html`, `docs.html`, `settings.html`,
`changelog.html`, `downloads.html`) are owned by other lanes. It is reported
in full, with the reproduction above, so the fix can be applied to
`SITE_API.md`'s canonical template and to each affected page's own trailing
script.
