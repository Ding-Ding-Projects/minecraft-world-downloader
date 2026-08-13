import type { DocArticle } from '../../core/registry';

/**
 * In-app documentation for the server feature, bundled at build time and
 * rendered through the shared markdown renderer in the documentation browser.
 *
 * This is deliberately shorter than `docs/features/server.md`: that file is
 * the exhaustive reference; these two articles are what somebody reads while
 * they are looking at the actual panel, wondering what a button does.
 */
export const SERVER_DOCS: DocArticle[] = [
  {
    id: 'server.overview',
    title: 'Server and container manager',
    category: 'Server',
    body: [
      'This feature replaces the small container manager that used to ship beside the world',
      'downloader. Everything that manager did is here, against **every** container Docker',
      'knows about on this machine rather than one hard-coded name, and every command that',
      'destroys something now goes through the two-key confirmation gate rather than a single',
      'button press.',
      '',
      '## The two destinations',
      '',
      '- **Containers** lists every container Docker reports, with its state, health, ports and',
      '  Compose labels, plus start, stop, restart and remove — singly or in bulk.',
      '- **Container logs** reads one container at a time, either as a snapshot or followed live.',
      '',
      '## Where the data comes from',
      '',
      'Nothing here talks to a Docker socket. Every fact — a state, a port, an uptime — comes from',
      'what the `docker` command line actually printed, run through the privileged process bridge.',
      'Where Docker says nothing, this feature says nothing rather than guessing.',
      '',
      '## Docker missing vs Docker not answering',
      '',
      'These are told apart because they need different fixes. **Docker is not installed** means the',
      '`docker` command itself could not be run at all — there is a button to open the official',
      'installation page. **Docker is installed and nothing is answering it** means the command line',
      'exists and the daemon behind it did not reply — if Docker Desktop is found on this machine, a',
      'button opens it; otherwise the panel says plainly that there is nothing here to press, because',
      'no button was invented to do something it could not actually do.',
      '',
      '## Destructive actions',
      '',
      'Stop, restart and remove all name the exact container (or containers, in bulk), state exactly',
      'what is lost and what is kept, and require the two-key gate before anything runs. Remove',
      'never touches a named volume or a bind-mounted directory — which is where this project keeps',
      'a downloaded world — so a removed container can be recreated without losing what it held.'
    ].join('\n'),
    related: ['server.logs', 'core.locks', 'core.overview']
  },
  {
    id: 'server.logs',
    title: 'Reading container logs',
    category: 'Server',
    body: [
      'One container at a time, read with `docker logs`. A **snapshot** runs `docker logs --tail N`',
      'and stops; **following** runs the same command with `--follow`, which never exits on its own',
      'and is stopped when following is switched off, the container is changed, or the destination',
      'closes.',
      '',
      '## Severity is a reading, not a fact',
      '',
      'A container log carries no severity channel — it is whatever the program inside wrote to its',
      'own output. The severity chips (error, warning, info, debug, other) come from the words in',
      'each line and from which stream it arrived on. The filter panel says this plainly, so nobody',
      'mistakes a guess for something Docker reported.',
      '',
      '## Redaction',
      '',
      'By default, any value assigned to a key that looks like a password, a token, a secret or a',
      'key is shown as `<redacted>`, in both the echoed command lines on the containers destination',
      'and in log lines here. This can be switched off in settings — doing so also changes what an',
      'export writes, and the export notification says which one just happened.',
      '',
      '## Bulk selection and export',
      '',
      'Lines carry the same shift-range and keyboard selection as the container table, an honestly',
      'scoped select-all (the lines this page shows vs every line held in memory), and copy and',
      'export actions that act on exactly the selected lines when something is selected, or on',
      'everything currently shown otherwise.'
    ].join('\n'),
    related: ['server.overview', 'core.export']
  }
];
