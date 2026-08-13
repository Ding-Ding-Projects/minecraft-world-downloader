import type { DocArticle } from '../../core/registry';

/**
 * The in-application documentation for this feature.
 *
 * These articles are bundled into the build and rendered by the shared markdown
 * renderer; nothing here fetches anything, so they read the same offline as
 * online. The same material is on disk at `docs/features/authenticator.md`.
 */

export const AUTHENTICATOR_DOCS: DocArticle[] = [
  {
    id: 'authenticator.overview',
    title: 'The authenticator',
    category: 'Security',
    body: [
      'This is a full time-based one-time code authenticator. It holds your own entries for whatever accounts you like, shows live codes with a countdown and a peek at the next code, and pairs new accounts by drawing a QR here rather than anywhere else.',
      '',
      '## What it implements',
      '',
      'RFC 6238 time-based codes over RFC 4226 counter-based codes, with SHA-1, SHA-256 and SHA-512, six to eight digits, and any period from 5 to 300 seconds. SHA-1, six digits and thirty seconds are the defaults because they are what almost every service issues.',
      '',
      'The implementation is checked against the published test vectors, and you can run that check yourself from the **Verification** tab. An authenticator that is subtly wrong produces codes that every service refuses with no error to read, so "it looked right" is not evidence.',
      '',
      '## Local only',
      '',
      'There is no account, no synchronization, no telemetry and no network request anywhere in this feature — not for the QR, not for the reader, not for the clock. Records live in the settings file; secrets live in the operating system credential vault under one key per entry.',
      '',
      '## What a secret is worth',
      '',
      'A secret is the whole of a second factor. Anybody who reads one can generate that account’s codes for ever, which is why the written value is masked until you reveal it, why an ordinary export leaves it out and says so, and why writing the secrets out in the clear is a separate, explicitly named action behind the two-key confirmation.'
    ].join('\n'),
    related: ['authenticator.pairing', 'authenticator.clock', 'authenticator.privacy', 'core.locks']
  },
  {
    id: 'authenticator.pairing',
    title: 'Pairing, QR codes and every route in',
    category: 'Security',
    body: [
      'Retyping a thirty-two character secret off another screen is where a pairing goes wrong, so every route that avoids it is offered.',
      '',
      '## The routes',
      '',
      '1. **Paste a pairing link** — an `otpauth://totp/` URI. Every parameter it carries is kept: an issuer that uses eight digits, a fifty second period or SHA-512 stays exactly as it asked. Quietly replacing those with defaults produces ordinary-looking codes that are always refused.',
      '2. **Read a picture** — choose a file, drop one on the panel, or read the picture on the clipboard. The reader is implemented in this application: luminance, an adaptive threshold, the three corner squares, a perspective transform onto the module grid, the format field, the mask, de-interleaving, Reed-Solomon correction and the segment stream.',
      '3. **Scan with a camera** — offered only when this computer actually has one. With no camera the control says so and points at the routes that work, rather than failing when pressed.',
      '4. **Create a new secret here** — generated with the platform random source, drawn as a QR beside its written form.',
      '5. **Type the secret** — validated as base32 before it is accepted, with the usual 0/O and 1/I confusions named specifically.',
      '',
      '## The picture is drawn here',
      '',
      'A pairing QR contains the secret. Sending it to a chart service or a remote generator would hand that secret to somebody else’s server on its way to being drawn, so both the encoder and the reader are implemented in this process and neither makes a network request.',
      '',
      'The picture honours the quiet zone and is always true black on white rather than tinted into the theme, because a QR styled to match a dark interface stops scanning. The **Pairing picture size** setting controls pixels per square for a smaller window or a poorer camera.',
      '',
      '## The written secret is always beside it',
      '',
      'A picture is no use to somebody who cannot see it, and no use at all when the authenticator being paired is on this same screen. The written secret is therefore always present, in copyable groups of four, with the algorithm, digit count and period stated beside it. Its value is masked until you reveal it deliberately.',
      '',
      '## The pairing is confirmed before the factor arms',
      '',
      'You type one live code back and only a match completes the registration. For a secret created here that step cannot be skipped: nothing has ever paired with it, so a matching code is the only proof the pairing took.',
      '',
      'For a secret that came from somewhere else you can say plainly that you cannot check a code right now. The entry is then saved and marked **Not checked**, and the row says so, rather than the application pretending a check happened.'
    ].join('\n'),
    related: ['authenticator.overview', 'authenticator.clock', 'authenticator.verification']
  },
  {
    id: 'authenticator.clock',
    title: 'The clock, and codes that are refused',
    category: 'Security',
    body: [
      'Codes come from the system clock. When it is wrong the digits look perfectly ordinary and every service simply refuses them, with nothing anywhere that says why. This is the failure nobody diagnoses, so this feature makes it visible.',
      '',
      '## What can and cannot be known offline',
      '',
      '- A clock that **jumps** while the application is open is detectable, by comparing wall-clock movement against the steady clock. Waking from sleep looks exactly the same and is harmless, so that is said rather than reported as a fault.',
      '- A clock that is simply, steadily wrong is **not** detectable without a reference. You supply one — the time on your phone — and the measured difference is recorded.',
      '- A clock outside any plausible range is wrong whatever else is true.',
      '',
      '## Time zones are innocent',
      '',
      'The standard counts seconds from the same instant everywhere, so a machine set to the wrong zone but the right instant produces correct codes. It is the first thing people suspect and almost never the cause.',
      '',
      '## Corrections are never silent',
      '',
      'A correction is applied only because you set one, and while it is not zero every code surface says so. A correction applied in silence is indistinguishable from a fault.'
    ].join('\n'),
    related: ['authenticator.overview', 'authenticator.verification']
  },
  {
    id: 'authenticator.verification',
    title: 'Verification against the published vectors',
    category: 'Security',
    body: [
      'The **Verification** tab runs the real code paths that produce your codes against the published test vectors, and reports exactly what happened.',
      '',
      '## What is checked',
      '',
      '- RFC 4226 appendix D: the ten published counter-based values.',
      '- RFC 6238 appendix B: six instants, at SHA-1, SHA-256 and SHA-512, eight digits.',
      '- That six-digit codes are the low six digits of those published eight-digit values.',
      '- That a non-standard period changes the code exactly at its own boundary and nowhere else.',
      '- That verification accepts one step of skew either side and refuses three.',
      '- That a pairing URI keeps every parameter it carries, falls back to the standard defaults when one is absent, and refuses a counter-based link.',
      '- That every QR block structure adds up to its version total, that the format field survives three flipped bits, and that Reed-Solomon repairs damage up to its published limit.',
      '- That a pairing URI survives this feature’s QR encoder and reader at every error correction level, through the module grid AND through a real rasterized picture.',
      '',
      'A failure names the exact expected and produced values. If any check fails, do not trust codes from that build until it is explained.'
    ].join('\n'),
    related: ['authenticator.overview', 'authenticator.clock', 'core.regex']
  },
  {
    id: 'authenticator.privacy',
    title: 'Where the secrets are kept, and what leaves',
    category: 'Security',
    body: [
      '## Two stores, deliberately',
      '',
      'The record — issuer, account, label, icon, group, algorithm, digits, period — goes in the ordinary settings document like any other list this application owns. The **secret** goes in the operating system credential vault under a stable per-entry key.',
      '',
      'Nothing that can generate a code is written to the settings file, an export, a log, a screenshot, a history entry or a crash report.',
      '',
      '## Secrets in memory',
      '',
      'A live code display needs the secret every period, so a secret read back from the vault is held in this window’s memory for the session. It is a plain map in this process: never persisted, never serialized, gone when the window closes, and clearable on demand with **Forget them until they are needed again**.',
      '',
      '## Exports',
      '',
      'An ordinary export carries the records and not the secrets, and every row says so in its own secret column so a file cannot be mistaken for a backup that would restore your codes.',
      '',
      'Writing the secrets out in readable form is a separate action behind the two-key confirmation. The file it produces lets anybody who copies it generate these codes for ever, is not encrypted, is not protected, and cannot be withdrawn once it leaves this computer. The confirmation says exactly that.',
      '',
      '## This application’s own toy lock',
      '',
      'If you register one of this application’s own one-time-code locks in this same authenticator, the panel says plainly that the lock has become ornamental — the key is sitting inside the box it opens — and then lets you do it anyway. It is a for-fun lock, and that is a funny way to hold it.'
    ].join('\n'),
    related: ['authenticator.overview', 'core.locks', 'core.export']
  }
];
