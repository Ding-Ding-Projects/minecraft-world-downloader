import { el } from '../../core/a11y';
import { createCollapsiblePanel } from '../../core/collapse';
import { components } from '../../core/components';
import { iconElement } from '../../core/icons';
import type { AppContext, SearchBarHandle, SearchQuery, TabContext, TabDefinition } from '../../core/types';
import { shell } from '../index';
import type { ScreenDefinition } from '../types';
import './other.css';

/**
 * "Other": the directory of everything this application does that is not the
 * downloader, and the detail frame that opens when one of its destinations is
 * selected.
 *
 * This screen owns no feature logic of its own. It is a thin, generic reader
 * of `ctx.registry.tabs()` — the exact same declarative list every one of the
 * ~40 feature modules under `features/*` already contributes to, whether it
 * has one tab or several. Grouping, search and the detail frame are all this
 * lane draws; the content inside the detail frame, on selecting a card, is
 * always the real `TabDefinition.mount` the owning feature registered. That
 * is deliberate: this file must never grow a second, competing copy of a
 * feature's own UI, and being generic is what keeps this destination correct
 * automatically as features are added, renamed or removed without this file
 * changing at all.
 *
 * A small, explicit set of tab ids is excluded because a DIFFERENT top-level
 * screen already owns that exact surface (the downloader, the live map, the
 * bot runner, settings, and version history — see `shell/types.ts`'s own
 * docstring, which groups history with map and bot as the three
 * "elevated but not railed" screens). Excluding them here is what stops the
 * same destination appearing twice under two different names in the rail.
 * Every other registered tab — including several the design's own mockup
 * never enumerated by name, because the real registry has grown since it was
 * drawn — is real, live and reachable from here.
 *
 * Two concepts the design's mockup names ("Regex builder", "Tabs and
 * navigation") have no dedicated tab anywhere in the registry: the regex
 * builder is a cross-cutting popover every search bar already carries, and
 * the tab strip is configured from Settings. Rather than fabricate a dead
 * panel for either, they get an honest card that says exactly that, per the
 * house rule: "Where the design shows an area with NO corresponding
 * registered tab, list it honestly as unavailable with the reason." The
 * notification centre similarly has no registered tab — it is a service
 * method, `ctx.notify.mountCentre` — so it gets its own honest, wired entry
 * rather than being silently dropped.
 */

const AREA_PARAM = 'area';

/**
 * Tab ids already surfaced by a dedicated top-level screen owned by a
 * different lane. Kept as a short, explicit, hand-written list rather than a
 * pattern match, because a pattern that guesses "this looks like a core
 * screen's tab" is exactly the kind of guard that silently stops guarding
 * when a feature is renamed.
 */
const OWNED_BY_ANOTHER_SCREEN = new Set<string>([
  'downloader.main', // the Downloader screen
  'map.viewer', // the Live map screen
  'bot.runner', // the Bot runner screen
  'settings', // the Settings screen
  'history.panel', // the Version history screen
  'history.protected' // ditto
]);

interface GroupMeta {
  /** Real i18n key when known (shared with the legacy tab strip's own group names). */
  key: string;
  fallback: string;
  /** Lower sorts first. Mirrors `core/tabs.ts`'s own `DEFAULT_GROUPS` order. */
  order: number;
}

/** The product's own ungrouped, top-of-strip surfaces (server, console, chunk
 *  editing, and this screen's own synthetic entries) land in this bucket. */
const CORE_GROUP: GroupMeta = { key: 'other.group.core', fallback: 'Core surfaces', order: 0 };

/**
 * The same five group ids and i18n keys `core/tabs.ts` seeds its own default
 * groups from, reused rather than reinvented so a group reads identically
 * here and in the legacy tab strip.
 */
const KNOWN_GROUPS: Record<string, GroupMeta> = {
  'group.bot-control': { key: 'core.tabs.group.botControl', fallback: 'Bot control', order: 10 },
  'group.tools': { key: 'core.tabs.group.tools', fallback: 'Tools', order: 20 },
  'group.personalisation': { key: 'core.tabs.group.personalisation', fallback: 'Personalisation', order: 30 },
  'group.records': { key: 'core.tabs.group.records', fallback: 'Records', order: 40 },
  'group.security': { key: 'core.tabs.group.security', fallback: 'Security', order: 50 }
};

function humanizeGroupId(id: string): string {
  const stripped = id.startsWith('group.') ? id.slice('group.'.length) : id;
  return stripped
    .split(/[-.]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function groupMetaFor(groupId: string): GroupMeta {
  if (groupId === '__core__') return CORE_GROUP;
  return KNOWN_GROUPS[groupId] ?? { key: groupId, fallback: humanizeGroupId(groupId), order: 999 };
}

interface Description {
  key: string;
  fallback: string;
}

/**
 * Curated, honest descriptions for the tabs a person is most likely to look
 * for — the ones the design's own mockup named, plus their close neighbours.
 * A tab with no entry here is never hidden; it falls back to a true,
 * generic sentence naming its real group instead of a fabricated one.
 */
const TAB_DESCRIPTIONS: Record<string, Description> = {
  'worldlens.main': {
    key: 'other.desc.worldlens',
    fallback: 'Hands a finished world to the Worldlens companion renderer and drives it over loopback once it is installed.'
  },
  'world-vault.main': {
    key: 'other.desc.vault',
    fallback: 'A local Git repository per world, committing on settled writes while the download runs.'
  },
  'worldvaultedit.grid': {
    key: 'other.desc.chunk',
    fallback: 'Select a chunk on the map, copy it elsewhere, or remove it — every edit is its own commit.'
  },
  'worldvaultrenders.main': {
    key: 'other.desc.renders',
    fallback: 'Queued map renders, one per vault commit, never blocking the download.'
  },
  'server.containers': {
    key: 'other.desc.serverContainers',
    fallback: 'The Docker container list for this world, with gated start, stop, restart and remove.'
  },
  'server.logs': {
    key: 'other.desc.serverLogs',
    fallback: "The container's own log stream, followed live."
  },
  'console.main': {
    key: 'other.desc.console',
    fallback: 'Everything the bundled web console does, driven in the app over loopback.'
  },
  'downloader-e2e.main': {
    key: 'other.desc.e2e',
    fallback: 'A real server and real bots, with the produced world read back from its own region files.'
  },
  'export.main': {
    key: 'other.desc.export',
    fallback: 'Every list exports in every format that can hold it, with the losses named before it writes.'
  },
  'external-editor.main': {
    key: 'other.desc.editor',
    fallback: 'Opens exports, logs, profiles and settings snapshots straight into Visual Studio Code.'
  },
  'scheduled-settings.schedule': {
    key: 'other.desc.schedule',
    fallback: 'Appearance and behaviour on a real clock, with typed dates and a live calendar.'
  },
  'locks.manager': {
    key: 'other.desc.locks',
    fallback: 'Toy locks per element, for fun — never security, never encryption, always recoverable.'
  },
  'supportTickets.desk': {
    key: 'other.desc.tickets',
    fallback: 'The recovery route, dressed as a support desk. Nothing here is sent anywhere.'
  },
  'docs-browser.library': {
    key: 'other.desc.docs',
    fallback: 'Every feature article, bundled at build time and searchable fully offline.'
  },
  'changelog.viewer': {
    key: 'other.desc.changelog',
    fallback: 'Every released version, each entry linked to the exact commit that made it.'
  },
  'status.panel': {
    key: 'other.desc.status',
    fallback: 'The same states and evidence a shared status hub would see.'
  },
  'language.preview': {
    key: 'other.desc.language',
    fallback: 'English, Cantonese, bilingual, both funny-level sliders, and the spoken narrator.'
  },
  'updates.main': {
    key: 'other.desc.updates',
    fallback: 'The unsigned update feed and its ready-to-restart state, restarted only when you choose to.'
  },
  'downloads.main': {
    key: 'other.desc.downloads',
    fallback: 'Every captured transfer, with a real filename, source, byte count, rate and ETA.'
  },
  'models.overview': {
    key: 'other.desc.modelsOverview',
    fallback: "The local model runtime's health, installed models and hardware-fit verdicts."
  },
  'models.store': {
    key: 'other.desc.modelsStore',
    fallback: 'The exhaustive local model catalog, with real download sizes and fit verdicts.'
  },
  'models.chat': {
    key: 'other.desc.modelsChat',
    fallback: 'A local chat session against an installed model, streamed and kept offline.'
  },
  'models.harness': {
    key: 'other.desc.modelsHarness',
    fallback: 'Launches a registered local harness against an installed model, with a reviewable preflight.'
  },
  'converter.convert': {
    key: 'other.desc.converterConvert',
    fallback: 'Converts a chosen file through a bundled, sandboxed adapter.'
  },
  'converter.catalog': {
    key: 'other.desc.converterCatalog',
    fallback: 'The categorized adapter catalog, with unavailable formats named rather than hidden.'
  },
  'converter.pdftools': {
    key: 'other.desc.converterPdf',
    fallback: 'Inspect, split, merge, extract, reorder and rotate PDFs, fully offline.'
  },
  'authenticator.entries': {
    key: 'other.desc.authEntries',
    fallback: 'Your own TOTP entries, generated locally, to the RFC 6238 standard.'
  },
  'authenticator.checks': {
    key: 'other.desc.authChecks',
    fallback: 'The RFC 6238 published test vectors this authenticator is verified against.'
  },
  'appearance.studio': {
    key: 'other.desc.appearance',
    fallback: 'Full per-element appearance editing: typography, the infinite colour picker, presets and export.'
  },
  'app-identity.about': {
    key: 'other.desc.about',
    fallback: "This build's version, package identity and installed feature list."
  },
  'appLogo.main': {
    key: 'other.desc.logo',
    fallback: 'Choose a shipped logo preset or upload a local image; nothing leaves this machine.'
  }
};

type EntryKind = 'tab' | 'notify' | 'info';

interface DirectoryEntry {
  id: string;
  icon: string;
  groupId: string;
  order: number;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  kind: EntryKind;
  tab?: TabDefinition;
  infoParagraphs?: Description[];
  infoAction?: { key: string; fallback: string; run(): void };
}

function genericDescription(groupId: string): string {
  return `A real destination in ${groupMetaFor(groupId).fallback}.`;
}

/**
 * Builds the full, current directory: every registered tab not owned by
 * another screen, plus the notification centre and the two honest
 * "not a separate screen" entries. Called fresh on every paint (initial mount
 * and every language/humour change) rather than cached, so a feature
 * registered, renamed or removed between paints is reflected immediately.
 */
function buildEntries(ctx: AppContext): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];

  for (const tab of ctx.registry.tabs()) {
    if (OWNED_BY_ANOTHER_SCREEN.has(tab.id)) continue;
    const described = TAB_DESCRIPTIONS[tab.id];
    const groupId = tab.group ?? '__core__';
    entries.push({
      id: tab.id,
      icon: tab.icon,
      groupId,
      order: tab.order ?? 1000,
      titleKey: tab.title,
      titleFallback: tab.title,
      descKey: described?.key ?? 'other.desc.generic',
      descFallback: described?.fallback ?? genericDescription(groupId),
      kind: 'tab',
      tab
    });
  }

  // The notification centre is a real, wired surface — `ctx.notify.mountCentre`
  // — that simply never claimed a tab id, so it needs its own entry rather
  // than being silently absent from a directory that otherwise lists
  // everything.
  entries.push({
    id: 'other.entry.notify',
    icon: 'notifications',
    groupId: '__core__',
    order: 50,
    titleKey: 'other.notify.title',
    titleFallback: 'Notification centre',
    descKey: 'other.desc.notify',
    descFallback: 'Dismissed notifications stay reviewable, with the same bulk actions as any other list.',
    kind: 'notify'
  });

  entries.push({
    id: 'other.entry.regex',
    icon: 'search',
    groupId: '__core__',
    order: 90,
    titleKey: 'other.regex.title',
    titleFallback: 'Regex builder',
    descKey: 'other.desc.regex',
    descFallback: 'There is no separate regex-builder screen.',
    kind: 'info',
    infoParagraphs: [
      {
        key: 'other.regex.body1',
        fallback:
          'Every search bar in this application already opens its own anchored pattern builder next to the field — there is nothing standalone to open here.'
      },
      {
        key: 'other.regex.body2',
        fallback:
          'Plain text is always the default and regular expressions are an explicit opt-in; the sample text, flags and validation live in that same popover, wherever the field is.'
      }
    ]
  });

  entries.push({
    id: 'other.entry.tabs',
    icon: 'dock',
    groupId: '__core__',
    order: 91,
    titleKey: 'other.tabs.title',
    titleFallback: 'Tabs and navigation',
    descKey: 'other.desc.tabs',
    descFallback: 'There is no separate tabs screen here.',
    kind: 'info',
    infoParagraphs: [
      {
        key: 'other.tabs.body1',
        fallback:
          'The tab strip dock edge, its groups, pinning and the four tab searches are configured from Settings, not from a card in this directory.'
      }
    ],
    infoAction: {
      key: 'other.tabs.action',
      fallback: 'Open Settings',
      run: () => shell.go('settings')
    }
  });

  return entries;
}

/* ------------------------------------------------------------------ */
/* Directory                                                           */
/* ------------------------------------------------------------------ */

interface BuiltCard {
  node: HTMLElement;
  haystack: string;
}

interface BuiltGroup {
  root: HTMLElement;
  cards: BuiltCard[];
  refreshActiveBadge(): void;
}

function buildCard(ctx: AppContext, entry: DirectoryEntry, title: string, description: string): HTMLElement {
  const node = el('button', { className: 'wds-other__card', attrs: { type: 'button' } });
  const head = el('div', { className: 'wds-other__cardhead' });
  head.append(iconElement(entry.icon, 20));
  head.append(el('span', { className: 'md-typescale-title-small wds-other__cardtitle', text: title }));
  node.append(head, el('p', { className: 'md-typescale-body-small wds-other__carddesc', text: description }));
  node.addEventListener('click', () => shell.go('other', { [AREA_PARAM]: entry.id }));
  ctx.a11y.assertTouchTarget(node, `other-card:${entry.id}`);
  return node;
}

/** Builds the whole directory into `host` and returns its dispose function. */
function buildDirectory(host: HTMLElement, ctx: AppContext): () => void {
  host.textContent = '';
  const root = el('div', { className: 'wds-other' });
  host.append(root);

  root.append(
    components.topAppBar({
      title: ctx.t('other.title', 'Other'),
      subtitle: ctx.t('other.tab.subtitle', 'Every capability that is not the downloader, gathered in one directory.')
    })
  );

  const entries = buildEntries(ctx);
  const summary = el('p', { className: 'wds-other__summary md-typescale-body-small', attrs: { role: 'status', 'aria-live': 'polite' } });
  const groupsHost = el('div', { className: 'wds-other__groups' });
  const emptyState = components.emptyState({ title: ctx.t('other.empty.title', 'Nothing matches that search.') });
  emptyState.hidden = true;

  const byGroup = new Map<string, DirectoryEntry[]>();
  for (const entry of entries) {
    const list = byGroup.get(entry.groupId) ?? [];
    list.push(entry);
    byGroup.set(entry.groupId, list);
  }
  const groupIds = [...byGroup.keys()].sort(
    (a, b) => groupMetaFor(a).order - groupMetaFor(b).order || a.localeCompare(b)
  );

  let queryActive = false;
  const built: BuiltGroup[] = [];

  for (const groupId of groupIds) {
    const meta = groupMetaFor(groupId);
    const groupEntries = (byGroup.get(groupId) ?? []).slice().sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

    const grid = el('div', { className: 'wds-other__grid' });
    const cards: BuiltCard[] = [];
    for (const entry of groupEntries) {
      const title = ctx.t(entry.titleKey, entry.titleFallback);
      const description = ctx.t(entry.descKey, entry.descFallback);
      const node = buildCard(ctx, entry, title, description);
      grid.append(node);
      cards.push({ node, haystack: `${title} ${description} ${entry.id}`.toLowerCase() });
    }

    const panel = createCollapsiblePanel({
      key: `other.group.${groupId}`,
      label: ctx.t(meta.key, meta.fallback),
      descriptive: false,
      render: (body) => body.append(grid),
      isActive: () => queryActive
    });

    groupsHost.append(panel.root);
    built.push({ root: panel.root, cards, refreshActiveBadge: panel.refreshActiveBadge });
  }

  function applyQuery(query: SearchQuery): void {
    queryActive = query.text.trim() !== '' || (query.regex && query.pattern.trim() !== '');
    let shown = 0;
    let anyGroupVisible = false;
    for (const group of built) {
      let groupShown = 0;
      for (const card of group.cards) {
        const visible = query.matches(card.haystack);
        card.node.hidden = !visible;
        if (visible) {
          groupShown += 1;
          shown += 1;
        }
      }
      group.root.hidden = groupShown === 0;
      if (groupShown > 0) anyGroupVisible = true;
      group.refreshActiveBadge();
    }
    summary.textContent = ctx.t('other.search.summary', '{shown} of {total} destinations shown.', {
      values: { shown, total: entries.length }
    });
    emptyState.hidden = anyGroupVisible || entries.length === 0;
  }

  const search: SearchBarHandle = ctx.createSearchBar({
    label: ctx.t('other.search.label', 'Search everything else this app does'),
    placeholder: ctx.t('other.search.placeholder', 'Search everything else this app does'),
    sample: entries.map((entry) => ctx.t(entry.titleKey, entry.titleFallback)).join('\n'),
    onChange: applyQuery
  });

  root.append(search.root, summary, groupsHost, emptyState);
  applyQuery(search.query());

  return () => search.destroy();
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

/**
 * Builds the detail frame for one selected destination into `host`. Cleanup
 * callbacks — the mounted tab's own dispose, `onDispose` registrations it
 * made, and this function's own i18n subscription — are pushed onto
 * `disposers`, which the caller runs when the screen itself is torn down.
 *
 * A language or humour change while a real tab is showing updates only this
 * frame's own chrome (the back label, the group chip, the description) in
 * place. It deliberately never re-mounts the tab underneath it: doing that on
 * every funny-level change would silently discard whatever state that tab's
 * own UI was holding.
 */
function buildDetail(host: HTMLElement, ctx: AppContext, areaId: string, disposers: Array<() => void>): void {
  host.textContent = '';
  const entry = buildEntries(ctx).find((candidate) => candidate.id === areaId) ?? null;

  const root = el('div', { className: 'wds-other-detail' });
  host.append(root);

  const crumbs = el('div', { className: 'wds-other-detail__crumbs' });
  const back = components.button({
    label: ctx.t('other.back', 'Other'),
    variant: 'tonal',
    icon: 'chevronLeft',
    onClick: () => shell.go('other', {})
  });
  crumbs.append(back);
  root.append(crumbs);

  if (!entry) {
    crumbs.append(
      el('span', {
        className: 'md-typescale-body-small wds-other-detail__desc',
        text: ctx.t('other.area.gone', 'This destination is no longer available.')
      })
    );
    root.append(
      components.emptyState({
        title: ctx.t('other.area.gone.title', 'Not available'),
        body: ctx.t('other.area.gone.body', 'Whatever registered this destination is no longer present in this build.')
      })
    );
    return;
  }

  const meta = groupMetaFor(entry.groupId);
  const chip = el('span', { className: 'wds-other-detail__chip md-typescale-label-small', text: ctx.t(meta.key, meta.fallback) });
  const description = el('span', {
    className: 'md-typescale-body-small wds-other-detail__desc',
    text: ctx.t(entry.descKey, entry.descFallback)
  });
  crumbs.append(chip, description);

  const frame = el('div', { className: 'wds-other-detail__frame' });
  root.append(frame);

  const stopI18n = ctx.i18n.onChange(() => {
    const backLabel = back.querySelector('.md-btn__label');
    if (backLabel) backLabel.textContent = ctx.t('other.back', 'Other');
    chip.textContent = ctx.t(meta.key, meta.fallback);
    description.textContent = ctx.t(entry.descKey, entry.descFallback);
  });
  disposers.push(stopI18n);

  if (entry.kind === 'tab' && entry.tab) {
    const tab = entry.tab;
    const tabDisposers: Array<() => void> = [];
    const tabCtx: TabContext = { ...ctx, tabId: tab.id, onDispose: (fn) => tabDisposers.push(fn) };
    let mountDispose: (() => void) | undefined;
    try {
      mountDispose = tab.mount(frame, tabCtx) ?? undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`The "${tab.id}" surface failed to mount:`, error);
      frame.append(
        components.emptyState({
          title: ctx.t('other.area.mountFailed.title', 'This surface did not start'),
          body: ctx.t('other.area.mountFailed.body', '{id} reported: {message}', { values: { id: tab.id, message } })
        })
      );
    }
    disposers.push(() => {
      if (typeof mountDispose === 'function') mountDispose();
      for (const fn of tabDisposers.splice(0)) {
        try {
          fn();
        } catch (disposeError) {
          console.error(`A cleanup callback registered by "${tab.id}" threw:`, disposeError);
        }
      }
    });
  } else if (entry.kind === 'notify') {
    disposers.push(ctx.notify.mountCentre(frame, ctx));
  } else {
    const panel = el('div', { className: 'wds-other-info md-card md-card--outlined' });
    panel.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t(entry.titleKey, entry.titleFallback) }));
    for (const paragraph of entry.infoParagraphs ?? []) {
      panel.append(el('p', { className: 'md-typescale-body-medium', text: ctx.t(paragraph.key, paragraph.fallback) }));
    }
    if (entry.infoAction) {
      const action = entry.infoAction;
      panel.append(components.button({ label: ctx.t(action.key, action.fallback), variant: 'tonal', onClick: action.run }));
    }
    frame.append(panel);
  }
}

/* ------------------------------------------------------------------ */
/* Screen                                                               */
/* ------------------------------------------------------------------ */

function runAll(disposers: Array<() => void>): void {
  for (const fn of disposers.splice(0).reverse()) {
    try {
      fn();
    } catch (error) {
      console.error('The Other screen failed to clean up:', error);
    }
  }
}

function mount(host: HTMLElement, ctx: AppContext): () => void {
  const area = shell.params()[AREA_PARAM] ?? '';

  if (area !== '') {
    const disposers: Array<() => void> = [];
    buildDetail(host, ctx, area, disposers);
    return () => runAll(disposers);
  }

  let directoryDispose: (() => void) | null = null;
  const rebuildDirectory = (): void => {
    directoryDispose?.();
    directoryDispose = buildDirectory(host, ctx);
  };
  rebuildDirectory();
  const stopI18n = ctx.i18n.onChange(rebuildDirectory);

  return () => {
    stopI18n();
    directoryDispose?.();
  };
}

const screen: ScreenDefinition = {
  id: 'other',
  title: 'Other',
  subtitle: 'Every capability that is not the downloader',
  icon: 'more',
  // Sits after the four core destinations (downloader/profiles/hosts/services)
  // and before Settings in the rail's numeric order. Numeric collisions with
  // another lane's own screen are not destructive — `ShellApi.screens()` sorts
  // by rail order then falls back to the id, so at worst two items trade
  // places rather than crashing.
  rail: 40,
  mount
};

export default screen;
