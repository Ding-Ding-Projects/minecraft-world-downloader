import { el } from '../../core/a11y';
import type { ExportFormat, SearchBarHandle, TabContext } from '../../core/registry';

import {
  DOCS_BUNDLE,
  allArticles,
  anchorOf,
  formatBytes,
  resolveArticleLink,
  search,
  verifyBundle
} from './library';
import { renderProviderText } from './providerText';
import {
  DEFAULT_SPLIT_WIDTH,
  MAX_SPLIT_WIDTH,
  MIN_SPLIT_WIDTH,
  START_CONTINUE,
  clearAllMarks,
  isBookmarked,
  isRead,
  lastArticle,
  rememberArticle,
  readingState,
  searchBodiesEnabled,
  setBookmarked,
  setRead,
  setSplitWidth,
  showOutlineEnabled,
  showSourceEnabled,
  splitWidth,
  startArticleChoice
} from './state';
import type { LibraryArticle } from './types';

/**
 * The offline documentation browser.
 *
 * Two panes: an index of every bundled and feature-registered article, and the
 * article itself rendered as prose. A splitter between them that drags and also
 * moves from the keyboard. One search covering titles and bodies, carrying the
 * same anchored pattern builder as every other search field in the application.
 * Links between articles that land on the linked article.
 *
 * There is no network call anywhere in this file. Every article is already in
 * memory, compiled into the build.
 */

/** Rows rendered before the list pages in more. Keeps a huge bundle scrollable. */
const PAGE_SIZE = 60;
/** Below this width the two panes stack instead of sitting side by side. */
const STACK_BELOW_PX = 720;
/** Keyboard step for the splitter, and the larger step with Page Up/Down. */
const SPLIT_STEP = 16;
const SPLIT_PAGE = 64;

interface Row {
  article: LibraryArticle;
  node: HTMLElement;
  selectBox: HTMLInputElement;
  readBox: HTMLInputElement;
  bookmarkButton: HTMLButtonElement;
}

/**
 * The mounted browser's own `show`, when there is one.
 *
 * Something outside the tab — a palette entry, an article link from another
 * surface, the shared documentation opener — asks for an article by id. If the
 * tab is mounted it is shown immediately; if it is not, the request is held and
 * honoured the moment it mounts, rather than being dropped on the floor while
 * the tab opens.
 */
let liveShow: ((id: string) => void) | null = null;
let pendingArticle: string | null = null;

export function requestArticle(id: string): void {
  if (liveShow) liveShow(id);
  else pendingArticle = id;
}

export function mountBrowser(host: HTMLElement, ctx: TabContext): void {
  const selected = new Set<string>();
  const trail: string[] = [];
  let trailIndex = -1;
  let currentId: string | null = null;
  let visible: LibraryArticle[] = [];
  let hitCounts = new Map<string, number>();
  let renderLimit = PAGE_SIZE;
  let rows: Row[] = [];
  let lastAnchorIndex = -1;

  const articlesNow = (): LibraryArticle[] => allArticles();

  /* ---------------------------------------------------------------- */
  /* Chrome                                                            */
  /* ---------------------------------------------------------------- */

  const back = ctx.components.iconButton({
    icon: 'chevronLeft',
    label: 'docs-browser.back',
    onClick: () => step(-1)
  });
  const forward = ctx.components.iconButton({
    icon: 'chevronRight',
    label: 'docs-browser.forward',
    onClick: () => step(1)
  });
  const resetLayout = ctx.components.iconButton({
    icon: 'refresh',
    label: 'docs-browser.splitter.reset',
    onClick: () => {
      setSplitWidth(DEFAULT_SPLIT_WIDTH);
      applyWidth(DEFAULT_SPLIT_WIDTH);
      ctx.a11y.announce(ctx.t('docs-browser.splitter.reset', 'Reset the layout'));
    }
  });

  host.append(
    ctx.components.topAppBar({
      title: 'docs-browser.tab',
      subtitle: ctx.t('docs-browser.subtitle', '{count} articles compiled into this build.', {
        values: { count: articlesNow().length }
      }),
      actions: [back, forward, resetLayout]
    })
  );

  /* ---------------------------------------------------------------- */
  /* Search                                                            */
  /* ---------------------------------------------------------------- */

  const summary = el('p', {
    className: 'docs-browser__summary md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const searchBar: SearchBarHandle = ctx.createSearchBar({
    label: 'docs-browser.search',
    placeholder: 'docs-browser.search.placeholder',
    sample: articlesNow()
      .map((article) => article.title)
      .join('\n'),
    onChange: (query) => {
      const all = articlesNow();
      const hits = search(all, query, searchBodiesEnabled());
      hitCounts = new Map(hits.map((hit) => [hit.article.id, hit.bodyHits]));
      visible = hits.map((hit) => hit.article);
      renderLimit = PAGE_SIZE;
      lastAnchorIndex = -1;
      drawIndex();
      summary.textContent = [
        ctx.t('docs-browser.matchCount', '{count} of {total} articles shown.', {
          values: { count: visible.length, total: all.length }
        }),
        query.error ?? ''
      ]
        .filter(Boolean)
        .join(' ');
      ctx.a11y.announce(summary.textContent);
    }
  });

  /* ---------------------------------------------------------------- */
  /* Bulk actions                                                      */
  /* ---------------------------------------------------------------- */

  const selectionStatus = el('p', {
    className: 'docs-browser__selection md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const bulkBar = el('div', {
    className: 'docs-browser__bulk',
    attrs: { role: 'group', 'aria-label': ctx.t('docs-browser.tab', 'Documentation') }
  });

  const selectionButtons: HTMLButtonElement[] = [];

  const selectShown = ctx.components.button({
    label: 'docs-browser.selectShown',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      for (const article of visible) selected.add(article.id);
      syncSelection();
    }
  });
  const selectEvery = ctx.components.button({
    label: 'docs-browser.selectEvery',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      for (const article of articlesNow()) selected.add(article.id);
      syncSelection();
    }
  });
  const invert = ctx.components.button({
    label: 'docs-browser.invert',
    variant: 'text',
    icon: 'sort',
    onClick: () => {
      for (const article of visible) {
        if (selected.has(article.id)) selected.delete(article.id);
        else selected.add(article.id);
      }
      syncSelection();
    }
  });
  const clearSelection = ctx.components.button({
    label: 'docs-browser.clearSelection',
    variant: 'text',
    icon: 'close',
    onClick: () => {
      selected.clear();
      syncSelection();
    }
  });

  const bulkAction = (
    label: string,
    icon: string,
    run: (ids: string[]) => Promise<void>
  ): HTMLButtonElement => {
    const node = ctx.components.button({
      label,
      variant: 'text',
      icon,
      onClick: () => {
        const ids = [...selected];
        if (ids.length === 0) {
          ctx.notify.warn(
            ctx.t(label, label),
            ctx.t('docs-browser.bulk.none', 'Select at least one article first.')
          );
          return;
        }
        void run(ids);
      }
    });
    selectionButtons.push(node);
    return node;
  };

  const reportOutcome = (label: string, outcome: { changed: number; unchanged: number }): void => {
    if (outcome.changed === 0) {
      ctx.notify.info(
        ctx.t(label, label),
        ctx.t('docs-browser.bulk.noChange', 'Nothing changed.', {
          values: { count: outcome.unchanged }
        })
      );
      return;
    }
    ctx.notify.success(
      ctx.t(label, label),
      ctx.t('docs-browser.bulk.done', '{count} articles updated.', {
        values: { count: outcome.changed }
      })
    );
  };

  const markRead = bulkAction('docs-browser.bulk.markRead', 'success', async (ids) => {
    reportOutcome('docs-browser.bulk.markRead', await setRead(ids, true));
    refreshMarks();
  });
  const markUnread = bulkAction('docs-browser.bulk.markUnread', 'visibility', async (ids) => {
    reportOutcome('docs-browser.bulk.markUnread', await setRead(ids, false));
    refreshMarks();
  });
  const addBookmark = bulkAction('docs-browser.bulk.bookmark', 'pin', async (ids) => {
    reportOutcome('docs-browser.bulk.bookmark', await setBookmarked(ids, true));
    refreshMarks();
  });
  const removeBookmark = bulkAction('docs-browser.bulk.unbookmark', 'remove', async (ids) => {
    reportOutcome('docs-browser.bulk.unbookmark', await setBookmarked(ids, false));
    refreshMarks();
  });
  const copySelection = bulkAction('docs-browser.bulk.copy', 'copy', async (ids) => {
    const chosen = articlesNow().filter((article) => ids.includes(article.id));
    const text = chosen
      .map((article) => `<!-- ${article.id} — ${article.sourceFile ?? 'registered in code'} -->\n\n${article.body}`)
      .join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(text);
      ctx.notify.success(
        ctx.t('docs-browser.bulk.copy', 'Copy as Markdown'),
        ctx.t('docs-browser.copy.ok', '{count} articles copied.', { values: { count: chosen.length } })
      );
    } catch (error) {
      ctx.notify.error(
        ctx.t('docs-browser.bulk.copy', 'Copy as Markdown'),
        ctx.t('docs-browser.copy.fail', 'The clipboard refused the copy: {reason}.', {
          values: { reason: error instanceof Error ? error.message : String(error) }
        })
      );
    }
  });
  const exportSelection = bulkAction('docs-browser.bulk.export', 'download', async (ids) => {
    const chosen = articlesNow().filter((article) => ids.includes(article.id));
    await runExport(ctx, chosen);
  });

  const clearMarks = ctx.components.button({
    label: 'docs-browser.clearAll',
    variant: 'text',
    danger: true,
    icon: 'trash',
    onClick: async (event) => {
      const state = readingState();
      if (state.read.length === 0 && state.bookmarked.length === 0) {
        ctx.notify.info(
          ctx.t('docs-browser.clearAll', 'Clear every read mark and bookmark'),
          ctx.t('docs-browser.clearAll.empty', 'There are no read marks or bookmarks to clear.')
        );
        return;
      }
      const approved = await ctx.confirm.request({
        action: `Clear ${state.read.length} read marks and ${state.bookmarked.length} bookmarks in the documentation browser`,
        affected: [
          `${state.read.length} articles marked read`,
          `${state.bookmarked.length} bookmarked articles`
        ],
        irreversible:
          'Every read mark and every bookmark is removed at once. The articles themselves are untouched, and the cleared lists are written to local history, so this can be restored from there — but nothing in this surface undoes it.',
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      const cleared = await clearAllMarks();
      refreshMarks();
      ctx.notify.success(
        ctx.t('docs-browser.clearAll', 'Clear every read mark and bookmark'),
        ctx.t('docs-browser.clearAll.done', 'Cleared {read} read marks and {bookmarks} bookmarks.', {
          values: { read: cleared.read, bookmarks: cleared.bookmarks }
        })
      );
    }
  });

  bulkBar.append(
    selectShown,
    selectEvery,
    invert,
    clearSelection,
    ctx.components.divider(true),
    markRead,
    markUnread,
    addBookmark,
    removeBookmark,
    copySelection,
    exportSelection,
    ctx.components.divider(true),
    clearMarks
  );

  /* ---------------------------------------------------------------- */
  /* Layout                                                            */
  /* ---------------------------------------------------------------- */

  const layout = el('div', { className: 'docs-browser__layout' });
  const indexPane = el('nav', {
    className: 'docs-browser__index',
    attrs: { 'aria-label': ctx.t('docs-browser.index.label', 'Article index') }
  });
  const splitter = el('div', {
    className: 'docs-browser__splitter',
    attrs: {
      role: 'separator',
      tabindex: '0',
      'aria-orientation': 'vertical',
      'aria-label': ctx.t('docs-browser.splitter', 'Resize the index pane'),
      'aria-valuemin': String(MIN_SPLIT_WIDTH),
      'aria-valuemax': String(MAX_SPLIT_WIDTH),
      'aria-valuenow': String(splitWidth())
    }
  });
  const articlePane = el('article', {
    className: 'docs-browser__article',
    attrs: {
      'aria-label': ctx.t('docs-browser.article.label', 'Article'),
      'aria-live': 'polite',
      tabindex: '-1'
    }
  });
  layout.append(indexPane, splitter, articlePane);

  const applyWidth = (value: number): void => {
    const clamped = Math.min(MAX_SPLIT_WIDTH, Math.max(MIN_SPLIT_WIDTH, Math.round(value)));
    layout.style.setProperty('--docs-browser-index-width', `${clamped}px`);
    splitter.setAttribute('aria-valuenow', String(clamped));
  };
  applyWidth(splitWidth());

  let dragging = false;
  splitter.addEventListener('pointerdown', (event) => {
    if (window.innerWidth < STACK_BELOW_PX) return;
    dragging = true;
    splitter.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  splitter.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    applyWidth(event.clientX - layout.getBoundingClientRect().left);
  });
  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
    setSplitWidth(Number(splitter.getAttribute('aria-valuenow') ?? DEFAULT_SPLIT_WIDTH));
  };
  splitter.addEventListener('pointerup', endDrag);
  splitter.addEventListener('pointercancel', endDrag);

  splitter.addEventListener('keydown', (event) => {
    const current = Number(splitter.getAttribute('aria-valuenow') ?? DEFAULT_SPLIT_WIDTH);
    let next = current;
    if (event.key === 'ArrowLeft') next = current - SPLIT_STEP;
    else if (event.key === 'ArrowRight') next = current + SPLIT_STEP;
    else if (event.key === 'PageUp') next = current - SPLIT_PAGE;
    else if (event.key === 'PageDown') next = current + SPLIT_PAGE;
    else if (event.key === 'Home') next = MIN_SPLIT_WIDTH;
    else if (event.key === 'End') next = MAX_SPLIT_WIDTH;
    else return;
    event.preventDefault();
    applyWidth(next);
    setSplitWidth(next);
  });

  host.append(searchBar.root, summary, bulkBar, selectionStatus, layout);

  /* ---------------------------------------------------------------- */
  /* The index                                                         */
  /* ---------------------------------------------------------------- */

  function syncSelection(): void {
    for (const row of rows) row.selectBox.checked = selected.has(row.article.id);
    const total = articlesNow().length;
    selectionStatus.textContent = ctx.t(
      'docs-browser.selection',
      '{count} selected of {shown} shown, {total} in all.',
      { values: { count: selected.size, shown: visible.length, total } }
    );
    const none = selected.size === 0;
    for (const button of selectionButtons) {
      button.disabled = none;
      if (none) {
        button.setAttribute(
          'title',
          ctx.t('docs-browser.bulk.none', 'Select at least one article first.')
        );
      } else {
        button.removeAttribute('title');
      }
    }
  }

  function refreshMarks(): void {
    for (const row of rows) {
      row.readBox.checked = isRead(row.article.id);
      const marked = isBookmarked(row.article.id);
      row.bookmarkButton.setAttribute('aria-pressed', String(marked));
      row.node.classList.toggle('docs-browser__row--bookmarked', marked);
      row.node.classList.toggle('docs-browser__row--read', row.readBox.checked);
    }
    if (currentId) show(currentId, { record: false });
  }

  function buildRow(article: LibraryArticle, orderIndex: number): Row {
    const node = el('li', { className: 'docs-browser__row' });
    node.dataset.articleId = article.id;
    node.setAttribute('data-appearance-id', 'docs-browser:row');

    const box = ctx.components.checkbox({
      label: `${ctx.t('docs-browser.select', 'Select')}: ${article.title}`,
      checked: selected.has(article.id),
      onChange: (checked) => {
        applySelection(article.id, orderIndex, checked, shiftHeld);
        shiftHeld = false;
      }
    });
    box.root.querySelector('span')?.classList.add('md-visually-hidden');
    box.root.classList.add('docs-browser__row-select');

    // The checkbox's own change event carries no modifier state, so the shift
    // key is captured from the interaction that produced it. Shift+Space on a
    // focused checkbox produces a click with `shiftKey` set, so this covers the
    // keyboard path as well as the pointer one.
    let shiftHeld = false;
    box.root.addEventListener(
      'click',
      (event) => {
        shiftHeld = (event as MouseEvent).shiftKey === true;
      },
      true
    );

    const open = ctx.components.button({
      label: article.title,
      variant: 'text',
      onClick: () => show(article.id)
    });
    open.classList.add('docs-browser__row-title');

    const meta = el('span', {
      className: 'docs-browser__row-meta md-typescale-body-small',
      text: ctx.t('docs-browser.meta', '{minutes} min read · {size} · {category}', {
        values: {
          minutes: article.readingMinutes,
          size: formatBytes(article.bytes),
          category: article.category
        }
      })
    });

    const text = el('div', { className: 'docs-browser__row-text' });
    text.append(open, meta);

    const hits = hitCounts.get(article.id) ?? 0;
    if (hits > 0) {
      text.append(
        el('span', {
          className: 'docs-browser__row-hits md-typescale-label-small',
          text: ctx.t('docs-browser.hits', '{count} matches in the body', { values: { count: hits } })
        })
      );
    }

    const readControl = ctx.components.checkbox({
      label: 'docs-browser.read',
      checked: isRead(article.id),
      onChange: (checked) => {
        void setRead([article.id], checked).then(() => refreshMarks());
      }
    });
    readControl.root.classList.add('docs-browser__row-read');

    const bookmark = ctx.components.iconButton({
      icon: 'pin',
      label: 'docs-browser.bookmark',
      toggled: isBookmarked(article.id),
      onClick: () => {
        void setBookmarked([article.id], !isBookmarked(article.id)).then(() => refreshMarks());
      }
    });

    node.append(box.root, text, readControl.root, bookmark);

    const selectInput = box.root.querySelector('input');
    const readInput = readControl.root.querySelector('input');
    if (!(selectInput instanceof HTMLInputElement) || !(readInput instanceof HTMLInputElement)) {
      throw new Error('The component kit no longer builds a checkbox around an input element.');
    }

    return { article, node, selectBox: selectInput, readBox: readInput, bookmarkButton: bookmark };
  }

  /**
   * Applies a selection change, extending from the previous anchor when shift
   * was held. The range is taken over the articles currently shown, which is
   * what the user can actually see, rather than over the whole library.
   */
  function applySelection(id: string, index: number, checked: boolean, shift: boolean): void {
    if (shift && lastAnchorIndex >= 0 && lastAnchorIndex !== index) {
      const from = Math.min(lastAnchorIndex, index);
      const to = Math.max(lastAnchorIndex, index);
      for (let cursor = from; cursor <= to; cursor += 1) {
        const article = visible[cursor];
        if (!article) continue;
        if (checked) selected.add(article.id);
        else selected.delete(article.id);
      }
    } else if (checked) {
      selected.add(id);
    } else {
      selected.delete(id);
    }
    lastAnchorIndex = index;
    syncSelection();
  }

  function drawIndex(): void {
    indexPane.textContent = '';
    rows = [];

    if (visible.length === 0) {
      indexPane.append(
        ctx.components.emptyState({
          title:
            articlesNow().length === 0 ? 'docs-browser.empty.noArticles' : 'docs-browser.empty.noMatches'
        })
      );
      syncSelection();
      return;
    }

    const shown = visible.slice(0, renderLimit);
    let cursor = 0;
    let currentCategory: string | null = null;
    let listNode: HTMLElement | null = null;

    for (const article of shown) {
      if (article.category !== currentCategory) {
        currentCategory = article.category;
        indexPane.append(
          el('h2', { className: 'docs-browser__category md-typescale-title-small', text: currentCategory })
        );
        listNode = ctx.components.list({ label: currentCategory });
        listNode.classList.add('docs-browser__list');
        indexPane.append(listNode);
      }
      const row = buildRow(article, cursor);
      rows.push(row);
      listNode?.append(row.node);
      cursor += 1;
    }

    const remaining = visible.length - shown.length;
    if (remaining > 0) {
      // A real button, not a bare sentinel: the observer below activates it when
      // it scrolls into view, and somebody navigating by keyboard reaches and
      // presses the same control.
      const more = ctx.components.button({
        label: `${ctx.t('docs-browser.matchCount', '{count} of {total} articles shown.', {
          values: { count: shown.length, total: visible.length }
        })}`,
        variant: 'tonal',
        icon: 'chevronDown',
        onClick: () => {
          renderLimit += PAGE_SIZE;
          drawIndex();
        }
      });
      more.classList.add('docs-browser__more');
      indexPane.append(more);
      observer?.disconnect();
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer?.disconnect();
            renderLimit += PAGE_SIZE;
            drawIndex();
          }
        }
      });
      observer.observe(more);
    }

    highlightCurrent();
    syncSelection();
    refreshRowMarks();
  }

  function refreshRowMarks(): void {
    for (const row of rows) {
      row.node.classList.toggle('docs-browser__row--read', isRead(row.article.id));
      row.node.classList.toggle('docs-browser__row--bookmarked', isBookmarked(row.article.id));
    }
  }

  function highlightCurrent(): void {
    for (const row of rows) {
      const active = row.article.id === currentId;
      row.node.classList.toggle('docs-browser__row--current', active);
      row.node.setAttribute('aria-current', active ? 'true' : 'false');
    }
  }

  let observer: IntersectionObserver | null = null;

  /* ---------------------------------------------------------------- */
  /* The article                                                       */
  /* ---------------------------------------------------------------- */

  function step(direction: -1 | 1): void {
    const next = trailIndex + direction;
    if (next < 0) {
      ctx.notify.info(
        ctx.t('docs-browser.back', 'Back'),
        ctx.t('docs-browser.nav.noBack', 'There is nothing earlier to go back to.')
      );
      return;
    }
    if (next >= trail.length) {
      ctx.notify.info(
        ctx.t('docs-browser.forward', 'Forward'),
        ctx.t('docs-browser.nav.noForward', 'There is nothing further forward to go to.')
      );
      return;
    }
    trailIndex = next;
    render(trail[trailIndex]);
    syncNav();
  }

  function syncNav(): void {
    const noBack = trailIndex <= 0;
    const noForward = trailIndex >= trail.length - 1;
    back.disabled = noBack;
    forward.disabled = noForward;
    back.title = noBack
      ? ctx.t('docs-browser.nav.noBack', 'There is nothing earlier to go back to.')
      : ctx.t('docs-browser.back', 'Back');
    forward.title = noForward
      ? ctx.t('docs-browser.nav.noForward', 'There is nothing further forward to go to.')
      : ctx.t('docs-browser.forward', 'Forward');
  }

  function show(id: string, options: { record?: boolean; anchor?: string | null } = {}): void {
    if (options.record !== false && trail[trailIndex] !== id) {
      trail.splice(trailIndex + 1);
      trail.push(id);
      trailIndex = trail.length - 1;
    }
    render(id, options.anchor ?? null);
    syncNav();
  }

  function render(id: string, anchor: string | null = null): void {
    const article = allArticles().find((candidate) => candidate.id === id) ?? null;
    articlePane.textContent = '';
    currentId = article?.id ?? null;

    if (!article) {
      articlePane.append(
        ctx.components.emptyState({
          title: 'docs-browser.empty.pick',
          body: 'docs-browser.related.missing'
        })
      );
      highlightCurrent();
      return;
    }

    rememberArticle(article.id);

    const header = el('header', { className: 'docs-browser__article-head' });
    header.append(el('h1', { className: 'md-typescale-headline-medium', text: article.title }));
    header.append(
      el('p', {
        className: 'md-typescale-label-medium docs-browser__meta',
        text: ctx.t('docs-browser.meta', '{minutes} min read · {size} · {category}', {
          values: {
            minutes: article.readingMinutes,
            size: formatBytes(article.bytes),
            category: article.category
          }
        })
      })
    );

    if (showSourceEnabled()) {
      header.append(
        el('p', {
          className: 'md-typescale-body-small docs-browser__source',
          text: article.sourceFile
            ? ctx.t('docs-browser.source', 'Source: {file}', { values: { file: article.sourceFile } })
            : ctx.t('docs-browser.source.module', 'Registered by a feature module.')
        })
      );
    }

    const controls = el('div', { className: 'docs-browser__article-controls' });
    const readHere = ctx.components.checkbox({
      label: 'docs-browser.read',
      checked: isRead(article.id),
      onChange: (checked) => {
        void setRead([article.id], checked).then(() => {
          refreshRowMarks();
        });
      }
    });
    const bookmarkHere = ctx.components.iconButton({
      icon: 'pin',
      label: 'docs-browser.bookmark',
      toggled: isBookmarked(article.id),
      onClick: (event) => {
        const next = !isBookmarked(article.id);
        void setBookmarked([article.id], next).then(() => {
          (event.currentTarget as HTMLElement).setAttribute('aria-pressed', String(next));
          refreshRowMarks();
        });
      }
    });
    controls.append(readHere.root, bookmarkHere);
    header.append(controls);
    articlePane.append(header);

    const prose = renderProviderText(article.body, {
      label: 'docs-browser.markdown.region',
      emptyLabel: 'docs-browser.empty.body',
      onRelativeLink: (target) => {
        const resolved = resolveArticleLink(target, allArticles());
        if (!resolved) return false;
        show(resolved, { anchor: anchorOf(target) });
        return true;
      },
      onUnresolvedLink: (target) => {
        ctx.notify.warn(
          ctx.t('docs-browser.tab', 'Documentation'),
          ctx.t('docs-browser.link.outside', 'That link points outside the bundled documentation: {target}', {
            values: { target }
          })
        );
      }
    });

    const outlineHost = el('nav', {
      className: 'docs-browser__outline',
      attrs: { 'aria-label': ctx.t('docs-browser.outline', 'On this page') }
    });
    articlePane.append(outlineHost, prose);

    if (showOutlineEnabled()) buildOutline(outlineHost, prose, article);
    else outlineHost.remove();

    articlePane.append(buildSuggestions(article));

    highlightCurrent();

    if (anchor) {
      const target = prose.querySelector(`#${cssEscape(`docs-heading-${anchor}`)}`);
      if (target instanceof HTMLElement) scrollTo(target);
      else articlePane.scrollTop = 0;
    } else {
      articlePane.scrollTop = 0;
    }
  }

  function scrollTo(target: HTMLElement): void {
    target.scrollIntoView({
      behavior: ctx.a11y.reducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
    ctx.a11y.focusVisible(target);
  }

  /**
   * Builds the "On this page" outline and wires each entry to a real heading.
   *
   * The recorded headings and the rendered ones come from the same source text
   * under the same rule, so they normally line up one to one. When they do not
   * — a renderer change, a malformed article — the outline is omitted and says
   * why, rather than offering links that scroll nowhere. An outline whose links
   * do nothing is worse than no outline, because it looks like the page is
   * broken rather than like the feature is off.
   */
  function buildOutline(hostNode: HTMLElement, prose: HTMLElement, article: LibraryArticle): void {
    const rendered = [...prose.querySelectorAll<HTMLElement>('h2, h3, h4, h5, h6')];
    const recorded = article.headings;
    if (recorded.length === 0 || rendered.length !== recorded.length) {
      hostNode.append(
        el('p', {
          className: 'md-typescale-body-small docs-browser__outline-note',
          text: ctx.t('docs-browser.outline.unavailable', 'The heading outline is not shown for this article.')
        })
      );
      return;
    }

    hostNode.append(
      el('h2', { className: 'md-typescale-title-small', text: ctx.t('docs-browser.outline', 'On this page') })
    );
    const listNode = el('ul', { className: 'docs-browser__outline-list' });

    recorded.forEach((heading, index) => {
      const node = rendered[index];
      node.id = `docs-heading-${heading.anchor}`;
      const item = el('li');
      item.style.setProperty('--docs-browser-outline-level', String(Math.max(0, heading.level - 1)));
      const link = ctx.components.button({
        label: heading.text,
        variant: 'text',
        onClick: () => scrollTo(node)
      });
      link.classList.add('docs-browser__outline-link');
      item.append(link);
      listNode.append(item);
    });

    hostNode.append(listNode);
  }

  /**
   * Suggested reading, so no article is a dead end.
   *
   * Two lists, labelled separately because they are not the same claim: the
   * first is what this article's author actually linked to, the second is what
   * happens to sit beside it in the same category.
   */
  function buildSuggestions(article: LibraryArticle): HTMLElement {
    const wrap = el('section', { className: 'docs-browser__suggestions' });
    const library = allArticles();
    const byId = new Map(library.map((entry) => [entry.id, entry]));

    const related = article.related.filter((id) => id !== article.id);
    wrap.append(
      el('h2', {
        className: 'md-typescale-title-medium',
        text: ctx.t('docs-browser.related', 'Suggested articles')
      })
    );

    if (related.length > 0) {
      const listNode = ctx.components.list({ label: 'docs-browser.related' });
      for (const id of related) {
        const target = byId.get(id);
        listNode.append(
          ctx.components.listItem({
            headline: target?.title ?? id,
            supporting: target
              ? target.category
              : ctx.t('docs-browser.related.missing', 'This article has not been written yet.'),
            leadingIcon: 'book',
            onActivate: target ? () => show(id) : undefined
          })
        );
      }
      wrap.append(listNode);
    }

    const neighbours = library.filter(
      (entry) => entry.category === article.category && entry.id !== article.id && !related.includes(entry.id)
    );
    if (neighbours.length > 0) {
      wrap.append(
        el('h3', {
          className: 'md-typescale-title-small',
          text: ctx.t('docs-browser.alsoInCategory', 'Also in {category}', {
            values: { category: article.category }
          })
        })
      );
      const listNode = ctx.components.list({ label: article.category });
      for (const neighbour of neighbours.slice(0, 8)) {
        listNode.append(
          ctx.components.listItem({
            headline: neighbour.title,
            supporting: ctx.t('docs-browser.meta', '{minutes} min read · {size} · {category}', {
              values: {
                minutes: neighbour.readingMinutes,
                size: formatBytes(neighbour.bytes),
                category: neighbour.category
              }
            }),
            leadingIcon: 'book',
            onActivate: () => show(neighbour.id)
          })
        );
      }
      wrap.append(listNode);
    }

    if (related.length === 0 && neighbours.length === 0) {
      wrap.append(
        ctx.components.emptyState({
          title: 'docs-browser.related',
          body: 'docs-browser.bookmarks.none'
        })
      );
    }

    return wrap;
  }

  /* ---------------------------------------------------------------- */
  /* First paint                                                       */
  /* ---------------------------------------------------------------- */

  visible = articlesNow();
  drawIndex();
  summary.textContent = ctx.t('docs-browser.matchCount', '{count} of {total} articles shown.', {
    values: { count: visible.length, total: visible.length }
  });

  const choice = startArticleChoice();
  const requested = pendingArticle;
  pendingArticle = null;
  const opening =
    requested && visible.some((article) => article.id === requested)
      ? requested
      : choice === START_CONTINUE
        ? lastArticle() ?? visible[0]?.id ?? null
        : visible.some((article) => article.id === choice)
          ? choice
          : visible[0]?.id ?? null;
  if (opening) show(opening);
  else render('');
  syncNav();
  syncSelection();

  liveShow = (id: string) => show(id);

  const stopWatchingSettings = ctx.settings.onChange((change) => {
    if (!change.id.startsWith('docs-browser.')) return;
    if (change.id === 'docs-browser.splitWidth') applyWidth(Number(change.value));
    if (currentId) render(currentId);
  });

  ctx.onDispose(() => {
    searchBar.destroy();
    observer?.disconnect();
    stopWatchingSettings();
    liveShow = null;
  });
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

/** One flat record per article: everything the index shows, minus the text. */
export function indexRecords(articles: LibraryArticle[]): Array<Record<string, unknown>> {
  return articles.map((article) => ({
    id: article.id,
    title: article.title,
    category: article.category,
    origin: article.origin,
    sourceFile: article.sourceFile ?? '',
    readingMinutes: article.readingMinutes,
    bytes: article.bytes,
    headings: article.headings.length,
    related: article.related.join(' '),
    read: isRead(article.id),
    bookmarked: isBookmarked(article.id)
  }));
}

/**
 * Asks which format, states what that format cannot carry, and only then writes.
 *
 * The preflight runs before anything is saved, which is the whole point of
 * showing it: a reader who learns after the fact that their chosen format
 * dropped a column has been told too late to do anything about it.
 */
export async function runExport(ctx: TabContext, articles: LibraryArticle[]): Promise<void> {
  const records = indexRecords(articles);
  const body = el('div', { className: 'docs-browser__export' });
  const losses = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  let format: ExportFormat = 'json';

  const describeLosses = (): void => {
    const preflight = ctx.exporter.preflight(records, format);
    losses.textContent =
      preflight.losses.length === 0
        ? ''
        : ctx.t('docs-browser.export.losses', 'This format cannot carry: {fields}.', {
            values: { fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join(', ') }
          });
  };

  const picker = ctx.components.select({
    label: 'docs-browser.export.format',
    value: format,
    options: ctx.exporter.formats().map((candidate) => ({ value: candidate, label: candidate })),
    onChange: (value) => {
      format = value as ExportFormat;
      describeLosses();
    }
  });
  describeLosses();
  body.append(picker.root, losses);

  const approved = await ctx.components.dialog({
    title: ctx.t('docs-browser.bulk.export', 'Export…'),
    body,
    icon: 'download',
    confirmLabel: ctx.t('docs-browser.bulk.export', 'Export…')
  });
  if (!approved) return;

  const path = await ctx.exporter.save(records, format, {
    name: 'documentation-index',
    schemaVersion: String(DOCS_BUNDLE.schemaVersion),
    defaultFileName: `documentation-index.${format}`
  });
  if (!path) return;
  ctx.notify.success(
    ctx.t('docs-browser.bulk.export', 'Export…'),
    ctx.t('docs-browser.export.saved', 'Saved to {path}', { values: { path } })
  );
}

/** Escapes an id for use in a CSS selector, without assuming `CSS.escape`. */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

export { verifyBundle };
