import { el } from '../../core/a11y';
import { components } from '../../core/components';
import { guidedTextField } from '../../core/forms';
import type { AppContext, MenuItem } from '../../core/types';
import { shell } from '../index';
import type { ScreenDefinition } from '../types';

import './hosts.css';

/**
 * Hosts (design lines 321-391): saved SSH machines this build can run the
 * downloader on, per-host capability detection evidence, and a run mode of
 * Docker / No Docker / Auto-detect.
 *
 * `AppContext.studio` (`app/src/shared/api.ts`) has no SSH namespace at all —
 * no connect, no exec, no probe. So this screen renders honestly rather than
 * pretending: saving a host, editing its connection fields, choosing its run
 * mode and forgetting it are real, local, `ctx.settings`-backed actions with
 * no network implication whatsoever; "Deploy and run here", "Re-run
 * detection", "Test the connection", "Open a shell" and "Follow" are real
 * buttons that are honestly DISABLED, each with its own
 * `disabledReason` naming the exact missing capability, because there is no
 * `ctx.studio` call to route them through and nothing here will fabricate a
 * success. Every detection row therefore reads "Not checked — no detection
 * has run" forever in this build: a host that has not been probed says so, it
 * never shows a guessed verdict.
 */

/* ================================================================== */
/* Storage                                                             */
/* ================================================================== */

const HOSTS_SETTING_ID = 'hosts.records';
const SELECTED_HOST_SETTING_ID = 'hosts.selectedId';
/** Read opportunistically: a future Settings > Hosts tab may declare this. */
const DEFAULT_RUN_MODE_SETTING_ID = 'hosts.runMode';

type RunMode = 'auto' | 'docker' | 'native';
type DetectionKey = 'docker' | 'java' | 'systemd' | 'arch' | 'disk' | 'port';
type DeployKey = 'image' | 'dataDir' | 'ports' | 'restart';
type LogKind = 'created' | 'edited' | 'forgotten';

interface DetectionCheck {
  key: DetectionKey;
  /** Raw, untranslated probe result. Null means "never probed". */
  value: string | null;
  ok: boolean | null;
}

interface DeployField {
  key: DeployKey;
  /** Raw, untranslated planned value. Null means "not yet determined". */
  value: string | null;
}

interface LogLine {
  /** ISO-8601, or '' for the placeholder line written before anything real happened. */
  time: string;
  kind: LogKind;
}

interface HostRecord {
  id: string;
  name: string;
  /** "user@host". */
  addr: string;
  port: string;
  /** Empty means "ask for a password at each connection"; otherwise a key path. */
  keyPath: string;
  /** Set only once a connection is actually made and a key is actually seen — never in this build. */
  fingerprint: string | null;
  /** Never true in this build: nothing here can actually open a connection. */
  connected: boolean;
  runMode: RunMode;
  detect: DetectionCheck[];
  deploy: DeployField[];
  log: LogLine[];
  createdAt: string;
  updatedAt: string;
}

const DETECTION_KEYS: DetectionKey[] = ['docker', 'java', 'systemd', 'arch', 'disk', 'port'];
const DEPLOY_KEYS: DeployKey[] = ['image', 'dataDir', 'ports', 'restart'];

function freshDetect(): DetectionCheck[] {
  return DETECTION_KEYS.map((key) => ({ key, value: null, ok: null }));
}

function freshDeploy(): DeployField[] {
  return DEPLOY_KEYS.map((key) => ({ key, value: null }));
}

function validRunMode(value: unknown): RunMode {
  return value === 'docker' || value === 'native' ? value : 'auto';
}

let idCounter = 0;
function newHostId(): string {
  idCounter += 1;
  return `host-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

function normalizeDetect(raw: unknown): DetectionCheck[] {
  const items = asRecordArray(raw);
  return DETECTION_KEYS.map((key) => {
    const found = items.find((item) => item.key === key);
    return {
      key,
      value: found && typeof found.value === 'string' ? found.value : null,
      ok: found && typeof found.ok === 'boolean' ? found.ok : null
    };
  });
}

function normalizeDeploy(raw: unknown): DeployField[] {
  const items = asRecordArray(raw);
  return DEPLOY_KEYS.map((key) => {
    const found = items.find((item) => item.key === key);
    return { key, value: found && typeof found.value === 'string' ? found.value : null };
  });
}

function normalizeLog(raw: unknown): LogLine[] {
  const items = asRecordArray(raw).map((item) => ({
    time: typeof item.time === 'string' ? item.time : '',
    kind: item.kind === 'edited' || item.kind === 'forgotten' ? (item.kind as LogKind) : ('created' as const)
  }));
  return items.length > 0 ? items : [{ time: '', kind: 'created' }];
}

function readHosts(ctx: AppContext): HostRecord[] {
  const stored = ctx.settings.get<unknown>(HOSTS_SETTING_ID, []);
  const hosts: HostRecord[] = [];
  for (const raw of asRecordArray(stored)) {
    const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : newHostId();
    const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : 'Unnamed host';
    hosts.push({
      id,
      name,
      addr: typeof raw.addr === 'string' && raw.addr.trim() !== '' ? raw.addr : 'user@host',
      port: typeof raw.port === 'string' && raw.port.trim() !== '' ? raw.port : '22',
      keyPath: typeof raw.keyPath === 'string' ? raw.keyPath : '',
      fingerprint: typeof raw.fingerprint === 'string' ? raw.fingerprint : null,
      connected: raw.connected === true,
      runMode: validRunMode(raw.runMode),
      detect: normalizeDetect(raw.detect),
      deploy: normalizeDeploy(raw.deploy),
      log: normalizeLog(raw.log),
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString()
    });
  }
  return hosts;
}

function writeHosts(ctx: AppContext, hosts: HostRecord[]): void {
  ctx.settings.set(HOSTS_SETTING_ID, hosts);
}

function selectedHostId(ctx: AppContext): string {
  return ctx.settings.get<string>(SELECTED_HOST_SETTING_ID, '');
}

function setSelectedHostId(ctx: AppContext, id: string | null): void {
  ctx.settings.set(SELECTED_HOST_SETTING_ID, id ?? '');
}

/* ================================================================== */
/* Copy resolution (translated at render time, never persisted)        */
/* ================================================================== */

function noSshReason(ctx: AppContext): string {
  return ctx.t(
    'shell.screen.hosts.action.noSshChannel',
    "This build's privileged bridge has no SSH connection channel yet, so this cannot run for real. Nothing on the host is touched."
  );
}

function detectionLabel(ctx: AppContext, key: DetectionKey): string {
  if (key === 'docker') return ctx.t('shell.screen.hosts.detect.docker', 'Docker Engine');
  if (key === 'java') return ctx.t('shell.screen.hosts.detect.java', 'Java runtime');
  if (key === 'systemd') return ctx.t('shell.screen.hosts.detect.systemd', 'systemd');
  if (key === 'arch') return ctx.t('shell.screen.hosts.detect.arch', 'Architecture');
  if (key === 'disk') return ctx.t('shell.screen.hosts.detect.disk', 'Free disk');
  return ctx.t('shell.screen.hosts.detect.port', 'Port 25565');
}

function detectionValue(ctx: AppContext, check: DetectionCheck): string {
  return check.value ?? ctx.t('shell.screen.hosts.detect.notChecked', 'Not checked — no detection has run');
}

function deployLabel(ctx: AppContext, key: DeployKey): string {
  if (key === 'image') return ctx.t('shell.screen.hosts.deploy.image', 'Image or jar');
  if (key === 'dataDir') return ctx.t('shell.screen.hosts.deploy.dataDir', 'Data directory');
  if (key === 'ports') return ctx.t('shell.screen.hosts.deploy.ports', 'Published ports');
  return ctx.t('shell.screen.hosts.deploy.restart', 'Restart policy');
}

function deployValue(ctx: AppContext, field: DeployField): string {
  return field.value ?? ctx.t('shell.screen.hosts.deploy.pending', 'Not yet determined — no detection has run');
}

function authSummary(ctx: AppContext, host: HostRecord): string {
  const key = host.keyPath.trim();
  if (key !== '') return `${ctx.t('shell.screen.hosts.auth.key', 'Key')} · ${key}`;
  return ctx.t('shell.screen.hosts.auth.password', 'Password · asked at each connection');
}

function fingerprintSummary(ctx: AppContext, host: HostRecord): string {
  return host.fingerprint ?? ctx.t('shell.screen.hosts.fingerprint.untrusted', 'not trusted yet');
}

function runModeLabel(ctx: AppContext, mode: RunMode): string {
  if (mode === 'docker') return ctx.t('shell.screen.hosts.mode.docker', 'Docker');
  if (mode === 'native') return ctx.t('shell.screen.hosts.mode.native', 'No Docker');
  return ctx.t('shell.screen.hosts.mode.auto', 'auto-detected');
}

function detectedBadge(ctx: AppContext, host: HostRecord): string {
  const dockerCheck = host.detect.find((check) => check.key === 'docker');
  if (dockerCheck?.ok === true) return ctx.t('shell.screen.hosts.badge.docker', 'DOCKER');
  if (dockerCheck?.ok === false) return ctx.t('shell.screen.hosts.badge.native', 'NO DOCKER');
  return ctx.t('shell.screen.hosts.badge.unknown', 'NOT PROBED');
}

function verdictText(ctx: AppContext, host: HostRecord): string {
  const dockerCheck = host.detect.find((check) => check.key === 'docker');
  if (dockerCheck?.ok === true) {
    return ctx.t(
      'shell.screen.hosts.verdict.docker',
      'Docker answered on the machine itself, so the container route is chosen. Nothing is assumed from the hostname.'
    );
  }
  if (dockerCheck?.ok === false) {
    return ctx.t(
      'shell.screen.hosts.verdict.native',
      'No Docker was found on this machine, so the jar would run directly instead.'
    );
  }
  return ctx.t(
    'shell.screen.hosts.verdict.unprobed',
    'Nothing has been checked on this host yet. This build cannot run a detection pass — the privileged bridge has no SSH connection channel — so no run mode is chosen automatically. Pick Docker or No Docker yourself below if you already know which applies.'
  );
}

function logLineText(ctx: AppContext, line: LogLine): string {
  if (line.kind === 'edited') {
    return ctx.t(
      'shell.screen.hosts.log.edited',
      'Connection details were edited locally. No connection to the host has been attempted.'
    );
  }
  if (line.kind === 'forgotten') {
    return ctx.t('shell.screen.hosts.log.forgotten', 'This host was forgotten.');
  }
  return ctx.t('shell.screen.hosts.log.created', 'No connection has been made to this host.');
}

function logLineTime(line: LogLine): string {
  if (line.time === '') return '—';
  const date = new Date(line.time);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ================================================================== */
/* Real, local actions                                                 */
/* ================================================================== */

async function copySshCommand(ctx: AppContext, host: HostRecord): Promise<void> {
  const command = `ssh ${host.addr} -p ${host.port}`;
  try {
    await navigator.clipboard.writeText(command);
    ctx.notify.success(ctx.t('shell.screen.hosts.copy.success', 'The ssh command is on the clipboard'), command);
  } catch (error) {
    ctx.notify.error(
      ctx.t('shell.screen.hosts.copy.failed', 'The clipboard refused the text'),
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function forgetHost(ctx: AppContext, host: HostRecord, anchor: HTMLElement): Promise<void> {
  const approved = await ctx.confirm.request({
    action: ctx.t('shell.screen.hosts.forget.action', 'Forget {name}', { values: { name: host.name } }),
    affected: [`${host.name} — ssh ${host.addr} -p ${host.port}`],
    irreversible: ctx.t(
      'shell.screen.hosts.forget.irreversible',
      'The saved connection, its key reference and its detection record are removed from this machine. The machine itself is untouched.'
    ),
    anchor
  });
  if (!approved) return;

  const hosts = readHosts(ctx);
  const remaining = hosts.filter((candidate) => candidate.id !== host.id);
  writeHosts(ctx, remaining);
  if (selectedHostId(ctx) === host.id) {
    setSelectedHostId(ctx, remaining[0]?.id ?? null);
  }
  await ctx.history.record('Forgot an SSH host', 'hosts', { id: host.id, name: host.name });
  ctx.notify.success(ctx.t('shell.screen.hosts.forget.done', 'Forgot {name}', { values: { name: host.name } }));
}

/**
 * "Add an SSH host": nothing is assumed about the machine, and nothing is
 * probed — only a name, an address, a port and how to authenticate, saved
 * locally with an honest never-connected/never-checked state.
 */
async function openAddHostDialog(ctx: AppContext): Promise<void> {
  const body = el('div', { className: 'wds-hosts-form' });
  body.append(
    el('p', {
      className: 'md-typescale-body-medium wds-hosts-form__lede',
      text: ctx.t(
        'shell.screen.hosts.add.lede',
        'Nothing is assumed about the machine. Capabilities would be detected on it after the first connection — once a build of this application can make one.'
      )
    })
  );

  const nameField = guidedTextField({
    label: ctx.t('shell.screen.hosts.add.name', 'Name'),
    supportingText: ctx.t('shell.screen.hosts.add.name.hint', 'How it appears in this list.'),
    validate: (value) =>
      value.trim() === '' ? ctx.t('shell.screen.hosts.add.name.required', 'Give the host a name.') : null
  });
  const addrField = components.textField({
    label: ctx.t('shell.screen.hosts.add.addr', 'user@host'),
    supportingText: ctx.t('shell.screen.hosts.add.addr.hint', 'The address this host is reached at.')
  });
  const portField = components.textField({
    label: ctx.t('shell.screen.hosts.add.port', 'Port'),
    value: '22',
    supportingText: ctx.t('shell.screen.hosts.add.port.hint', '22 unless it was changed.')
  });
  const authField = components.textField({
    label: ctx.t('shell.screen.hosts.add.auth', 'Key path'),
    browse: 'file',
    supportingText: ctx.t(
      'shell.screen.hosts.add.auth.hint',
      'Leave blank to be asked for a password at each connection.'
    )
  });
  body.append(nameField.root, addrField.root, portField.root, authField.root);

  const confirmed = await components.dialog({
    title: ctx.t('shell.screen.hosts.add.title', 'Add an SSH host'),
    icon: 'cloud',
    body,
    confirmLabel: ctx.t('shell.screen.hosts.add.confirm', 'Save the host'),
    cancelLabel: ctx.t('core.action.cancel', 'Cancel')
  });
  if (!confirmed) return;
  if (!nameField.revalidate()) {
    ctx.notify.error(
      ctx.t('shell.screen.hosts.add.failedTitle', 'The host was not saved'),
      ctx.t('shell.screen.hosts.add.name.required', 'Give the host a name.')
    );
    return;
  }

  const now = new Date().toISOString();
  const record: HostRecord = {
    id: newHostId(),
    name: nameField.get().trim(),
    addr: addrField.get().trim() || 'user@host',
    port: portField.get().trim() || '22',
    keyPath: authField.get().trim(),
    fingerprint: null,
    connected: false,
    runMode: validRunMode(ctx.settings.get<string>(DEFAULT_RUN_MODE_SETTING_ID, 'auto')),
    detect: freshDetect(),
    deploy: freshDeploy(),
    log: [{ time: now, kind: 'created' }],
    createdAt: now,
    updatedAt: now
  };

  const hosts = readHosts(ctx);
  hosts.unshift(record);
  writeHosts(ctx, hosts);
  setSelectedHostId(ctx, record.id);
  await ctx.history.record('Added an SSH host', 'hosts', { id: record.id, name: record.name });
  ctx.notify.success(ctx.t('shell.screen.hosts.add.done', 'Saved {name}', { values: { name: record.name } }));
}

/**
 * "Edit the connection": a real, local edit of the address/port/key path.
 * Changing the address invalidates any previously trusted host key, because
 * an old trust decision cannot honestly carry over to what may now be a
 * different machine entirely.
 */
async function openEditConnectionDialog(ctx: AppContext, host: HostRecord): Promise<void> {
  const body = el('div', { className: 'wds-hosts-form' });
  const addrField = components.textField({ label: ctx.t('shell.screen.hosts.add.addr', 'user@host'), value: host.addr });
  const portField = components.textField({ label: ctx.t('shell.screen.hosts.add.port', 'Port'), value: host.port });
  const authField = components.textField({
    label: ctx.t('shell.screen.hosts.add.auth', 'Key path'),
    value: host.keyPath,
    browse: 'file',
    supportingText: ctx.t(
      'shell.screen.hosts.add.auth.hint',
      'Leave blank to be asked for a password at each connection.'
    )
  });
  body.append(addrField.root, portField.root, authField.root);

  const confirmed = await components.dialog({
    title: ctx.t('shell.screen.hosts.edit.title', 'Edit the connection'),
    icon: 'edit',
    body,
    confirmLabel: ctx.t('core.action.save', 'Save'),
    cancelLabel: ctx.t('core.action.cancel', 'Cancel')
  });
  if (!confirmed) return;

  const newAddr = addrField.get().trim() || 'user@host';
  const newPort = portField.get().trim() || '22';
  const newKeyPath = authField.get().trim();
  const addressChanged = newAddr !== host.addr || newPort !== host.port;

  const hosts = readHosts(ctx);
  const index = hosts.findIndex((candidate) => candidate.id === host.id);
  if (index === -1) return;
  const now = new Date().toISOString();
  hosts[index] = {
    ...hosts[index],
    addr: newAddr,
    port: newPort,
    keyPath: newKeyPath,
    fingerprint: addressChanged ? null : hosts[index].fingerprint,
    connected: addressChanged ? false : hosts[index].connected,
    updatedAt: now,
    log: [{ time: now, kind: 'edited' }, ...hosts[index].log]
  };
  writeHosts(ctx, hosts);
  await ctx.history.record('Edited an SSH host connection', 'hosts', { id: host.id, name: host.name });
  ctx.notify.success(
    ctx.t('shell.screen.hosts.edit.done', 'Updated the connection for {name}', { values: { name: host.name } })
  );
}

/** The right-click menu on a host row or the detail header (design's `data-menu="host"`). */
function openHostMenu(ctx: AppContext, host: HostRecord, anchor: HTMLElement): void {
  const items: MenuItem[] = [
    {
      id: 'deploy',
      label: ctx.t('shell.screen.hosts.action.deploy', 'Deploy and run here'),
      icon: 'download',
      disabled: true,
      disabledReason: noSshReason(ctx)
    },
    {
      id: 'redetect',
      label: ctx.t('shell.screen.hosts.action.redetect', 'Re-run detection'),
      icon: 'refresh',
      disabled: true,
      disabledReason: noSshReason(ctx)
    },
    {
      id: 'shell',
      label: ctx.t('shell.screen.hosts.action.shell', 'Open a shell'),
      icon: 'terminal',
      disabled: true,
      disabledReason: noSshReason(ctx)
    },
    {
      id: 'copy',
      label: ctx.t('shell.screen.hosts.action.copySsh', 'Copy the ssh command'),
      icon: 'copy',
      separatorBefore: true,
      run: () => copySshCommand(ctx, host)
    },
    {
      id: 'forget',
      label: ctx.t('shell.screen.hosts.action.forget', 'Forget this host…'),
      icon: 'trash',
      danger: true,
      separatorBefore: true,
      run: () => forgetHost(ctx, host, anchor)
    }
  ];
  components.menu({
    anchor,
    items,
    label: ctx.t('shell.screen.hosts.action.menuLabel', '{name} actions', { values: { name: host.name } })
  });
}

/* ================================================================== */
/* Mounting                                                             */
/* ================================================================== */

function mount(hostElement: HTMLElement, ctx: AppContext): () => void {
  const root = el('div', { className: 'wds-hosts' });
  const sidebar = el('div', {
    className: 'wds-hosts__sidebar',
    attrs: { 'aria-label': ctx.t('shell.screen.hosts.sidebar.label', 'Saved SSH hosts') }
  });
  const detail = el('div', { className: 'wds-hosts__detail' });
  root.append(sidebar, detail);
  hostElement.append(root);

  let rowButtons: HTMLButtonElement[] = [];
  let currentMatch: (value: string) => boolean = () => true;
  let searchText = '';
  let disposeSearch: (() => void) | null = null;

  function updateSubtitle(): void {
    const hosts = readHosts(ctx);
    if (hosts.length === 0) {
      shell.setSubtitle('hosts', ctx.t('shell.screen.hosts.subtitle.empty', 'No hosts saved yet'));
      return;
    }
    const selected = hosts.find((candidate) => candidate.id === selectedHostId(ctx)) ?? hosts[0];
    shell.setSubtitle(
      'hosts',
      ctx.t('shell.screen.hosts.subtitle', '{count} saved · {name} · {state} · run mode {mode}', {
        values: {
          count: hosts.length,
          name: selected.name,
          state: selected.connected
            ? ctx.t('shell.screen.hosts.state.connected', 'Connected')
            : ctx.t('shell.screen.hosts.state.never', 'Never connected'),
          mode: runModeLabel(ctx, selected.runMode)
        }
      })
    );
  }

  function applyRowFilter(): void {
    const hosts = readHosts(ctx);
    rowButtons.forEach((button, index) => {
      const record = hosts[index];
      if (!record) return;
      const haystack = `${record.name} ${record.addr} ${detectedBadge(ctx, record)}`;
      button.hidden = !currentMatch(haystack);
    });
  }

  function buildSidebar(): void {
    sidebar.textContent = '';
    disposeSearch?.();
    disposeSearch = null;
    currentMatch = () => true;

    const hosts = readHosts(ctx);

    if (hosts.length > 0) {
      const search = ctx.createSearchBar({
        label: ctx.t('shell.screen.hosts.search', 'Search saved SSH hosts'),
        placeholder: ctx.t('shell.screen.hosts.search.placeholder', 'Search saved SSH hosts'),
        sample: hosts.map((record) => `${record.name}\n${record.addr}`).join('\n'),
        initialText: searchText,
        onChange: (query) => {
          searchText = query.text;
          currentMatch = query.matches;
          applyRowFilter();
        }
      });
      disposeSearch = () => search.destroy();
      sidebar.append(search.root);
    }

    const list = el('div', {
      className: 'wds-hosts__list',
      attrs: { role: 'list', 'aria-label': ctx.t('shell.screen.hosts.sidebar.label', 'Saved SSH hosts') }
    });
    sidebar.append(list);

    if (hosts.length === 0) {
      sidebar.append(
        components.emptyState({
          title: ctx.t('shell.screen.hosts.empty.title', 'No hosts saved yet'),
          body: ctx.t(
            'shell.screen.hosts.empty.body',
            'Add a machine you reach over SSH to keep its connection details here.'
          )
        })
      );
    }

    rowButtons = [];
    const selectedId = selectedHostId(ctx);
    for (const record of hosts) {
      const row = el('button', {
        className: 'md-list-item--card',
        attrs: { type: 'button', 'aria-selected': String(record.id === selectedId) }
      });
      row.append(
        el('span', {
          className: 'md-avatar',
          attrs: { 'aria-hidden': 'true' },
          text: record.name.trim().charAt(0).toUpperCase() || '?'
        })
      );
      const text = el('span', { className: 'wds-hosts-row__text' });
      text.append(
        el('b', { className: 'md-typescale-body-large', text: record.name }),
        el('span', { className: 'md-list-item__supporting wds-hosts-mono', text: record.addr })
      );
      row.append(text);
      row.append(el('span', { className: 'md-tag', text: detectedBadge(ctx, record) }));
      row.addEventListener('click', () => {
        setSelectedHostId(ctx, record.id);
      });
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        openHostMenu(ctx, record, row);
      });
      list.append(row);
      rowButtons.push(row);
    }
    ctx.a11y.roving(list, () => rowButtons.filter((button) => !button.hidden), 'vertical');

    sidebar.append(
      components.button({
        label: ctx.t('shell.screen.hosts.add.button', 'Add an SSH host'),
        variant: 'tonal',
        icon: 'add',
        onClick: () => void openAddHostDialog(ctx)
      })
    );

    applyRowFilter();
  }

  function buildDetail(): void {
    detail.textContent = '';
    const hosts = readHosts(ctx);

    if (hosts.length === 0) {
      detail.append(
        components.emptyState({
          title: ctx.t('shell.screen.hosts.detail.empty.title', 'No host selected'),
          body: ctx.t(
            'shell.screen.hosts.detail.empty.body',
            'Add an SSH host to see its connection and detection details here.'
          ),
          action: {
            label: ctx.t('shell.screen.hosts.add.button', 'Add an SSH host'),
            variant: 'tonal',
            icon: 'add',
            onClick: () => void openAddHostDialog(ctx)
          }
        })
      );
      return;
    }

    const requestedId = selectedHostId(ctx);
    const host = hosts.find((candidate) => candidate.id === requestedId) ?? hosts[0];
    if (host.id !== requestedId) setSelectedHostId(ctx, host.id);

    /* ---------------- hero ---------------- */

    const hero = el('div', { className: 'md-detail-hero' });
    const heroText = el('div', { className: 'md-detail-hero__text' });
    const heroTop = el('div', { className: 'wds-hosts-hero__top' });
    heroTop.append(
      el('span', {
        className: 'md-avatar md-avatar--lg',
        attrs: { 'aria-hidden': 'true' },
        text: host.name.trim().charAt(0).toUpperCase() || '?'
      })
    );
    const heroTextCol = el('div', { className: 'wds-hosts-hero__textcol' });
    const nameRow = el('div', { className: 'wds-hosts-hero__namerow' });
    nameRow.append(
      el('span', { className: 'md-detail-hero__title', text: host.name }),
      el('span', {
        className: `md-tag${host.connected ? ' md-tag--success' : ''}`,
        text: host.connected
          ? ctx.t('shell.screen.hosts.state.connected', 'Connected')
          : ctx.t('shell.screen.hosts.state.never', 'Never connected')
      })
    );
    heroTextCol.append(
      nameRow,
      el('div', {
        className: 'md-detail-hero__meta wds-hosts-mono',
        text: `ssh ${host.addr} -p ${host.port}`
      })
    );
    heroTop.append(heroTextCol);
    heroText.append(heroTop);
    hero.append(heroText);

    const heroActions = el('div', { className: 'md-detail-hero__actions' });
    heroActions.append(
      components.button({
        label: ctx.t('shell.screen.hosts.action.deploy', 'Deploy and run here'),
        variant: 'filled',
        icon: 'download',
        disabled: true,
        disabledReason: noSshReason(ctx)
      }),
      components.button({
        label: ctx.t('shell.screen.hosts.action.shell', 'Open a shell'),
        variant: 'outlined',
        icon: 'terminal',
        disabled: true,
        disabledReason: noSshReason(ctx)
      }),
      components.button({
        label: ctx.t('shell.screen.hosts.action.forget', 'Forget…'),
        variant: 'filled',
        danger: true,
        icon: 'trash',
        onClick: (event) => void forgetHost(ctx, host, event.currentTarget as HTMLElement)
      })
    );
    hero.append(heroActions);
    hero.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHostMenu(ctx, host, hero);
    });
    detail.append(hero);

    /* ---------------- how it will run ---------------- */

    const runCard = el('div', { className: 'md-section-card' });
    const runHeader = el('div', { className: 'md-section-card__header' });
    runHeader.append(
      el('b', { className: 'md-section-card__title', text: ctx.t('shell.screen.hosts.run.title', 'How it will run') }),
      el('span', {
        className: 'md-section-card__hint',
        text: ctx.t('shell.screen.hosts.run.hint', 'Auto-detect asks the machine; it never guesses')
      })
    );
    runCard.append(runHeader);

    const runBody = el('div', { className: 'wds-hosts-run__body' });
    const modeControl = components.segmentedButton({
      label: ctx.t('shell.screen.hosts.run.modeLabel', 'Run mode'),
      value: host.runMode,
      options: [
        { value: 'auto', label: ctx.t('shell.screen.hosts.mode.autoOption', 'Auto-detect'), icon: 'bolt' },
        { value: 'docker', label: ctx.t('shell.screen.hosts.mode.dockerOption', 'Docker'), icon: 'dock' },
        { value: 'native', label: ctx.t('shell.screen.hosts.mode.nativeOption', 'No Docker'), icon: 'terminal' }
      ],
      onChange: (value) => {
        const mode = validRunMode(value);
        const current = readHosts(ctx);
        const index = current.findIndex((candidate) => candidate.id === host.id);
        if (index === -1) return;
        current[index] = { ...current[index], runMode: mode, updatedAt: new Date().toISOString() };
        writeHosts(ctx, current);
        void ctx.history.record('Changed the chosen run mode for an SSH host', 'hosts', { id: host.id, mode });
      }
    });
    runBody.append(modeControl.root);
    runBody.append(
      components.button({
        label: ctx.t('shell.screen.hosts.action.redetect', 'Re-run detection'),
        variant: 'outlined',
        icon: 'refresh',
        disabled: true,
        disabledReason: noSshReason(ctx)
      })
    );
    runCard.append(runBody);
    runCard.append(el('p', { className: 'wds-hosts-run__verdict md-typescale-body-small', text: verdictText(ctx, host) }));

    const evidence = el('div', { className: 'wds-hosts-evidence' });
    for (const check of host.detect) {
      const row = el('div', { className: 'wds-hosts-evidence__row' });
      const glyphModifier =
        check.ok === true ? ' wds-hosts-evidence__glyph--ok' : check.ok === false ? ' wds-hosts-evidence__glyph--fail' : '';
      const glyphText = check.ok === true ? '✓' : check.ok === false ? '✕' : '?';
      row.append(
        el('span', {
          className: `wds-hosts-evidence__glyph${glyphModifier}`,
          attrs: { 'aria-hidden': 'true' },
          text: glyphText
        })
      );
      const rowText = el('span', { className: 'wds-hosts-evidence__text' });
      rowText.append(
        el('b', { className: 'md-typescale-label-medium', text: detectionLabel(ctx, check.key) }),
        el('span', { className: 'wds-hosts-mono md-typescale-body-small', text: detectionValue(ctx, check) })
      );
      row.append(rowText);
      evidence.append(row);
    }
    runCard.append(evidence);
    detail.append(runCard);

    /* ---------------- connection + deployment ---------------- */

    const grid = el('div', { className: 'wds-hosts-grid2' });

    const connCard = el('div', { className: 'md-section-card' });
    const connHeader = el('div', { className: 'md-section-card__header' });
    connHeader.append(
      el('b', { className: 'md-section-card__title', text: ctx.t('shell.screen.hosts.conn.title', 'Connection') })
    );
    connCard.append(connHeader);

    const authRow = el('div', { className: 'md-section-card__row' });
    authRow.append(
      el('span', { text: ctx.t('shell.screen.hosts.conn.auth', 'Authentication') }),
      el('b', { className: 'wds-hosts-mono wds-hosts-row__value', text: authSummary(ctx, host) })
    );
    connCard.append(authRow);

    const fpRow = el('div', { className: 'md-section-card__row' });
    fpRow.append(
      el('span', { text: ctx.t('shell.screen.hosts.conn.fingerprint', 'Host key') }),
      el('b', { className: 'wds-hosts-mono wds-hosts-row__value', text: fingerprintSummary(ctx, host) })
    );
    connCard.append(fpRow);

    const connFooter = el('div', { className: 'md-section-card__footer' });
    connFooter.append(
      components.button({
        label: ctx.t('shell.screen.hosts.action.test', 'Test the connection'),
        variant: 'tonal',
        disabled: true,
        disabledReason: noSshReason(ctx)
      }),
      components.button({
        label: ctx.t('shell.screen.hosts.action.editConnection', 'Edit'),
        variant: 'outlined',
        onClick: () => void openEditConnectionDialog(ctx, host)
      })
    );
    connCard.append(connFooter);
    grid.append(connCard);

    const deployCard = el('div', { className: 'md-section-card' });
    const deployHeader = el('div', { className: 'md-section-card__header' });
    deployHeader.append(
      el('b', { className: 'md-section-card__title', text: ctx.t('shell.screen.hosts.deploy.title', 'Deployment') }),
      el('span', { className: 'md-tag md-tag--tertiary', text: detectedBadge(ctx, host) })
    );
    deployCard.append(deployHeader);
    for (const field of host.deploy) {
      const row = el('div', { className: 'md-section-card__row' });
      row.append(
        el('span', { text: deployLabel(ctx, field.key) }),
        el('b', { className: 'wds-hosts-mono wds-hosts-row__value', text: deployValue(ctx, field) })
      );
      deployCard.append(row);
    }
    grid.append(deployCard);
    detail.append(grid);

    /* ---------------- remote session log ---------------- */

    const logCard = el('div', { className: 'md-section-card' });
    const logHeader = el('div', { className: 'md-section-card__header' });
    logHeader.append(
      el('b', { className: 'md-section-card__title', text: ctx.t('shell.screen.hosts.log.title', 'Remote session') }),
      components.button({
        label: ctx.t('shell.screen.hosts.action.follow', 'Follow'),
        variant: 'text',
        disabled: true,
        disabledReason: noSshReason(ctx)
      })
    );
    logCard.append(logHeader);
    const logBody = el('div', { className: 'wds-hosts-log' });
    for (const line of host.log) {
      const row = el('div', { className: 'wds-hosts-log__line' });
      row.append(
        el('span', { className: 'wds-hosts-log__time', text: logLineTime(line) }),
        el('span', { className: 'wds-hosts-log__msg', text: logLineText(ctx, line) })
      );
      logBody.append(row);
    }
    logCard.append(logBody);
    detail.append(logCard);
  }

  const unsubscribeSettings = ctx.settings.onChange((change) => {
    if (change.id !== HOSTS_SETTING_ID && change.id !== SELECTED_HOST_SETTING_ID) return;
    buildSidebar();
    buildDetail();
    updateSubtitle();
  });
  const unsubscribeI18n = ctx.i18n.onChange(() => {
    buildSidebar();
    buildDetail();
    updateSubtitle();
  });

  buildSidebar();
  buildDetail();
  updateSubtitle();

  return () => {
    unsubscribeSettings();
    unsubscribeI18n();
    disposeSearch?.();
  };
}

/* ================================================================== */
/* Screen definition                                                   */
/* ================================================================== */

const screen: ScreenDefinition = {
  id: 'hosts',
  // Self-fallback: `shell/header.ts` and `shell/rail.ts` resolve this with
  // `ctx.t(screen.title, screen.title)`, so the value doubles as its own
  // English fallback whether or not a catalogue entry is ever registered for
  // it — matching every other `ScreenDefinition.title` in this shell.
  title: 'Hosts',
  subtitle: 'Hosts reachable over SSH',
  icon: 'cloud',
  rail: 3,
  mount
};

export default screen;
