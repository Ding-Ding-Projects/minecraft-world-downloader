import type { DocArticle } from '../../core/registry';

/**
 * In-app documentation for the world downloader. Mirrors, in shorter form, the
 * standalone article at `docs/features/downloader.md`; the two are kept in
 * step by hand because one is Markdown rendered inside the app and the other
 * is a repository file a person reads on GitHub.
 */

export const DOWNLOADER_DOCS: DocArticle[] = [
  {
    id: 'downloader.overview',
    title: 'The world downloader',
    category: 'World download',
    body: [
      'The world downloader runs the bundled `world-downloader.jar` — a real Minecraft proxy — between your client and a server. Every packet the server sends to describe the world passes through it, and it writes what it sees to a normal Anvil world folder on disk: `region/`, `entities/`, one folder per dimension, exactly the shape a vanilla server or a single-player world already uses.',
      '',
      '## How the pieces fit',
      '',
      'This tab does three things. It finds a Java runtime and the jar on your machine and says plainly when either is missing. It turns the options you choose into the exact command-line flags the jar understands — never an invented one — and shows you that command line before anything starts. And once a download is running, it reads the process\'s own output to show connection state, the account signed in, the proxy target, and what has actually been written to the output world; nothing here is simulated.',
      '',
      '## Starting a download',
      '',
      'Set a server address in the Session card, open the Launch options card for anything beyond the defaults, and press Start. If a Java runtime or the jar has not been found yet, the button explains exactly that and points at the settings that fix it. If any option is invalid — a bad port, a seed that is not a whole number — the plan is refused before anything spawns, and the reason names the exact field.',
      '',
      '## Where the account comes from',
      '',
      'Two authentication routes exist, matching the jar exactly. Automatic reuses the running Minecraft launcher\'s own session; Microsoft runs the headless device-code flow and shows the one-time code and link right here in the Session card the moment the jar prints it. Neither route puts a live access token on the command line — that flag is deliberately not offered by this application, because a command line is visible to anything that can list processes on the machine.',
      '',
      '## Stopping cleanly',
      '',
      'Stop asks the jar to exit rather than killing it outright, so the current region files get flushed before the process ends. It goes through the same confirmation as any action that could interrupt in-flight work.'
    ].join('\n'),
    related: ['downloader.options', 'downloader.profiles', 'core.overview']
  },
  {
    id: 'downloader.options',
    title: 'Launch options and what they actually do',
    category: 'World download',
    body: [
      'Every control in the Launch options card corresponds to one real `@Option` declared on `config/Config.java` in the bundled Java core. Nothing here is invented: a flag the jar does not accept would be rejected by its own argument parser at startup, which is a failure you would see as an unexplained exit rather than as a mistake in this table.',
      '',
      '## Reading a row',
      '',
      'Each option shows its control, the exact command-line flag it contributes, and — behind the **i** affordance — a plain-English explanation. A row that currently does nothing (the auto-open delay while auto-open itself is off, for instance) is disabled and says exactly why, rather than sitting there looking live.',
      '',
      '## Two things this application deliberately does not offer',
      '',
      'A Minecraft access token has no field here. It would sit on a command line in the clear, readable by anything on the machine that can list processes; automatic authentication and the Microsoft device-code flow both reach the same result without that exposure. And a couple of flags whose default is already the behaviour they request — marking old chunks, modded block colours — are offered as their opposite, a `--disable-…` switch, because a switch that changes nothing when turned on is not a real control.',
      '',
      '## Command-line preview',
      '',
      'The exact command that will run is always visible and copyable before you press Start, so a report to the project or a comparison with a manual run never has to guess at what actually happened.'
    ].join('\n'),
    related: ['downloader.overview', 'downloader.profiles']
  },
  {
    id: 'downloader.profiles',
    title: 'Saved profiles and presets',
    category: 'World download',
    body: [
      'A profile is a name plus one value for every launch option. Saving one lets you switch between servers — or between a few different capture strategies for the same server — without re-entering every field by hand.',
      '',
      '## Presets are honest about what they set',
      '',
      'Applying a preset never guesses: it starts from the real compiled-in defaults and changes only the exact options it names, and it says which ones before you commit to it. That is also what makes "reset to defaults" trustworthy — a preset and a reset can never disagree about what the defaults actually are, because both read the same table.',
      '',
      '## What gets exported',
      '',
      'Exporting profiles writes one row per profile with one column per launch option, in whichever format you choose. Nothing about a Microsoft sign-in or an access token is ever part of a profile, so a shared or exported profile file carries no credential with it.'
    ].join('\n'),
    related: ['downloader.overview', 'downloader.options', 'core.export']
  }
];
