import type { AppContext, SearchBarHandle, SearchQuery, TabContext } from '../../core/registry';
import type { ExportFormat } from '../../core/registry';
import {
  CONTAINER_STATES,
  type ContainerRow,
  type ContainerState,
  type OperationKind,
  type PortBinding
} from './docker';
import { SelectionModel, collapsible, formatElapsed, formatTime, hideCheckboxLabel, node, wireRowKeyboard } from './dom';
import { openLogsFor } from './logs';
import {
  DOCKER_INSTALL_URL,
  ELEMENT_IDS,
  EXPORT_FORMAT_ID,
  KNOWN_CONTAINERS,
  type OperationState,
  SHOW_STOPPED_ID,
  type ServerState,
  findDockerDesktop,
  stopTimeoutSeconds
} from './state';

/**
 * The containers destination.
 *
 * This replaces the manager that used to ship beside the downloader: it listed
 * one container, echoed the `docker` command it ran, and offered start, stop and
 * remove. Everything that manager did is here, against every container on the
 * machine rather than one hard-coded name, and the three commands that destroy
 * something now go through the two-key gate rather than a single button press.
 *
 * Nothing on this surface is decorative. Every state chip is read from what
 * `docker ps` printed, every control performs the command it names, and the two
 * unavailable states — no Docker installed, and a Docker that is installed with
 * nothing answering — are told apart and given different routes out.
 */

/* ------------------------------------------------------------------ */
/* State kept across a remount                                         */
/* ------------------------------------------------------------------ */

interface PanelMemory {
  query: string;
  states: Set<ContainerState>;
  project: string;
  filtersOpen: boolean;
  statisticsOpen: boolean;
  selection: SelectionModel;
  focusId: string;
}

const memory: PanelMemory = {
  query: '',
  states: new Set<ContainerState>(),
  project: '',
  filtersOpen: true,
  // The descriptive panel starts closed. It describes the collection; it does
  // not change it, so it is not what somebody opened this destination for.
  statisticsOpen: false,
  selection: new SelectionModel(),
  focusId: ''
};

export function resetContainersPanelMemory(): void {
  memory.query = '';
  memory.states.clear();
  memory.project = '';
  memory.filtersOpen = true;
  memory.statisticsOpen = false;
  memory.selection.clear();
  memory.focusId = '';
}

/* ------------------------------------------------------------------ */
/* Small formatting helpers                                            */
/* ------------------------------------------------------------------ */

const STATE_SEVERITY: Record<ContainerState, 'info' | 'success' | 'warning' | 'error' | 'progress'> = {
  running: 'success',
  restarting: 'progress',
  paused: 'warning',
  created: 'info',
  exited: 'info',
  removing: 'progress',
  dead: 'error',
  unknown: 'info'
};

function stateLabel(ctx: AppContext, state: ContainerState): string {
  return ctx.t(`server.state.${state}`, state);
}

function portText(binding: PortBinding): string {
  const protocol = binding.protocol === '' ? '' : `/${binding.protocol}`;
  if (binding.published === '') return `${binding.container}${protocol}`;
  return `${binding.published} → ${binding.container}${protocol}`;
}

/** Published TCP bindings, which are the only ones a browser could reach. */
function browsablePorts(row: ContainerRow): PortBinding[] {
  return row.ports.filter((binding) => binding.published !== '' && binding.protocol === 'tcp');
}

function publishedAddress(binding: PortBinding): string {
  // `0.0.0.0:8080` and `[::]:8080` both mean "every interface on this machine",
  // and the address that reliably reaches it from here is the loopback one.
  const match = /^(.*):(\d+)$/.exec(binding.published);
  const port = match ? match[2] : binding.container;
  const host = match ? match[1] : '';
  const wildcard = host === '' || host === '0.0.0.0' || host === '::' || host === '[::]';
  return `http://${wildcard ? 'localhost' : host}:${port}`;
}

async function copyText(ctx: AppContext, text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ctx.notify.success(ctx.t('server.copy.ok', 'Copied'), ctx.t('server.copy.ok.body', '{what} is on the clipboard.', { values: { what } }));
  } catch (error) {
    ctx.notify.error(
      ctx.t('server.copy.failed', 'Nothing was copied'),
      ctx.t('server.copy.failed.body', 'The clipboard refused: {reason}', {
        values: { reason: error instanceof Error ? error.message : String(error) }
      })
    );
  }
}

/* ------------------------------------------------------------------ */
/* The destination                                                     */
/* ------------------------------------------------------------------ */

export function mountContainersPanel(host: HTMLElement, ctx: TabContext, state: ServerState): void {
  host.classList.add('server');

  let query: SearchQuery | null = null;

  const refreshButton = ctx.components.iconButton({
    icon: 'refresh',
    label: ctx.t('server.action.refresh', 'Refresh the container list'),
    onClick: () => {
      void state.refreshList();
      ctx.a11y.announce(ctx.t('server.action.refresh', 'Refresh the container list'));
    }
  });

  const checkButton = ctx.components.button({
    label: 'server.action.check',
    variant: 'text',
    icon: 'bolt',
    onClick: () => void state.probe()
  });

  host.append(
    ctx.components.topAppBar({
      title: 'server.tab.containers',
      subtitle: 'server.tab.containers.subtitle',
      actions: [checkButton, refreshButton]
    })
  );

  const body = node('div', { className: 'server__body' });
  host.append(body);

  /* ---------------- daemon banner ---------------- */

  const daemonCard = ctx.components.card({ variant: 'filled' });
  daemonCard.id = ELEMENT_IDS.daemon;
  daemonCard.dataset.appearanceId = 'server:daemon';
  daemonCard.classList.add('server__daemon');
  daemonCard.setAttribute('aria-label', ctx.t('server.daemon.label', 'Docker availability'));
  body.append(daemonCard);

  let announcedDaemon = '';
  let desktopPath: string | null = null;
  let desktopProbed = false;

  const drawDaemon = (): void => {
    const status = state.daemon();
    daemonCard.textContent = '';

    const heading = node('p', { className: 'md-typescale-title-medium' });
    const detail = node('p', { className: 'md-typescale-body-medium' });
    const actions = node('div', { className: 'server__row' });

    if (status.kind === 'unknown' || status.kind === 'checking') {
      heading.textContent = ctx.t('server.daemon.checking', 'Asking Docker whether it is there');
      detail.textContent = ctx.t(
        'server.daemon.checking.body',
        'Running "docker version" to find out whether the command line exists on this computer and whether a daemon answers it.'
      );
      daemonCard.append(heading, detail);
      const progress = ctx.components.linearProgress({ label: ctx.t('server.daemon.checking', 'Asking Docker whether it is there') });
      daemonCard.append(progress.root);
      return;
    }

    if (status.kind === 'ready') {
      heading.textContent = ctx.t('server.daemon.ready', 'Docker is answering');
      detail.textContent = ctx.t(
        'server.daemon.ready.body',
        'Command line {client}, daemon {server} on {os}. Checked at {time}.',
        {
          values: {
            client: status.clientVersion === '' ? '(unreported)' : status.clientVersion,
            server: status.serverVersion,
            os: status.serverOs === '' ? '(unreported)' : status.serverOs,
            time: formatTime(status.checkedAt)
          }
        }
      );
      daemonCard.append(heading, detail);
      const listedAt = state.listedAt();
      if (listedAt) {
        daemonCard.append(
          node('p', {
            className: 'md-typescale-body-small server-muted',
            text: ctx.t('server.list.listedAt', 'Container list last read at {time}.', {
              values: { time: formatTime(listedAt) }
            })
          })
        );
      }
      if (state.unreadable() > 0) {
        daemonCard.append(
          node('p', {
            className: 'md-typescale-body-small server-muted',
            text: ctx.t(
              'server.list.unreadable',
              '{count} lines of the listing could not be read as container records and were left out.',
              { values: { count: state.unreadable() } }
            )
          })
        );
      }
      return;
    }

    if (status.kind === 'missing') {
      heading.textContent = ctx.t('server.daemon.missing', 'Docker is not installed on this computer');
      detail.textContent = ctx.t(
        'server.daemon.missing.body',
        'The "docker" command could not be run at all. Docker reported: {detail}',
        { values: { detail: status.detail } }
      );
      actions.append(
        ctx.components.button({
          label: 'server.action.install',
          variant: 'filled',
          icon: 'cloud',
          onClick: () => {
            void ctx.studio.shell.openExternal(DOCKER_INSTALL_URL);
          }
        }),
        ctx.components.button({
          label: 'server.action.check',
          variant: 'text',
          icon: 'refresh',
          onClick: () => void state.probe()
        })
      );
      daemonCard.append(
        heading,
        detail,
        node('p', {
          className: 'md-typescale-body-small server-muted',
          text: ctx.t(
            'server.daemon.missing.help',
            'This is a different problem from a stopped daemon: there is nothing installed to start. The button opens the official installation page in your browser; it is the only request this feature ever makes to the internet, and only when you press it.'
          )
        }),
        actions
      );
      return;
    }

    if (status.kind === 'unreachable') {
      heading.textContent = ctx.t('server.daemon.unreachable', 'Docker is installed and nothing is answering it');
      detail.textContent = ctx.t(
        'server.daemon.unreachable.body',
        'The "docker" command ran, so it is installed; the daemon it talks to did not reply. Docker reported: {detail}',
        { values: { detail: status.detail } }
      );
      if (desktopPath) {
        actions.append(
          ctx.components.button({
            label: 'server.action.openDesktop',
            variant: 'filled',
            icon: 'play',
            onClick: async (event) => {
              const button = event.currentTarget as HTMLButtonElement;
              button.disabled = true;
              const opened = await ctx.studio.shell.openPath(desktopPath ?? '');
              button.disabled = false;
              if (!opened.ok) {
                ctx.notify.error(
                  ctx.t('server.action.openDesktop', 'Open Docker Desktop'),
                  ctx.t('server.desktop.failed', 'It could not be opened: {reason}', { values: { reason: opened.error } })
                );
                return;
              }
              ctx.notify.info(
                ctx.t('server.action.openDesktop', 'Open Docker Desktop'),
                ctx.t(
                  'server.desktop.opened',
                  'Docker Desktop was opened from {path}. It takes a little while to start its daemon; this surface keeps checking.',
                  { values: { path: desktopPath ?? '' } }
                )
              );
            }
          })
        );
      }
      actions.append(
        ctx.components.button({
          label: 'server.action.check',
          variant: desktopPath ? 'text' : 'filled',
          icon: 'refresh',
          onClick: () => void state.probe()
        })
      );
      daemonCard.append(
        heading,
        detail,
        node('p', {
          className: 'md-typescale-body-small server-muted',
          text: desktopPath
            ? ctx.t('server.daemon.unreachable.desktop', 'Docker Desktop is installed at {path}, so it can be started from here.', {
                values: { path: desktopPath }
              })
            : ctx.t(
                'server.daemon.unreachable.noDesktop',
                'No Docker Desktop was found in the usual place on this platform, so there is nothing here to press to start it. Start the Docker service the way it was installed, then check again.'
              )
        }),
        actions
      );
      return;
    }

    heading.textContent = ctx.t('server.daemon.refused', 'Docker answered with a refusal');
    detail.textContent = ctx.t('server.daemon.refused.body', 'Docker reported: {detail}', {
      values: { detail: status.detail }
    });
    actions.append(
      ctx.components.button({
        label: 'server.action.check',
        variant: 'filled',
        icon: 'refresh',
        onClick: () => void state.probe()
      })
    );
    daemonCard.append(
      heading,
      detail,
      node('p', {
        className: 'md-typescale-body-small server-muted',
        text: ctx.t(
          'server.daemon.refused.help',
          'The command line exists and the daemon rejected the request rather than failing to answer. On Linux this is usually group membership; on Windows it is usually a container engine that is still starting.'
        )
      }),
      actions
    );
  };

  /* ---------------- operations ---------------- */

  const operationsSection = node('section', {
    className: 'server__section',
    attrs: { id: ELEMENT_IDS.operations, 'data-appearance-id': 'server:operations' }
  });
  body.append(operationsSection);

  const operationCard = (operation: OperationState): HTMLElement => {
    const card = ctx.components.card({ variant: 'outlined' });
    card.classList.add('server__operation');
    const running = operation.phase !== 'succeeded' && operation.phase !== 'failed';

    card.append(
      node('p', {
        className: 'md-typescale-title-small',
        text: ctx.t('server.op.title', '{action} {name}', {
          values: { action: ctx.t(`server.op.kind.${operation.kind}`, operation.kind), name: operation.name }
        })
      })
    );

    const phaseText = ctx.t(`server.op.phase.${operation.phase}`, operation.phase);
    card.append(
      node('p', {
        className: 'md-typescale-body-medium',
        attrs: { role: 'status', 'aria-live': 'polite' },
        text: phaseText
      })
    );

    if (running) {
      if (operation.graceMs !== null) {
        const fraction = Math.min(1, operation.elapsedMs / operation.graceMs);
        const progress = ctx.components.linearProgress({
          label: ctx.t('server.op.elapsedLabel', 'Time elapsed against the grace period'),
          value: fraction
        });
        card.append(progress.root);
        card.append(
          node('p', {
            className: 'md-typescale-body-small server-muted',
            text: ctx.t(
              'server.op.elapsed',
              '{elapsed} elapsed of the {grace} Docker was told to wait before it stops waiting politely. This bar is elapsed time, not an estimate of how far the work has got.',
              {
                values: {
                  elapsed: formatElapsed(operation.elapsedMs),
                  grace: formatElapsed(operation.graceMs)
                }
              }
            )
          })
        );
      } else {
        const progress = ctx.components.linearProgress({
          label: ctx.t('server.op.workingLabel', 'The command is running')
        });
        card.append(progress.root);
        card.append(
          node('p', {
            className: 'md-typescale-body-small server-muted',
            text: ctx.t(
              'server.op.working',
              '{elapsed} elapsed. Docker reports no completion figure for this command, so this bar shows that work is happening and nothing more.',
              { values: { elapsed: formatElapsed(operation.elapsedMs) } }
            )
          })
        );
      }
    }

    if (operation.command !== '') {
      card.append(node('pre', { className: 'server__command', text: operation.command, attrs: { tabindex: '0' } }));
    }

    if (operation.lines.length > 0) {
      const output = node('pre', {
        className: 'server__command',
        text: operation.lines.join('\n'),
        attrs: { tabindex: '0', 'aria-label': ctx.t('server.op.output', 'What the command printed') }
      });
      card.append(output);
    }

    if (!running) {
      card.append(
        node('p', {
          className: 'md-typescale-body-small',
          text: operation.detail
        }),
        ctx.components.button({
          label: 'server.op.dismiss',
          variant: 'text',
          onClick: () => state.dismissOperation(operation.name)
        })
      );
    }

    return card;
  };

  const drawOperations = (): void => {
    operationsSection.textContent = '';
    const operations = state.runningOperations();
    if (operations.length === 0) {
      operationsSection.hidden = true;
      return;
    }
    operationsSection.hidden = false;
    operationsSection.append(
      ctx.components.sectionHeading({
        title: 'server.op.section',
        description: 'server.op.section.description'
      })
    );
    for (const operation of operations) operationsSection.append(operationCard(operation));
  };

  /* ---------------- filters ---------------- */

  const filterSummary = node('span', { className: 'md-typescale-label-medium' });
  const filters = collapsible(ctx, {
    id: ELEMENT_IDS.filters,
    title: 'server.filters.title',
    description: 'server.filters.description',
    startOpen: memory.filtersOpen,
    summary: filterSummary
  });
  filters.trigger.addEventListener('click', () => {
    memory.filtersOpen = filters.isOpen();
  });
  body.append(filters.root);

  const search: SearchBarHandle = ctx.createSearchBar({
    label: 'server.search.label',
    placeholder: 'server.search.placeholder',
    initialText: memory.query,
    sample: state
      .rows()
      .map((row) => `${row.name} ${row.image} ${row.status}`)
      .join('\n'),
    onChange: (next) => {
      query = next;
      memory.query = next.text;
      draw();
    }
  });
  search.root.id = ELEMENT_IDS.search;
  filters.body.append(search.root);

  const stateChips = node('div', { className: 'server__chips', attrs: { role: 'group' } });
  filters.body.append(
    node('p', { className: 'md-typescale-label-large', text: ctx.t('server.filters.states', 'Show these states') }),
    stateChips
  );

  const showStoppedControl = ctx.components.switchControl({
    label: 'server.filters.showStopped',
    checked: ctx.settings.get<boolean>(SHOW_STOPPED_ID, true) !== false,
    onChange: (value) => {
      ctx.settings.set(SHOW_STOPPED_ID, value);
      draw();
    }
  });

  const projectRow = node('div', { className: 'server__row' });
  filters.body.append(node('div', { className: 'server__row', children: [showStoppedControl.root] }), projectRow);

  const resetFilters = ctx.components.button({
    label: 'server.filters.reset',
    variant: 'text',
    icon: 'close',
    onClick: () => {
      memory.states.clear();
      memory.project = '';
      search.clear();
      query = null;
      memory.query = '';
      ctx.settings.set(SHOW_STOPPED_ID, true);
      showStoppedControl.set(true);
      draw();
    }
  });
  filters.body.append(node('div', { className: 'server__row', children: [resetFilters] }));

  /* ---------------- statistics ---------------- */

  const statisticsSummary = node('span', { className: 'md-typescale-label-medium' });
  const statistics = collapsible(ctx, {
    id: ELEMENT_IDS.statistics,
    title: 'server.stats.title',
    description: 'server.stats.description',
    startOpen: memory.statisticsOpen,
    summary: statisticsSummary
  });
  statistics.trigger.addEventListener('click', () => {
    memory.statisticsOpen = statistics.isOpen();
  });
  body.append(statistics.root);

  /* ---------------- selection and table ---------------- */

  const selectionBar = node('div', { className: 'server__toolbar' });
  const selectionStatus = node('p', {
    className: 'md-typescale-body-medium server__selection',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const selectionActions = node('div', { className: 'server__row' });
  selectionBar.append(selectionStatus, selectionActions);
  body.append(selectionBar);

  const tableHost = node('div', {
    className: 'server__tablehost',
    attrs: { id: ELEMENT_IDS.table, 'data-appearance-id': 'server:table' }
  });
  body.append(tableHost);

  /* ---------------- filtering ---------------- */

  const visibleRows = (): ContainerRow[] => {
    const showStopped = ctx.settings.get<boolean>(SHOW_STOPPED_ID, true) !== false;
    return state.rows().filter((row) => {
      if (!showStopped && row.state !== 'running' && row.state !== 'restarting' && row.state !== 'paused') return false;
      if (memory.states.size > 0 && !memory.states.has(row.state)) return false;
      if (memory.project !== '' && (row.composeProject ?? '') !== memory.project) return false;
      if (query && query.text.trim() !== '') {
        const haystack = `${row.name} ${row.image} ${row.status} ${row.shortId} ${row.composeProject ?? ''} ${row.composeService ?? ''} ${row.ports.map(portText).join(' ')}`;
        if (!query.matches(haystack)) return false;
      }
      return true;
    });
  };

  /* ---------------- actions ---------------- */

  const kindNeeded = (kind: OperationKind, row: ContainerRow): boolean => {
    switch (kind) {
      case 'start':
        return row.state !== 'running' && row.state !== 'restarting' && row.state !== 'removing';
      case 'stop':
        return row.state === 'running' || row.state === 'restarting' || row.state === 'paused';
      case 'restart':
      case 'remove':
        return true;
    }
  };

  const irreversibleText = (kind: OperationKind): string => {
    const grace = stopTimeoutSeconds(ctx);
    switch (kind) {
      case 'stop':
        return ctx.t(
          'server.confirm.stop.irreversible',
          'Every process inside the container is asked to finish and is killed after {grace} seconds if it has not. Anything the program was holding in memory and had not written to disk is lost. The container itself, its filesystem and its mounted directories are kept, so it can be started again.',
          { values: { grace } }
        );
      case 'restart':
        return ctx.t(
          'server.confirm.restart.irreversible',
          'The container is stopped exactly as a stop would stop it, with the same {grace}-second grace period and the same loss of anything held only in memory, and then started again. Connections open through it are dropped.',
          { values: { grace } }
        );
      case 'remove':
        return ctx.t(
          'server.confirm.remove.irreversible',
          'The container is stopped if it is running and then deleted, together with anything written inside it that is not on a mounted volume. Named volumes and bind-mounted directories, which is where this project keeps a downloaded world, are NOT deleted. A removed container cannot be started again; it has to be created again.'
        );
      case 'start':
        return '';
    }
  };

  const runOne = async (kind: OperationKind, row: ContainerRow, anchor: HTMLElement): Promise<void> => {
    if (state.busy(row.name)) return;
    if (kind !== 'start') {
      const approved = await ctx.confirm.request({
        anchor,
        action: ctx.t('server.confirm.one', '{action} the container {name}', {
          values: { action: ctx.t(`server.op.kind.${kind}`, kind), name: row.name }
        }),
        affected: [
          ctx.t('server.confirm.affected.container', '{name} — image {image}, currently {state}', {
            values: { name: row.name, image: row.image, state: stateLabel(ctx, row.state) }
          }),
          ...row.ports
            .filter((binding) => binding.published !== '')
            .map((binding) =>
              ctx.t('server.confirm.affected.port', 'Published address {address} stops answering', {
                values: { address: portText(binding) }
              })
            )
        ],
        irreversible: irreversibleText(kind),
        confirmLabel: ctx.t(`server.action.${kind}`, kind)
      });
      if (!approved) return;
    }
    memory.focusId = ELEMENT_IDS.table;
    const result = await state.run(kind, row.name);
    if (result.ok) {
      ctx.notify.success(
        ctx.t('server.notify.done', '{action} {name}', {
          values: { action: ctx.t(`server.op.kind.${kind}`, kind), name: row.name }
        }),
        result.detail
      );
    } else {
      ctx.notify.error(
        ctx.t('server.notify.failed', '{action} {name} did not succeed', {
          values: { action: ctx.t(`server.op.kind.${kind}`, kind), name: row.name }
        }),
        result.detail
      );
    }
  };

  const runBulk = async (kind: OperationKind, anchor: HTMLElement): Promise<void> => {
    const chosen = state.rows().filter((row) => memory.selection.has(row.name));
    const applicable = chosen.filter((row) => kindNeeded(kind, row));
    const busy = applicable.filter((row) => state.busy(row.name));
    const runnable = applicable.filter((row) => !state.busy(row.name));
    if (runnable.length === 0) return;

    if (kind !== 'start') {
      const shown = runnable.slice(0, 12);
      const affected = shown.map((row) =>
        ctx.t('server.confirm.affected.container', '{name} — image {image}, currently {state}', {
          values: { name: row.name, image: row.image, state: stateLabel(ctx, row.state) }
        })
      );
      if (runnable.length > shown.length) {
        affected.push(
          ctx.t('server.confirm.andMore', '… and {count} more', { values: { count: runnable.length - shown.length } })
        );
      }
      if (chosen.length !== runnable.length) {
        affected.push(
          ctx.t(
            'server.confirm.skipped',
            '{count} of the {selected} selected are left alone: they are already in the requested state or an operation is already running against them.',
            { values: { count: chosen.length - runnable.length, selected: chosen.length } }
          )
        );
      }
      const approved = await ctx.confirm.request({
        anchor,
        action: ctx.t('server.confirm.many', '{action} {count} containers', {
          values: { action: ctx.t(`server.op.kind.${kind}`, kind), count: runnable.length }
        }),
        affected,
        irreversible: irreversibleText(kind),
        confirmLabel: ctx.t(`server.action.${kind}`, kind)
      });
      if (!approved) return;
    }

    memory.focusId = ELEMENT_IDS.table;
    const succeeded: string[] = [];
    const failed: string[] = [];
    // Sequential rather than parallel: each command gets its own progress card,
    // and a machine asked to stop nine containers at once produces nine
    // simultaneous grace periods and a very confused report.
    for (const row of runnable) {
      const result = await state.run(kind, row.name);
      if (result.ok) succeeded.push(row.name);
      else failed.push(`${row.name}: ${result.detail}`);
    }

    const summary = ctx.t('server.notify.bulk', '{succeeded} succeeded, {failed} failed, {skipped} left alone.', {
      values: { succeeded: succeeded.length, failed: failed.length, skipped: chosen.length - runnable.length + busy.length }
    });
    if (failed.length === 0) {
      ctx.notify.success(
        ctx.t('server.notify.bulkTitle', '{action} {count} containers', {
          values: { action: ctx.t(`server.op.kind.${kind}`, kind), count: runnable.length }
        }),
        summary
      );
    } else {
      ctx.notify.error(
        ctx.t('server.notify.bulkTitle', '{action} {count} containers', {
          values: { action: ctx.t(`server.op.kind.${kind}`, kind), count: runnable.length }
        }),
        `${summary}\n${failed.join('\n')}`
      );
    }
    ctx.a11y.announce(summary);
  };

  const exportRows = async (): Promise<void> => {
    const rows = memory.selection.size() > 0
      ? state.rows().filter((row) => memory.selection.has(row.name))
      : visibleRows();
    if (rows.length === 0) {
      ctx.notify.info(
        ctx.t('server.export.title', 'Export the container list'),
        ctx.t('server.export.empty', 'There is nothing to export: no container is selected and none is shown.')
      );
      return;
    }
    const records = rows.map((row) => ({
      name: row.name,
      id: row.id,
      image: row.image,
      state: row.state,
      status: row.status,
      health: row.health,
      runningFor: row.runningFor,
      createdAt: row.createdAt,
      ports: row.ports.map(portText).join('; '),
      composeProject: row.composeProject ?? '',
      composeService: row.composeService ?? '',
      command: row.command
    }));
    const format = ctx.settings.get<string>(EXPORT_FORMAT_ID, 'json') as ExportFormat;
    const preflight = ctx.exporter.preflight(records, format);
    if (preflight.losses.length > 0) {
      const proceed = await ctx.components.dialog({
        title: ctx.t('server.export.losses', 'This format cannot carry everything'),
        body: preflight.losses.map((loss) => `${loss.field}: ${loss.reason}`).join('\n'),
        confirmLabel: ctx.t('server.export.proceed', 'Export anyway'),
        cancelLabel: ctx.t('server.export.cancel', 'Choose another format first')
      });
      if (!proceed) return;
    }
    const path = await ctx.exporter.save(records, format, {
      name: 'containers',
      defaultFileName: `containers.${format}`
    });
    if (!path) return;
    ctx.notify.success(ctx.t('server.export.title', 'Export the container list'), path);
    await ctx.history.record(`Exported ${records.length} container records`, 'server', {
      kind: 'server.export',
      format,
      count: records.length,
      path
    });
  };

  /* ---------------- row menu ---------------- */

  const rowMenu = (row: ContainerRow, anchor: HTMLElement): void => {
    const browsable = browsablePorts(row);
    ctx.components.menu({
      anchor,
      label: ctx.t('server.row.more', 'Actions for {name}', { values: { name: row.name } }),
      items: [
        {
          id: 'start',
          label: ctx.t('server.action.start', 'Start'),
          icon: 'play',
          disabled: state.busy(row.name) || !kindNeeded('start', row),
          disabledReason: state.busy(row.name)
            ? ctx.t('server.action.busy', 'An operation is already running against this container.')
            : ctx.t('server.action.start.disabled', 'This container is already running.'),
          run: () => void runOne('start', row, anchor)
        },
        {
          id: 'stop',
          label: ctx.t('server.action.stop', 'Stop'),
          icon: 'stop',
          danger: true,
          disabled: state.busy(row.name) || !kindNeeded('stop', row),
          disabledReason: state.busy(row.name)
            ? ctx.t('server.action.busy', 'An operation is already running against this container.')
            : ctx.t('server.action.stop.disabled', 'This container is not running, so there is nothing to stop.'),
          run: () => void runOne('stop', row, anchor)
        },
        {
          id: 'restart',
          label: ctx.t('server.action.restart', 'Restart'),
          icon: 'refresh',
          danger: true,
          disabled: state.busy(row.name),
          disabledReason: ctx.t('server.action.busy', 'An operation is already running against this container.'),
          run: () => void runOne('restart', row, anchor)
        },
        {
          id: 'remove',
          label: ctx.t('server.action.remove', 'Remove'),
          icon: 'trash',
          danger: true,
          separatorBefore: true,
          disabled: state.busy(row.name),
          disabledReason: ctx.t('server.action.busy', 'An operation is already running against this container.'),
          run: () => void runOne('remove', row, anchor)
        },
        {
          id: 'logs',
          label: ctx.t('server.row.logs', 'Open the log stream'),
          icon: 'terminal',
          separatorBefore: true,
          run: () => openLogsFor(ctx, row.name)
        },
        {
          id: 'open',
          label: ctx.t('server.row.open.group', 'Open a published address in the browser'),
          icon: 'world',
          disabled: browsable.length === 0,
          disabledReason: ctx.t(
            'server.row.open.disabled',
            'This container publishes no TCP port to this machine, so there is no address to open.'
          ),
          children: browsable.map((binding) => ({
            id: `open-${binding.published}`,
            label: ctx.t('server.row.open', 'Open {address}', { values: { address: publishedAddress(binding) } }),
            icon: 'world',
            run: () => {
              void ctx.studio.shell.openExternal(publishedAddress(binding));
            }
          }))
        },
        {
          id: 'copy-name',
          label: ctx.t('server.row.copyName', 'Copy the container name'),
          icon: 'copy',
          separatorBefore: true,
          run: () => void copyText(ctx, row.name, ctx.t('server.table.name', 'Name'))
        },
        {
          id: 'copy-id',
          label: ctx.t('server.row.copyId', 'Copy the container id'),
          icon: 'copy',
          run: () => void copyText(ctx, row.id, ctx.t('server.row.id', 'Container id'))
        },
        {
          id: 'copy-command',
          label: ctx.t('server.row.copyCommand', 'Copy the container command line'),
          icon: 'copy',
          disabled: row.command === '',
          disabledReason: ctx.t('server.row.copyCommand.disabled', 'Docker reported no command line for this container.'),
          run: () => void copyText(ctx, row.command, ctx.t('server.table.command', 'Command'))
        }
      ]
    });
  };

  /* ---------------- drawing ---------------- */

  const drawStateChips = (): void => {
    stateChips.textContent = '';
    const counts = new Map<ContainerState, number>();
    for (const row of state.rows()) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
    for (const containerState of CONTAINER_STATES) {
      const count = counts.get(containerState) ?? 0;
      const chip = ctx.components.chip({
        label: `${stateLabel(ctx, containerState)} (${count})`,
        selected: memory.states.has(containerState),
        onToggle: (selected) => {
          if (selected) memory.states.add(containerState);
          else memory.states.delete(containerState);
          draw();
        }
      });
      if (count === 0 && !memory.states.has(containerState)) chip.classList.add('server-chip--empty');
      stateChips.append(chip);
    }
  };

  const drawProjectPicker = (): void => {
    projectRow.textContent = '';
    const projects = [...new Set(state.rows().map((row) => row.composeProject).filter((value): value is string => !!value))].sort();
    const options = [
      { value: '', label: ctx.t('server.filters.project.all', 'Every container on this machine') },
      ...projects.map((project) => ({ value: project, label: project }))
    ];
    if (memory.project !== '' && !projects.includes(memory.project)) memory.project = '';
    const picker = ctx.components.select({
      label: 'server.filters.project',
      options,
      value: memory.project,
      disabled: projects.length === 0,
      disabledReason: ctx.t(
        'server.filters.project.disabled',
        'No container on this machine carries a Compose project label, so there is nothing to narrow to.'
      ),
      onChange: (value) => {
        memory.project = value;
        draw();
      }
    });
    projectRow.append(picker.root);
  };

  const drawStatistics = (rows: ContainerRow[]): void => {
    statistics.body.textContent = '';
    const all = state.rows();
    const running = all.filter((row) => row.state === 'running').length;
    const stopped = all.filter((row) => row.state === 'exited' || row.state === 'dead').length;
    const unhealthy = all.filter((row) => row.health === 'unhealthy').length;
    const healthy = all.filter((row) => row.health === 'healthy').length;
    const published = all.reduce((total, row) => total + row.ports.filter((port) => port.published !== '').length, 0);
    const images = new Set(all.map((row) => row.image)).size;
    const projects = new Set(all.map((row) => row.composeProject).filter(Boolean)).size;

    statisticsSummary.textContent = ctx.t('server.stats.summary', '{running} running of {total}', {
      values: { running, total: all.length }
    });

    const grid = node('dl', { className: 'server__stats' });
    const pair = (label: string, value: string): void => {
      grid.append(
        node('div', {
          className: 'server__stat',
          children: [
            node('dt', { className: 'md-typescale-label-medium server-muted', text: label }),
            node('dd', { className: 'md-typescale-title-medium', text: value })
          ]
        })
      );
    };
    pair(ctx.t('server.stats.total', 'Containers on this machine'), String(all.length));
    pair(ctx.t('server.stats.shown', 'Shown by the current filter'), String(rows.length));
    pair(ctx.t('server.stats.running', 'Running'), String(running));
    pair(ctx.t('server.stats.stopped', 'Exited or dead'), String(stopped));
    pair(ctx.t('server.stats.healthy', 'Reporting healthy'), String(healthy));
    pair(ctx.t('server.stats.unhealthy', 'Reporting unhealthy'), String(unhealthy));
    pair(ctx.t('server.stats.published', 'Published port bindings'), String(published));
    pair(ctx.t('server.stats.images', 'Distinct images'), String(images));
    pair(ctx.t('server.stats.projects', 'Compose projects'), String(projects));
    statistics.body.append(grid);
    statistics.body.append(
      node('p', {
        className: 'md-typescale-body-small server-muted',
        text: ctx.t(
          'server.stats.note',
          'Every figure counts every container Docker listed, including the ones the filter is hiding, except the row marked as shown by the current filter.'
        )
      })
    );
  };

  const drawSelection = (rows: ContainerRow[]): void => {
    const chosen = state.rows().filter((row) => memory.selection.has(row.name));
    selectionStatus.textContent =
      chosen.length === 0
        ? ctx.t('server.selection.none', 'No container selected')
        : ctx.t('server.selection.count', '{count} selected', { values: { count: chosen.length } });

    if (chosen.length > 0) {
      selectionStatus.append(
        node('span', {
          className: 'server-muted',
          text: ` · ${ctx.t(
            'server.selection.preview',
            '{start} would start, {stop} would stop, {restart} would restart, {remove} would be removed.',
            {
              values: {
                start: chosen.filter((row) => kindNeeded('start', row) && !state.busy(row.name)).length,
                stop: chosen.filter((row) => kindNeeded('stop', row) && !state.busy(row.name)).length,
                restart: chosen.filter((row) => !state.busy(row.name)).length,
                remove: chosen.filter((row) => !state.busy(row.name)).length
              }
            }
          )}`
        })
      );
    }

    selectionActions.textContent = '';
    const emptyReason = ctx.t('server.selection.none', 'No container selected');
    const bulkButton = (kind: OperationKind, icon: string, danger: boolean): HTMLElement => {
      const applicable = chosen.filter((row) => kindNeeded(kind, row) && !state.busy(row.name)).length;
      return ctx.components.button({
        label: `server.action.${kind}`,
        variant: danger ? 'outlined' : 'tonal',
        icon,
        danger,
        disabled: applicable === 0,
        disabledReason:
          chosen.length === 0
            ? emptyReason
            : ctx.t('server.selection.noneApplicable', 'No selected container can be {action}ed right now.', {
                values: { action: ctx.t(`server.op.kind.${kind}`, kind).toLowerCase() }
              }),
        onClick: (event) => void runBulk(kind, event.currentTarget as HTMLElement)
      });
    };

    selectionActions.append(
      bulkButton('start', 'play', false),
      bulkButton('stop', 'stop', true),
      bulkButton('restart', 'refresh', true),
      bulkButton('remove', 'trash', true),
      ctx.components.divider(true),
      ctx.components.button({
        label: ctx.t('server.action.selectMatching', 'Select the {count} shown', { values: { count: rows.length } }),
        variant: 'text',
        disabled: rows.length === 0,
        disabledReason: ctx.t('server.empty.filtered', 'No container matches the current filter.'),
        onClick: () => {
          memory.selection.addAll(rows.map((row) => row.name));
          draw();
          ctx.a11y.announce(
            ctx.t('server.selection.count', '{count} selected', { values: { count: memory.selection.size() } })
          );
        }
      }),
      ctx.components.button({
        label: ctx.t('server.action.selectAll', 'Select all {count}, including hidden', {
          values: { count: state.rows().length }
        }),
        variant: 'text',
        disabled: state.rows().length === 0,
        disabledReason: ctx.t('server.empty.title', 'Docker listed no containers on this machine.'),
        onClick: () => {
          memory.selection.addAll(state.rows().map((row) => row.name));
          draw();
          ctx.a11y.announce(
            ctx.t('server.selection.count', '{count} selected', { values: { count: memory.selection.size() } })
          );
        }
      }),
      ctx.components.button({
        label: 'server.action.invert',
        variant: 'text',
        disabled: rows.length === 0,
        disabledReason: ctx.t('server.empty.filtered', 'No container matches the current filter.'),
        onClick: () => {
          memory.selection.invert(rows.map((row) => row.name));
          draw();
        }
      }),
      ctx.components.button({
        label: 'server.action.clearSelection',
        variant: 'text',
        disabled: chosen.length === 0,
        disabledReason: emptyReason,
        onClick: () => {
          memory.selection.clear();
          draw();
        }
      }),
      ctx.components.divider(true),
      ctx.components.button({
        label: 'server.action.export',
        variant: 'text',
        icon: 'download',
        onClick: () => void exportRows()
      })
    );
  };

  const redrawAndFocusRow = (index: number): void => {
    draw();
    const restored = tableHost.querySelectorAll('tbody input[type="checkbox"]')[index];
    if (restored instanceof HTMLInputElement) restored.focus();
  };

  const drawTable = (rows: ContainerRow[]): void => {
    tableHost.textContent = '';

    const status = state.daemon();
    if (status.kind !== 'ready') {
      // The banner above already says exactly what is wrong and what to do about
      // it, so this says only that the list has no source, rather than repeating
      // a diagnosis in different words.
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('server.empty.noDaemon', 'No container list, because Docker is not answering'),
          body: ctx.t('server.empty.noDaemon.body', 'The panel above says which of the two problems this is and how to get out of it.')
        })
      );
      return;
    }

    if (state.error() !== null) {
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('server.list.error', 'The container list could not be read'),
          body: state.error() ?? '',
          action: {
            label: 'server.action.refresh',
            variant: 'filled',
            icon: 'refresh',
            onClick: () => void state.refreshList()
          }
        })
      );
      return;
    }

    if (state.rows().length === 0) {
      const known = KNOWN_CONTAINERS.map((container) => container.name).join(', ');
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('server.empty.title', 'Docker listed no containers on this machine.'),
          body: ctx.t(
            'server.empty.body',
            'Nothing exists yet, running or stopped. This project\'s compose file defines {known}; bringing it up with "docker compose up -d" from the repository creates them, and they appear here on the next refresh.',
            { values: { known } }
          ),
          action: {
            label: 'server.action.refresh',
            variant: 'filled',
            icon: 'refresh',
            onClick: () => void state.refreshList()
          }
        })
      );
      return;
    }

    if (rows.length === 0) {
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('server.empty.filtered', 'No container matches the current filter.'),
          body: ctx.t('server.empty.filtered.body', '{total} containers exist; the search text, the state chips and the project picker are hiding all of them.', {
            values: { total: state.rows().length }
          }),
          action: {
            label: 'server.filters.reset',
            variant: 'text',
            icon: 'close',
            onClick: () => {
              memory.states.clear();
              memory.project = '';
              search.clear();
              query = null;
              memory.query = '';
              draw();
            }
          }
        })
      );
      return;
    }

    const wrap = node('div', {
      className: 'md-table-wrap server__tablewrap',
      attrs: { role: 'region', tabindex: '0', 'aria-label': ctx.t('server.table.label', 'Containers') }
    });
    const table = node('table', {
      className: 'md-table server__table',
      attrs: { 'aria-label': ctx.t('server.table.label', 'Containers') }
    });

    const head = node('thead');
    const headRow = node('tr');
    const keys = rows.map((row) => row.name);
    const selectedShown = rows.filter((row) => memory.selection.has(row.name)).length;
    const selectAll = ctx.components.checkbox({
      label: ctx.t('server.table.selectShown', 'Select the {count} containers this filter shows', {
        values: { count: rows.length }
      }),
      checked: selectedShown === rows.length && rows.length > 0,
      indeterminate: selectedShown > 0 && selectedShown < rows.length,
      onChange: (checked) => {
        for (const row of rows) memory.selection.set(row.name, checked);
        draw();
      }
    });
    hideCheckboxLabel(selectAll.root);
    const selectHeader = node('th', { attrs: { scope: 'col' } });
    selectHeader.append(selectAll.root);
    headRow.append(selectHeader);

    for (const [key, fallback] of [
      ['server.table.name', 'Name'],
      ['server.table.state', 'State'],
      ['server.table.image', 'Image'],
      ['server.table.ports', 'Ports'],
      ['server.table.status', 'Reported status'],
      ['server.table.uptime', 'Started'],
      ['server.table.controls', 'Controls']
    ] as const) {
      headRow.append(node('th', { attrs: { scope: 'col' }, text: ctx.t(key, fallback) }));
    }
    head.append(headRow);

    const tbody = node('tbody');
    rows.forEach((row, index) => {
      const tr = node('tr', { attrs: { 'aria-selected': String(memory.selection.has(row.name)) } });
      tr.dataset.appearanceId = 'server:row';

      const selectCell = node('td');
      const box = ctx.components.checkbox({
        label: ctx.t('server.table.select', 'Select the container {name}', { values: { name: row.name } }),
        checked: memory.selection.has(row.name),
        onChange: (checked) => {
          memory.selection.set(row.name, checked);
          tr.setAttribute('aria-selected', String(checked));
          drawSelection(rows);
        }
      });
      hideCheckboxLabel(box.root);
      const input = box.root.querySelector('input');
      if (input instanceof HTMLInputElement) wireRowKeyboard(input, index, keys, memory.selection, redrawAndFocusRow);
      selectCell.append(box.root);

      const nameCell = node('td', { className: 'server__namecell' });
      nameCell.append(node('span', { className: 'md-typescale-body-medium', text: row.name }));
      if (row.composeService) {
        nameCell.append(
          node('span', {
            className: 'md-typescale-body-small server-muted',
            text: ctx.t('server.table.service', 'Compose service {service} in project {project}', {
              values: { service: row.composeService, project: row.composeProject ?? '' }
            })
          })
        );
      }
      nameCell.append(node('span', { className: 'md-typescale-body-small server-muted', text: row.shortId }));

      const stateCell = node('td');
      stateCell.append(
        ctx.components.badge({ label: stateLabel(ctx, row.state), severity: STATE_SEVERITY[row.state] })
      );
      if (row.health !== 'none') {
        stateCell.append(
          ctx.components.badge({
            label: ctx.t(`server.health.${row.health}`, row.health),
            severity: row.health === 'healthy' ? 'success' : row.health === 'unhealthy' ? 'error' : 'progress'
          })
        );
      }

      const imageCell = node('td', { text: row.image });

      const portsCell = node('td');
      if (row.ports.length === 0) {
        portsCell.append(
          node('span', { className: 'server-muted', text: ctx.t('server.ports.none', 'None published') })
        );
      } else {
        const list = node('ul', { className: 'server__ports' });
        for (const binding of row.ports) {
          list.append(node('li', { className: 'md-typescale-body-small', text: portText(binding) }));
        }
        portsCell.append(list);
      }

      const statusCell = node('td', { text: row.status });
      const uptimeCell = node('td', {
        text: row.runningFor === '' ? ctx.t('server.table.uptime.none', 'Not reported') : row.runningFor
      });

      const controlCell = node('td', { className: 'server__controls' });
      const busy = state.busy(row.name);
      const isRunning = row.state === 'running' || row.state === 'restarting';
      // The row's own live control. Somebody looking at a stopped container has
      // usually come to start it, and sending them to a menu to do that is a
      // round trip this row can save.
      const primary = ctx.components.button({
        label: isRunning ? 'server.action.stop' : 'server.action.start',
        variant: isRunning ? 'outlined' : 'filled',
        icon: isRunning ? 'stop' : 'play',
        danger: isRunning,
        disabled: busy || (isRunning ? !kindNeeded('stop', row) : !kindNeeded('start', row)),
        disabledReason: busy
          ? ctx.t('server.action.busy', 'An operation is already running against this container.')
          : isRunning
            ? ctx.t('server.action.stop.disabled', 'This container is not running, so there is nothing to stop.')
            : ctx.t('server.action.start.disabled', 'This container is already running.'),
        onClick: (event) => void runOne(isRunning ? 'stop' : 'start', row, event.currentTarget as HTMLElement)
      });
      const restart = ctx.components.iconButton({
        icon: 'refresh',
        label: ctx.t('server.action.restartOne', 'Restart {name}', { values: { name: row.name } }),
        disabled: busy,
        disabledReason: ctx.t('server.action.busy', 'An operation is already running against this container.'),
        onClick: (event) => void runOne('restart', row, event.currentTarget as HTMLElement)
      });
      const more = ctx.components.iconButton({
        icon: 'more',
        label: ctx.t('server.row.more', 'Actions for {name}', { values: { name: row.name } }),
        onClick: (event) => rowMenu(row, event.currentTarget as HTMLElement)
      });
      controlCell.append(primary, restart, more);

      tr.append(selectCell, nameCell, stateCell, imageCell, portsCell, statusCell, uptimeCell, controlCell);
      tbody.append(tr);
    });

    table.append(head, tbody);
    wrap.append(table);
    tableHost.append(wrap);
  };

  /* ---------------- the whole draw ---------------- */

  const draw = (): void => {
    memory.selection.retain(state.rows().map((row) => row.name));
    const rows = visibleRows();
    filterSummary.textContent = ctx.t('server.filters.summary', '{shown} of {total} shown', {
      values: { shown: rows.length, total: state.rows().length }
    });
    drawDaemon();
    drawOperations();
    drawStateChips();
    drawProjectPicker();
    drawStatistics(rows);
    drawSelection(rows);
    drawTable(rows);

    const status = state.daemon();
    const headline =
      status.kind === 'ready'
        ? ctx.t('server.daemon.ready', 'Docker is answering')
        : status.kind === 'missing'
          ? ctx.t('server.daemon.missing', 'Docker is not installed on this computer')
          : status.kind === 'unreachable'
            ? ctx.t('server.daemon.unreachable', 'Docker is installed and nothing is answering it')
            : status.kind === 'refused'
              ? ctx.t('server.daemon.refused', 'Docker answered with a refusal')
              : '';
    if (headline !== '' && announcedDaemon !== '' && announcedDaemon !== headline) ctx.a11y.announce(headline);
    if (headline !== '') announcedDaemon = headline;
  };

  /* ---------------- wiring ---------------- */

  state.containersPanel = {
    focusSearch: () => search.focus(),
    exportRows: () => exportRows()
  };

  const unsubscribe = state.subscribe(() => draw());
  const detach = state.attach();

  // The Docker Desktop probe is one filesystem check per candidate path and its
  // answer decides whether a recovery button can exist at all, so it runs once
  // and redraws when it lands rather than on every draw.
  if (!desktopProbed) {
    desktopProbed = true;
    void findDockerDesktop(ctx).then((found) => {
      desktopPath = found;
      drawDaemon();
    });
  }

  ctx.onDispose(() => {
    unsubscribe();
    detach();
    search.destroy();
    state.containersPanel = null;
  });

  draw();
  if (memory.query !== '') search.setText(memory.query);

  if (memory.focusId) {
    const target = document.getElementById(memory.focusId);
    memory.focusId = '';
    if (target) window.requestAnimationFrame(() => ctx.a11y.focusVisible(target));
  }
}
