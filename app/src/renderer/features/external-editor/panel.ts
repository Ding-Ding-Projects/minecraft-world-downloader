import { el } from '../../core/a11y';
import type { ControlHandle, TabContext } from '../../core/registry';
import { buildEditorsSection } from './editorsList';
import {
  blockingReason,
  handOff,
  openDownloadPage,
  openWithSystemDefault,
  reportOutcome,
  revealInFileManager,
  storedFileMode
} from './handoff';
import { buildRecentSection } from './recentList';
import {
  ACTIVE_ID,
  AUTOMATIC,
  DEFAULT_PROJECT_FOLDER,
  ELEMENT_IDS,
  PROJECT_FOLDER_ID,
  VS_CODE_DOWNLOAD_URL,
  type FileMode
} from './settingIds';
import { baseName, editorStore } from './state';
import './styles.css';

/**
 * The External editor destination.
 *
 * Every value on this surface is picked rather than typed where a real list
 * exists: the active editor comes from what the machine actually reported, the
 * executable field has a native browse control beside it, and the path field
 * browses for either a file or a folder. Every disabled control names the one
 * condition that is unmet, because a disabled button with no explanation reads
 * as broken rather than as blocked.
 */

/** Localized description of how the active editor was arrived at. */
function activeSummary(ctx: TabContext): string {
  const active = editorStore.resolveActive();
  const chosen = editorStore.activeId();

  if (active && chosen === AUTOMATIC) {
    return ctx.t(
      'externalEditor.active.auto',
      '{name} will be used. It was chosen automatically as the best of {count} editors this application can start.',
      { values: { name: active.name, count: String(editorStore.usable().length) } }
    );
  }
  if (active) {
    return ctx.t('externalEditor.active.explicit', '{name} will be used, because you chose it.', {
      values: { name: active.name }
    });
  }
  if (editorStore.activeIsUnusable()) {
    const row = editorStore.row(chosen);
    return ctx.t(
      'externalEditor.active.unusable',
      'You chose {name}, and it cannot be started from here right now, so nothing will be opened. Nothing else will be started in its place.',
      { values: { name: row?.name ?? chosen } }
    );
  }
  if (!editorStore.hasProbed()) {
    return ctx.t(
      'externalEditor.active.unprobed',
      'This machine has not been checked for editors yet, so nothing can be opened.'
    );
  }
  return ctx.t(
    'externalEditor.active.none',
    'No editor this application can start was found on this machine, so nothing will be opened. Visual Studio Code is the one this application knows best.'
  );
}

function provenanceLine(ctx: TabContext): string {
  const provenance = ctx.settings.provenanceOf(ACTIVE_ID);
  const value = editorStore.activeId();
  const shown =
    value === AUTOMATIC
      ? ctx.t('externalEditor.option.auto', 'Choose automatically (Visual Studio Code first)')
      : (editorStore.row(value)?.name ?? value);
  if (provenance === 'default') {
    return ctx.t(
      'externalEditor.provenance.default',
      'Nothing has ever written this choice, so the built-in value is in effect: choose automatically, preferring Visual Studio Code.'
    );
  }
  return ctx.t('externalEditor.provenance.set', 'This choice is set to {value} ({source}).', {
    values: { value: shown, source: provenance }
  });
}

interface StatusSection {
  root: HTMLElement;
  refresh(): void;
}

function buildStatusSection(ctx: TabContext): StatusSection {
  const root = el('section', { className: 'external-editor-section' });
  root.id = ELEMENT_IDS.status;

  root.append(
    ctx.components.sectionHeading({
      title: 'externalEditor.status.title',
      description: 'externalEditor.status.description'
    })
  );

  const summary = el('p', {
    className: 'external-editor-summary md-typescale-body-large',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const provenance = el('p', { className: 'external-editor-note md-typescale-body-small' });

  /**
   * The picker lives in its own host and is rebuilt whenever the inventory
   * changes, because its options are the machine's real answer rather than a
   * written-down list: an editor uninstalled since the last launch must stop
   * being offered rather than fail at the moment somebody picks it.
   */
  const pickerHost = el('div', { className: 'external-editor-picker' });

  const download = ctx.components.button({
    label: 'externalEditor.action.download',
    variant: 'outlined',
    icon: 'download',
    onClick: () => {
      void openDownloadPage(ctx);
    }
  });

  const downloadNote = el('p', {
    className: 'external-editor-note md-typescale-body-small',
    text: ctx.t(
      'externalEditor.download.note',
      'The page is opened in your browser at {url}. This application downloads nothing itself and makes no request of its own.',
      { values: { url: VS_CODE_DOWNLOAD_URL } }
    )
  });

  const row = el('div', { className: 'external-editor-row' });
  row.append(pickerHost, download);
  root.append(summary, row, provenance, downloadNote);

  const refresh = (): void => {
    const options = [
      {
        value: AUTOMATIC,
        label: ctx.t('externalEditor.option.auto', 'Choose automatically (Visual Studio Code first)')
      },
      ...editorStore.rows().map((editor) => ({
        value: editor.id,
        label:
          editor.launchId !== null
            ? editor.name
            : ctx.t('externalEditor.option.unusable', '{name} — cannot be started from here', {
                values: { name: editor.name }
              })
      }))
    ];

    const hadFocus = pickerHost.contains(document.activeElement);
    pickerHost.textContent = '';
    const picker = ctx.components.select({
      label: 'externalEditor.active.label',
      options,
      value: editorStore.activeId(),
      onChange: (value) => {
        editorStore.setActive(value);
        void ctx.history.record('Chose the active external editor', 'external-editor', {
          id: value,
          name: value === AUTOMATIC ? 'automatic' : (editorStore.row(value)?.name ?? value)
        });
      }
    });
    pickerHost.append(picker.root);
    if (hadFocus) picker.focus();

    summary.textContent = activeSummary(ctx);
    provenance.textContent = provenanceLine(ctx);
  };

  refresh();
  return { root, refresh };
}

/* ------------------------------------------------------------------ */
/* Adding an editor                                                    */
/* ------------------------------------------------------------------ */

interface AddSection {
  root: HTMLElement;
  refresh(): void;
}

function buildAddSection(ctx: TabContext): AddSection {
  const root = el('section', { className: 'external-editor-section' });
  root.id = ELEMENT_IDS.add;

  root.append(
    ctx.components.sectionHeading({
      title: 'externalEditor.add.title',
      description: 'externalEditor.add.description'
    })
  );

  const status = el('p', {
    className: 'external-editor-note md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const executable = ctx.components.textField({
    label: 'externalEditor.add.executable',
    browse: 'file',
    placeholder: ctx.t('externalEditor.add.executablePlaceholder', 'The editor executable, chosen with Browse'),
    supportingText: 'externalEditor.add.executableSupport',
    onChange: () => refreshState()
  });

  const name = ctx.components.textField({
    label: 'externalEditor.add.name',
    supportingText: 'externalEditor.add.nameSupport',
    onChange: () => refreshState()
  });

  const folderSwitch = ctx.components.switchControl({
    label: 'externalEditor.add.supportsFolder',
    checked: false
  });

  const add = ctx.components.button({
    label: 'externalEditor.action.add',
    variant: 'filled',
    icon: 'add',
    disabled: true,
    disabledReason: ctx.t('externalEditor.add.blocked', 'Choose an executable first.'),
    onClick: () => {
      const command = executable.get().trim();
      void editorStore
        .addCustom({ name: name.get(), command, supportsFolder: folderSwitch.get() })
        .then(async (outcome) => {
          const title = ctx.t('externalEditor.title', 'External editor', { dialog: true });
          if (!outcome.ok) {
            status.textContent = ctx.t('externalEditor.add.refused', 'That editor was not added: {message}', {
              values: { message: outcome.error ?? '' }
            });
            ctx.notify.error(title, status.textContent);
            ctx.a11y.announce(status.textContent, true);
            return;
          }
          await editorStore.refresh();
          const row = outcome.row ? editorStore.row(outcome.row.id) : null;
          const linked = row?.launchId !== null && row !== null;
          status.textContent = linked
            ? ctx.t(
                'externalEditor.add.addedLinked',
                '{name} was added, and it is the same file as an editor this application already knows, so it can be started from here.',
                { values: { name: row?.name ?? baseName(command) } }
              )
            : ctx.t(
                'externalEditor.add.addedUnlinked',
                '{name} was added and its executable was verified, but this application cannot start it: a handoff runs one of the editors it knows how to launch, not an arbitrary program. Use the system default application, or show the file in the file manager, until that changes.',
                { values: { name: row?.name ?? baseName(command) } }
              );
          ctx.notify.success(title, status.textContent);
          ctx.a11y.announce(status.textContent);
          void ctx.history.record('Added an external editor', 'external-editor', {
            name: row?.name ?? baseName(command),
            command,
            startable: linked
          });
          name.set('');
          executable.set('');
          folderSwitch.set(false);
          refreshState();
        });
    }
  });

  const row = el('div', { className: 'external-editor-row' });
  row.append(add);
  root.append(executable.root, name.root, folderSwitch.root, row, status);

  function refreshState(): void {
    const command = executable.get().trim();
    const empty = command === '';
    add.disabled = empty;
    if (empty) {
      const reason = ctx.t('externalEditor.add.blocked', 'Choose an executable first.');
      add.title = reason;
      add.setAttribute('aria-description', reason);
    } else {
      add.removeAttribute('title');
      add.removeAttribute('aria-description');
    }
  }

  refreshState();
  return { root, refresh: refreshState };
}

/* ------------------------------------------------------------------ */
/* Opening something                                                   */
/* ------------------------------------------------------------------ */

interface OpenSection {
  root: HTMLElement;
  refresh(): void;
}

function buildOpenSection(ctx: TabContext): OpenSection {
  const root = el('section', { className: 'external-editor-section' });
  root.id = ELEMENT_IDS.open;

  root.append(
    ctx.components.sectionHeading({
      title: 'externalEditor.open.title',
      description: 'externalEditor.open.description'
    })
  );

  const status = el('p', {
    className: 'external-editor-note md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const target = ctx.components.textField({
    label: 'externalEditor.open.target',
    browse: 'both',
    placeholder: ctx.t('externalEditor.open.targetPlaceholder', 'A file or a folder, chosen with Browse'),
    supportingText: 'externalEditor.open.targetSupport',
    onChange: () => refreshState()
  });

  const kind: ControlHandle<string> = ctx.components.segmentedButton({
    label: 'externalEditor.open.kind',
    options: [
      { value: 'file', label: 'externalEditor.open.kindFile', icon: 'file' },
      { value: 'folder', label: 'externalEditor.open.kindFolder', icon: 'folder' }
    ],
    value: 'file',
    onChange: () => refreshState()
  });

  const mode: ControlHandle<string> = ctx.components.select({
    label: 'externalEditor.open.mode',
    options: [
      { value: 'file', label: 'externalEditor.open.modeFile' },
      { value: 'workspace', label: 'externalEditor.open.modeWorkspace' }
    ],
    value: storedFileMode(ctx),
    onChange: () => refreshState()
  });

  const open = ctx.components.button({
    label: 'externalEditor.action.open',
    variant: 'filled',
    icon: 'play',
    disabled: true,
    disabledReason: ctx.t('externalEditor.blocked.noPath', 'Choose a file or a folder first.'),
    onClick: () => {
      const path = target.get().trim();
      const chosenKind = kind.get() === 'folder' ? 'folder' : 'file';
      const chosenMode: FileMode = chosenKind === 'folder' || mode.get() === 'workspace' ? 'workspace' : 'file';
      void handOff(ctx, { path, kind: chosenKind, mode: chosenMode }).then((outcome) => {
        reportOutcome(ctx, outcome);
        status.textContent = outcome.ok
          ? ctx.t('externalEditor.open.done', '{editor} opened {path}.', {
              values: { editor: outcome.editor?.name ?? '', path: outcome.path }
            })
          : outcome.error;
        refreshState();
      });
    }
  });

  const projectButton = ctx.components.button({
    label: 'externalEditor.action.openProject',
    variant: 'tonal',
    icon: 'folder',
    onClick: () => {
      const folder = ctx.settings.get<string>(PROJECT_FOLDER_ID, DEFAULT_PROJECT_FOLDER).trim();
      if (folder === '') return;
      void handOff(ctx, { path: folder, kind: 'folder' }).then((outcome) => {
        reportOutcome(ctx, outcome);
        status.textContent = outcome.ok
          ? ctx.t('externalEditor.open.doneWorkspace', '{editor} opened {path} as a workspace root.', {
              values: { editor: outcome.editor?.name ?? '', path: outcome.path }
            })
          : outcome.error;
      });
    }
  });

  const systemDefault = ctx.components.button({
    label: 'externalEditor.action.systemDefault',
    variant: 'outlined',
    icon: 'file',
    onClick: () => {
      void openWithSystemDefault(ctx, target.get().trim());
    }
  });

  const reveal = ctx.components.button({
    label: 'externalEditor.action.reveal',
    variant: 'outlined',
    icon: 'folder',
    onClick: () => {
      void revealInFileManager(ctx, target.get().trim());
    }
  });

  const primary = el('div', { className: 'external-editor-row' });
  primary.append(open, projectButton);
  const secondary = el('div', { className: 'external-editor-row' });
  secondary.append(systemDefault, reveal);

  root.append(
    target.root,
    kind.root,
    mode.root,
    primary,
    el('p', {
      className: 'external-editor-note md-typescale-body-small',
      text: ctx.t(
        'externalEditor.open.fallbackNote',
        'These two do not use the editor at all: one asks the operating system to open the path with whatever it considers the default application, and the other shows it in the file manager.'
      )
    }),
    secondary,
    status
  );

  function setDisabled(node: HTMLButtonElement, reason: string | null): void {
    node.disabled = reason !== null;
    if (reason !== null) {
      node.title = reason;
      node.setAttribute('aria-description', reason);
    } else {
      node.removeAttribute('title');
      node.removeAttribute('aria-description');
    }
  }

  function refreshState(): void {
    const path = target.get().trim();
    setDisabled(open, blockingReason(ctx, path));

    const isFolder = kind.get() === 'folder';
    mode.setDisabled(
      isFolder,
      ctx.t(
        'externalEditor.open.modeLocked',
        'A folder is always opened as a workspace root, so there is nothing to choose here.'
      )
    );

    const folder = ctx.settings.get<string>(PROJECT_FOLDER_ID, DEFAULT_PROJECT_FOLDER).trim();
    const projectReason =
      folder === ''
        ? ctx.t(
            'externalEditor.blocked.noProject',
            'No project folder is set. Choose one in Settings, under External editor.'
          )
        : blockingReason(ctx, folder);
    setDisabled(projectButton, projectReason);

    const noPath = ctx.t('externalEditor.blocked.noPath', 'Choose a file or a folder first.');
    setDisabled(systemDefault, path === '' ? noPath : null);
    setDisabled(reveal, path === '' ? noPath : null);
  }

  refreshState();
  return { root, refresh: refreshState };
}

/* ------------------------------------------------------------------ */
/* The tab                                                             */
/* ------------------------------------------------------------------ */

export function mountEditorTab(host: HTMLElement, ctx: TabContext): () => void {
  host.append(
    ctx.components.topAppBar({
      title: 'externalEditor.title',
      subtitle: 'externalEditor.subtitle'
    })
  );

  const status = buildStatusSection(ctx);
  const editors = buildEditorsSection(ctx);
  const add = buildAddSection(ctx);
  const open = buildOpenSection(ctx);
  const recent = buildRecentSection(ctx);

  host.append(status.root, editors.root, add.root, open.root, recent.root);

  const refreshAll = (): void => {
    status.refresh();
    editors.refresh();
    add.refresh();
    open.refresh();
    recent.refresh();
  };

  const stopStore = editorStore.onChange(refreshAll);
  const stopSettings = ctx.settings.onChange((change) => {
    if (change.id.startsWith('external-editor.')) refreshAll();
  });
  const stopLanguage = ctx.i18n.onChange(() => refreshAll());

  if (!editorStore.hasProbed() && !editorStore.isProbing()) {
    void editorStore.refresh();
  }

  return () => {
    stopStore();
    stopSettings();
    stopLanguage();
    editors.destroy();
    recent.destroy();
  };
}
