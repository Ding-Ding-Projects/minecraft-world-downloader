# Authenticator and QR pairing

A complete time-based one-time code authenticator, built into the application and
entirely local. It holds the user's own entries for whatever accounts they like,
shows live codes with a countdown and a peek at the next code, and pairs new
accounts by drawing a QR in this process rather than fetching one from anywhere.

- **Feature id:** `authenticator`
- **Destinations:** *Authenticator* (the entry list) and *Verification* (the checks)
- **Settings section:** *Authenticator*
- **Command palette:** open, add, verify, run the checks, check the clock, forget
  cached secrets, plus the live controls for four of its settings
- **Satisfies:** `FEATURE_INVENTORY.md` rows **8.5** and **8.6**

---

## Behaviour

### The entry list

Each row shows the entry's icon, its label and account, the algorithm/digits/period
it uses, the current code in large grouped digits, a countdown, and — when the
setting is on — the code the next period will produce. The code is a button:
activating it copies the code.

Rows carry live controls rather than printed values. The group is an actual
select wired to the same store the rest of the surface uses, so a row can be
regrouped where it is rather than through a separate screen. When codes are
masked, each row carries its own reveal switch.

The list supports everything a list in this application supports:

| Capability | How it behaves |
| --- | --- |
| Multi-select | A checkbox per row, plus shift-click for a range over the currently visible order |
| Select all | Two separate, honestly scoped actions: *all N matching this search* and *all N entries, including those the search hides* |
| Inverse | Inverts the selection across the matching set |
| Bulk delete | Behind the two-key destructive-action gate, with the exact list of affected entries |
| Bulk export | Honours the current selection; secrets are never included |
| Bulk group | Opens the group picker, which carries its own search and pattern builder |
| Search | The shared search bar with its anchored regular-expression builder; plain text is the default |
| Paging | 50 rows at a time, with the true total always stated above |

Groups can be created, coloured, collapsed and deleted. Deleting a group keeps
its entries and simply ungroups them, and the confirmation says so.

### Registration

Retyping a thirty-two character secret off another screen is where a pairing goes
wrong, so every route that avoids it is offered:

1. **Paste a pairing link** — an `otpauth://totp/` URI, typed or read from the
   clipboard.
2. **Read a picture** — choose a file, drop one onto the panel, or read the
   picture currently on the clipboard.
3. **Scan with a camera** — offered only when this computer actually has one.
4. **Create a new secret here** — generated with the platform random source.
5. **Type the secret** — validated as base32 before it is accepted.

**Parameters carried by the source are honoured.** An issuer that uses eight
digits, a fifty second period or SHA-512 is entirely legitimate; replacing those
with local defaults produces ordinary-looking codes that every service refuses,
with nothing on screen to explain why. Where the source omits a parameter, the
standard default is used (SHA-1, six digits, thirty seconds) rather than a local
preference, because that is what the issuer assumed when it left the parameter
out.

### The pairing picture

The QR is **encoded in this process** and the reader is **implemented in this
process**. A pairing QR contains the secret, so sending it to a chart service or
a remote generator would hand that secret to somebody else's server on its way to
being drawn. There is no network call anywhere in this feature.

The encoder writes the whole standard structure: function patterns and their
reserved areas, multi-block Reed-Solomon with interleaving, the version field for
versions 7 and above, all eight masks scored by the published penalty rules, and
both copies of the format field. Versions 1 to 10 at every error correction level
are supported, which covers a pairing URI comfortably; a URI too long for the
preferred level steps down through the levels and states which one was used.

The picture honours the four-module quiet zone and is drawn true black on true
white **in both themes**, on its own white card. A QR tinted to match a dark
interface stops being readable by the camera it exists for. **Pairing picture
size** sets pixels per square for a smaller window or a poorer camera.

Beside the picture, always, is the same secret written out in copyable groups of
four, with the algorithm, digit count and period stated. A picture is no use to
somebody who cannot see it, and no use at all when the authenticator being paired
is on this same screen. The written value is masked until it is revealed by a
deliberate action; the picture itself carries a real text alternative naming what
it is and what it pairs.

### Confirming the pairing

One live code is typed back, and only a match completes the registration.

For a secret **created here** this cannot be skipped: nothing has ever paired
with it, so a matching code is the only proof the pairing took. For a secret that
came from somewhere else, the user can state plainly that they cannot check a
code right now; the entry is then saved and marked **Not checked**, and the row
carries that badge, rather than the application pretending a check happened.

### The clock

Codes come from the system clock. When it is wrong the digits look perfectly
ordinary and every service simply refuses them, with nothing anywhere to say why.

What can and cannot be known offline is stated exactly:

- A clock that **jumps** while the application is open is detected by comparing
  wall-clock movement against the monotonic clock, with a two second threshold.
  Waking from sleep looks identical and is harmless, so the message says so
  instead of reporting a fault.
- A clock that is simply, steadily wrong **cannot** be detected without a
  reference. The user supplies one — the time on their phone — and the measured
  difference is recorded with its timestamp.
- A year outside 2024–2100 is wrong whatever else is true.

A correction is applied only because the user set one, and while it is not zero
**every code surface says so**, because a correction applied in silence is
indistinguishable from a fault. The banner also states that time zones never
matter here: the standard counts from the same instant everywhere, so the wrong
zone at the right instant produces correct codes. It is the first thing people
suspect and almost never the cause.

### Verification

The *Verification* destination runs the real code paths against the published
vectors and reports exactly what happened — see [Verification](#verification-1)
below.

---

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| `authenticator.default.algorithm` | `SHA-1` | Algorithm used **only** when this application creates a secret |
| `authenticator.default.digits` | `6` | Digits for a secret created here |
| `authenticator.default.period` | `30` | Seconds for a secret created here |
| `authenticator.hideCodes` | `false` | Masks every code until revealed, one row at a time |
| `authenticator.showNextCode` | `true` | Shows the next period's code beside the current one |
| `authenticator.qr.moduleSize` | `6` | Pixels per square in the pairing picture (3–12) |
| `authenticator.clock.warnSeconds` | `10` | Difference from the reference that counts as a problem |
| `authenticator.clock.offsetSeconds` | `0` | Manual correction applied before a code is computed |

Every one of these carries its progressive-disclosure explanation and a truthful
provenance line naming the real value in use, and each appears in the settings
search and the command palette with its live control rendered inline.

Two actions live in the same section: **Run the verification checks** (which
teleports to the checks and focuses the run control) and **Export the secrets in
the clear** (behind the two-key gate).

---

## Standards

RFC 6238 time-based codes over RFC 4226 counter-based codes:

- **Hash functions:** SHA-1, SHA-256, SHA-512
- **Digits:** 6 to 8
- **Period:** any whole number of seconds from 5 to 300
- **Defaults:** SHA-1, 6 digits, 30 seconds — what nearly every service issues
- **Skew window on verification:** one step either side

Secrets are base32 (RFC 4648 alphabet, no padding), validated on entry with the
common `0`/`O` and `1`/`I` confusions named specifically, and refused below 10
decoded bytes as almost certainly incomplete.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| The vault has no secret for a record | The row shows `——`, disables the copy action and explains that the record exists but the vault does not, with the routes to fix it |
| A vault write fails during registration | **No record is created at all**, and the exact vault error is shown. A record without its secret would be a row that can never produce a code |
| A vault delete fails | That record is **kept** and reported, rather than leaving an orphan row that can never produce a code |
| The picture holds no readable code | The reader says which stage failed — corner squares not found, grid unmeasurable, format field unreadable, or damage beyond what the check symbols can repair — and points at the paste route |
| The QR is a version above 10 | Reported as outside the supported range, with the paste route offered. Nothing is guessed |
| Reed-Solomon cannot repair a block | The read is refused. A mis-corrected block yields a plausible-looking URI that pairs the account with the **wrong** secret, which is far worse than an honest failure |
| No camera on this machine | The camera route says so and points at the routes that work. It never offers a control that fails when pressed |
| Camera permission refused | The exact reason is shown; the other routes are unaffected |
| The clipboard cannot be read | The exact reason is shown |
| A picture over 12 MiB | Refused before decoding, with its size and the limit |
| An `otpauth://hotp/` link | Refused, explaining that this authenticator holds time-based entries and cannot keep the counter a counter-based link needs |
| A duplicate issuer and account | A dialog states the duplicate and offers to add a second one anyway |
| The clock has jumped | A banner states the movement and that waking from sleep looks the same and is harmless |
| The entry limit (500) is reached | The add is refused with the limit stated |

---

## Security considerations

**Two stores, deliberately.** The record — issuer, account, label, icon, group,
algorithm, digits, period, created-at, verified flag, note — lives in the ordinary
settings document like any other list. The **secret** lives in the operating
system credential vault under the stable key `authenticator:<entry id>`.

Nothing that can generate a code is written to the settings file, an export, a
log, a screenshot, a history entry or a crash report. History entries for this
feature record ids, parameters and which fields changed — never a secret, never a
code.

**Secrets in memory.** A live code display needs the secret every period, so a
secret read back from the vault is held in a plain map in this window for the
session: never persisted, never serialized, gone when the window closes. The
footer states how many are held and offers **Forget them until they are needed
again**; the same action is in the command palette.

**Exports.** An ordinary export carries the records and not the secrets, and
every row says so in its own `secret` column — so a file cannot be mistaken for a
backup that would restore codes. Writing the secrets out in readable form is a
separate, explicitly named action behind the two-key destructive-action gate; its
confirmation says plainly that the resulting file lets anybody who copies it
generate these codes for ever, is not encrypted, is not protected, and cannot be
withdrawn once it leaves this computer. Entries whose secret is missing from the
vault are listed in the file as not written rather than silently omitted.

**No network, anywhere.** Not for the QR encoder, not for the reader, not for the
clock, not for anything else in this feature. The vault status line names the
backend and says plainly when the operating system offered no encryption service,
rather than implying protection that is not there.

**This application's own toy lock.** If one of this application's own one-time
code locks is registered in this same authenticator, the panel says plainly that
the lock has become ornamental — the key is sitting inside the box it opens — and
then lets the user do it anyway. It is a for-fun lock, and that is a funny way to
hold it.

---

## Verification

The *Verification* destination runs every check below against the real code paths
and reports the exact expected and produced values on any failure. It is also in
the command palette, both as a destination and as a command that runs the checks
and reports through a notification.

| Check | What it proves |
| --- | --- |
| Base32 | 64 lengths round-trip without loss; four invalid alphabets are refused |
| RFC 4226 appendix D | All ten published counter-based values |
| RFC 6238 appendix B (SHA-1) | Six published instants at eight digits |
| RFC 6238 appendix B (SHA-256) | Six published instants at eight digits |
| RFC 6238 appendix B (SHA-512) | Six published instants at eight digits |
| Six-digit truncation | Six-digit codes are the low six digits of those published values |
| Non-standard periods | A code holds steady inside its period and changes exactly at its boundary, at 15/30/45/60/90 seconds |
| Skew window | One step either side is accepted; three steps is refused |
| Pairing URI | Every parameter survives a round trip; absent parameters fall back to the standard defaults; a counter-based link is refused |
| QR block tables | All 40 version/level structures add up to their published version totals |
| QR format field | All 32 format strings read back clean, and after three flipped bits |
| Reed-Solomon | Undamaged blocks are unaltered; blocks damaged to exactly half the check-symbol count are repaired exactly |
| QR module round trip | A pairing URI survives the encoder and reader at every error correction level |
| QR picture round trip | The same URI survives being rasterized to a canvas and read back, at two module sizes and every level |

An authenticator that is subtly wrong produces codes every service refuses with
no error to read, so "it looked right" is not evidence and neither is a passing
build. If any check fails, do not trust codes from that build until it is
explained.

---

## Accessibility and layout

- Every control is keyboard reachable with a visible focus ring; rows use roving
  tabindex along the vertical axis, because a list that runs down the surface
  moves with Up and Down.
- The countdown is never colour alone and never motion alone: the exact number of
  seconds is always readable as text, the bar carries `progressbar` semantics
  with a live value, and the low state is marked by a pattern as well as a
  colour.
- The code region announces on change through the shared live region rather than
  every second.
- The QR carries a real text alternative naming what it is and what it pairs, not
  a decorative one.
- Copy actions, reveals and destructive actions all announce their outcome.
- Reduced motion removes the countdown transition.
- At narrow widths the row stacks into a grid rather than clipping, and the
  pairing picture scrolls inside its own container so the page never scrolls
  sideways.
- All copy runs through the translator in English, playful Hong Kong Cantonese
  and bilingual mode, at all five humour levels per language. Humour styles the
  voice only: a code, a secret, an algorithm name, a digit count, a period, a
  number of seconds and a warning's facts read the same at every level.
- School mode needs no special handling here: this feature exposes no Cantonese,
  bilingual, humour, personal-vocabulary or dim sum capability of its own, so
  there is nothing for it to omit. Its copy follows whatever mode is active like
  any other surface.

---

## Suggested related articles

- [Toy locks and Support Tickets](../../app/src/renderer/core/coreFeature.ts) — the
  one-time-code locks this authenticator can hold the key to
- [Exporting anything](./export.md) — the shared export contract this feature's
  ordinary export follows
- [Local version history](./history.md) — where every change made here is recorded
- [The pattern builder](./regex.md) — the builder anchored to this feature's
  search fields
- [Settings](./settings.md) — where this feature's eight settings and two actions
  live
