import type { DocArticle } from '../../core/registry';

/**
 * In-app documentation for the end-to-end test harness. Mirrors, in shorter
 * form, `docs/features/downloader-e2e.md` — the two are kept in step by hand,
 * one Markdown rendered inside the app and the other a repository file read
 * on GitHub.
 */
export const DOWNLOADER_E2E_DOCS: DocArticle[] = [
  {
    id: 'downloader-e2e.overview',
    title: 'The end-to-end test',
    category: 'World download',
    body: [
      'This is the only test in the application that touches a real Minecraft server. It brings one up (Docker first, a downloaded server jar as the fallback), starts the bundled downloader as a proxy in front of it, drives one or more real mineflayer bots through that proxy along a deterministic route, and then — the entire point of the exercise — opens the region files that were actually written and counts the chunks really saved. A clean process exit with an empty world is reported as a failure here, not a pass.',
      '',
      '## Why this exists',
      '',
      'Every other test in this application can be wrong about the protocol and still pass, because nothing else here speaks the real Minecraft protocol against a real server. This harness is the one place that does, which is also why it is the slowest and the most likely to be blocked by something the machine does not have (Docker, a Java runtime, network access for the first jar download).',
      '',
      '## What a run actually does',
      '',
      '1. Brings up a real server and waits for its own printed "Done (…)! For help" line — never a guessed sleep.',
      '2. Starts `world-downloader.jar` as a proxy in front of it and waits for its own "Starting proxy for …" line.',
      '3. Runs this project\'s existing `scraper/scrape.js` bot(s) through the proxy along a deterministic spiral route, centred on spawn.',
      '4. Stops the proxy so pending region writes flush, then opens every region file it wrote and reads its real header — the same 4 KiB location table the Java writer produces — to see which chunks are genuinely present.',
      '5. Compares that against the exact chunk coordinates the route says the bot should have visited, and reports the match count, not just a total.',
      '',
      '## Reading a failed run',
      '',
      'A run never reports a bare "failed". It names exactly one of five distinct causes, and which stage it reached before that cause struck: the environment could not provide something (no Docker and the jar download failed), the server never became ready, the proxy never reported listening, the bot never logged in, the bot connected but no chunks streamed, or chunks streamed but too few were found saved on disk. Each of those points at a different fix.',
      '',
      '## Running it outside the application',
      '',
      'The exact same script this tab launches is a standalone Node script: `node test-e2e/run.js --version 1.20.4`. It needs nothing this application provides — no Electron, no window. `node test-e2e/run.js --help` lists every option. `node test-e2e/test/selftest.js` runs the harness\'s own tests for the parts that would be silently wrong if broken: reading a region file\'s real header, building the deterministic route, and recognising the server and downloader\'s real log lines.'
    ].join('\n'),
    related: ['downloader-e2e.settings', 'downloader.overview', 'core.overview']
  },
  {
    id: 'downloader-e2e.settings',
    title: 'Pointing the harness at a real checkout',
    category: 'World download',
    body: [
      'This is a repository developer tool, not a packaged feature: the harness script (`test-e2e/run.js`), the built `world-downloader.jar`, and the bot code (`scraper/`) all live in the repository, not inside this installed application. The settings for this tab exist to tell it exactly where those three things are on this machine.',
      '',
      '## The three paths',
      '',
      '**Harness script** — the absolute path to `test-e2e/run.js` in a checkout of this repository.',
      '',
      '**world-downloader.jar** — the built jar the harness runs as the proxy. Build one with `mvn package` from the repository root; it lands at `target/world-downloader.jar`.',
      '',
      '**Scraper directory** — the repository\'s `scraper/` directory, whose `scrape.js` drives the actual bots. It needs its own `npm install` run once before it can connect to anything.',
      '',
      '## Checking',
      '',
      'The "Check the harness locations" action re-probes all three and says plainly which are found and which are missing, rather than a run failing partway through with a confusing error. The Start button stays disabled, with the exact unmet condition named, until the harness script itself is found — the other two are checked again at the start of every run, and a missing one is reported as the environment-unavailable cause rather than a bare crash.'
    ].join('\n'),
    related: ['downloader-e2e.overview']
  }
];
