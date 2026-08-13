import { el } from '../../core/a11y';
import type { TabContext } from '../../core/registry';
import type { WorldVaultCommit, WorldVaultStatus } from '../../../shared/api';
import { setActiveWorldPath } from './contract';
import {
  AUTO_START_ID,
  POLL_INTERVAL_ID,
  PUBLISH_VISIBILITY_ID,
  QUIET_PERIOD_ID,
  VaultFeatureState,
  WORLD_PATH_ID,
  formatBytes,
  formatSeconds,
  formatTimestamp
} from './state';

/**
 * Disables a plain button and states why in the same breath. `components.button`
 * returns a real `HTMLButtonElement`, not a `ControlHandle`, so there is no
 * `.setDisabled` on it — this is the same pattern `history/panel.ts` uses.
 */
function setButtonDisabled(button: HTMLButtonElement, disabled: boolean, reason: string): void {
  button.disabled = disabled;
  if (disabled) {
    button.title = reason;
    button.setAttribute('aria-description', reason);
  } else {
    button.removeAttribute('title');
    button.removeAttribute('aria-description');
  }
}

/**
 * The vault tab: pick a world, create/watch its vault, browse and act on its
 * commit timeline, and publish it — always by hand, never on its own.
 */
export function mountWorldVaultPanel(host: HTMLElement, ctx: TabContext, state: VaultFeatureState): void {
  let commits: WorldVaultCommit[] = [];
  let filteredCommits: WorldVaultCommit[] = [];
  const selection = new Set<string>();
  let statusTickTimer: number | null = null;

  /* ================================================================ */
  /* Chrome                                                            */
  /* ================================================================ */

  const refreshButton = ctx.components.iconButton({
    icon: 'refresh',
    label: ctx.t('history.action.refresh', 'Refresh'),
    onClick: () => void reloadAll()
  });
  const openFolderButton = ctx.components.iconButton({
    icon: 'folder',
    label: ctx.t('world-vault.status.openFolder', 'Open in File Explorer'),
    onClick: () => void openFolder()
  });
  host.append(
    ctx.components.topAppBar({
      title: 'world-vault.tab',
      subtitle: 'world-vault.tab.subtitle',
      actions: [refreshButton, openFolderButton]
    })
  );

  /* ---------------- world picker ---------------- */

  const pickerCard = ctx.components.card({ variant: 'outlined' });
  pickerCard.classList.add('worldvault-picker');
  pickerCard.setAttribute('data-appearance-id', 'world-vault:picker');
  const pickerField = ctx.components.textField({
    label: 'world-vault.picker.label',
    value: state.worldPath,
    browse: 'folder',
    onCommit: (value) => {
      state.setWorldPath(value);
      ctx.settings.set(WORLD_PATH_ID, value);
      void reloadAll();
      void ctx.history.record(
        value ? `Selected the world vault folder ${value}` : 'Cleared the world vault folder',
        'world-vault',
        { worldPath: value }
      );
    }
  });
  pickerCard.append(
    ctx.components.sectionHeading({ title: 'world-vault.picker.label', description: 'world-vault.picker.description' }),
    pickerField.root
  );
  host.append(pickerCard);

  const body = el('div', { className: 'worldvault-body' });
  host.append(body);

  /* ================================================================ */
  /* Rendering                                                         */
  /* ================================================================ */

  function render(): void {
    body.textContent = '';
    if (!state.worldPath) {
      body.append(
        ctx.components.emptyState({
          title: ctx.t('world-vault.picker.empty.title', 'Choose a world'),
          body: ctx.t('world-vault.picker.empty.body', 'Select a downloaded world folder above.')
        })
      );
      return;
    }
    body.append(buildStatusCard());
    body.append(buildTimelineSection());
    body.append(buildPublishCard());
  }

  /* ---------------- status card ---------------- */

  function buildStatusCard(): HTMLElement {
    const status = state.status;
    const card = ctx.components.card({ variant: 'outlined' });
    card.id = 'worldvault-status';
    card.classList.add('worldvault-status');
    card.setAttribute('data-appearance-id', 'world-vault:status');

    const heading = el('h2', { className: 'md-typescale-title-small', text: ctx.t('world-vault.status.heading', 'Vault status') });
    card.append(heading);

    if (state.lastError) {
      card.append(el('p', { className: 'md-typescale-body-medium worldvault-status__error', text: state.lastError }));
      return card;
    }
    if (!status) {
      card.append(el('p', { className: 'md-typescale-body-medium', text: '…' }));
      return card;
    }
    if (status.degradedReason && !status.exists) {
      card.append(
        el('p', { className: 'md-typescale-body-medium worldvault-status__error', text: status.degradedReason })
      );
      return card;
    }

    if (!status.exists) {
      card.append(
        el('p', { className: 'md-typescale-body-medium', text: ctx.t('world-vault.status.notCreated', 'No vault exists for this folder yet.') }),
        el('p', { className: 'md-typescale-body-small', text: formatBytes(status.workingTreeBytes) }),
        ctx.components.button({
          label: 'world-vault.status.create',
          variant: 'filled',
          icon: 'add',
          onClick: (event) => void createVault(event.currentTarget as HTMLElement)
        })
      );
      return card;
    }

    const facts = el('dl', { className: 'worldvault-status__facts' });
    facts.append(
      el('dt', { text: ctx.t('world-vault.status.commitCount', '{count} commits', { values: { count: status.commitCount } }) }),
      el('dd', { text: status.branch ? ctx.t('world-vault.status.branch', 'Branch: {branch}', { values: { branch: status.branch } }) : '' }),
      el('dt', {
        text: status.lastCommit
          ? ctx.t('world-vault.status.lastCommit', 'Last commit: {subject} · {when}', {
              values: { subject: status.lastCommit.subject, when: formatTimestamp(status.lastCommit.timestampIso) }
            })
          : ctx.t('world-vault.status.noCommit', 'No commits yet.')
      }),
      el('dd', {
        text: ctx.t('world-vault.status.size', 'History: {gitSize} · World: {worldSize}', {
          values: { gitSize: formatBytes(status.gitDirBytes), worldSize: formatBytes(status.workingTreeBytes) }
        })
      })
    );
    card.append(facts);

    if (status.degradedReason) {
      card.append(
        el('p', {
          className: 'md-typescale-body-small worldvault-status__error',
          text: ctx.t('world-vault.status.degraded', 'The vault is degraded: {reason}', { values: { reason: status.degradedReason } })
        })
      );
    }

    const activity = el('p', { className: 'md-typescale-body-small worldvault-status__activity', attrs: { role: 'status' } });
    if (status.waitingForSettle) {
      activity.textContent = ctx.t('world-vault.status.waiting', 'Waiting for writes to settle — last activity {seconds} ago.', {
        values: { seconds: formatSeconds(status.msSinceLastActivity ?? 0) }
      });
    } else if (status.runnerActive) {
      activity.textContent = ctx.t('world-vault.status.idle', 'Nothing pending. Everything settled is committed.');
    }
    card.append(activity);

    const actions = el('div', { className: 'worldvault-status__actions' });
    actions.append(
      ctx.components.button({
        label: status.runnerActive ? 'world-vault.status.stopRunner' : 'world-vault.status.startRunner',
        variant: status.runnerActive ? 'outlined' : 'tonal',
        icon: status.runnerActive ? 'pause' : 'play',
        onClick: () => void toggleRunner(status)
      }),
      ctx.components.button({
        label: 'world-vault.status.commitNow',
        variant: 'text',
        icon: 'save',
        onClick: () => void commitNow()
      }),
      ctx.components.button({
        label: 'world-vault.status.gc',
        variant: 'text',
        icon: 'tune',
        onClick: () => void runGc()
      })
    );
    card.append(actions);

    card.append(
      el('p', { className: 'md-typescale-body-small worldvault-status__retention', text: ctx.t('world-vault.status.retentionNote', 'History grows with every commit.') })
    );

    return card;
  }

  /* ---------------- timeline ---------------- */

  let table: ReturnType<typeof ctx.components.dataTable<WorldVaultCommit>> | null = null;
  let searchHandle: ReturnType<typeof ctx.createSearchBar> | null = null;
  let bulkBar: HTMLElement | null = null;

  function buildTimelineSection(): HTMLElement {
    const section = el('section', { className: 'worldvault-timeline', attrs: { id: 'worldvault-timeline' } });
    section.append(ctx.components.sectionHeading({ title: 'world-vault.timeline.heading' }));

    searchHandle = ctx.createSearchBar({
      label: 'world-vault.search',
      sample: commits.map((commit) => commit.subject).join('\n'),
      onChange: (query) => {
        filteredCommits = commits.filter((commit) => query.matches(`${commit.subject} ${commit.shortHash} ${commit.kind}`));
        table?.setRows(filteredCommits);
        drawBulkBar();
      }
    });
    searchHandle.root.id = 'worldvault-search';
    section.append(searchHandle.root);

    bulkBar = el('div', { className: 'worldvault-bulk', attrs: { role: 'group' } });
    bulkBar.hidden = true;
    section.append(bulkBar);

    filteredCommits = [...commits];
    table = ctx.components.dataTable<WorldVaultCommit>({
      label: ctx.t('world-vault.timeline.heading', 'Timeline'),
      selectable: true,
      onSelectionChange: (ids) => {
        selection.clear();
        for (const id of ids) selection.add(id);
        drawBulkBar();
      },
      columns: [
        {
          id: 'when',
          label: ctx.t('world-vault.timeline.column.date', 'When'),
          sortable: true,
          value: (row) => row.timestampIso,
          render: (row) => formatTimestamp(row.timestampIso)
        },
        { id: 'subject', label: ctx.t('world-vault.timeline.column.subject', 'Commit'), value: (row) => row.subject },
        {
          id: 'kind',
          label: ctx.t('world-vault.timeline.column.kind', 'Kind'),
          sortable: true,
          value: (row) => row.kind,
          render: (row) =>
            ctx.components.badge({
              label: ctx.t(`world-vault.timeline.kind.${row.kind}`, row.kind),
              severity: row.kind === 'prune' ? 'warning' : row.kind === 'restore' ? 'success' : 'info'
            })
        },
        { id: 'files', label: ctx.t('world-vault.timeline.column.files', 'Files'), align: 'end', sortable: true, value: (row) => row.filesChanged },
        {
          id: 'bytes',
          label: ctx.t('world-vault.timeline.column.bytes', 'Bytes'),
          align: 'end',
          sortable: true,
          value: (row) => row.bytesChanged,
          render: (row) => formatBytes(row.bytesChanged)
        }
      ],
      rows: filteredCommits,
      rowId: (row) => row.hash,
      onActivate: (row) => openRowMenu(row, table?.root ?? section),
      emptyMessage: commits.length === 0 ? ctx.t('world-vault.timeline.empty.body', 'Create the vault or start watching.') : ctx.t('core.search.noMatches', 'Nothing matched.')
    });
    section.append(table.root);
    return section;
  }

  function drawBulkBar(): void {
    if (!bulkBar) return;
    const count = selection.size;
    bulkBar.hidden = count === 0;
    bulkBar.textContent = '';
    if (count === 0) return;
    bulkBar.setAttribute('aria-label', ctx.t('world-vault.bulk.selected', '{count} selected', { values: { count } }));
    const rows = filteredCommits;
    bulkBar.append(
      el('span', { className: 'md-typescale-label-large', text: ctx.t('world-vault.bulk.selected', '{count} selected', { values: { count } }) }),
      ctx.components.button({
        label: ctx.t('world-vault.bulk.selectPage', 'Select the {count} shown', { values: { count: rows.length } }),
        variant: 'text',
        onClick: () => {
          for (const commit of rows) selection.add(commit.hash);
          table?.setSelection([...selection]);
          drawBulkBar();
        }
      }),
      ctx.components.button({
        label: ctx.t('world-vault.bulk.selectAll', 'Select all {count} matching', { values: { count: filteredCommits.length } }),
        variant: 'text',
        onClick: () => {
          for (const commit of filteredCommits) selection.add(commit.hash);
          table?.setSelection([...selection]);
          drawBulkBar();
        }
      }),
      ctx.components.button({
        label: 'world-vault.bulk.invert',
        variant: 'text',
        onClick: () => {
          for (const commit of filteredCommits) {
            if (selection.has(commit.hash)) selection.delete(commit.hash);
            else selection.add(commit.hash);
          }
          table?.setSelection([...selection]);
          drawBulkBar();
        }
      }),
      ctx.components.button({
        label: 'world-vault.bulk.clear',
        variant: 'text',
        onClick: () => {
          selection.clear();
          table?.clearSelection();
          drawBulkBar();
        }
      }),
      ctx.components.divider(true),
      ctx.components.button({
        label: 'world-vault.bulk.export',
        variant: 'tonal',
        icon: 'download',
        onClick: () => void exportCommits(selectedCommits())
      }),
      ctx.components.button({
        label: 'world-vault.row.restore',
        variant: 'text',
        icon: 'history',
        disabled: count !== 1,
        disabledReason: ctx.t('world-vault.restore.needOne', 'Select exactly one commit to restore to.'),
        onClick: (event) => {
          const [only] = selectedCommits();
          if (only) void restoreTo(only, event.currentTarget as HTMLElement);
        }
      }),
      ctx.components.button({
        label: 'world-vault.row.pruneBefore',
        variant: 'text',
        icon: 'trash',
        danger: true,
        disabled: count !== 1,
        disabledReason: ctx.t('world-vault.prune.needOne', 'Select exactly one commit as the prune boundary.'),
        onClick: (event) => {
          const [only] = selectedCommits();
          if (only) void pruneBefore(only, event.currentTarget as HTMLElement);
        }
      })
    );
  }

  function selectedCommits(): WorldVaultCommit[] {
    return commits.filter((commit) => selection.has(commit.hash));
  }

  function openRowMenu(commit: WorldVaultCommit, anchor: HTMLElement): void {
    ctx.components.menu({
      anchor,
      label: ctx.t('world-vault.row.actions', 'Commit actions'),
      items: [
        { id: 'restore', label: ctx.t('world-vault.row.restore', 'Restore to this commit'), icon: 'history', run: () => void restoreTo(commit, anchor) },
        { id: 'prune', label: ctx.t('world-vault.row.pruneBefore', 'Prune history before this commit'), icon: 'trash', danger: true, separatorBefore: true, run: () => void pruneBefore(commit, anchor) },
        { id: 'copy', label: ctx.t('world-vault.row.copyHash', 'Copy commit hash'), icon: 'copy', separatorBefore: true, run: () => void copyHash(commit) }
      ]
    });
  }

  async function copyHash(commit: WorldVaultCommit): Promise<void> {
    try {
      await navigator.clipboard.writeText(commit.hash);
      ctx.notify.success(ctx.t('world-vault.tab', 'World vault'), ctx.t('world-vault.row.copied', '{hash} copied to the clipboard.', { values: { hash: commit.shortHash } }));
    } catch {
      /* clipboard access can be refused by the platform; nothing further to do */
    }
  }

  async function exportCommits(rows: WorldVaultCommit[]): Promise<void> {
    if (rows.length === 0) return;
    const records = rows.map((row) => ({ ...row }));
    const path = await ctx.exporter.save(records, 'json', { name: 'world-vault-commits', defaultFileName: 'world-vault-commits.json' });
    if (path) ctx.notify.success(ctx.t('world-vault.bulk.export', 'Export'), ctx.t('core.export.saved', 'Written to {path}', { values: { path } }));
  }

  /* ---------------- publish card ---------------- */

  function buildPublishCard(): HTMLElement {
    const card = ctx.components.card({ variant: 'outlined' });
    card.classList.add('worldvault-publish');
    card.setAttribute('data-appearance-id', 'world-vault:publish');
    card.append(
      ctx.components.sectionHeading({ title: 'world-vault.publish.heading' }),
      el('p', { className: 'md-typescale-body-medium worldvault-publish__risk', text: ctx.t('world-vault.publish.risk', 'Publishing sends the whole world to a remote you choose.') })
    );

    const preflightText = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
    card.append(preflightText);

    const remoteField = ctx.components.textField({
      label: 'world-vault.publish.remoteUrl.label',
      placeholder: 'https://github.com/you/world.git'
    });
    const pushButton = ctx.components.button({
      label: 'world-vault.publish.push',
      variant: 'filled',
      icon: 'upload',
      onClick: (event) => void doPush(remoteField.get(), event.currentTarget as HTMLElement)
    });
    card.append(remoteField.root, pushButton);

    card.append(ctx.components.divider());

    const repoNameField = ctx.components.textField({ label: 'world-vault.publish.repoName.label' });
    const visibilitySelect = ctx.components.select({
      label: 'world-vault.publish.visibility.label',
      value: String(ctx.settings.get<string>(PUBLISH_VISIBILITY_ID, 'private')),
      options: [
        { value: 'private', label: 'world-vault.publish.visibility.private' },
        { value: 'public', label: 'world-vault.publish.visibility.public' }
      ]
    });
    const createRepoButton = ctx.components.button({
      label: 'world-vault.publish.createRepo',
      variant: 'tonal',
      icon: 'cloud',
      onClick: (event) =>
        void doCreateRepo(repoNameField.get(), visibilitySelect.get() as 'public' | 'private', event.currentTarget as HTMLElement)
    });
    card.append(repoNameField.root, visibilitySelect.root, createRepoButton);

    void (async () => {
      if (!state.worldPath) return;
      const result = await ctx.studio.worldVault.publishPreflight(state.worldPath);
      if (!result.ok) {
        preflightText.textContent = result.error;
        return;
      }
      const preflight = result.value;
      const lines: string[] = [
        ctx.t('world-vault.publish.preflight.summary', 'World: {size} · {files} files', {
          values: { size: formatBytes(preflight.worldSizeBytes), files: preflight.fileCount }
        })
      ];
      if (!preflight.gitAvailable) lines.push(ctx.t('world-vault.publish.preflight.gitMissing', 'git is not installed.'));
      if (!preflight.ghAvailable) lines.push(ctx.t('world-vault.publish.preflight.ghMissing', 'The GitHub CLI was not found.'));
      else if (!preflight.ghAuthenticated) lines.push(ctx.t('world-vault.publish.preflight.ghNotAuthed', 'The GitHub CLI is not signed in.'));
      preflightText.textContent = lines.join(' · ');

      if (preflight.remoteUrl) remoteField.set(preflight.remoteUrl);
      setButtonDisabled(
        pushButton,
        !preflight.hasRemote && remoteField.get().trim() === '',
        ctx.t('world-vault.publish.remoteUrl.label', 'Remote URL')
      );
      setButtonDisabled(
        createRepoButton,
        !preflight.ghAvailable || !preflight.ghAuthenticated,
        !preflight.ghAvailable
          ? ctx.t('world-vault.publish.preflight.ghMissing', 'The GitHub CLI was not found.')
          : ctx.t('world-vault.publish.preflight.ghNotAuthed', 'The GitHub CLI is not signed in.')
      );
    })();

    return card;
  }

  async function doPush(remoteUrl: string, anchor: HTMLElement): Promise<void> {
    const world = state.worldPath;
    if (!world) return;
    const preflight = await ctx.studio.worldVault.publishPreflight(world);
    const size = preflight.ok ? formatBytes(preflight.value.worldSizeBytes) : '?';
    const files = preflight.ok ? preflight.value.fileCount : 0;
    const url = remoteUrl.trim();
    if (!url) {
      ctx.notify.warn(ctx.t('world-vault.publish.heading', 'Publish'), ctx.t('world-vault.publish.remoteUrl.label', 'Remote URL'));
      return;
    }
    const approved = await ctx.confirm.request({
      action: ctx.t('world-vault.publish.pushConfirmAction', 'Push the vault to {url}', { values: { url } }),
      affected: [ctx.t('world-vault.publish.preflight.summary', 'World: {size} · {files} files', { values: { size, files } })],
      irreversible: ctx.t('world-vault.publish.pushIrreversible', 'Every committed file becomes visible to anyone who can reach {url}.', { values: { url } }),
      anchor
    });
    if (!approved) return;

    const setRemoteResult = await ctx.studio.worldVault.setRemote(world, url);
    if (!setRemoteResult.ok) {
      ctx.notify.error(ctx.t('world-vault.publish.heading', 'Publish'), ctx.t('world-vault.publish.pushFailed', 'The push failed: {reason}', { values: { reason: setRemoteResult.error } }));
      return;
    }
    const pushResult = await ctx.studio.worldVault.push(world);
    if (!pushResult.ok) {
      ctx.notify.error(ctx.t('world-vault.publish.heading', 'Publish'), ctx.t('world-vault.publish.pushFailed', 'The push failed: {reason}', { values: { reason: pushResult.error } }));
      return;
    }
    await ctx.history.record(`Published the world vault to ${url}`, 'world-vault', { worldPath: world, url });
    ctx.notify.success(ctx.t('world-vault.publish.heading', 'Publish'), ctx.t('world-vault.publish.pushDone', 'Pushed to {url}.', { values: { url } }));
    await state.reload();
  }

  async function doCreateRepo(name: string, visibility: 'public' | 'private', anchor: HTMLElement): Promise<void> {
    const world = state.worldPath;
    if (!world) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      ctx.notify.warn(ctx.t('world-vault.publish.heading', 'Publish'), ctx.t('world-vault.publish.repoName.label', 'Repository name'));
      return;
    }
    const preflight = await ctx.studio.worldVault.publishPreflight(world);
    const size = preflight.ok ? formatBytes(preflight.value.worldSizeBytes) : '?';
    const files = preflight.ok ? preflight.value.fileCount : 0;
    const approved = await ctx.confirm.request({
      action: ctx.t('world-vault.publish.createRepoConfirmAction', 'Create "{name}" ({visibility}) and push {size}', { values: { name: trimmedName, visibility, size } }),
      affected: [ctx.t('world-vault.publish.preflight.summary', 'World: {size} · {files} files', { values: { size, files } })],
      irreversible: ctx.t('world-vault.publish.createRepoIrreversible', 'A new repository is created and the vault is pushed to it.', { values: { name: trimmedName, visibility } }),
      anchor
    });
    if (!approved) return;

    const result = await ctx.studio.worldVault.createGithubRepo(world, { name: trimmedName, visibility });
    if (!result.ok) {
      ctx.notify.error(ctx.t('world-vault.publish.heading', 'Publish'), ctx.t('world-vault.publish.createRepoFailed', 'The repository could not be created: {reason}', { values: { reason: result.error } }));
      return;
    }
    await ctx.history.record(`Published the world vault as a new GitHub repository "${trimmedName}"`, 'world-vault', {
      worldPath: world,
      name: trimmedName,
      visibility,
      url: result.value.url
    });
    ctx.notify.success(
      ctx.t('world-vault.publish.heading', 'Publish'),
      ctx.t('world-vault.publish.createRepoDone', '"{name}" was created and pushed: {url}', { values: { name: trimmedName, url: result.value.url } })
    );
    await state.reload();
  }

  /* ================================================================ */
  /* Actions                                                           */
  /* ================================================================ */

  async function createVault(anchor: HTMLElement): Promise<void> {
    const world = state.worldPath;
    if (!world) return;
    const result = await ctx.studio.worldVault.create(world);
    if (!result.ok) {
      ctx.notify.error(ctx.t('world-vault.tab', 'World vault'), ctx.t('world-vault.status.createFailed', 'The vault could not be created: {reason}', { values: { reason: result.error } }));
      return;
    }
    await ctx.history.record(`Created a world vault for ${world}`, 'world-vault', { worldPath: world });
    ctx.notify.success(ctx.t('world-vault.tab', 'World vault'), ctx.t('world-vault.status.create', 'Create the vault'));
    if (state.autoStart()) await toggleRunner(result.value, true);
    await reloadAll();
    void anchor;
  }

  async function toggleRunner(status: WorldVaultStatus, forceStart = false): Promise<void> {
    const world = state.worldPath;
    if (!world) return;
    if (status.runnerActive && !forceStart) {
      await ctx.studio.worldVault.stopRunner(world);
    } else {
      await ctx.studio.worldVault.startRunner(world, {
        quietPeriodMs: state.quietPeriodMs(),
        pollIntervalMs: state.pollIntervalMs()
      });
    }
    await state.reload();
  }

  async function commitNow(): Promise<void> {
    const world = state.worldPath;
    if (!world) return;
    const result = await ctx.studio.worldVault.commitNow(world, 'Captured a manual snapshot', 'snapshot');
    if (!result.ok) {
      ctx.notify.error(ctx.t('world-vault.status.commitNow', 'Commit now'), result.error);
      return;
    }
    if (!result.value) {
      ctx.notify.info(ctx.t('world-vault.status.commitNow', 'Commit now'), ctx.t('world-vault.status.commitNowNothing', 'Nothing has changed since the last commit.'));
      return;
    }
    await ctx.history.record(`Committed the world vault manually (${result.value.filesChanged} files)`, 'world-vault', {
      worldPath: world,
      hash: result.value.hash
    });
    ctx.notify.success(
      ctx.t('world-vault.status.commitNow', 'Commit now'),
      ctx.t('world-vault.status.commitNowDone', '{count} changed files were committed.', {
        values: { count: result.value.filesChanged, hash: result.value.shortHash }
      })
    );
    await reloadAll();
  }

  async function runGc(): Promise<void> {
    const world = state.worldPath;
    if (!world) return;
    const result = await ctx.studio.worldVault.gc(world);
    if (!result.ok) {
      ctx.notify.error(ctx.t('world-vault.status.gc', 'Compact history'), result.error);
      return;
    }
    ctx.notify.success(
      ctx.t('world-vault.status.gc', 'Compact history'),
      ctx.t('world-vault.status.gcDone', 'History now takes {size} on disk.', { values: { size: formatBytes(result.value.gitDirBytes) } })
    );
    await state.reload();
  }

  async function restoreTo(commit: WorldVaultCommit, anchor: HTMLElement): Promise<void> {
    const world = state.worldPath;
    if (!world) return;
    const approved = await ctx.confirm.request({
      action: ctx.t('world-vault.restore.confirmAction', 'Restore the world to commit {hash}', { values: { hash: commit.shortHash } }),
      affected: [commit.subject, formatTimestamp(commit.timestampIso)],
      irreversible: ctx.t('world-vault.restore.irreversible', 'Every file on disk is overwritten to match this commit.', {
        values: { path: world, hash: commit.shortHash }
      }),
      anchor
    });
    if (!approved) return;

    const result = await ctx.studio.worldVault.restore(world, commit.hash);
    if (!result.ok) {
      ctx.notify.error(ctx.t('world-vault.row.restore', 'Restore'), ctx.t('world-vault.restore.failed', 'The restore failed: {reason}', { values: { reason: result.error } }));
      return;
    }
    await ctx.history.record(`Restored the world vault to commit ${commit.shortHash}`, 'world-vault', {
      worldPath: world,
      restoredTo: commit.hash,
      newCommit: result.value.hash
    });
    ctx.notify.success(ctx.t('world-vault.row.restore', 'Restore'), ctx.t('world-vault.restore.done', 'Restored to {hash}.', { values: { hash: commit.shortHash } }));
    await reloadAll();
  }

  async function pruneBefore(commit: WorldVaultCommit, anchor: HTMLElement): Promise<void> {
    const world = state.worldPath;
    if (!world) return;
    const approved = await ctx.confirm.request({
      action: ctx.t('world-vault.prune.confirmAction', 'Prune history before {hash}', { values: { hash: commit.shortHash } }),
      affected: [commit.subject, formatTimestamp(commit.timestampIso)],
      irreversible: ctx.t('world-vault.prune.irreversible', 'Every commit before this one is collapsed into one, permanently.', { values: { hash: commit.shortHash } }),
      anchor
    });
    if (!approved) return;

    const result = await ctx.studio.worldVault.prune(world, commit.hash);
    if (!result.ok) {
      ctx.notify.error(ctx.t('world-vault.row.pruneBefore', 'Prune'), ctx.t('world-vault.prune.failed', 'Pruning failed and was rolled back: {reason}', { values: { reason: result.error } }));
      return;
    }
    await ctx.history.record(`Pruned the world vault's history before ${commit.shortHash}`, 'world-vault', {
      worldPath: world,
      beforeHash: commit.hash,
      removedCommitCount: result.value.removedCommitCount
    });
    ctx.notify.success(
      ctx.t('world-vault.row.pruneBefore', 'Prune'),
      ctx.t('world-vault.prune.done', '{count} commits were combined, reclaiming {size}.', {
        values: { count: result.value.removedCommitCount, size: formatBytes(result.value.reclaimedBytes) }
      })
    );
    await reloadAll();
  }

  async function openFolder(): Promise<void> {
    if (!state.worldPath) return;
    const result = await ctx.studio.shell.openPath(state.worldPath);
    if (!result.ok) ctx.notify.error(ctx.t('world-vault.status.openFolder', 'Open in File Explorer'), result.error);
  }

  /* ================================================================ */
  /* Wiring                                                            */
  /* ================================================================ */

  async function reloadAll(): Promise<void> {
    await state.reload();
    await state.reloadCommits();
    commits = state.commits;
    render();
  }

  const offStatus = state.onStatusChange(() => render());
  const offCommit = state.onCommit(() => void reloadAll());

  statusTickTimer = window.setInterval(() => {
    if (state.status?.waitingForSettle) render();
  }, 1000);

  ctx.onDispose(() => {
    offStatus();
    offCommit();
    searchHandle?.destroy();
    if (statusTickTimer !== null) window.clearInterval(statusTickTimer);
    setActiveWorldPath(null);
  });

  state.start();
  void reloadAll();
}
