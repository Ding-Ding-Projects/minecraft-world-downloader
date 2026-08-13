# Local models

A local model suite manager over Ollama's documented local HTTP API: runtime health,
installed and running models, an exhaustive published catalog with conservative
hardware-fit verdicts, a batch pull queue, local chat sessions, and allow-listed harness
launches. Nothing here calls an unofficial proxy or embeds a cloud model service, and the
runtime itself is never asked to launch a program — that is what harness profiles are for,
and they launch through this application's own allow-listed process bridge instead.

- **Feature id:** `models`
- **Destinations:** *Local models* (health, installed inventory, hardware evidence),
  *Model store* (the published catalog and the pull queue), *Model chat* (local
  sessions), *Harness profiles* (launch a local program of your own against a model)
- **Settings section:** *Local models*
- **Command palette:** open each of the four destinations, jump straight to the pull
  queue, check the runtime, refresh the catalog, plus the live controls for all sixteen
  settings
- **Satisfies:** `FEATURE_INVENTORY.md` rows **11.5**–**11.10**

---

## Behaviour

### Runtime health and the installed inventory (row 11.5)

*Local models* asks the runtime for its version, its installed model list (`/api/tags`)
and its currently loaded list (`/api/ps`), and reports what it found. A failed check never
clears what is already known: the installed list from the last successful call stays on
screen, labelled with the moment it was read, because a list that empties itself the
instant a service stops would throw away the only offline evidence the user had.

When the runtime cannot be reached, the panel shows a troubleshooter naming the exact
address, the platform-appropriate next step (install it, or start it the way it is
normally started), and states plainly that everything else in this feature — the last
verified catalog, saved chats, harness profiles and snapshots — still works without it.

Every installed model can be deleted, copied to a new local name, exported, or opened for
its full detail — capabilities, context length, digest, hardware-fit reasoning and every
metadata gap named. Deletion goes through the two-key destructive-action gate.

### Hardware evidence and fit verdicts (row 11.7)

Every fit verdict is arithmetic over measured figures, never inferred from a model's name.

| Figure | Source | Bound or exact |
| --- | --- | --- |
| Logical processors | Browser runtime | Exact |
| System memory (default) | `navigator.deviceMemory` | Lower bound, capped at 8 GiB by the browser |
| System memory, free memory, free disk | The measurement helper (off by default) | Exact |
| Graphics adapter | `WEBGL_debug_renderer_info` | Exact when the browser allows it |
| Video memory in use | The runtime's own `/api/ps` report | A lower bound on capacity, not the capacity itself |

The measurement helper is one small, fixed program held as a constant in this feature's
own source (`hardware.ts`). It runs through the privileged process bridge, reads three
numbers, and writes nothing; no text a user types ever becomes part of it. It is off by
default and the panel says exactly why a figure is Unknown when it is off.

The four verdicts are **Runs well**, **Runs with limits**, **Unlikely** and **Unknown**.
Missing metadata — an unpublished weights size, an unmeasured disk figure — produces
Unknown, never a zero that would silently bias the arithmetic. Every verdict shows its
reasoning line by line and names every assumption, including the flat context-and-runtime
memory allowance configured in Settings. The evidence rows and the verdict reasoning are
shown in English regardless of the active language mode, because they are measured
figures and quoted runtime output rather than copy.

### The model store and catalog refresh (row 11.6)

*Model store* enumerates the runtime's registry using its documented OCI Distribution v2
endpoints: the repository catalog, each repository's tag list, and a manifest per
variant. A refresh follows every page of every listing to its end and records:

- the source revision (the registry's own content digest), when the registry supplies one
- the timestamp of the attempt and of the last refresh that actually produced entries
- the page count and repository count
- a completeness verdict — true only when nothing stopped the refresh early
- a completeness note naming exactly what happened, in words rather than a bare boolean

When the registry refuses a whole-catalog listing, the note says so in those exact words
and the refresh falls back to enumerating every repository it can name from real
evidence — a previous refresh's own cache, and what is installed locally — which is
genuinely complete for every repository it names, and honestly incomplete about the rest.
The catalog is combined with the local runtime's installed list; neither set is hidden
inside the other.

Sizes are not fetched eagerly. A row's download size, in-memory size, parameter count,
quantization and capabilities stay Unknown, with the gap named, until the row is opened,
queued, or included in the bounded manifest-enrichment pass over the rows currently shown.
A catalog older than the configured staleness window is labelled stale with an offer to
verify it again — nothing is deleted when it goes stale — and when the source cannot be
reached at all, the store shows the last verified catalog plus current installed state and
says plainly that nothing new was guessed at.

The inventory is searchable (name, family, capabilities), filterable (installation state,
family, capability, quantization, hardware fit), sortable (name, size, fit), and can be
sorted so variants from the same repository sit together. Every row carries the full bulk
toolbar: select shown, select every match, invert, clear, add to the pull queue, read
manifests for what is shown, and export.

### The pull queue (row 11.8)

Adding a variant schedules a local download and nothing else — there is no price, no
purchase, no checkout, no account and no payment anywhere in this feature, stated plainly
beside the "add to the pull queue" action every time it appears.

The privileged network boundary caps any single request at two minutes and hands the
response body back only once it is complete, so a multi-gigabyte pull cannot be one such
request. Each queue item instead runs as a sequence of bounded attempts: the runtime keeps
the layers it already fetched between attempts and resumes from them, and after every
attempt the queue asks the runtime's own installed list whether the model is now there —
that list, never a status line, is the only thing that marks an item done.

| Control | Effect |
| --- | --- |
| Cancel | Stops the item without discarding progress; a retry resumes from the layers already on disk |
| Retry | Returns a finished-but-unsuccessful item to the queue for another attempt budget |
| Remove | Deletes the record outright, behind a confirmation naming whether the item is currently running |
| Reconcile (on startup) | Checks every outstanding item against the runtime's installed list, so work finished while the app was closed is recognised rather than re-pulled |

Concurrency is configurable from 1 to 4 attempts at once. Progress is byte-accurate per
attempt (the runtime's own reported totals), and the summary line reports queued, running,
done, failed and cancelled counts honestly, including a note when at least one outstanding
item has no published size and the transfer estimate is therefore a floor rather than a
total.

### Model chat (row 11.9)

*Model chat* is a local, multi-session surface against an installed model. Nothing leaves
this machine except the request to the configured runtime address (a loopback address by
default). A session carries its own system prompt, temperature, top-p and reply-length
ceiling, editable in place; sessions are searchable by title and message content, and
support the full bulk toolbar for delete and export.

Replies arrive complete rather than a word at a time — the privileged network boundary
buffers the whole response before handing it back — so the timing counters shown under a
reply (prompt tokens, reply tokens, total duration, tokens per second) are the runtime's
own measurements read straight off its response, and the delivery note beside the input
says so plainly.

Image attachments are gated on real, runtime-reported capability: a model that has not had
its `/api/show` capabilities read yet shows an honest "not read yet" state, a model without
a reported vision capability shows a disabled attach control naming exactly why, and only a
model that has reported vision may receive one. Turn history sent with each new message is
bounded by the configured turn limit, which is what keeps a long-running session from
growing without limit.

### Harness profiles (row 11.10)

A harness profile is this application launching a local program of the user's own against
a model — never the model runtime launching anything, because the runtime cannot launch a
program at all. There is no free-text command field anywhere in this feature, and no two
strings are ever concatenated into a value that gets passed to a process.

**The allow list, twice over.** The executable is one of a short fixed list
(`java`, `javaw`, `node`, `npm`, `npx`, `docker`, `docker-compose`, `git`, `python`,
`python3`, `py`, `mvn`, `gradle`), enforced first by the privileged process bridge and
again by this feature's own schema. Every argument is a typed token: a literal drawn from a
bounded character set, an absolute path chosen through the native browse control, a
number, or one of two substitutions this application fills in itself — the chosen model, or
the runtime address. Every environment key a profile may set is drawn from a fixed list; a
secret value is stored as the *name* of an operating system vault account, never the value
itself, and the value is read from the vault only at the moment of launch.

**Preflight, then the reviewable preview, then launch.** Preflight checks the profile's
schema, its working directory, its required files, the chosen model's presence in the
runtime's installed list, every vault entry the profile needs, and the runtime's own
health — reporting each one by name as pass, blocked or unchecked, with the exact next
in-app action for anything blocked. The reviewable preview shows exactly what will run:
the resolved command and argument list, and the environment with every secret redacted.

**Snapshot, launch, automatic rollback.** A snapshot of the profile is taken automatically
before every launch attempt. If the process refuses to start, exits during its configured
settle window, or never prints its configured readiness marker, the snapshot is put back
automatically and the launch report says so by name — a failed launch never leaves a
profile carrying the state of a run that did not happen. Every snapshot is also listed for
manual restore, and a restore is itself recorded as a new snapshot, never a silent rewrite.

The three shipped profiles (an npm script, a Docker Compose stack, a Python module) are
templates rather than one-click launchers: they name a real, allow-listed shape and leave
the folder — and anything specific to the user's own machine — to be chosen through the
pickers after duplicating one into a profile of the user's own.

---

## Configuration

| Setting | Default | What it controls |
| --- | --- | --- |
| Model runtime address | `http://127.0.0.1:11434` | The base address every runtime call is sent to. Plain `http` is only permitted for a loopback address. |
| Request timeout | 60 s | Capped at 120 s by the privileged network boundary regardless of this value. |
| Catalog source | `registry.ollama.ai` | The registry the published catalog is enumerated from. `none` limits the inventory to what is installed locally. |
| Catalog page size | 100 | Entries requested per listing page. Every page is followed to its end regardless. |
| Repository ceiling | 500 | The most repositories one refresh will enumerate before marking itself incomplete. |
| Catalog goes stale after | 24 h | How old a verified refresh may be before the store labels it stale. |
| Concurrent pulls | 1 | Queue items pulling at once, 1–4. |
| Attempt budget per item | 20 | Bounded attempts a queue item may use before it is marked failed. |
| Context and runtime allowance | 1024 MiB | Flat memory budgeted on top of a model's weights when computing a fit verdict. |
| Measurement helper | Off | Whether the fixed local measurement program may run through the privileged process bridge. |
| Folder to measure free space at | Home folder | Which filesystem the free-space figure is read from. |
| Turns kept per session | 20 | How many past messages are sent with each new chat turn. |
| Default temperature / top-p / reply ceiling | 0.8 / 0.9 / 512 | Starting sampling parameters for a new chat session; each session can change its own. |
| Preferred export format | JSON | The format offered first when exporting an inventory, a queue or a session. |

Two actions are also available from Settings: **Check the runtime now** and **Refresh the
catalog now**, each teleporting to the relevant panel and reporting what it found.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| Runtime unreachable | Health shows the exact address and reason; the troubleshooter names the next step; everything local keeps working |
| Runtime answers with an unexpected body | Reported as "not JSON" with the exact endpoint, rather than silently treated as empty |
| Registry refuses a whole-catalog listing | The refresh says so verbatim and falls back to a fallback listing built from real local evidence, marked incomplete |
| A manifest's metadata blob redirects off the allow-listed host | The privileged boundary refuses the hop; parameter size and quantization stay Unknown with the refusal named |
| A pull attempt exceeds its two-minute window | The item is re-verified against the installed list before being retried; the runtime's own resumable layers are not lost |
| A pull genuinely fails | The item is marked failed with the runtime's own last status line or transport error, and can be retried |
| A harness profile fails validation | Every failing field is named; nothing is launched |
| A harness process exits, or never becomes ready, during its settle window | The launch is reported as failed and the profile's snapshot is restored automatically |
| A harness environment entry's vault account is missing | Preflight blocks the launch and names exactly which account to store |

---

## Security considerations

- Every network call goes through the privileged bridge, which enforces deny-by-default
  host allow rules. This feature registers a rule for the configured runtime host and for
  the configured catalog host, naming itself as the owner and stating the reason, before
  ever making a request.
- Plain `http` is refused for anything but a loopback runtime address; a remote runtime
  must be reached over `https`.
- A harness profile never accepts a shell command, and no two strings are concatenated
  into one before being passed to a process — every token is validated against a fixed
  schema first.
- A harness secret is stored as a vault account *name*; its value is read only at the
  moment of launch and is never written into a snapshot, a log, an export, the reviewable
  preview, or the settings file.
- The pull queue and the model store never send anything except the documented registry
  and runtime requests; there is no telemetry, no analytics, and no third-party asset.

---

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` is clean for every file in this feature.
- Manual verification exercised: runtime health reachable and unreachable (including the
  troubleshooter copy); the installed table's search, bulk delete, copy and export; the
  hardware evidence panel with the measurement helper on and off; a catalog refresh against
  a reachable and an unreachable registry, including the incomplete-listing fallback path;
  the store's search, every filter, every sort, and the repository-grouping toggle; adding
  variants to the pull queue and running it to completion, including a cancel and a retry;
  creating, renaming, exporting and deleting a chat session; sending a message against an
  installed model and reading back its timing stats; the vision-attachment gate in its
  three states (unread, unsupported, supported); duplicating a shipped harness template,
  editing every field type, running its preflight, and launching it; and restoring a
  harness snapshot.
- Every settings control has a real default and a progressive-disclosure description; the
  runtime-address and catalog-host validators were exercised with a valid address, an
  invalid URL, an embedded credential, and a non-loopback `http` address.

---

## Suggested related articles

- [Exporting anything](./export.md) — the shared export contract every list in this
  feature's bulk toolbar follows
- [Local version history](./history.md) — where every deletion, copy, refresh, launch and
  restore this feature performs is recorded
- [The pattern builder](./regex.md) — the builder anchored to every search field in this
  feature
- [Settings](./settings.md) — where this feature's sixteen settings and two actions live
- [The command palette](./palette.md) — every destination and live setting this feature
  registers
