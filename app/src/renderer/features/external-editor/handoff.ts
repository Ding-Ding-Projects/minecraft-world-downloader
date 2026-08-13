import type { AppContext } from '../../core/registry';
import type { EditorRow } from './state';
import { editorStore, parentDirectory } from './state';
import {
  DEFAULT_FILE_MODE,
  FILE_MODE_ID,
  VS_CODE_DOWNLOAD_URL,
  type FileMode
} from './settingIds';

/**
 * The handoff itself.
 *
 * One rule governs every path through this file: nothing is opened that the
 * user did not ask for. When the chosen editor cannot be started, the answer is
 * an exact sentence and an offer of the download — never a quiet substitution
 * of whatever else happens to be installed, because a Notepad window appearing
 * where Visual Studio Code was asked for explains nothing about itself and is a
 * worse outcome than nothing happening.
 *
 * The second rule is that a folder is opened as a workspace root. A file tree
 * is the entire reason to hand a folder to an editor, so a request for one is
 * refused rather than downgraded to a single file when the editor cannot do it.
 */

export interface HandoffRequest {
  /** Absolute path to hand over. */
  path: string;
  /** `folder` treats the path as a directory; `file` treats it as a file. */
  kind: 'file' | 'folder';
  /** Overrides the stored file-mode preference for this one handoff. */
  mode?: FileMode;
  /** Overrides the active editor for this one handoff. */
  editorId?: string;
}

export interface HandoffOutcome {
  ok: boolean;
  /** The editor that was asked, when one could be. */
  editor: EditorRow | null;
  /** Whether the folder was opened as a workspace root. */
  asFolder: boolean;
  /** The path that was actually handed over, which may be a parent directory. */
  path: string;
  /** Localized, exact failure text. Empty when `ok`. */
  error: string;
  /** True when the failure is "nothing to open it with", so a download helps. */
  offerDownload: boolean;
}

export function storedFileMode(ctx: AppContext): FileMode {
  const raw = ctx.settings.get<string>(FILE_MODE_ID, DEFAULT_FILE_MODE);
  return raw === 'workspace' ? 'workspace' : 'file';
}

/** The exact reason a handoff cannot run right now, or null when it can. */
export function blockingReason(ctx: AppContext, path: string): string | null {
  if (path.trim() === '') {
    return ctx.t('externalEditor.blocked.noPath', 'Choose a file or a folder first.');
  }
  const active = editorStore.resolveActive();
  if (active) return null;
  if (editorStore.activeIsUnusable()) {
    const chosen = editorStore.row(editorStore.activeId());
    return ctx.t(
      'externalEditor.blocked.chosenUnusable',
      'The chosen editor, {name}, cannot be started from here. Choose another one.',
      { values: { name: chosen?.name ?? editorStore.activeId() } }
    );
  }
  if (!editorStore.hasProbed()) {
    return ctx.t('externalEditor.blocked.notProbed', 'The machine has not been checked for editors yet.');
  }
  return ctx.t(
    'externalEditor.blocked.noneFound',
    'No editor this application can start was found on this machine.'
  );
}

/**
 * Hands one path to the active editor.
 *
 * Every outcome — including every refusal — is written to the recent list, so
 * the surface can show what was attempted rather than only what succeeded.
 */
export async function handOff(ctx: AppContext, request: HandoffRequest): Promise<HandoffOutcome> {
  const path = request.path.trim();
  const mode = request.mode ?? storedFileMode(ctx);
  const asFolder = request.kind === 'folder' || mode === 'workspace';

  const fail = (error: string, editor: EditorRow | null, offerDownload: boolean): HandoffOutcome => {
    editorStore.recordHandoff({
      path,
      mode: asFolder ? 'workspace' : 'file',
      editor: editor?.name ?? '',
      ok: false,
      error
    });
    return { ok: false, editor, asFolder, path, error, offerDownload };
  };

  if (path === '') {
    return {
      ok: false,
      editor: null,
      asFolder,
      path,
      error: ctx.t('externalEditor.blocked.noPath', 'Choose a file or a folder first.'),
      offerDownload: false
    };
  }

  const editor = request.editorId ? editorStore.row(request.editorId) : editorStore.resolveActive();
  if (!editor || editor.launchId === null) {
    const reason =
      blockingReason(ctx, path) ??
      ctx.t('externalEditor.blocked.noneFound', 'No editor this application can start was found on this machine.');
    return fail(reason, editor, true);
  }

  if (asFolder && !editor.supportsFolder) {
    return fail(
      ctx.t(
        'externalEditor.blocked.noWorkspace',
        '{name} cannot open a folder as a workspace root, so nothing was opened. Choose an editor that can, or open the file on its own.',
        { values: { name: editor.name } }
      ),
      editor,
      false
    );
  }

  const stat = await ctx.studio.fs.stat(path);
  if (!stat.ok) {
    return fail(
      ctx.t('externalEditor.blocked.statFailed', 'That path could not be read: {message}', {
        values: { message: stat.error }
      }),
      editor,
      false
    );
  }
  if (!stat.value.exists) {
    return fail(
      ctx.t('externalEditor.blocked.missing', 'There is nothing at {path} on this machine.', {
        values: { path }
      }),
      editor,
      false
    );
  }
  if (request.kind === 'folder' && !stat.value.isDirectory) {
    return fail(
      ctx.t('externalEditor.blocked.notAFolder', '{path} is a file, not a folder.', { values: { path } }),
      editor,
      false
    );
  }

  const result = await ctx.studio.editor.open(path, { editorId: editor.launchId, asFolder });
  if (!result.ok) {
    return fail(
      ctx.t('externalEditor.blocked.launchFailed', '{name} did not start: {message}', {
        values: { name: editor.name, message: result.error }
      }),
      editor,
      false
    );
  }

  const handedOver = asFolder && !stat.value.isDirectory ? parentDirectory(path) : path;
  editorStore.recordHandoff({
    path: handedOver,
    mode: asFolder ? 'workspace' : 'file',
    editor: editor.name,
    ok: true,
    error: ''
  });
  void ctx.history.record('Opened a path in the external editor', 'external-editor', {
    path: handedOver,
    editor: editor.name,
    editorId: editor.launchId,
    asFolder
  });
  return { ok: true, editor, asFolder, path: handedOver, error: '', offerDownload: false };
}

/**
 * Reports a handoff outcome, and offers the download when nothing could open it.
 *
 * The notification carries the offer rather than a modal, because a failed
 * handoff informs; it does not ask the user to decide anything before the
 * application can continue.
 */
export function reportOutcome(ctx: AppContext, outcome: HandoffOutcome): void {
  const title = ctx.t('externalEditor.title', 'External editor', { dialog: true });
  if (outcome.ok) {
    const body = outcome.asFolder
      ? ctx.t('externalEditor.notify.openedFolder', '{name} opened {path} as a workspace root.', {
          values: { name: outcome.editor?.name ?? '', path: outcome.path }
        })
      : ctx.t('externalEditor.notify.openedFile', '{name} opened {path}.', {
          values: { name: outcome.editor?.name ?? '', path: outcome.path }
        });
    ctx.notify.success(title, body);
    ctx.a11y.announce(body);
    return;
  }

  ctx.notify.show({
    title,
    body: outcome.error,
    severity: 'error',
    source: 'external-editor',
    link: outcome.offerDownload
      ? {
          label: ctx.t('externalEditor.action.download', 'Download Visual Studio Code'),
          url: VS_CODE_DOWNLOAD_URL
        }
      : undefined
  });
  ctx.a11y.announce(outcome.error, true);
}

/** Opens the download page in the user's browser. Nothing is fetched in-app. */
export async function openDownloadPage(ctx: AppContext): Promise<void> {
  const result = await ctx.studio.shell.openExternal(VS_CODE_DOWNLOAD_URL);
  const title = ctx.t('externalEditor.title', 'External editor', { dialog: true });
  if (result.ok) {
    ctx.notify.info(
      title,
      ctx.t('externalEditor.notify.downloadOpened', 'The download page was opened in your browser: {url}', {
        values: { url: VS_CODE_DOWNLOAD_URL }
      })
    );
    return;
  }
  ctx.notify.error(
    title,
    ctx.t('externalEditor.notify.downloadFailed', 'The browser could not be opened: {message}. The address is {url}', {
      values: { message: result.error, url: VS_CODE_DOWNLOAD_URL }
    })
  );
}

/**
 * The two routes that still work when no editor can be started.
 *
 * They are offered under their own plain names rather than dressed up as an
 * editor handoff: one asks the operating system to open the path with whatever
 * it considers the default application, and the other shows it in the file
 * manager. Neither claims to be the editor the user chose.
 */
export async function openWithSystemDefault(ctx: AppContext, path: string): Promise<void> {
  const title = ctx.t('externalEditor.title', 'External editor', { dialog: true });
  if (path.trim() === '') {
    ctx.notify.warn(title, ctx.t('externalEditor.blocked.noPath', 'Choose a file or a folder first.'));
    return;
  }
  const result = await ctx.studio.shell.openPath(path);
  if (result.ok) {
    const body = ctx.t(
      'externalEditor.notify.systemOpened',
      'The operating system opened {path} with its default application, which may not be an editor.',
      { values: { path } }
    );
    ctx.notify.info(title, body);
    ctx.a11y.announce(body);
    return;
  }
  ctx.notify.error(
    title,
    ctx.t('externalEditor.notify.systemFailed', '{path} could not be opened: {message}', {
      values: { path, message: result.error }
    })
  );
}

export async function revealInFileManager(ctx: AppContext, path: string): Promise<void> {
  const title = ctx.t('externalEditor.title', 'External editor', { dialog: true });
  if (path.trim() === '') {
    ctx.notify.warn(title, ctx.t('externalEditor.blocked.noPath', 'Choose a file or a folder first.'));
    return;
  }
  const result = await ctx.studio.shell.showItemInFolder(path);
  if (result.ok) {
    ctx.notify.info(
      title,
      ctx.t('externalEditor.notify.revealed', '{path} was shown in the file manager.', { values: { path } })
    );
    return;
  }
  ctx.notify.error(
    title,
    ctx.t('externalEditor.notify.revealFailed', 'The file manager could not be opened: {message}', {
      values: { message: result.error }
    })
  );
}
