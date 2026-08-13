import { el } from '../../core/a11y';
import type { DataTableHandle, TabContext } from '../../core/registry';
import {
  ALLOWED_COMMANDS,
  ALLOWED_ENVIRONMENT_KEYS,
  builtinProfiles,
  launchProfile,
  preflight,
  readNpmScripts,
  redactedEnvironment,
  restoreSnapshot,
  validateProfile
} from './harness';
import type { PreflightReport } from './harness';
import { boundedAffected, selectionToolbar, setButtonDisabled } from './shared';
import type { HarnessArgument, HarnessEnvironmentEntry, HarnessProfile, HarnessSnapshot } from './state';
import type { Runtime } from './runtime';
import { formatTimestamp, nowIso } from './util';

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

function blankProfile(): HarnessProfile {
  return {
    id: newId('profile'),
    name: '',
    description: '',
    builtin: false,
    command: ALLOWED_COMMANDS[0],
    args: [],
    workingDirectory: '',
    environment: [],
    requiredPorts: [],
    requiredFiles: [],
    readinessMarker: '',
    settleSeconds: 5,
    modelRef: '',
    updatedAt: nowIso(),
    lastLaunchAt: null,
    lastOutcome: null
  };
}

function defaultArgumentFor(kind: HarnessArgument['kind']): HarnessArgument {
  switch (kind) {
    case 'literal':
      return { kind: 'literal', value: '' };
    case 'path':
      return { kind: 'path', value: '' };
    case 'number':
      return { kind: 'number', value: 0 };
    case 'model':
      return { kind: 'model' };
    default:
      return { kind: 'runtimeUrl' };
  }
}

/** The "Harness profiles" tab: launching a local program of your own against a model. */
export function mountHarnessPanel(host: HTMLElement, ctx: TabContext, rt: Runtime): void {
  const { models } = rt;
  host.className = 'models-panel';

  host.append(
    ctx.components.topAppBar({
      title: ctx.t('models.harness.title', 'Harness profiles'),
      subtitle: ctx.t(
        'models.harness.subtitle',
        'This application launching a local program against a model, from an allow-listed schema. The model runtime cannot launch anything, and nothing here accepts a shell command.'
      )
    })
  );

  const listSection = el('section', { className: 'models-section', attrs: { id: 'models-harness-list' } });
  const snapshotSection = el('section', { className: 'models-section' });
  host.append(listSection, snapshotSection);

  const selection = new Set<string>();
  let table: DataTableHandle<HarnessProfile> | null = null;
  let filtered: HarnessProfile[] = [];

  function allProfiles(): HarnessProfile[] {
    return [...builtinProfiles(), ...models.profiles];
  }

  /* ================================================================ */
  /* Profile list                                                       */
  /* ================================================================ */

  function renderList(): void {
    listSection.textContent = '';
    listSection.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('models.harness.title', 'Harness profiles') }));

    const newButton = ctx.components.button({ label: 'models.harness.new', variant: 'tonal', icon: 'add', onClick: () => void openEditor(null) });
    listSection.append(newButton);

    const all = allProfiles();
    if (models.profiles.length === 0) {
      listSection.append(
        el('div', {
          className: 'models-gaps',
          children: [
            el('p', { className: 'md-typescale-body-medium', text: ctx.t('models.harness.empty.title', 'No profiles of your own yet') }),
            el('p', { className: 'md-typescale-body-small', text: ctx.t('models.harness.empty.body', 'Duplicate one of the shipped templates below, or create a profile from scratch.') })
          ]
        })
      );
    }

    const search = ctx.createSearchBar({
      label: 'models.harness.search',
      sample: all.map((p) => `${p.name}\n${p.description}`).join('\n'),
      onChange: (q) => {
        filtered = all.filter((p) => q.matches(p.name) || q.matches(p.description) || q.matches(p.command));
        table?.setRows(filtered);
        table?.setSelection([...selection].filter((id) => filtered.some((p) => p.id === id)));
        toolbar.refresh();
      }
    });
    ctx.onDispose(() => search.destroy());
    listSection.append(search.root);

    const toolbar = selectionToolbar({
      ctx,
      selection,
      shownIds: () => filtered.map((p) => p.id),
      allIds: () => all.map((p) => p.id),
      onChange: () => table?.setSelection([...selection])
    });
    listSection.append(toolbar.root);

    const bulk = el('div', { className: 'models-panel__toolbar' });
    bulk.append(
      ctx.components.button({ label: 'models.harness.delete', variant: 'text', icon: 'trash', danger: true, onClick: (event) => void doDeleteSelected(event.currentTarget as HTMLElement) }),
      ctx.components.button({ label: 'models.action.export', variant: 'text', icon: 'download', onClick: () => void doExportSelected() })
    );
    listSection.append(bulk);

    const scroll = el('div', { className: 'models-scroll' });
    listSection.append(scroll);

    table = ctx.components.dataTable<HarnessProfile>({
      label: 'models.harness.title',
      rowId: (p) => p.id,
      rows: [],
      selectable: true,
      emptyMessage: 'core.search.noMatches',
      onSelectionChange: (ids) => {
        selection.clear();
        for (const id of ids) selection.add(id);
        toolbar.refresh();
      },
      columns: [
        { id: 'name', label: 'models.harness.title', sortable: true, value: (p) => p.name },
        { id: 'command', label: 'models.harness.command', sortable: true, value: (p) => p.command },
        { id: 'model', label: 'models.chat.model', sortable: true, value: (p) => p.modelRef || '—' },
        { id: 'launched', label: 'models.harness.launch', sortable: true, value: (p) => p.lastLaunchAt ?? '', render: (p) => (p.lastLaunchAt ? formatTimestamp(p.lastLaunchAt) : '—') },
        {
          id: 'actions',
          label: 'core.action.more',
          render: (p) => {
            const row = el('div', { className: 'models-panel__toolbar' });
            row.append(
              ctx.components.iconButton({ icon: 'copy', label: ctx.t('models.harness.duplicate', 'Duplicate'), onClick: () => void doDuplicate(p) })
            );
            if (!p.builtin) {
              row.append(
                ctx.components.iconButton({ icon: 'edit', label: ctx.t('models.harness.edit', 'Edit'), onClick: () => void openEditor(p) }),
                ctx.components.iconButton({ icon: 'check', label: ctx.t('models.harness.preflight', 'Run the preflight'), onClick: () => void doPreflight(p) })
              );
            }
            return row;
          }
        }
      ]
    });
    scroll.append(table.root);
    filtered = all;
    table.setRows(filtered);
    toolbar.refresh();

    async function doDeleteSelected(anchor: HTMLElement): Promise<void> {
      const ids = [...selection].filter((id) => models.profiles.some((p) => p.id === id));
      if (ids.length === 0) {
        ctx.notify.info(ctx.t('models.harness.delete', 'Delete the profile'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
        return;
      }
      const affected = models.profiles.filter((p) => ids.includes(p.id)).map((p) => p.name);
      const approved = await ctx.confirm.request({
        action: ctx.t('models.confirm.deleteProfilesAction', 'Delete {count} harness profile(s)', { values: { count: ids.length } }),
        affected: boundedAffected(affected),
        irreversible: ctx.t('models.confirm.deleteProfilesIrreversible', 'The profiles are removed. Their launch snapshots stay in the snapshot list below and can still be restored into a new profile.'),
        anchor
      });
      if (!approved) return;
      models.profiles = models.profiles.filter((p) => !ids.includes(p.id));
      models.saveProfiles();
      await ctx.history.record(`Deleted ${ids.length} harness profiles`, 'models', { ids });
      selection.clear();
      renderList();
    }

    async function doExportSelected(): Promise<void> {
      const rows = (selection.size > 0 ? all.filter((p) => selection.has(p.id)) : filtered).map((p) => ({
        ...p,
        args: JSON.stringify(p.args),
        environment: JSON.stringify(redactedEnvironment(p, p.modelRef, models.runtimeConfig().baseUrl))
      }));
      const format = models.exportFormat();
      const path = await ctx.exporter.save(rows, format, { name: 'harness-profiles', defaultFileName: `harness-profiles.${format}` });
      if (path) ctx.notify.success(ctx.t('models.action.export', 'Export'), ctx.t('models.notice.exported', 'Written to {path}.', { values: { path } }));
    }
  }

  async function doDuplicate(source: HarnessProfile): Promise<void> {
    const copy: HarnessProfile = {
      ...source,
      id: newId('profile'),
      builtin: false,
      name: `${source.name} (copy)`,
      args: source.args.map((a) => ({ ...a })),
      environment: source.environment.map((e) => ({ ...e })),
      requiredPorts: [...source.requiredPorts],
      requiredFiles: [...source.requiredFiles],
      updatedAt: nowIso(),
      lastLaunchAt: null,
      lastOutcome: null
    };
    await openEditor(copy, true);
  }

  /* ================================================================ */
  /* Editor                                                             */
  /* ================================================================ */

  async function openEditor(existing: HarnessProfile | null, isNewCopy = false): Promise<void> {
    const draft: HarnessProfile = existing ? { ...existing, args: existing.args.map((a) => ({ ...a })), environment: existing.environment.map((e) => ({ ...e })), requiredPorts: [...existing.requiredPorts], requiredFiles: [...existing.requiredFiles] } : blankProfile();

    for (;;) {
      const body = el('div', { className: 'models-harness-form' });

      const nameField = ctx.components.textField({ label: 'models.harness.nameField', value: draft.name, onCommit: (v) => (draft.name = v) });
      const descriptionField = ctx.components.textField({ label: 'models.harness.descriptionField', value: draft.description, multiline: true, rows: 2, onCommit: (v) => (draft.description = v) });
      const commandSelect = ctx.components.select({
        label: 'models.harness.command',
        value: draft.command,
        options: ALLOWED_COMMANDS.map((c) => ({ value: c, label: c })),
        onChange: (v) => (draft.command = v)
      });
      const cwdField = ctx.components.textField({ label: 'models.harness.cwd', value: draft.workingDirectory, browse: 'folder', onCommit: (v) => (draft.workingDirectory = v) });
      const modelSelect = ctx.components.select({
        label: 'models.chat.model',
        value: draft.modelRef,
        options: [{ value: '', label: ctx.t('models.harness.chooseAtLaunch', 'Choose at launch') }, ...models.installedNames().map((n) => ({ value: n, label: n }))],
        onChange: (v) => (draft.modelRef = v)
      });
      const markerField = ctx.components.textField({ label: 'models.harness.marker', value: draft.readinessMarker, onCommit: (v) => (draft.readinessMarker = v) });
      const settleField = ctx.components.textField({ label: 'models.harness.settle', value: String(draft.settleSeconds), type: 'number', onCommit: (v) => (draft.settleSeconds = Math.min(120, Math.max(1, Math.round(Number(v)) || draft.settleSeconds))) });
      const portsField = ctx.components.textField({
        label: 'models.harness.ports',
        value: draft.requiredPorts.join(', '),
        supportingText: ctx.t('models.harness.ports.hint', 'Comma-separated port numbers'),
        onCommit: (v) => (draft.requiredPorts = v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0))
      });
      const filesField = ctx.components.textField({
        label: 'models.harness.files',
        value: draft.requiredFiles.join(', '),
        supportingText: ctx.t('models.harness.files.hint', 'Comma-separated relative file names'),
        onCommit: (v) => (draft.requiredFiles = v.split(',').map((s) => s.trim()).filter((s) => s !== ''))
      });

      body.append(nameField.root, descriptionField.root, commandSelect.root, cwdField.root, modelSelect.root, markerField.root, settleField.root, portsField.root, filesField.root);

      if (draft.command === 'npm' && draft.workingDirectory.trim() !== '') {
        body.append(
          ctx.components.button({
            label: 'models.harness.detectScripts',
            variant: 'text',
            icon: 'search',
            onClick: () => void doDetectScripts(draft)
          })
        );
      }

      const argsHost = el('div', { className: 'models-harness-form' });
      body.append(el('h3', { className: 'md-typescale-title-small', text: ctx.t('models.harness.args', 'Arguments') }), argsHost);
      renderArgs(argsHost, draft);

      const envHost = el('div', { className: 'models-harness-form' });
      body.append(el('h3', { className: 'md-typescale-title-small', text: ctx.t('models.harness.env', 'Environment') }), envHost);
      renderEnvironment(envHost, draft);

      const confirmed = await ctx.components.dialog({
        title: ctx.t(existing && !isNewCopy ? 'models.harness.edit' : 'models.harness.new', existing && !isNewCopy ? 'Edit' : 'New profile'),
        body,
        confirmLabel: 'core.action.save'
      });
      if (!confirmed) return;

      const issues = validateProfile(draft);
      if (issues.length > 0) {
        ctx.notify.error(
          ctx.t('core.action.save', 'Save'),
          issues.map((issue) => `${issue.field}: ${issue.message}`).join(' ')
        );
        isNewCopy = false;
        continue;
      }

      const index = models.profiles.findIndex((p) => p.id === draft.id);
      draft.updatedAt = nowIso();
      if (index >= 0) {
        models.profiles[index] = draft;
      } else {
        models.profiles = [...models.profiles, draft];
      }
      models.saveProfiles();
      await ctx.history.record(existing && index >= 0 ? `Edited the harness profile ${draft.name}` : `Created the harness profile ${draft.name}`, 'models', { id: draft.id, name: draft.name });
      renderList();
      return;
    }
  }

  function renderArgs(hostEl: HTMLElement, draft: HarnessProfile): void {
    hostEl.textContent = '';
    draft.args.forEach((argument, index) => {
      const row = el('div', { className: 'models-harness-row' });
      const kindSelect = ctx.components.select({
        label: 'models.harness.argKind',
        value: argument.kind,
        options: [
          { value: 'literal', label: ctx.t('models.harness.argKind.literal', 'Literal text') },
          { value: 'path', label: ctx.t('models.harness.argKind.path', 'Path (browse)') },
          { value: 'number', label: ctx.t('models.harness.argKind.number', 'Number') },
          { value: 'model', label: ctx.t('models.harness.argKind.model', 'The chosen model') },
          { value: 'runtimeUrl', label: ctx.t('models.harness.argKind.runtimeUrl', 'The runtime address') }
        ],
        onChange: (v) => {
          draft.args[index] = defaultArgumentFor(v as HarnessArgument['kind']);
          renderArgs(hostEl, draft);
        }
      });
      row.append(kindSelect.root);
      if (argument.kind === 'literal') {
        row.append(ctx.components.textField({ label: 'models.copy.field', value: argument.value, onCommit: (v) => (draft.args[index] = { kind: 'literal', value: v }) }).root);
      } else if (argument.kind === 'path') {
        row.append(ctx.components.textField({ label: 'models.harness.cwd', value: argument.value, browse: 'both', onCommit: (v) => (draft.args[index] = { kind: 'path', value: v }) }).root);
      } else if (argument.kind === 'number') {
        row.append(ctx.components.textField({ label: 'models.copy.field', value: String(argument.value), type: 'number', onCommit: (v) => (draft.args[index] = { kind: 'number', value: Number(v) || 0 }) }).root);
      }
      row.append(
        ctx.components.iconButton({
          icon: 'remove',
          label: ctx.t('models.harness.removeArg', 'Remove this argument'),
          onClick: () => {
            draft.args.splice(index, 1);
            renderArgs(hostEl, draft);
          }
        })
      );
      hostEl.append(row);
    });
    hostEl.append(
      ctx.components.button({
        label: 'models.harness.addArg',
        variant: 'text',
        icon: 'add',
        onClick: () => {
          draft.args.push(defaultArgumentFor('literal'));
          renderArgs(hostEl, draft);
        }
      })
    );
  }

  function renderEnvironment(hostEl: HTMLElement, draft: HarnessProfile): void {
    hostEl.textContent = '';
    draft.environment.forEach((entry, index) => {
      const row = el('div', { className: 'models-harness-row' });
      const keySelect = ctx.components.select({
        label: 'models.harness.envKey',
        value: entry.key,
        options: ALLOWED_ENVIRONMENT_KEYS.map((k) => ({ value: k, label: k })),
        onChange: (v) => (draft.environment[index] = { ...entry, key: v })
      });
      const sourceSelect = ctx.components.select({
        label: 'models.harness.envSource',
        value: entry.source,
        options: [
          { value: 'literal', label: ctx.t('models.harness.envSource.literal', 'A literal value') },
          { value: 'vault', label: ctx.t('models.harness.envSource.vault', 'An operating system vault account') }
        ],
        onChange: (v) => {
          draft.environment[index] = { ...draft.environment[index], source: v as HarnessEnvironmentEntry['source'] };
        }
      });
      const valueField = ctx.components.textField({ label: 'models.harness.envValue', value: entry.value, onCommit: (v) => (draft.environment[index] = { ...draft.environment[index], value: v }) });
      row.append(
        keySelect.root,
        sourceSelect.root,
        valueField.root,
        ctx.components.iconButton({
          icon: 'remove',
          label: ctx.t('models.harness.removeEnv', 'Remove this entry'),
          onClick: () => {
            draft.environment.splice(index, 1);
            renderEnvironment(hostEl, draft);
          }
        })
      );
      hostEl.append(row);
    });
    hostEl.append(
      ctx.components.button({
        label: 'models.harness.addEnv',
        variant: 'text',
        icon: 'add',
        onClick: () => {
          draft.environment.push({ key: ALLOWED_ENVIRONMENT_KEYS[0], source: 'literal', value: '' });
          renderEnvironment(hostEl, draft);
        }
      })
    );
  }

  async function doDetectScripts(draft: HarnessProfile): Promise<void> {
    const result = await readNpmScripts(ctx.studio, draft.workingDirectory);
    if (!result.ok) {
      ctx.notify.error(ctx.t('models.harness.detectScripts', 'Detect npm scripts'), result.error);
      return;
    }
    const select = ctx.components.select({ label: 'models.harness.scriptsField', value: result.value[0], options: result.value.map((s) => ({ value: s, label: s })) });
    const body = el('div');
    body.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('models.harness.scriptsRead', '{count} scripts were read from {path}.', { values: { count: result.value.length, path: draft.workingDirectory } }) }), select.root);
    const confirmed = await ctx.components.dialog({ title: ctx.t('models.harness.scriptsField', 'Script'), body, confirmLabel: 'core.action.apply' });
    if (!confirmed) return;
    draft.args.push({ kind: 'literal', value: select.get() });
    ctx.notify.info(ctx.t('models.harness.scriptsField', 'Script'), select.get());
  }

  /* ================================================================ */
  /* Preflight and launch                                              */
  /* ================================================================ */

  async function doPreflight(profile: HarnessProfile): Promise<void> {
    const report = await preflight(models, profile, profile.modelRef);
    await showPreflightDialog(profile, report);
  }

  async function showPreflightDialog(profile: HarnessProfile, report: PreflightReport): Promise<void> {
    const body = el('div', { className: 'models-harness-form' });
    for (const check of report.checks) {
      const row = el('div', { className: 'models-check-row' });
      const icon = check.status === 'pass' ? 'success' : check.status === 'blocked' ? 'error' : 'info';
      const statusLabel =
        check.status === 'pass'
          ? ctx.t('models.harness.check.pass', 'Passed')
          : check.status === 'blocked'
            ? ctx.t('models.harness.check.blocked', 'Blocked')
            : ctx.t('models.harness.check.unchecked', 'Not checked');
      row.append(
        el('span', { className: 'models-check-row__status', children: [ctx.components.icon(icon, { label: statusLabel })] }),
        el('div', { className: 'models-check-row__body', children: [el('p', { className: 'md-typescale-body-medium', text: check.label }), el('p', { className: 'md-typescale-body-small models-muted', text: check.detail })] })
      );
      body.append(row);
    }
    body.append(el('h3', { className: 'md-typescale-title-small', text: ctx.t('models.harness.preview', 'Exactly what will run') }));
    body.append(el('pre', { className: 'models-preview', text: `${report.command} ${report.args.join(' ')}` }));
    const envList = el('ul', { className: 'models-reasoning' });
    for (const entry of report.environment) envList.append(el('li', { className: 'md-typescale-body-small', text: `${entry.key} = ${entry.display}` }));
    body.append(envList, el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.harness.secretNote', 'A secret is read from the operating system vault at the moment of launch and is never written into a snapshot, a log, an export, this preview or the settings file.') }));

    if (report.blockers.length > 0) {
      const blockers = el('div', { className: 'models-gaps' });
      blockers.append(el('p', { className: 'md-typescale-title-small', text: ctx.t('models.harness.blockers', 'What is stopping it') }));
      for (const blocker of report.blockers) blockers.append(el('p', { className: 'md-typescale-body-small', text: blocker }));
      body.append(blockers);
    } else {
      body.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('models.harness.ready', 'Everything the preflight can check passed.') }));
    }

    const confirmed = await ctx.components.dialog({
      title: ctx.t('models.harness.preflight', 'Run the preflight'),
      body,
      confirmLabel: 'models.harness.launch',
      cancelLabel: 'core.action.close'
    });
    if (!confirmed) return;
    if (report.blockers.length > 0) {
      ctx.notify.error(ctx.t('models.harness.launch', 'Launch'), report.blockers.join(' '));
      return;
    }
    await doLaunch(profile);
  }

  async function doLaunch(profile: HarnessProfile): Promise<void> {
    const outcome = await launchProfile(ctx.studio, models, profile, profile.modelRef);
    if (outcome.ready) {
      ctx.notify.success(ctx.t('models.harness.launched', '{name} started. {summary}', { values: { name: profile.name, summary: outcome.summary } }), '');
    } else {
      ctx.notify.error(ctx.t('models.harness.launchFailed', '{name} did not become ready. {summary}', { values: { name: profile.name, summary: outcome.summary } }), '');
    }
    await ctx.history.record(`Launched the harness profile ${profile.name}`, 'models', { id: profile.id, ready: outcome.ready, rolledBack: outcome.rolledBack });
    renderList();
    renderSnapshots();
  }

  /* ================================================================ */
  /* Snapshots                                                          */
  /* ================================================================ */

  function renderSnapshots(): void {
    snapshotSection.textContent = '';
    snapshotSection.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('models.harness.snapshots', 'Snapshots') }));
    if (models.snapshots.length === 0) {
      snapshotSection.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.notice.nothingSelected', 'Nothing is selected.') }));
      return;
    }
    const scroll = el('div', { className: 'models-scroll' });
    snapshotSection.append(scroll);
    const snapTable = ctx.components.dataTable<HarnessSnapshot>({
      label: 'models.harness.snapshots',
      rowId: (s) => s.id,
      rows: models.snapshots,
      columns: [
        { id: 'profile', label: 'models.harness.title', sortable: true, value: (s) => s.profile.name },
        { id: 'reason', label: 'core.action.more', value: (s) => s.reason },
        { id: 'takenAt', label: 'models.column.modified', sortable: true, value: (s) => s.takenAt, render: (s) => formatTimestamp(s.takenAt) },
        {
          id: 'restore',
          label: 'models.harness.restore',
          render: (s) =>
            ctx.components.button({
              label: 'models.harness.restore',
              variant: 'text',
              onClick: (event) => void doRestore(s, event.currentTarget as HTMLElement)
            })
        }
      ]
    });
    scroll.append(snapTable.root);
  }

  async function doRestore(snapshot: HarnessSnapshot, anchor: HTMLElement): Promise<void> {
    const approved = await ctx.confirm.request({
      action: ctx.t('models.confirm.restoreAction', 'Restore the snapshot of {name} taken at {time}', { values: { name: snapshot.profile.name, time: formatTimestamp(snapshot.takenAt) } }),
      affected: [snapshot.profile.name],
      irreversible: ctx.t('models.confirm.restoreIrreversible', 'The profile’s current fields are replaced by the snapshot. The state being replaced is itself kept as a new snapshot, so this can be undone the same way.'),
      anchor
    });
    if (!approved) return;
    const result = restoreSnapshot(models, snapshot);
    if (!result.ok) {
      ctx.notify.error(ctx.t('models.harness.restore', 'Restore this snapshot'), result.error ?? '');
      return;
    }
    await ctx.history.record(`Restored the harness profile ${snapshot.profile.name} from a snapshot`, 'models', { id: snapshot.profileId, snapshotId: snapshot.id });
    ctx.notify.success(ctx.t('models.harness.restore', 'Restore this snapshot'), snapshot.profile.name);
    renderList();
    renderSnapshots();
  }

  renderList();
  renderSnapshots();

  const unsubscribe = models.on((event) => {
    if (event === 'harness') {
      renderList();
      renderSnapshots();
    }
  });
  ctx.onDispose(unsubscribe);
}
