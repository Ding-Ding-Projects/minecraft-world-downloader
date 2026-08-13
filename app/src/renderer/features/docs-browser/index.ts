import { setDocsOpener } from '../../core/docs';
import { defineFeature } from '../../core/registry';
import type {
  AppContext,
  DocArticle,
  SettingContext,
  SettingOption,
  TabContext
} from '../../core/registry';

import './styles.css';

import { mountBrowser, requestArticle, runExport } from './browser';
import { DOCS_BUNDLE, allArticles, formatBytes, verifyBundle } from './library';
import {
  DEFAULT_SPLIT_WIDTH,
  MAX_SPLIT_WIDTH,
  MIN_SPLIT_WIDTH,
  SETTING_SEARCH_BODIES,
  SETTING_SHOW_OUTLINE,
  SETTING_SHOW_SOURCE,
  SETTING_SPLIT_WIDTH,
  SETTING_START,
  SETTING_VERIFY_ON_START,
  START_CONTINUE,
  STATE_BOOKMARKS,
  STATE_LAST_ARTICLE,
  STATE_READ,
  readingState
} from './state';
import { STRINGS } from './strings';

/**
 * The offline in-application documentation browser.
 *
 * Distinct from, and additional to, the documentation website. Every feature
 * article is compiled into the build by `app/scripts/bundle-docs.mjs`, and
 * `app/scripts/check-docs-bundle.mjs` fails the build when a file on disk is
 * missing from that bundle — the failure that is otherwise invisible, because a
 * missing article leaves no gap behind it.
 *
 * There is no network call in this feature. No article is fetched, no image is
 * loaded from anywhere, no font is requested and nothing is cached, so it works
 * identically on a machine that has never had a connection.
 */

export const TAB_ID = 'docs-browser.library';

/**
 * Options for the starting-article setting, built from the real bundle.
 *
 * A picker populated from real data can never offer an article that does not
 * exist, which is the whole reason this is a select rather than a text box
 * somebody has to type an id into correctly.
 */
function startOptions(): SettingOption[] {
  const options: SettingOption[] = [
    { value: START_CONTINUE, label: 'docs-browser.setting.start.last' }
  ];
  for (const article of DOCS_BUNDLE.articles ?? []) {
    options.push({ value: article.id, label: article.title });
  }
  return options;
}

/**
 * The bundled articles, registered so the whole application can see them.
 *
 * They are handed to the registry rather than kept private to this feature, so
 * the command palette finds every article by name, the core documentation
 * surface lists them, and `related` ids resolve wherever an article is rendered.
 * Their `manual.` prefix keeps them from colliding with the article ids other
 * feature modules register for themselves.
 */
function bundledArticles(): DocArticle[] {
  return (DOCS_BUNDLE.articles ?? []).map((article) => ({
    id: article.id,
    title: article.title,
    category: article.category,
    body: article.body,
    related: article.related
  }));
}

function describeIntegrity(ctx: AppContext): { ok: boolean; message: string } {
  const report = verifyBundle();
  if (report.ok) {
    return {
      ok: true,
      message: ctx.t('docs-browser.integrity.ok', '{count} bundled articles verified.', {
        values: { count: report.articleCount, size: formatBytes(report.totalBytes) }
      })
    };
  }
  const ids = [...new Set(report.problems.map((problem) => problem.articleId))];
  return {
    ok: false,
    message: ctx.t('docs-browser.integrity.bad', '{count} bundled articles failed verification: {ids}.', {
      values: { count: ids.length, ids: ids.join(', ') }
    })
  };
}

export default defineFeature({
  id: 'docs-browser',
  name: 'Documentation browser',
  description:
    'Reads every bundled documentation article inside the application, with no network connection, resolving article-to-article links in place.',

  strings: STRINGS,

  tabs: [
    {
      id: TAB_ID,
      title: 'docs-browser.tab',
      icon: 'book',
      group: 'group.records',
      order: 110,
      mount(host: HTMLElement, ctx: TabContext) {
        // Re-asserted on every mount so that, while this surface is the one the
        // reader is looking at, an article opened from anywhere in the
        // application lands here rather than being rendered into a pane that is
        // not on screen.
        setDocsOpener((id) => {
          ctx.tabs.open(TAB_ID);
          requestArticle(id);
        });
        mountBrowser(host, ctx);
      }
    }
  ],

  settings: [
    {
      id: 'docs-browser.settings',
      title: 'docs-browser.settings.title',
      icon: 'book',
      order: 150,
      controls: [
        {
          id: SETTING_START,
          label: 'docs-browser.setting.start',
          description: 'docs-browser.setting.start.description',
          kind: 'select',
          defaultValue: START_CONTINUE,
          options: startOptions(),
          keywords: ['documentation', 'manual', 'article', 'start', 'first'],
          validate: (value) => {
            if (typeof value !== 'string') return 'Choose one of the listed articles.';
            if (value === START_CONTINUE) return null;
            return (DOCS_BUNDLE.articles ?? []).some((article) => article.id === value)
              ? null
              : `"${value}" is not an article in this build. Choose one from the list.`;
          }
        },
        {
          id: SETTING_SEARCH_BODIES,
          label: 'docs-browser.setting.searchBodies',
          description: 'docs-browser.setting.searchBodies.description',
          kind: 'switch',
          defaultValue: true,
          keywords: ['documentation', 'search', 'full text', 'body']
        },
        {
          id: SETTING_SHOW_SOURCE,
          label: 'docs-browser.setting.showSource',
          description: 'docs-browser.setting.showSource.description',
          kind: 'switch',
          defaultValue: false,
          keywords: ['documentation', 'source', 'file', 'path', 'markdown']
        },
        {
          id: SETTING_SHOW_OUTLINE,
          label: 'docs-browser.setting.showOutline',
          description: 'docs-browser.setting.showOutline.description',
          kind: 'switch',
          defaultValue: true,
          keywords: ['documentation', 'outline', 'headings', 'on this page']
        },
        {
          id: SETTING_VERIFY_ON_START,
          label: 'docs-browser.setting.verify',
          description: 'docs-browser.setting.verify.description',
          kind: 'switch',
          defaultValue: true,
          keywords: ['documentation', 'integrity', 'checksum', 'verify']
        },
        {
          id: SETTING_SPLIT_WIDTH,
          label: 'docs-browser.setting.splitWidth',
          description: 'docs-browser.setting.splitWidth.description',
          kind: 'number',
          defaultValue: DEFAULT_SPLIT_WIDTH,
          min: MIN_SPLIT_WIDTH,
          max: MAX_SPLIT_WIDTH,
          step: 8,
          keywords: ['documentation', 'layout', 'width', 'splitter', 'index'],
          validate: (value) => {
            const width = Number(value);
            if (!Number.isFinite(width)) return 'Enter a width in pixels.';
            if (width < MIN_SPLIT_WIDTH || width > MAX_SPLIT_WIDTH) {
              return `The index pane is between ${MIN_SPLIT_WIDTH} and ${MAX_SPLIT_WIDTH} pixels wide.`;
            }
            return null;
          }
        },
        {
          id: 'docs-browser.verifyNow',
          label: 'docs-browser.integrity.title',
          description: 'docs-browser.integrity.description',
          kind: 'action',
          defaultValue: null,
          keywords: ['documentation', 'verify', 'checksum', 'integrity', 'bundle'],
          run: (ctx: SettingContext) => {
            const result = describeIntegrity(ctx);
            if (result.ok) {
              ctx.notify.success(ctx.t('docs-browser.integrity.title', 'Verify the bundle now'), result.message);
            } else {
              ctx.notify.error(
                ctx.t('docs-browser.integrity.warnTitle', 'The bundled documentation failed its own check'),
                result.message
              );
            }
          }
        },
        {
          id: 'docs-browser.exportIndex',
          label: 'docs-browser.setting.exportIndex',
          description: 'docs-browser.setting.exportIndex.description',
          kind: 'action',
          defaultValue: null,
          keywords: ['documentation', 'export', 'index', 'csv', 'json'],
          run: async (ctx: SettingContext) => {
            // The export dialog only needs the application context; the tab
            // context's extra members are unused by it, which is why passing the
            // settings context here is safe rather than a shortcut.
            await runExport(ctx as unknown as TabContext, allArticles());
          }
        }
      ]
    }
  ],

  palette: [
    {
      id: 'docs-browser.command.open',
      title: 'docs-browser.palette.open',
      subtitle: 'Documentation',
      icon: 'book',
      kind: 'destination',
      keywords: ['documentation', 'docs', 'manual', 'help', 'article', 'offline'],
      teleport: { tabId: TAB_ID }
    },
    {
      id: 'docs-browser.command.bookmarks',
      title: 'docs-browser.palette.bookmarks',
      subtitle: 'Documentation',
      icon: 'pin',
      kind: 'command',
      keywords: ['documentation', 'bookmark', 'saved', 'article'],
      run: () => {
        const marked = readingState().bookmarked;
        const known = allArticles();
        const first = marked.find((id) => known.some((article) => article.id === id));
        if (!first) {
          notifyNoBookmarks();
          return;
        }
        openArticle(first);
      }
    },
    {
      id: 'docs-browser.command.verify',
      title: 'docs-browser.integrity.title',
      subtitle: 'Documentation',
      icon: 'success',
      kind: 'command',
      keywords: ['documentation', 'verify', 'checksum', 'integrity', 'bundle'],
      run: () => {
        const ctx = appContext;
        if (!ctx) return;
        const result = describeIntegrity(ctx);
        if (result.ok) {
          ctx.notify.success(ctx.t('docs-browser.integrity.title', 'Verify the bundle now'), result.message);
        } else {
          ctx.notify.error(
            ctx.t('docs-browser.integrity.warnTitle', 'The bundled documentation failed its own check'),
            result.message
          );
        }
      }
    }
  ],

  docs: [
    {
      id: 'docs-browser.overview',
      title: 'Reading the documentation offline',
      category: 'Documentation',
      body: [
        'Every article in this browser is compiled into the application. Nothing is fetched, so the',
        'manual reads identically on a machine that has never had a network connection.',
        '',
        '## Where the articles come from',
        '',
        'Two sets of articles share one index, and the difference is stated rather than hidden.',
        '',
        '- **Bundled articles** come from the Markdown files in `docs/features/`. A build script reads',
        '  every one of them and writes a TypeScript module the renderer imports like any other source',
        '  file. Their ids begin `manual.`, and turning on **Show each article’s source file** prints',
        '  the exact path each came from.',
        '- **Module articles** are registered in code by the feature they describe. They have no file',
        '  on disk, and say so where the source path would be.',
        '',
        '## The build guard',
        '',
        'A second script compares the bundle against the files actually present in `docs/features/`',
        'and fails the build when they disagree: an article added and not bundled, an article edited',
        'and not rebundled, a `related` id that names nothing, or a manifest that no longer describes',
        'what it holds.',
        '',
        'It is written that way round deliberately. A guard that validates only the articles it finds',
        'passes cleanly on a bundle containing none of them, because it never looked for the ones that',
        'are absent — and a documentation browser missing its newest article looks exactly like one',
        'that is complete.',
        '',
        '## Verification inside the application',
        '',
        '**Verify the bundle now**, in this feature’s settings and in the command palette, recomputes',
        'each article’s checksum and byte length from its own text and compares them with the values',
        'recorded when the bundle was written. That catches a generated file truncated, hand-edited or',
        'merged badly after the build. It cannot see the files on disk; only the build guard can.',
        '',
        'A failure names the exact article and leaves every other article readable. A bad checksum is a',
        'reason to distrust one article, not to hide the rest.',
        '',
        '## Links, and where they go',
        '',
        'A link from one article to another opens that article here. A link that leaves the bundle —',
        'a path outside the documentation directory, or an address on somebody’s website — is reported',
        'by name, so the reader learns exactly where it pointed instead of pressing a control that',
        'appears broken.'
      ].join('\n'),
      related: []
    },
    ...bundledArticles()
  ],

  init(ctx: AppContext) {
    appContext = ctx;

    ctx.settings.declareDefault(STATE_READ, []);
    ctx.settings.declareDefault(STATE_BOOKMARKS, []);
    ctx.settings.declareDefault(STATE_LAST_ARTICLE, '');

    // Claimed once at boot so an article opened from the palette, from another
    // feature, or from a notification action lands in this browser. Whichever
    // documentation surface mounted most recently owns the opener; this
    // feature's own routes call `requestArticle` directly and never depend on it.
    setDocsOpener((id) => {
      ctx.tabs.open(TAB_ID);
      requestArticle(id);
    });

    if (ctx.settings.get<boolean>(SETTING_VERIFY_ON_START, true) !== false) {
      const result = describeIntegrity(ctx);
      if (!result.ok) {
        ctx.notify.warn(
          ctx.t('docs-browser.integrity.warnTitle', 'The bundled documentation failed its own check'),
          result.message
        );
      }
    }
  }
});

/** Held from `init` so a palette command can reach the services it needs. */
let appContext: AppContext | null = null;

function openArticle(id: string): void {
  appContext?.tabs.open(TAB_ID);
  requestArticle(id);
}

function notifyNoBookmarks(): void {
  const ctx = appContext;
  if (!ctx) return;
  ctx.notify.info(
    ctx.t('docs-browser.palette.bookmarks', 'Go to a bookmarked article'),
    ctx.t('docs-browser.bookmarks.none', 'No article is bookmarked yet.')
  );
}
