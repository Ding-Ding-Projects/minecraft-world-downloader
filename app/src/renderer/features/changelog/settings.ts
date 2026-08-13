import type { SettingsSection } from '../../core/registry';

/**
 * The changelog's own settings.
 *
 * Each control declares its explanation, and the shared settings surface renders
 * that explanation behind progressive disclosure along with a provenance line
 * naming the real current value rather than the word "default". Nothing here
 * changes what the changelog SAYS — the record itself is generated from the
 * repository at build time and is not editable — only how the viewer presents
 * it, which is stated in the section's own copy.
 */

export const PAGE_SIZE_ID = 'changelog.pageSize';
export const SHOW_BODIES_ID = 'changelog.showBodies';
export const GROUP_BY_CATEGORY_ID = 'changelog.groupByCategory';
export const COPY_FORMAT_ID = 'changelog.copyFormat';
export const REMEMBER_VIEW_ID = 'changelog.rememberView';

/**
 * The persisted filter, written by the viewer rather than by a visible control.
 *
 * It is a real settings key so that it survives a restart, appears in an export,
 * and — like every other settings change — is recorded in the local append-only
 * history, which is what makes returning to a previous view an undoable action
 * rather than something that quietly overwrites itself.
 */
export const STORED_VIEW_ID = 'changelog.view';

/**
 * The changelog destination's tab id.
 *
 * It lives here rather than beside the view so that the settings section can
 * open the destination without importing the view, which would import these
 * ids straight back and close a cycle for no reason.
 */
export const CHANGELOG_TAB_ID = 'changelog.viewer';

export function changelogSettings(): SettingsSection {
  return {
    id: 'changelog',
    title: 'changelog.settings.section',
    icon: 'history',
    order: 320,
    controls: [
      {
        id: PAGE_SIZE_ID,
        label: 'changelog.settings.pageSize',
        description: 'changelog.settings.pageSizeHelp',
        kind: 'slider',
        defaultValue: 12,
        min: 4,
        max: 60,
        step: 2,
        keywords: ['changelog', 'versions', 'page', 'render', 'performance'],
        validate: (value) => {
          const number = Number(value);
          if (!Number.isFinite(number)) return 'This must be a number.';
          if (number < 4 || number > 60) return 'Choose between 4 and 60 versions.';
          return null;
        }
      },
      {
        id: GROUP_BY_CATEGORY_ID,
        label: 'changelog.settings.groupByCategory',
        description: 'changelog.settings.groupByCategoryHelp',
        kind: 'switch',
        defaultValue: true,
        keywords: ['changelog', 'group', 'category', 'added', 'fixed']
      },
      {
        id: SHOW_BODIES_ID,
        label: 'changelog.settings.showBodies',
        description: 'changelog.settings.showBodiesHelp',
        kind: 'switch',
        defaultValue: false,
        keywords: ['changelog', 'commit', 'message', 'body', 'expand']
      },
      {
        id: COPY_FORMAT_ID,
        label: 'changelog.settings.copyFormat',
        description: 'changelog.settings.copyFormatHelp',
        kind: 'select',
        defaultValue: 'markdown',
        options: [
          { value: 'markdown', label: 'changelog.settings.formatMarkdown' },
          { value: 'text', label: 'changelog.settings.formatText' }
        ],
        keywords: ['changelog', 'copy', 'clipboard', 'markdown', 'text']
      },
      {
        id: REMEMBER_VIEW_ID,
        label: 'changelog.settings.rememberView',
        description: 'changelog.settings.rememberViewHelp',
        kind: 'switch',
        defaultValue: true,
        keywords: ['changelog', 'remember', 'filter', 'search', 'date']
      },
      {
        // The Help-and-About route into the changelog. The destination is also a
        // tab and a palette entry; this is the one that answers "where do I find
        // what changed?" from the place a person goes looking for it.
        id: 'changelog.open',
        label: 'changelog.settings.open',
        description: 'changelog.settings.openHelp',
        kind: 'action',
        defaultValue: null,
        lockable: false,
        lockableReason:
          'Opening a destination changes nothing, and locking the route to the changelog would only hide what the application has already shipped.',
        keywords: ['changelog', 'about', 'help', 'release notes', 'what is new', 'version', 'history'],
        run: (ctx) => {
          ctx.tabs.open(CHANGELOG_TAB_ID);
        }
      }
    ]
  };
}
