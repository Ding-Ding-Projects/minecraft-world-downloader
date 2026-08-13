import { el } from '../../core/a11y';
import { defineFeature } from '../../core/registry';
import type { AppContext, SettingContext } from '../../core/registry';
import { externalEditorDocs } from './docs';
import { handOff, openDownloadPage, reportOutcome } from './handoff';
import { mountEditorTab } from './panel';
import {
  ACTIVE_ID,
  AUTOMATIC,
  CUSTOM_EDITORS_KEY,
  DEFAULT_ACTIVE,
  DEFAULT_FILE_MODE,
  DEFAULT_PROBE_AT_START,
  DEFAULT_PROJECT_FOLDER,
  DEFAULT_RECENT_LIMIT,
  ELEMENT_IDS,
  FILE_MODE_ID,
  PROBE_AT_START_ID,
  PROJECT_FOLDER_ID,
  RECENT_KEY,
  RECENT_LIMIT_ID,
  TAB_ID
} from './settingIds';
import { editorStore } from './state';
import { externalEditorStrings } from './strings';

/**
 * External editor handoff.
 *
 * The whole feature is one promise: anything this application can point at on
 * disk can be handed to a real editor in one action, with Visual Studio Code as
 * the first-class target and a folder arriving as a workspace root rather than
 * as one lonely file.
 *
 * It is deliberate that the surface never launches something the user did not
 * ask for. When the chosen editor is unavailable, nothing is opened and the
 * reason is said out loud, with the download offered; a quiet substitution
 * would leave somebody staring at a window they cannot account for.
 */

/**
 * The active-editor setting, rendered as the real picker rather than a stored
 * string, and rebuilt from the machine's own answer whenever the inventory
 * changes so it can never offer an editor that is not there.
 */
function renderActiveSetting(host: HTMLElement, ctx: SettingContext): void {
  const pickerHost = el('div', { className: 'external-editor-picker' });
  const summary = el('p', {
    className: 'external-editor-note md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const rebuild = (): void => {
    const hadFocus = pickerHost.contains(document.activeElement);
    pickerHost.textContent = '';
    const rows = editorStore.rows();
    const picker = ctx.components.select({
      label: 'externalEditor.settings.active',
      value: editorStore.activeId(),
      options: [
        {
          value: AUTOMATIC,
          label: ctx.t('externalEditor.option.auto', 'Choose automatically (Visual Studio Code first)')
        },
        ...rows.map((row) => ({
          value: row.id,
          label:
            row.launchId !== null
              ? row.name
              : ctx.t('externalEditor.option.unusable', '{name} — cannot be started from here', {
                  values: { name: row.name }
                })
        }))
      ],
      onChange: (value) => {
        ctx.setValue(value);
        void ctx.history.record('Chose the active external editor', 'external-editor', {
          id: value,
          name: value === AUTOMATIC ? 'automatic' : (editorStore.row(value)?.name ?? value)
        });
      }
    });
    pickerHost.append(picker.root);
    if (hadFocus) picker.focus();

    const active = editorStore.resolveActive();
    if (active) {
      summary.textContent = ctx.t('externalEditor.active.explicit', '{name} will be used, because you chose it.', {
        values: { name: active.name }
      });
      if (editorStore.activeId() === AUTOMATIC) {
        summary.textContent = ctx.t(
          'externalEditor.active.auto',
          '{name} will be used. It was chosen automatically as the best of {count} editors this application can start.',
          { values: { name: active.name, count: String(editorStore.usable().length) } }
        );
      }
    } else if (editorStore.activeIsUnusable()) {
      summary.textContent = ctx.t(
        'externalEditor.active.unusable',
        'You chose {name}, and it cannot be started from here right now, so nothing will be opened. Nothing else will be started in its place.',
        { values: { name: editorStore.row(editorStore.activeId())?.name ?? editorStore.activeId() } }
      );
    } else if (!editorStore.hasProbed()) {
      summary.textContent = ctx.t(
        'externalEditor.active.unprobed',
        'This machine has not been checked for editors yet, so nothing can be opened.'
      );
    } else {
      summary.textContent = ctx.t(
        'externalEditor.active.none',
        'No editor this application can start was found on this machine, so nothing will be opened. Visual Studio Code is the one this application knows best.'
      );
    }
  };

  rebuild();
  host.append(pickerHost, summary);

  // A settings surface is rebuilt whenever it is remounted, so this control can
  // outlive the element it belongs to. The subscription releases itself the
  // first time it fires against a host that is no longer in the document,
  // rather than staying alive to update a node nobody can see.
  let stop = (): void => {};
  stop = editorStore.onChange(() => {
    if (!host.isConnected) {
      stop();
      return;
    }
    rebuild();
  });

  if (!editorStore.hasProbed() && !editorStore.isProbing()) void editorStore.refresh();
}

/** Browses for a target and hands it over, used by two palette commands. */
async function browseAndOpen(ctx: AppContext, kind: 'file' | 'folder'): Promise<void> {
  const picked =
    kind === 'file'
      ? await ctx.studio.dialog.openFile({
          title: ctx.t('externalEditor.open.target', 'File or folder to open')
        })
      : await ctx.studio.dialog.openFolder({
          title: ctx.t('externalEditor.open.target', 'File or folder to open')
        });
  if (!picked.ok) {
    ctx.notify.error(
      ctx.t('externalEditor.title', 'External editor', { dialog: true }),
      ctx.t('externalEditor.blocked.statFailed', 'That path could not be read: {message}', {
        values: { message: picked.error }
      })
    );
    return;
  }
  const path = picked.value?.[0];
  if (path === undefined) return;
  reportOutcome(ctx, await handOff(ctx, { path, kind }));
}

export default defineFeature({
  id: 'external-editor',
  name: 'External editor',
  description:
    'Detects the editors installed on this machine, lets one be chosen or added by browsing for its executable, and hands files and folders to it — a folder as a workspace root, and Visual Studio Code first.',

  strings: externalEditorStrings,
  docs: externalEditorDocs,

  tabs: [
    {
      id: TAB_ID,
      title: 'externalEditor.title',
      icon: 'code',
      group: 'group.tools',
      order: 470,
      mount: mountEditorTab
    }
  ],

  settings: [
    {
      id: 'external-editor',
      title: 'externalEditor.settings.section',
      icon: 'code',
      order: 470,
      controls: [
        {
          id: ACTIVE_ID,
          label: 'externalEditor.settings.active',
          description: 'externalEditor.settings.active.description',
          kind: 'custom',
          defaultValue: DEFAULT_ACTIVE,
          keywords: ['editor', 'vscode', 'visual studio code', 'code', 'open with', 'handoff'],
          render: renderActiveSetting
        },
        {
          id: FILE_MODE_ID,
          label: 'externalEditor.settings.fileMode',
          description: 'externalEditor.settings.fileMode.description',
          kind: 'select',
          defaultValue: DEFAULT_FILE_MODE,
          keywords: ['workspace', 'folder', 'file', 'root', 'open'],
          options: [
            { value: 'file', label: 'externalEditor.open.modeFile' },
            { value: 'workspace', label: 'externalEditor.open.modeWorkspace' }
          ]
        },
        {
          id: PROBE_AT_START_ID,
          label: 'externalEditor.settings.probeAtStart',
          description: 'externalEditor.settings.probeAtStart.description',
          kind: 'switch',
          defaultValue: DEFAULT_PROBE_AT_START,
          keywords: ['detect', 'probe', 'startup', 'path', 'scan']
        },
        {
          id: PROJECT_FOLDER_ID,
          label: 'externalEditor.settings.projectFolder',
          description: 'externalEditor.settings.projectFolder.description',
          kind: 'folder',
          defaultValue: DEFAULT_PROJECT_FOLDER,
          keywords: ['project', 'folder', 'workspace', 'root', 'directory'],
          validate: (value) => {
            if (typeof value !== 'string') return 'A folder path is text.';
            if (value.length > 4096) return 'That path is longer than any file system allows.';
            return null;
          }
        },
        {
          id: RECENT_LIMIT_ID,
          label: 'externalEditor.settings.recentLimit',
          description: 'externalEditor.settings.recentLimit.description',
          kind: 'number',
          defaultValue: DEFAULT_RECENT_LIMIT,
          min: 0,
          max: 200,
          step: 5,
          keywords: ['recent', 'history', 'handoff', 'log', 'retention'],
          validate: (value) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return 'That is not a number.';
            if (parsed < 0 || parsed > 200) return 'Choose a number between 0 and 200.';
            return null;
          }
        },
        {
          id: 'external-editor.openTab',
          label: 'externalEditor.settings.openTab',
          description: 'externalEditor.settings.openTab.description',
          kind: 'action',
          defaultValue: '',
          keywords: ['editor', 'open', 'tab', 'destination'],
          run: (ctx) => ctx.tabs.open(TAB_ID)
        },
        {
          id: 'external-editor.recheck',
          label: 'externalEditor.settings.recheck',
          description: 'externalEditor.settings.recheck.description',
          kind: 'action',
          defaultValue: '',
          keywords: ['detect', 'probe', 'rescan', 'refresh', 'check'],
          run: async (ctx) => {
            await editorStore.refresh();
            const message = ctx.t(
              'externalEditor.notify.rechecked',
              'The machine was checked: {count} usable editors.',
              { values: { count: String(editorStore.usable().length) } }
            );
            ctx.notify.success(ctx.t('externalEditor.title', 'External editor', { dialog: true }), message);
            ctx.a11y.announce(message);
          }
        },
        {
          id: 'external-editor.download',
          label: 'externalEditor.settings.download',
          description: 'externalEditor.settings.download.description',
          kind: 'action',
          defaultValue: '',
          keywords: ['download', 'install', 'visual studio code', 'vscode', 'get'],
          run: (ctx) => openDownloadPage(ctx)
        }
      ]
    }
  ],

  palette: [
    {
      id: 'external-editor.palette.open',
      title: 'externalEditor.palette.open',
      subtitle: 'externalEditor.palette.openSubtitle',
      icon: 'code',
      kind: 'destination',
      keywords: ['editor', 'vscode', 'visual studio code', 'open in', 'handoff', '編輯器'],
      teleport: { tabId: TAB_ID }
    },
    {
      id: 'external-editor.palette.add',
      title: 'externalEditor.palette.add',
      icon: 'add',
      kind: 'destination',
      keywords: ['add editor', 'browse', 'executable', 'custom editor'],
      teleport: { tabId: TAB_ID, elementId: ELEMENT_IDS.add }
    },
    {
      id: 'external-editor.palette.recent',
      title: 'externalEditor.palette.recent',
      icon: 'history',
      kind: 'destination',
      keywords: ['recent', 'handoff', 'opened', 'log'],
      teleport: { tabId: TAB_ID, elementId: ELEMENT_IDS.recent }
    },
    {
      id: 'external-editor.palette.setting.active',
      title: 'externalEditor.settings.active',
      icon: 'tune',
      kind: 'setting',
      settingId: ACTIVE_ID,
      keywords: ['editor', 'active', 'vscode', 'choose']
    },
    {
      id: 'external-editor.palette.setting.fileMode',
      title: 'externalEditor.settings.fileMode',
      icon: 'tune',
      kind: 'setting',
      settingId: FILE_MODE_ID,
      keywords: ['workspace', 'root', 'file', 'folder']
    },
    {
      id: 'external-editor.palette.setting.projectFolder',
      title: 'externalEditor.settings.projectFolder',
      icon: 'tune',
      kind: 'setting',
      settingId: PROJECT_FOLDER_ID,
      keywords: ['project', 'folder', 'workspace']
    },
    {
      id: 'external-editor.palette.setting.probeAtStart',
      title: 'externalEditor.settings.probeAtStart',
      icon: 'tune',
      kind: 'setting',
      settingId: PROBE_AT_START_ID,
      keywords: ['detect', 'startup', 'probe']
    },
    {
      id: 'external-editor.palette.setting.recentLimit',
      title: 'externalEditor.settings.recentLimit',
      icon: 'tune',
      kind: 'setting',
      settingId: RECENT_LIMIT_ID,
      keywords: ['recent', 'retention', 'log']
    }
  ],

  init(ctx: AppContext) {
    editorStore.attach(ctx);

    // Both stores are declared so `reset` and the provenance line can work on
    // them even though neither has a visible control of its own.
    ctx.settings.declareDefault(CUSTOM_EDITORS_KEY, []);
    ctx.settings.declareDefault(RECENT_KEY, []);

    if (ctx.settings.get<boolean>(PROBE_AT_START_ID, DEFAULT_PROBE_AT_START)) {
      void editorStore.refresh();
    }

    // These four need a live context — a dialog to browse with, or the settings
    // store to read the project folder from — so they are registered here
    // rather than declared statically.
    ctx.palette.add([
      {
        id: 'external-editor.command.openProject',
        title: 'externalEditor.palette.openProject',
        icon: 'folder',
        kind: 'command',
        keywords: ['project', 'folder', 'workspace', 'open in editor', 'vscode'],
        run: async () => {
          const folder = ctx.settings.get<string>(PROJECT_FOLDER_ID, DEFAULT_PROJECT_FOLDER).trim();
          if (folder === '') {
            ctx.notify.show({
              title: ctx.t('externalEditor.title', 'External editor', { dialog: true }),
              body: ctx.t(
                'externalEditor.blocked.noProject',
                'No project folder is set. Choose one in Settings, under External editor.'
              ),
              severity: 'warning',
              source: 'external-editor',
              actions: [
                {
                  label: 'externalEditor.settings.openTab',
                  run: () => ctx.tabs.teleport('core.settings', `setting-${PROJECT_FOLDER_ID}`)
                }
              ]
            });
            return;
          }
          reportOutcome(ctx, await handOff(ctx, { path: folder, kind: 'folder' }));
        }
      },
      {
        id: 'external-editor.command.openFile',
        title: 'externalEditor.palette.openFile',
        icon: 'file',
        kind: 'command',
        keywords: ['open file', 'editor', 'browse', 'vscode'],
        run: () => browseAndOpen(ctx, 'file')
      },
      {
        id: 'external-editor.command.openFolder',
        title: 'externalEditor.palette.openFolder',
        icon: 'folder',
        kind: 'command',
        keywords: ['open folder', 'workspace root', 'editor', 'browse'],
        run: () => browseAndOpen(ctx, 'folder')
      },
      {
        id: 'external-editor.command.recheck',
        title: 'externalEditor.palette.recheck',
        icon: 'refresh',
        kind: 'command',
        keywords: ['detect', 'probe', 'rescan', 'editors'],
        run: async () => {
          await editorStore.refresh();
          const message = ctx.t(
            'externalEditor.notify.rechecked',
            'The machine was checked: {count} usable editors.',
            { values: { count: String(editorStore.usable().length) } }
          );
          ctx.notify.success(ctx.t('externalEditor.title', 'External editor', { dialog: true }), message);
          ctx.a11y.announce(message);
        }
      },
      {
        id: 'external-editor.command.download',
        title: 'externalEditor.palette.download',
        icon: 'download',
        kind: 'command',
        keywords: ['download', 'install', 'visual studio code', 'vscode'],
        run: () => openDownloadPage(ctx)
      }
    ]);
  }
});
