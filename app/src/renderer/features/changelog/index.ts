import './styles.css';

import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry } from '../../core/registry';

import { changelog, isEmptyBundle, totalEntries } from './data';
import { CHANGELOG_DOCS } from './docs';
import {
  COPY_FORMAT_ID,
  GROUP_BY_CATEGORY_ID,
  PAGE_SIZE_ID,
  REMEMBER_VIEW_ID,
  SHOW_BODIES_ID,
  STORED_VIEW_ID,
  changelogSettings
} from './settings';
import { CHANGELOG_STRINGS } from './strings';
import { CHANGELOG_TAB_ID, activeView, mountChangelog } from './view';

/**
 * The changelog viewer.
 *
 * Every version this project ever tagged, the changes in each one, and the
 * commit behind every change — generated from the repository at build time and
 * validated before the build finishes, so no entry can ship with a commit
 * reference that resolves to nothing.
 */

/**
 * Runs an action against the live viewer, opening it first when it is not
 * mounted.
 *
 * A palette command that acts on "the current view" has to have a current view.
 * Rather than failing quietly or acting on a guess, the destination is opened
 * and the action retried once the tab has mounted, and the user is told that is
 * what happened.
 */
function withView(ctx: AppContext, action: (view: NonNullable<ReturnType<typeof activeView>>) => void): void {
  const existing = activeView();
  if (existing) {
    action(existing);
    return;
  }
  ctx.tabs.open(CHANGELOG_TAB_ID);
  ctx.notify.info(
    ctx.t(
      'changelog.palette.notOpen',
      'The changelog was opened first, because that action works on what it is showing.'
    )
  );
  // The tab mounts synchronously inside `open`, but a frame is allowed for the
  // first window of releases to render before an action reads it.
  window.requestAnimationFrame(() => {
    const view = activeView();
    if (view) action(view);
  });
}

function paletteEntries(ctx: AppContext): PaletteEntry[] {
  return [
    {
      id: 'changelog.command.copy',
      title: ctx.t('changelog.palette.copy', 'Changelog: copy the current view'),
      icon: 'copy',
      kind: 'command',
      keywords: ['changelog', 'copy', 'clipboard', 'release', 'version', 'history'],
      run: () => withView(ctx, (view) => void view.copyCurrentView())
    },
    {
      id: 'changelog.command.exportMarkdown',
      title: ctx.t('changelog.palette.exportMarkdown', 'Changelog: export the current view as Markdown'),
      icon: 'download',
      kind: 'command',
      keywords: ['changelog', 'export', 'markdown', 'release', 'version'],
      run: () => withView(ctx, (view) => void view.exportCurrentView('markdown'))
    },
    {
      id: 'changelog.command.exportText',
      title: ctx.t('changelog.palette.exportText', 'Changelog: export the current view as plain text'),
      icon: 'download',
      kind: 'command',
      keywords: ['changelog', 'export', 'text', 'release', 'version'],
      run: () => withView(ctx, (view) => void view.exportCurrentView('text'))
    },
    {
      id: 'changelog.command.latest',
      title: ctx.t('changelog.palette.latest', 'Changelog: go to the newest version'),
      icon: 'chevronUp',
      kind: 'command',
      keywords: ['changelog', 'newest', 'latest', 'version', 'release'],
      run: () => withView(ctx, (view) => view.goToNewest())
    },
    {
      id: 'changelog.command.search',
      title: ctx.t('changelog.search.label', 'Search the changelog'),
      icon: 'search',
      kind: 'command',
      keywords: ['changelog', 'search', 'find', 'regex', 'pattern'],
      run: () => withView(ctx, (view) => view.focusSearch())
    }
  ];
}

export default defineFeature({
  id: 'changelog',
  name: 'Changelog',
  description:
    'Every released version with its date, its categorized changes and the commit behind each one, generated from the repository and validated before the build.',
  strings: CHANGELOG_STRINGS,
  settings: [changelogSettings()],
  docs: CHANGELOG_DOCS,
  tabs: [
    {
      id: CHANGELOG_TAB_ID,
      title: 'changelog.title',
      icon: 'history',
      order: 820,
      mount: mountChangelog
    }
  ],
  palette: [
    {
      id: 'changelog.destination',
      title: 'changelog.palette.open',
      subtitle: 'changelog.subtitle',
      icon: 'history',
      kind: 'destination',
      keywords: ['changelog', 'release', 'version', 'history', 'commit', 'notes', 'what is new'],
      teleport: { tabId: CHANGELOG_TAB_ID }
    },
    // The settings this feature owns are reachable by name from the palette and
    // render their live controls inline, exactly as any other setting does.
    {
      id: 'changelog.setting.pageSize',
      title: 'changelog.settings.pageSize',
      icon: 'tune',
      kind: 'setting',
      settingId: PAGE_SIZE_ID,
      keywords: ['changelog', 'versions', 'render', 'page']
    },
    {
      id: 'changelog.setting.groupByCategory',
      title: 'changelog.settings.groupByCategory',
      icon: 'tune',
      kind: 'setting',
      settingId: GROUP_BY_CATEGORY_ID,
      keywords: ['changelog', 'group', 'category']
    },
    {
      id: 'changelog.setting.showBodies',
      title: 'changelog.settings.showBodies',
      icon: 'tune',
      kind: 'setting',
      settingId: SHOW_BODIES_ID,
      keywords: ['changelog', 'commit', 'message', 'expand']
    },
    {
      id: 'changelog.setting.copyFormat',
      title: 'changelog.settings.copyFormat',
      icon: 'tune',
      kind: 'setting',
      settingId: COPY_FORMAT_ID,
      keywords: ['changelog', 'copy', 'markdown', 'text']
    },
    {
      id: 'changelog.setting.rememberView',
      title: 'changelog.settings.rememberView',
      icon: 'tune',
      kind: 'setting',
      settingId: REMEMBER_VIEW_ID,
      keywords: ['changelog', 'remember', 'filter']
    }
  ],
  init(ctx: AppContext) {
    // The persisted view is a real settings key written by the viewer rather
    // than by a visible control, so its default is declared here: without it the
    // settings surface could not report where the value came from, and resetting
    // it would have nothing to reset to.
    ctx.settings.declareDefault(STORED_VIEW_ID, null);

    ctx.palette.add(paletteEntries(ctx));

    if (isEmptyBundle()) {
      // A build with no changelog is a build whose generator did not run. That is
      // a real, reportable state rather than a project with no history, and the
      // viewer's own empty state names the command that fixes it.
      console.warn(
        `The changelog bundle is empty. Regenerate it with: ${changelog.command}`
      );
      return;
    }

    console.info(
      `Changelog: ${changelog.releases.length} versions and ${totalEntries()} changes, generated ${changelog.generatedAt} from commit ${changelog.headCommit}.`
    );
  }
});
