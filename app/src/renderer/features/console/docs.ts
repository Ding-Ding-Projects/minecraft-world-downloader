import type { DocArticle } from '../../core/registry';

/**
 * The in-application article for the console feature.
 *
 * Bundled into the build like every other article, and rendered by the
 * shared markdown renderer. Nothing here fetches anything.
 */

export const CONSOLE_DOCS: DocArticle[] = [
  {
    id: 'console.overview',
    title: 'The web console, natively',
    category: 'The product itself',
    body: [
      'The web console (`web/app.py`) is a small Flask application that normally runs as a Docker container’s main process, driving the downloader and reporting on it through a browser dashboard. This tab talks to that same process over the loopback interface, through its exact JSON API, and renders every one of its capabilities as a real native surface. It never embeds the dashboard in a web view.',
      '',
      '## What it does',
      '',
      '- **Installation** — inspects the configured console folder for `app.py`, `auth.py`, `requirements.txt` and `templates`, and offers to install the console’s Python dependencies from its own requirements file.',
      '- **Service** — starts the console as a child process this application owns, or detects one already answering on the configured port that something else started. Health is polled on a timer; the state distinguishes not configured, not installed, stopped, starting, running, running elsewhere, behind its own login, unhealthy and exited, because each of those has a different recovery action.',
      '- **Configuration** — every downloader option the console persists into `manager-config.json`, grouped exactly as the console groups them, with the exact command line previewed before anything runs.',
      '- **Minecraft account** — Microsoft device-code sign-in, a pasted access token, or an offline username, plus sign-out. The device code pairing flow is polled the same way the browser dashboard polls it.',
      '- **Worlds** — every world folder in the console’s data directory, not only the one the current configuration points at, measured for size, region-file count, dimensions and whether an overview render exists.',
      '- **Stored records** — the console’s own files: the saved configuration, the account record, the session signing key, the bot’s cached state and its Microsoft token cache, and any exported snapshots. Sizes and modification times are reported; credential-bearing files are never opened.',
      '- **Logs** — the downloader’s and the auto-explore bot’s output, fetched incrementally by the console’s own monotonic cursor so nothing is re-fetched or missed.',
      '- **Auto-explore bot** — start, stop and Microsoft sign-in for the console’s own mineflayer walking bot.',
      '',
      '## Two load-bearing boundaries',
      '',
      '1. **The outbound HTTP allow rule.** The privileged bridge denies outbound HTTP by default. This feature registers exactly one allow rule, naming itself and the reason, before its first request, and only ever talks to `127.0.0.1`.',
      '2. **Cookies and the console’s own login gate.** The privileged bridge strips `cookie` and `authorization` headers from every outbound request. A console started with `WEB_PASSWORD` set therefore gates its API behind a session cookie this application cannot present. That is reported as its own honest state — "behind its own login" — with its own recovery route (start the console without the login gate, or turn it off from here), rather than being reported as a broken console.',
      '',
      '## Failure modes',
      '',
      '- **Nothing answers on the port.** Reported as stopped (folder is ready to start) or not installed (nothing to start), never as a generic error.',
      '- **Something answers, but not with the shape the console reports.** Reported as unhealthy: something else is listening on that port.',
      '- **The console redirects to its own sign-in page, or answers 401.** Reported as login-gated, with the exact reason.',
      '- **The service this application started exits.** The exit code is reported, the service log keeps whatever it printed, and health is re-checked in case something else is now listening.',
      '- **A world folder cannot be read partway through a scan.** The scan continues and marks that world’s totals as a floor rather than failing the whole scan.',
      '',
      '## Security',
      '',
      'The console’s access token, its Minecraft account record, its session signing key and the bot’s Microsoft token cache are never opened by this feature — only their existence, size and modification time are reported. A pasted access token is passed straight through to the console and is never stored in settings, the vault, a history entry, an export or a log line. The console’s own login password, when one is configured, lives only in the operating system credential vault and is read once, immediately before the console starts, straight into the child process environment.',
      '',
      '## Verification',
      '',
      'Exercised against the console’s own JSON routes over loopback: health, status, logs (downloader and bot), world info, account status, save, start, stop, restart, export-directory, the Microsoft device-code flow, manual token and offline sign-in, sign-out, and the bot’s start, stop, status, logs and auth routes. The command-line preview is a direct transcription of the console’s own `build_command`, including the two overrides it applies (the fixed container proxy port, and the paired centre coordinates).'
    ].join('\n'),
    related: ['core.overview', 'core.history', 'core.export', 'core.locks']
  }
];
