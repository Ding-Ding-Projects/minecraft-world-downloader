import { el, nextId } from '../../core/a11y';
import { components } from '../../core/components';
import { createSearchBar } from '../../core/searchbar';
import type { ExportFormat, SearchQuery, TabContext } from '../../core/registry';

import { changelog, categoryCounts, commitUrl, dateBounds, isEmptyBundle, totalEntries } from './data';
import {
  applyFilter,
  describeFilter,
  emptyFilter,
  fromStoredView,
  groupByCategory,
  isFiltering,
  toStoredView
} from './filter';
import type { ChangelogFilter, FilterResult, FilteredRelease } from './filter';
import { suggestFileName, toMarkdown, toPlainText, toRows } from './format';
import type { FormatContext } from './format';
import {
  CHANGELOG_TAB_ID,
  COPY_FORMAT_ID,
  GROUP_BY_CATEGORY_ID,
  PAGE_SIZE_ID,
  REMEMBER_VIEW_ID,
  SHOW_BODIES_ID,
  STORED_VIEW_ID
} from './settings';
import type { ChangeCategory, ChangeEntry } from './types';
import { CHANGE_CATEGORIES } from './types';

/**
 * The changelog destination.
 *
 * Every version that was ever tagged is here, not only the newest, and every
 * change carries the commit that made it. Where several commits shared one
 * subject the entry says it is a summary and links the commit that COMPLETED
 * the change, rather than implying a single link is the whole story.
 *
 * The list is rendered in windows rather than all at once. On a history of a
 * hundred and forty versions and thirteen hundred changes, building every card
 * up front costs a visible pause before anything appears; a window plus an
 * observer costs nothing and still reaches the end. Both a scroll and a real
 * button advance it, because an observer alone is not a keyboard path.
 */

const RELEASE_ANCHOR = 'changelog-release';

/** The live viewer, so a palette command can act on what is on screen. */
export interface ChangelogViewHandle {
  copyCurrentView(): Promise<void>;
  exportCurrentView(format: 'markdown' | 'text'): Promise<void>;
  goToNewest(): void;
  focusSearch(): void;
}

let active: ChangelogViewHandle | null = null;

export function activeView(): ChangelogViewHandle | null {
  return active;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function anchorId(version: string): string {
  return `${RELEASE_ANCHOR}-${version.replace(/[^A-Za-z0-9_-]+/g, '_')}`;
}

/**
 * Puts text on the clipboard, honestly.
 *
 * The asynchronous clipboard is not available in every context an Electron
 * renderer can find itself in, so the older selection route is kept as a real
 * fallback. When both refuse, the caller is told why rather than being shown a
 * success message for something that did not happen.
 */
async function copyText(text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (error) {
      // Fall through to the selection route rather than giving up here.
      void error;
    }
  }
  const scratch = document.createElement('textarea');
  scratch.value = text;
  scratch.setAttribute('aria-hidden', 'true');
  scratch.style.position = 'fixed';
  scratch.style.top = '-1000px';
  scratch.style.opacity = '0';
  document.body.append(scratch);
  scratch.select();
  try {
    const copied = document.execCommand('copy');
    scratch.remove();
    if (copied) return { ok: true };
    return { ok: false, error: 'the clipboard command was refused' };
  } catch (error) {
    scratch.remove();
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Mount                                                               */
/* ------------------------------------------------------------------ */

export function mountChangelog(host: HTMLElement, ctx: TabContext): void {
  const categoryName = (category: ChangeCategory): string =>
    ctx.t(`changelog.category.${category}`, category);

  /**
   * Why a change ended up under "Other".
   *
   * Attached to the category marker rather than printed under every entry: with
   * a couple of hundred uncategorized commits in a history this long, the same
   * paragraph repeated two hundred times stops being an explanation and becomes
   * noise the reader learns to skip.
   */
  const uncategorizedNote = (): string =>
    ctx.t(
      'changelog.category.uncategorized',
      'Filed as "Other" because the commit subject matched no category rule. Its full text is shown so you can judge it.'
    );

  /**
   * Attaches an explanatory note to a marker without losing what the marker
   * says.
   *
   * The shared tooltip sets `aria-label` when an element has none, which on a
   * chip reading "Other" would replace the category name with the explanation —
   * a screen-reader user would then hear why the change is uncategorized and
   * never hear which category it is in. Setting the accessible name FIRST, with
   * both halves in it, means the tooltip leaves it alone. `title` carries the
   * same note for a sighted keyboard user, since a marker is not focusable.
   */
  function attachNote(element: HTMLElement, visibleText: string, note: string): void {
    element.setAttribute('aria-label', `${visibleText}. ${note}`);
    element.title = note;
    components.tooltip(element, note);
  }

  /* ---------------- state ---------------- */

  let filter: ChangelogFilter = emptyFilter();
  let result: FilterResult = applyFilter(changelog.releases, filter);
  let rendered = 0;
  const selection = new Set<string>();
  const expanded = new Set<string>();
  let lastToggledVersion: string | null = null;
  let shiftHeld = false;

  const pageSize = (): number => {
    const raw = ctx.settings.get<number>(PAGE_SIZE_ID, 12);
    return Math.max(1, Math.min(200, Math.round(Number(raw) || 12)));
  };
  const grouped = (): boolean => ctx.settings.get<boolean>(GROUP_BY_CATEGORY_ID, true) === true;
  const bodiesOpen = (): boolean => ctx.settings.get<boolean>(SHOW_BODIES_ID, false) === true;

  /* ---------------- chrome ---------------- */

  const copyButton = components.button({
    label: 'changelog.copy.action',
    variant: 'tonal',
    icon: 'copy',
    onClick: () => void copyCurrentView()
  });
  const exportButton = components.button({
    label: 'changelog.export.action',
    variant: 'tonal',
    icon: 'download',
    onClick: (event) => openExportMenu(event.currentTarget as HTMLElement)
  });

  host.append(
    components.topAppBar({
      title: 'changelog.title',
      subtitle: 'changelog.subtitle',
      actions: [copyButton, exportButton]
    })
  );

  /* ---------------- provenance of the bundle itself ---------------- */

  const source = el('div', { className: 'changelog__source' });
  const sourceLine = el('p', { className: 'md-typescale-body-small' });
  sourceLine.textContent = ctx.t(
    'changelog.status.source',
    'Built from this repository on {generated}. {releases} versions, {commits} commits across all release ranges.',
    {
      values: {
        generated: changelog.generatedAt === '' ? '—' : changelog.generatedAt,
        releases: changelog.releases.length,
        commits: changelog.commitsExamined
      }
    }
  );
  const overlapNote = el('p', {
    className: 'md-typescale-body-small md-setting__secondary',
    text: ctx.t(
      'changelog.status.overlap',
      'Tags that do not sit on one straight line of history share commits, so that total counts a shared commit once per range.'
    )
  });
  overlapNote.hidden = true;
  const overlapToggle = el('button', {
    className: 'md-setting__explain',
    text: '?',
    attrs: { type: 'button', 'aria-expanded': 'false', 'aria-label': ctx.t('core.settings.explain', 'What this does') }
  });
  overlapToggle.addEventListener('click', () => {
    overlapNote.hidden = !overlapNote.hidden;
    overlapToggle.setAttribute('aria-expanded', String(!overlapNote.hidden));
  });
  const sourceRow = el('div', { className: 'changelog__source-row' });
  sourceRow.append(sourceLine, overlapToggle);
  source.append(sourceRow, overlapNote);

  // A repository with no recognised forge says so once, here, instead of
  // repeating the explanation beside every commit id.
  if (changelog.forge.commitUrlTemplate === null && !isEmptyBundle()) {
    source.append(
      el('p', {
        className: 'md-typescale-body-small changelog__warning',
        text: ctx.t(
          'changelog.commit.noForge',
          'This repository has no recognised forge, so commit ids are shown as text rather than as links that would go nowhere.'
        )
      })
    );
  }
  host.append(source);

  /* ---------------- the empty bundle ---------------- */

  if (isEmptyBundle()) {
    host.append(
      components.emptyState({
        title: 'changelog.empty.title',
        body: ctx.t(
          'changelog.empty.body',
          'The changelog is generated from the repository at build time. Run "node scripts/generate-changelog.mjs" in the app directory and build again.'
        ),
        action: {
          label: 'changelog.copy.action',
          variant: 'outlined',
          icon: 'copy',
          onClick: async () => {
            const copied = await copyText(changelog.command);
            if (copied.ok) {
              ctx.notify.success(ctx.t('changelog.copy.action', 'Copy'), changelog.command);
            } else {
              ctx.notify.error(
                ctx.t('changelog.copy.failed', 'The clipboard refused the copy: {reason}', {
                  values: { reason: copied.error }
                })
              );
            }
          }
        }
      })
    );
    return;
  }

  /* ---------------- filters ---------------- */

  const toolbar = el('form', {
    className: 'changelog__toolbar',
    attrs: { role: 'search', 'aria-label': ctx.t('changelog.search.label', 'Search the changelog') }
  });
  toolbar.addEventListener('submit', (event) => event.preventDefault());

  const search = createSearchBar({
    label: 'changelog.search.label',
    placeholder: 'changelog.search.placeholder',
    sample: [
      changelog.releases[0]?.version ?? '',
      changelog.releases[0]?.entries[0]?.summary ?? '',
      changelog.releases[0]?.shortCommit ?? ''
    ]
      .filter((line) => line !== '')
      .join('\n'),
    onChange: (query: SearchQuery) => {
      filter = {
        ...filter,
        text: query.text,
        regex: query.regex,
        pattern: query.pattern,
        flags: query.flags,
        matches: query.text.trim() === '' && !query.regex ? null : query.matches
      };
      refresh();
    }
  });

  const bounds = dateBounds();
  const picker = components.datePicker({
    label: 'changelog.filter.date',
    range: true,
    min: bounds.min ?? undefined,
    max: bounds.max ?? undefined,
    onChange: (value) => {
      filter = { ...filter, from: value.start, to: value.end };
      refresh();
    }
  });

  const categoryHost = el('div', { className: 'changelog__chips' });
  const categoryHeading = components.sectionHeading({
    title: 'changelog.filter.categories',
    description: 'changelog.filter.categoriesHelp'
  });
  const counts = categoryCounts();
  const categoryChips = new Map<ChangeCategory, HTMLElement>();
  for (const category of CHANGE_CATEGORIES) {
    const count = counts.get(category) ?? 0;
    if (count === 0) continue;
    const node = components.chip({
      label: `${categoryName(category)} (${count})`,
      onToggle: (selected) => {
        filter = {
          ...filter,
          categories: selected
            ? [...filter.categories, category]
            : filter.categories.filter((candidate) => candidate !== category)
        };
        refresh();
      }
    });
    categoryChips.set(category, node);
    categoryHost.append(node);
  }

  const breakingSwitch = components.switchControl({
    label: 'changelog.filter.breaking',
    onChange: (checked) => {
      filter = { ...filter, breakingOnly: checked };
      refresh();
    }
  });
  const releasedSwitch = components.switchControl({
    label: 'changelog.filter.released',
    onChange: (checked) => {
      filter = { ...filter, releasedOnly: checked };
      refresh();
    }
  });

  const clearButton = components.button({
    label: 'changelog.filter.clear',
    variant: 'text',
    icon: 'close',
    onClick: () => {
      search.clear();
      picker.set({ start: null, end: null });
      for (const [, node] of categoryChips) node.setAttribute('aria-pressed', 'false');
      breakingSwitch.set(false);
      releasedSwitch.set(false);
      filter = emptyFilter();
      refresh();
    }
  });

  const switches = el('div', { className: 'changelog__switches' });
  switches.append(breakingSwitch.root, releasedSwitch.root, clearButton);

  toolbar.append(search.root, picker.root, categoryHeading, categoryHost, switches);
  host.append(toolbar);

  /* ---------------- status ---------------- */

  const status = el('p', {
    className: 'md-typescale-body-medium changelog__status',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  host.append(status);

  /* ---------------- bulk actions ---------------- */

  const bulk = el('section', {
    className: 'changelog__bulk',
    attrs: { 'aria-label': ctx.t('changelog.bulk.title', 'Selected versions') }
  });
  const bulkCount = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status', 'aria-live': 'polite' } });
  const bulkScope = el('p', { className: 'md-typescale-body-small md-setting__secondary' });

  const selectPageButton = components.button({
    label: 'changelog.bulk.selectPage',
    variant: 'text',
    onClick: () => {
      for (const item of result.releases.slice(0, rendered)) selection.add(item.release.version);
      syncSelectionUi();
    }
  });
  const selectAllButton = components.button({
    label: 'changelog.bulk.selectAll',
    variant: 'text',
    onClick: () => {
      for (const item of result.releases) selection.add(item.release.version);
      syncSelectionUi();
    }
  });
  const invertButton = components.button({
    label: 'changelog.bulk.invert',
    variant: 'text',
    onClick: () => {
      for (const item of result.releases) {
        const version = item.release.version;
        if (selection.has(version)) selection.delete(version);
        else selection.add(version);
      }
      syncSelectionUi();
    }
  });
  const clearSelectionButton = components.button({
    label: 'changelog.bulk.clear',
    variant: 'text',
    onClick: () => {
      selection.clear();
      syncSelectionUi();
    }
  });
  const openCommitsButton = components.button({
    label: 'changelog.openAll.action',
    variant: 'text',
    icon: 'world',
    onClick: (event) => void openEveryCommit(event.currentTarget as HTMLElement)
  });

  const bulkActions = el('div', { className: 'changelog__bulk-actions' });
  bulkActions.append(
    selectPageButton,
    selectAllButton,
    invertButton,
    clearSelectionButton,
    components.divider(true),
    openCommitsButton
  );

  /**
   * A line of copy with its own progressive-disclosure explanation.
   *
   * A hint is not a heading, so it is not rendered as one: making it an `h2`
   * would put "Shift-click a checkbox…" into the document outline between the
   * filters and the versions, which is a heading structure that helps nobody
   * navigating by headings.
   */
  function explainable(text: string, description: string): HTMLElement {
    const wrap = el('div', { className: 'changelog__hint' });
    const row = el('div', { className: 'changelog__source-row' });
    row.append(el('p', { className: 'md-typescale-body-small md-setting__secondary', text }));
    const note = el('p', { className: 'md-typescale-body-small md-setting__secondary', text: description });
    note.hidden = true;
    const toggle = el('button', {
      className: 'md-setting__explain',
      text: '?',
      attrs: {
        type: 'button',
        'aria-expanded': 'false',
        'aria-label': ctx.t('core.settings.explain', 'What this does')
      }
    });
    toggle.addEventListener('click', () => {
      note.hidden = !note.hidden;
      toggle.setAttribute('aria-expanded', String(!note.hidden));
    });
    row.append(toggle);
    wrap.append(row, note);
    return wrap;
  }

  bulk.append(
    bulkCount,
    bulkScope,
    bulkActions,
    explainable(
      ctx.t('changelog.bulk.shiftHint', 'Shift-click a checkbox to select a range.'),
      ctx.t(
        'changelog.bulk.scopeNote',
        '"Shown" is the versions currently rendered; "all matching" is every version the filter accepts.'
      )
    )
  );
  host.append(bulk);

  /* ---------------- body ---------------- */

  const body = el('div', { className: 'changelog__body' });
  const index = el('nav', {
    className: 'changelog__index',
    attrs: { 'aria-label': ctx.t('changelog.title', 'Changelog') }
  });
  const listHost = el('div', { className: 'changelog__releases' });
  const moreHost = el('div', { className: 'changelog__more' });
  const sentinel = el('div', { className: 'changelog__sentinel', attrs: { 'aria-hidden': 'true' } });

  body.append(index, el('div', { className: 'changelog__stream', children: [listHost, moreHost, sentinel] }));
  host.append(body);

  /* ---------------- commit reference ---------------- */

  function commitReference(sha: string, shortSha: string, summary: string): HTMLElement {
    const url = commitUrl(sha);
    const node = el('button', {
      className: 'changelog__commit',
      attrs: {
        type: 'button',
        'data-commit': sha,
        title: sha,
        'aria-label':
          url === null
            ? ctx.t('changelog.commit.copy', 'Copy the commit id {sha}', { values: { sha } })
            : ctx.t('changelog.commit.open', 'Open commit {sha} for "{summary}" in your browser', {
                values: { sha: shortSha, summary }
              })
      }
    });
    node.append(components.icon('code', { size: 14 }));
    node.append(el('code', { text: shortSha }));
    node.addEventListener('click', async () => {
      if (url === null) {
        const copied = await copyText(sha);
        if (copied.ok) {
          ctx.notify.success(ctx.t('changelog.commit.copied', 'Commit id copied: {sha}', { values: { sha } }));
          ctx.a11y.announce(ctx.t('changelog.commit.copied', 'Commit id copied: {sha}', { values: { sha } }));
        } else {
          ctx.notify.error(
            ctx.t('changelog.copy.failed', 'The clipboard refused the copy: {reason}', {
              values: { reason: copied.error }
            })
          );
        }
        return;
      }
      const opened = await ctx.studio.shell.openExternal(url);
      if (!opened.ok) {
        ctx.notify.error(
          ctx.t('changelog.commit.openFailed', 'The commit could not be opened: {reason}', {
            values: { reason: opened.error }
          }),
          url
        );
      }
    });
    return node;
  }

  /* ---------------- one change ---------------- */

  function renderEntry(entry: ChangeEntry, showCategory: boolean): HTMLElement {
    const row = el('li', { className: 'changelog__entry' });

    const head = el('div', { className: 'changelog__entry-head' });
    if (showCategory) {
      const marker = el('span', {
        className: `changelog__cat changelog__cat--${entry.category}`,
        text: categoryName(entry.category)
      });
      if (entry.category === 'other') {
        attachNote(marker, categoryName('other'), uncategorizedNote());
      }
      head.append(marker);
    }
    if (entry.breaking) {
      const flag = components.badge({ label: 'changelog.entry.breaking', severity: 'warning' });
      attachNote(
        flag,
        ctx.t('changelog.entry.breaking', 'Breaking change'),
        ctx.t(
          'changelog.entry.breakingNote',
          'The commit declared a breaking change. Read its message before upgrading.'
        )
      );
      head.append(flag);
    }
    head.append(el('span', { className: 'changelog__summary md-typescale-body-large', text: entry.summary }));
    head.append(commitReference(entry.commit, entry.shortCommit, entry.summary));
    row.append(head);

    const meta = el('p', { className: 'md-typescale-body-small changelog__meta' });
    meta.textContent = ctx.t('changelog.entry.by', '{author}, {date}', {
      values: { author: entry.author || '—', date: entry.authoredAt.slice(0, 10) }
    });
    row.append(meta);

    if (entry.summarizes !== null) {
      row.append(
        el('p', {
          className: 'md-typescale-body-small changelog__summary-note',
          text: ctx.t(
            'changelog.entry.summary',
            'One entry for {count} commits with the same subject. The link is the commit that completed the change.',
            { values: { count: entry.summarizes } }
          )
        })
      );
      const others = el('div', { className: 'changelog__commit-list' });
      for (const sha of entry.commits) {
        others.append(commitReference(sha, sha.slice(0, 7), entry.summary));
      }
      row.append(others);
    }

    if (entry.body.trim() !== '') {
      const bodyId = nextId('changelog-body');
      const pre = el('pre', { className: 'changelog__body-text', text: entry.body, attrs: { id: bodyId } });
      const open = bodiesOpen() || expanded.has(entry.id);
      pre.hidden = !open;
      const toggle = el('button', {
        className: 'md-btn md-btn--text changelog__disclosure',
        attrs: { type: 'button', 'aria-expanded': String(open), 'aria-controls': bodyId }
      });
      toggle.append(
        el('span', {
          className: 'md-btn__label',
          text: open
            ? ctx.t('changelog.entry.hideBody', 'Hide the commit message')
            : ctx.t('changelog.entry.showBody', 'Show the full commit message')
        })
      );
      toggle.addEventListener('click', () => {
        const next = pre.hidden;
        pre.hidden = !next;
        if (next) expanded.add(entry.id);
        else expanded.delete(entry.id);
        toggle.setAttribute('aria-expanded', String(next));
        const labelNode = toggle.querySelector('.md-btn__label');
        if (labelNode) {
          labelNode.textContent = next
            ? ctx.t('changelog.entry.hideBody', 'Hide the commit message')
            : ctx.t('changelog.entry.showBody', 'Show the full commit message');
        }
      });
      row.append(toggle, pre);

      if (entry.bodyTruncated) {
        row.append(
          el('p', {
            className: 'md-typescale-body-small changelog__warning',
            text: ctx.t(
              'changelog.entry.truncated',
              'The commit message was cut at {limit} characters. Open the commit for the whole message.',
              { values: { limit: changelog.bodyLimit } }
            )
          })
        );
      }
    }

    return row;
  }

  /* ---------------- one version ---------------- */

  function renderRelease(item: FilteredRelease, indexInResult: number): HTMLElement {
    const release = item.release;
    const card = components.card({ variant: 'outlined' });
    card.classList.add('changelog__release');
    card.id = anchorId(release.version);
    card.setAttribute('data-version', release.version);
    card.setAttribute('data-appearance-id', 'changelog:release');
    ctx.appearance.applyTo(card, '.changelog__release');

    const header = el('header', { className: 'changelog__release-head' });

    const select = components.checkbox({
      label: ctx.t('changelog.release.select', 'Select version {version}', { values: { version: release.version } }),
      checked: selection.has(release.version),
      onChange: (checked) => toggleSelection(release.version, indexInResult, checked)
    });
    select.root.classList.add('changelog__select');
    select.root.querySelector('span')?.classList.add('md-visually-hidden');
    select.root.addEventListener(
      'click',
      (event) => {
        shiftHeld = (event as MouseEvent).shiftKey === true;
      },
      true
    );
    header.append(select.root);

    const titleWrap = el('div', { className: 'changelog__release-title' });
    const heading = el('h2', { className: 'md-typescale-title-large', text: release.version });
    titleWrap.append(heading);
    if (!release.released) {
      titleWrap.append(components.badge({ label: 'changelog.release.unreleased', severity: 'warning' }));
    }
    const when = el('time', {
      className: 'md-typescale-body-medium changelog__date',
      text: release.date,
      attrs: { datetime: release.timestamp }
    });
    titleWrap.append(when);
    titleWrap.append(commitReference(release.commit, release.shortCommit, release.version));
    header.append(titleWrap);
    card.append(header);

    const meta = el('p', { className: 'md-typescale-body-small changelog__meta' });
    meta.textContent =
      release.previousTag === null
        ? ctx.t('changelog.release.metaFirst', '{count} changes from {commits} commits, the first recorded version', {
            values: { count: release.entries.length, commits: release.commitCount }
          })
        : ctx.t('changelog.release.meta', '{count} changes from {commits} commits since {previous}', {
            values: {
              count: release.entries.length,
              commits: release.commitCount,
              previous: release.previousTag
            }
          });
    card.append(meta);

    if (!release.released) {
      card.append(
        el('p', {
          className: 'md-typescale-body-small md-setting__secondary',
          text: ctx.t(
            'changelog.release.unreleasedNote',
            'Committed after the newest tag and not part of any release yet.'
          )
        })
      );
    }

    if (item.entries.length === 0) {
      card.append(
        el('p', {
          className: 'md-typescale-body-medium changelog__nochanges',
          text: ctx.t(
            'changelog.release.noChanges',
            'No changes are recorded for this version. Its tag points at the same commit as the version before it.'
          )
        })
      );
      return card;
    }

    if (grouped()) {
      for (const group of groupByCategory(item.entries)) {
        const groupLabel = `${categoryName(group.category)} · ${group.entries.length}`;
        const groupHeading = el('h3', {
          className: 'md-typescale-title-small changelog__group',
          text: groupLabel
        });
        if (group.category === 'other') attachNote(groupHeading, groupLabel, uncategorizedNote());
        card.append(groupHeading);
        const list = components.list({ label: categoryName(group.category) });
        list.classList.add('changelog__entries');
        for (const entry of group.entries) list.append(renderEntry(entry, false));
        card.append(list);
      }
    } else {
      const list = components.list({ label: release.version });
      list.classList.add('changelog__entries');
      for (const entry of item.entries) list.append(renderEntry(entry, true));
      card.append(list);
    }

    if (item.hidden > 0) {
      card.append(
        el('p', {
          className: 'md-typescale-body-small changelog__warning',
          text: ctx.t(
            'changelog.release.hiddenByFilter',
            "{hidden} of this version's {total} changes are hidden by the current filter.",
            { values: { hidden: item.hidden, total: release.entries.length } }
          )
        })
      );
    }

    return card;
  }

  /* ---------------- selection ---------------- */

  function toggleSelection(version: string, indexInResult: number, checked: boolean): void {
    if (shiftHeld && lastToggledVersion !== null) {
      const previous = result.releases.findIndex((item) => item.release.version === lastToggledVersion);
      if (previous !== -1) {
        const from = Math.min(previous, indexInResult);
        const to = Math.max(previous, indexInResult);
        for (let cursor = from; cursor <= to; cursor += 1) {
          const version_ = result.releases[cursor].release.version;
          if (checked) selection.add(version_);
          else selection.delete(version_);
        }
        shiftHeld = false;
        lastToggledVersion = version;
        syncSelectionUi();
        return;
      }
    }
    shiftHeld = false;
    if (checked) selection.add(version);
    else selection.delete(version);
    lastToggledVersion = version;
    syncSelectionUi();
  }

  /** The versions an action will act on, and how that scope was decided. */
  function actionScope(): { releases: FilteredRelease[]; fromSelection: boolean } {
    if (selection.size === 0) return { releases: result.releases, fromSelection: false };
    return {
      releases: result.releases.filter((item) => selection.has(item.release.version)),
      fromSelection: true
    };
  }

  function scopedResult(): FilterResult {
    const scope = actionScope();
    return {
      releases: scope.releases,
      entryCount: scope.releases.reduce((total, item) => total + item.entries.length, 0),
      hiddenCount: scope.releases.reduce((total, item) => total + item.hidden, 0)
    };
  }

  function syncSelectionUi(): void {
    const matching = result.releases.length;
    bulkCount.textContent =
      selection.size === 0
        ? ctx.t('changelog.bulk.none', 'No version is selected. Copy and export use the current filter instead.')
        : ctx.t('changelog.bulk.count', '{count} of {matching} matching versions selected', {
            values: { count: selection.size, matching }
          });

    const scoped = scopedResult();
    bulkScope.textContent = ctx.t(
      selection.size === 0 ? 'changelog.export.scopeAll' : 'changelog.export.scopeSelection',
      selection.size === 0 ? 'Everything the filter matches' : 'The selected versions only'
    );
    bulkScope.textContent += ` — ${ctx.t('changelog.status.counts', '{releases} of {totalReleases} versions, {entries} of {totalEntries} changes', {
      values: {
        releases: scoped.releases.length,
        totalReleases: changelog.releases.length,
        entries: scoped.entryCount,
        totalEntries: totalEntries()
      }
    })}`;

    const shown = Math.min(rendered, matching);
    const relabel = (button: HTMLButtonElement, text: string): void => {
      const labelNode = button.querySelector('.md-btn__label');
      if (labelNode) labelNode.textContent = text;
      button.setAttribute('aria-label', text);
    };
    relabel(
      selectPageButton,
      ctx.t('changelog.bulk.selectPage', 'Select the {count} versions shown', { values: { count: shown } })
    );
    relabel(
      selectAllButton,
      ctx.t('changelog.bulk.selectAll', 'Select all {count} matching versions', { values: { count: matching } })
    );

    for (const node of listHost.querySelectorAll<HTMLElement>('.changelog__release')) {
      const version = node.getAttribute('data-version');
      const input = node.querySelector<HTMLInputElement>('.changelog__select input');
      if (version && input) input.checked = selection.has(version);
    }

    // A disabled control that does not say which condition is unmet reads as
    // broken rather than as blocked, so every one of these carries its reason.
    const noMatch = ctx.t('changelog.bulk.disabledNoMatch', 'Nothing is available: the current filter matches no version.');
    const noSelection = ctx.t('changelog.bulk.disabledNoSelection', 'Nothing is selected, so there is nothing to clear.');
    const gate = (button: HTMLButtonElement, disabled: boolean, reason: string): void => {
      button.disabled = disabled;
      if (disabled) {
        button.title = reason;
        button.setAttribute('aria-description', reason);
      } else {
        button.removeAttribute('title');
        button.removeAttribute('aria-description');
      }
    };

    gate(openCommitsButton, scoped.releases.length === 0, noMatch);
    gate(invertButton, matching === 0, noMatch);
    gate(clearSelectionButton, selection.size === 0, noSelection);
    gate(selectPageButton, shown === 0, noMatch);
    gate(selectAllButton, matching === 0, noMatch);
  }

  /* ---------------- window rendering ---------------- */

  function renderWindow(reset: boolean): void {
    if (reset) {
      listHost.textContent = '';
      rendered = 0;
    }
    const target = Math.min(result.releases.length, rendered + pageSize());
    for (let cursor = rendered; cursor < target; cursor += 1) {
      listHost.append(renderRelease(result.releases[cursor], cursor));
    }
    rendered = target;

    moreHost.textContent = '';
    const remaining = result.releases.length - rendered;
    if (remaining > 0) {
      moreHost.append(
        components.button({
          label: ctx.t('changelog.release.more', 'Show more versions ({remaining} left)', {
            values: { remaining }
          }),
          variant: 'outlined',
          icon: 'chevronDown',
          onClick: () => {
            renderWindow(false);
            syncSelectionUi();
          }
        })
      );
    } else if (result.releases.length > 0) {
      moreHost.append(
        el('p', {
          className: 'md-typescale-body-small md-setting__secondary',
          text: ctx.t('changelog.release.allShown', 'Every matching version is shown.')
        })
      );
    }
  }

  function renderIndex(): void {
    index.textContent = '';
    if (result.releases.length === 0) return;
    const list = el('ul', { className: 'changelog__index-list' });
    for (const item of result.releases) {
      const li = el('li');
      const jump = el('button', {
        className: 'changelog__index-item',
        attrs: {
          type: 'button',
          'aria-label': ctx.t('changelog.release.jump', 'Go to version {version}', {
            values: { version: item.release.version }
          })
        }
      });
      jump.append(el('span', { className: 'changelog__index-version', text: item.release.version }));
      jump.append(el('span', { className: 'changelog__index-date', text: item.release.date }));
      jump.addEventListener('click', () => goToVersion(item.release.version));
      li.append(jump);
      list.append(li);
    }
    index.append(list);
  }

  function goToVersion(version: string): void {
    const position = result.releases.findIndex((item) => item.release.version === version);
    if (position === -1) return;
    while (rendered <= position && rendered < result.releases.length) renderWindow(false);
    syncSelectionUi();
    const node = document.getElementById(anchorId(version));
    if (!node) return;
    node.scrollIntoView({ behavior: ctx.a11y.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    node.classList.add('md-teleport-highlight');
    window.setTimeout(() => node.classList.remove('md-teleport-highlight'), 2000);
    const heading = node.querySelector<HTMLElement>('h2');
    if (heading) {
      heading.tabIndex = -1;
      ctx.a11y.focusVisible(heading);
    }
  }

  function refresh(): void {
    result = applyFilter(changelog.releases, filter);

    // A selection that no longer matches is dropped rather than silently acted
    // on later from behind the filter — and dropping it is announced, because
    // work quietly disappearing is exactly what a bulk surface must not do.
    let dropped = 0;
    for (const version of [...selection]) {
      if (!result.releases.some((item) => item.release.version === version)) {
        selection.delete(version);
        dropped += 1;
      }
    }
    if (dropped > 0) {
      ctx.a11y.announce(
        ctx.t('changelog.bulk.dropped', '{count} selected versions no longer match the filter and were deselected.', {
          values: { count: dropped }
        })
      );
    }
    renderWindow(true);
    renderIndex();

    if (result.releases.length === 0) {
      status.textContent = ctx.t(
        'changelog.status.noMatch',
        'No version and no change matched. Widen the date range or clear the search.'
      );
      status.classList.add('changelog__status--empty');
    } else {
      status.classList.remove('changelog__status--empty');
      const description = describeFilter(filter, categoryName);
      status.textContent = ctx.t(
        'changelog.status.counts',
        '{releases} of {totalReleases} versions, {entries} of {totalEntries} changes',
        {
          values: {
            releases: result.releases.length,
            totalReleases: changelog.releases.length,
            entries: result.entryCount,
            totalEntries: totalEntries()
          }
        }
      );
      if (description !== '') {
        status.textContent += ` — ${ctx.t('changelog.filter.active', 'Filters are active: {summary}', {
          values: { summary: description }
        })}`;
      }
    }

    syncSelectionUi();
    persistView();
  }

  /* ---------------- persistence ---------------- */

  let persistTimer: number | null = null;
  let lastPersisted = '';
  function persistView(): void {
    if (ctx.settings.get<boolean>(REMEMBER_VIEW_ID, true) !== true) return;
    if (persistTimer !== null) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      const stored = JSON.stringify(toStoredView(filter));
      if (stored === lastPersisted) return;
      lastPersisted = stored;
      ctx.settings.set(STORED_VIEW_ID, JSON.parse(stored));
    }, 1200);
  }

  function restoreView(): void {
    if (ctx.settings.get<boolean>(REMEMBER_VIEW_ID, true) !== true) return;
    const stored = fromStoredView(ctx.settings.get<unknown>(STORED_VIEW_ID, null));
    if (!stored) return;
    lastPersisted = JSON.stringify(stored);
    // A stored regular expression is deliberately not put back. The shared
    // search bar has no way to be switched into pattern mode from outside it,
    // so restoring the pattern would leave the field reading as plain text
    // while the list filtered as a pattern — two surfaces disagreeing about
    // what is being searched for, with no way for the reader to tell.
    const text = stored.regex ? '' : stored.text;
    if (text !== '') search.setText(text);
    picker.set({ start: stored.from, end: stored.to });
    for (const category of stored.categories) {
      categoryChips.get(category)?.setAttribute('aria-pressed', 'true');
    }
    breakingSwitch.set(stored.breakingOnly);
    releasedSwitch.set(stored.releasedOnly);

    const query = search.query();
    filter = {
      ...filter,
      text: query.text,
      regex: query.regex,
      pattern: query.pattern,
      flags: query.flags,
      from: stored.from,
      to: stored.to,
      categories: stored.categories,
      breakingOnly: stored.breakingOnly,
      releasedOnly: stored.releasedOnly,
      matches: query.text.trim() === '' ? null : query.matches
    };
  }

  /* ---------------- format context ---------------- */

  function formatContext(): FormatContext {
    const snapshot = ctx.i18n.snapshot();
    return {
      categoryLabel: categoryName,
      unreleasedLabel: ctx.t('changelog.release.unreleased', 'Unreleased'),
      languageMode: snapshot.mode,
      productName: ctx.studio.info.productName,
      productVersion: ctx.studio.info.version,
      filterDescription: isFiltering(filter) ? describeFilter(filter, categoryName) : '',
      exportedAt: new Date().toISOString()
    };
  }

  /* ---------------- copy ---------------- */

  async function copyCurrentView(): Promise<void> {
    const scoped = scopedResult();
    if (scoped.releases.length === 0) {
      ctx.notify.warn(
        ctx.t('changelog.copy.nothing', 'There is nothing to copy: the current filter matches no version.')
      );
      return;
    }
    const shape = ctx.settings.get<string>(COPY_FORMAT_ID, 'markdown') === 'text' ? 'text' : 'markdown';
    const text =
      shape === 'text'
        ? toPlainText(scoped, filter, formatContext(), grouped())
        : toMarkdown(scoped, filter, formatContext(), grouped());
    const copied = await copyText(text);
    if (!copied.ok) {
      ctx.notify.error(
        ctx.t('changelog.copy.failed', 'The clipboard refused the copy: {reason}', {
          values: { reason: copied.error }
        })
      );
      return;
    }
    const message = ctx.t(
      'changelog.copy.done',
      '{releases} versions and {entries} changes copied to the clipboard as {format}.',
      {
        values: {
          releases: scoped.releases.length,
          entries: scoped.entryCount,
          format: ctx.t(
            shape === 'text' ? 'changelog.settings.formatText' : 'changelog.settings.formatMarkdown',
            shape === 'text' ? 'Plain text' : 'Markdown'
          )
        }
      }
    );
    ctx.notify.success(message);
    ctx.a11y.announce(message);
    void ctx.history.record('Copied the changelog', 'changelog', {
      shape,
      versions: scoped.releases.length,
      changes: scoped.entryCount,
      filter: toStoredView(filter)
    });
  }

  /* ---------------- export ---------------- */

  function openExportMenu(anchor: HTMLElement): void {
    components.menu({
      anchor,
      label: ctx.t('changelog.export.action', 'Export'),
      items: [
        {
          id: 'changelog.export.markdown',
          label: 'changelog.export.markdown',
          icon: 'book',
          run: () => void exportCurrentView('markdown')
        },
        {
          id: 'changelog.export.text',
          label: 'changelog.export.text',
          icon: 'file',
          run: () => void exportCurrentView('text')
        },
        {
          id: 'changelog.export.records',
          label: 'changelog.export.records',
          icon: 'code',
          separatorBefore: true,
          run: () => void exportRecords(anchor)
        },
        {
          id: 'changelog.copy.action',
          label: 'changelog.copy.action',
          icon: 'copy',
          separatorBefore: true,
          run: () => void copyCurrentView()
        }
      ]
    });
  }

  /** The reviewable preview every bulk action gets before it writes anything. */
  function previewBody(scoped: FilterResult, text: string): HTMLElement {
    const wrap = el('div', { className: 'changelog__preview' });
    wrap.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t(
          'changelog.status.counts',
          '{releases} of {totalReleases} versions, {entries} of {totalEntries} changes',
          {
            values: {
              releases: scoped.releases.length,
              totalReleases: changelog.releases.length,
              entries: scoped.entryCount,
              totalEntries: totalEntries()
            }
          }
        )
      })
    );
    wrap.append(
      el('p', {
        className: 'md-typescale-body-small md-setting__secondary',
        text: ctx.t(
          'changelog.export.rangeNote',
          'The file states the exact range, the filter and the commit ids, so a copy stays traceable after it leaves this window.'
        )
      })
    );
    const sample = text.split('\n').slice(0, 24).join('\n');
    wrap.append(el('pre', { className: 'changelog__preview-text', text: sample }));
    return wrap;
  }

  async function exportCurrentView(shape: 'markdown' | 'text'): Promise<void> {
    const scoped = scopedResult();
    if (scoped.releases.length === 0) {
      ctx.notify.warn(
        ctx.t('changelog.copy.nothing', 'There is nothing to copy: the current filter matches no version.')
      );
      return;
    }
    const context = formatContext();
    const text =
      shape === 'text'
        ? toPlainText(scoped, filter, context, grouped())
        : toMarkdown(scoped, filter, context, grouped());

    const approved = await components.dialog({
      title: shape === 'text' ? 'changelog.export.text' : 'changelog.export.markdown',
      icon: 'download',
      body: previewBody(scoped, text),
      confirmLabel: ctx.t('core.action.save', 'Save')
    });
    if (!approved) return;

    const extension = shape === 'text' ? 'txt' : 'md';
    const target = await ctx.studio.dialog.saveFile({
      title: ctx.t('changelog.export.action', 'Export'),
      defaultPath: suggestFileName(scoped, extension),
      filters: [
        {
          name: shape === 'text' ? 'Plain text' : 'Markdown',
          extensions: [extension]
        }
      ]
    });
    if (!target.ok) {
      ctx.notify.error(
        ctx.t('changelog.export.failed', 'The export was not written: {reason}', {
          values: { reason: target.error }
        })
      );
      return;
    }
    if (target.value === null) return;

    const written = await ctx.studio.fs.writeText(target.value, text);
    if (!written.ok) {
      ctx.notify.error(
        ctx.t('changelog.export.failed', 'The export was not written: {reason}', {
          values: { reason: written.error }
        })
      );
      return;
    }

    const path = target.value;
    ctx.notify.show({
      severity: 'success',
      source: 'changelog',
      title: ctx.t('changelog.export.saved', 'Exported {releases} versions and {entries} changes to {path}', {
        values: { releases: scoped.releases.length, entries: scoped.entryCount, path }
      }),
      actions: [
        {
          label: 'core.action.openInEditor',
          run: async () => {
            const opened = await ctx.studio.editor.open(path);
            if (!opened.ok) {
              ctx.notify.error(
                ctx.t('changelog.export.failed', 'The export was not written: {reason}', {
                  values: { reason: opened.error }
                })
              );
            }
          }
        }
      ]
    });
    void ctx.history.record('Exported the changelog', 'changelog', {
      shape,
      path,
      versions: scoped.releases.length,
      changes: scoped.entryCount,
      filter: toStoredView(filter)
    });
  }

  async function exportRecords(anchor: HTMLElement): Promise<void> {
    const scoped = scopedResult();
    if (scoped.releases.length === 0) {
      ctx.notify.warn(
        ctx.t('changelog.copy.nothing', 'There is nothing to copy: the current filter matches no version.')
      );
      return;
    }
    const rows = toRows(scoped, formatContext());
    const wrap = el('div', { className: 'changelog__preview' });
    const losses = el('p', { className: 'md-typescale-body-small changelog__warning', attrs: { role: 'status' } });
    const preview = el('pre', { className: 'changelog__preview-text' });

    // Declared before the control so its own onChange can call it: the preview
    // and the loss report must track the chosen format, not the one it opened on.
    const refreshPreview = (format: ExportFormat): void => {
      const serialized = ctx.exporter.serialize(rows, format, {
        name: 'changelog',
        schemaVersion: '1'
      });
      const lost = serialized.preflight.losses;
      losses.textContent = lost.map((loss) => `${loss.field}: ${loss.reason}`).join(' · ');
      losses.hidden = lost.length === 0;
      preview.textContent = serialized.text.split('\n').slice(0, 24).join('\n');
    };

    const formatControl = components.select({
      label: 'changelog.export.format',
      options: ctx.exporter.formats().map((format) => ({ value: format, label: format.toUpperCase() })),
      value: 'json',
      onChange: (value) => refreshPreview(value as ExportFormat)
    });

    wrap.append(formatControl.root, losses, preview);
    refreshPreview('json');

    const approved = await components.dialog({
      title: 'changelog.export.records',
      icon: 'download',
      body: wrap,
      confirmLabel: ctx.t('core.action.save', 'Save')
    });
    if (!approved) {
      anchor.focus();
      return;
    }

    const format = formatControl.get() as ExportFormat;
    const path = await ctx.exporter.save(rows, format, {
      name: 'changelog',
      schemaVersion: '1',
      defaultFileName: suggestFileName(scoped, format === 'markdown' ? 'md' : format)
    });
    if (path === null) return;
    ctx.notify.success(
      ctx.t('changelog.export.saved', 'Exported {releases} versions and {entries} changes to {path}', {
        values: { releases: scoped.releases.length, entries: rows.length, path }
      })
    );
    void ctx.history.record('Exported the changelog', 'changelog', {
      shape: format,
      path,
      versions: scoped.releases.length,
      changes: rows.length,
      filter: toStoredView(filter)
    });
  }

  /* ---------------- opening every commit ---------------- */

  async function openEveryCommit(anchor: HTMLElement): Promise<void> {
    const scoped = scopedResult();
    const urls: Array<{ url: string; label: string }> = [];
    for (const item of scoped.releases) {
      for (const entry of item.entries) {
        const url = commitUrl(entry.commit);
        if (url !== null) urls.push({ url, label: `${item.release.version} · ${entry.shortCommit} ${entry.summary}` });
      }
    }
    if (urls.length === 0) {
      ctx.notify.warn(ctx.t('changelog.openAll.none', 'There is no commit to open in what is selected.'));
      return;
    }

    const approved = await ctx.confirm.request({
      action: ctx.t('changelog.openAll.confirmAction', 'Open {count} commit pages in your browser', {
        values: { count: urls.length }
      }),
      affected: urls.slice(0, 40).map((item) => item.label),
      irreversible: ctx.t(
        'changelog.openAll.irreversible',
        'Your browser opens {count} pages. Nothing is deleted and nothing changes on disk, but the windows cannot be recalled once they are handed to the operating system, and you will close them yourself.',
        { values: { count: urls.length } }
      ),
      anchor
    });
    if (!approved) return;

    let opened = 0;
    let lastError = '';
    for (const item of urls) {
      const result_ = await ctx.studio.shell.openExternal(item.url);
      if (result_.ok) opened += 1;
      else lastError = result_.error;
    }
    if (opened === urls.length) {
      ctx.notify.success(
        ctx.t('changelog.openAll.done', '{count} commit pages were handed to your browser.', {
          values: { count: opened }
        })
      );
    } else {
      ctx.notify.warn(
        ctx.t('changelog.openAll.partial', '{opened} of {count} commit pages opened. {failed} were refused: {reason}', {
          values: { opened, count: urls.length, failed: urls.length - opened, reason: lastError }
        })
      );
    }
  }

  /* ---------------- observers and wiring ---------------- */

  const observer = new IntersectionObserver(
    (records) => {
      if (!records.some((record) => record.isIntersecting)) return;
      if (rendered >= result.releases.length) return;
      renderWindow(false);
      syncSelectionUi();
    },
    { rootMargin: '400px' }
  );
  observer.observe(sentinel);

  const unsubscribeSettings = ctx.settings.onChange((change) => {
    if (change.id === GROUP_BY_CATEGORY_ID || change.id === SHOW_BODIES_ID || change.id === PAGE_SIZE_ID) {
      renderWindow(true);
      syncSelectionUi();
    }
  });

  const unsubscribeLanguage = ctx.i18n.onChange(() => {
    // Language, funny level and the emoji switch all restyle every string here,
    // so the surface is rebuilt rather than left half-translated.
    renderWindow(true);
    renderIndex();
    syncSelectionUi();
  });

  restoreView();
  refresh();

  const handle: ChangelogViewHandle = {
    copyCurrentView,
    exportCurrentView,
    goToNewest: () => {
      const newest = result.releases[0]?.release.version ?? changelog.releases[0]?.version;
      if (newest) goToVersion(newest);
    },
    focusSearch: () => search.focus()
  };
  active = handle;

  ctx.onDispose(() => {
    observer.disconnect();
    unsubscribeSettings();
    unsubscribeLanguage();
    if (persistTimer !== null) window.clearTimeout(persistTimer);
    search.destroy();
    // Only this mount's own handle is cleared. Comparing identity rather than
    // blanking the slot means a later mount that has already registered itself
    // is not switched off by an earlier one being torn down.
    if (active === handle) active = null;
  });
}

/** Re-exported so the feature entry point has one import for its destination. */
export { CHANGELOG_TAB_ID };
