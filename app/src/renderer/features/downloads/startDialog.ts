import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';
import { formatBytes, formatExactBytes, shortenUrl } from './format';
import { isAbsolutePath, joinPath, sanitizeFilename, type DownloadRecord } from './model';
import { alwaysOnTop } from './ontop';

/**
 * The Start download dialog.
 *
 * This is the surface the contract is really about: a capture arrives, and
 * BEFORE a single byte moves the user is told exactly what was captured, where
 * it would land and what will begin it. Confirming starts that exact transfer;
 * cancelling leaves the queue exactly as it was.
 *
 * It is a genuine decision surface, so it is one of the few places a modal is
 * correct: the answer changes what happens next, and there is nothing sensible
 * to do in the meantime. Everything that merely informs is a notification.
 */

export interface StartDecision {
  started: boolean;
  filename: string;
  folder: string;
  destination: string;
  overwrite: boolean;
}

interface DialogFields {
  body: HTMLElement;
  read(): { filename: string; folder: string; overwrite: boolean };
  focusFilename(): void;
}

function detailRow(term: string, value: string, valueId?: string): HTMLElement {
  const row = el('div', { className: 'downloads-detail' });
  row.append(
    el('span', { className: 'downloads-detail__term md-typescale-label-medium', text: term }),
    el('span', {
      className: 'downloads-detail__value md-typescale-body-medium',
      text: value,
      attrs: valueId ? { id: valueId } : {}
    })
  );
  return row;
}

function buildFields(ctx: AppContext, record: DownloadRecord, defaults: { overwrite: boolean }): DialogFields {
  const body = el('div', { className: 'downloads-start' });

  body.append(
    el('p', {
      className: 'downloads-start__lede md-typescale-body-medium',
      text: ctx.t('downloads.start.intro', 'Nothing has transferred yet. This is what was captured.', {
        values: { host: record.host || ctx.t('downloads.value.unknownHost', 'an unnamed host') },
        dialog: true
      })
    })
  );

  const filename = ctx.components.textField({
    label: 'downloads.start.filename',
    value: record.filename,
    variant: 'outlined',
    supportingText: ctx.t(
      'downloads.start.filename.hint',
      'Path separators and control characters are removed before anything is written.'
    ),
    id: 'downloads-start-filename'
  });

  const folder = ctx.components.textField({
    label: 'downloads.start.folder',
    value: record.folder,
    variant: 'outlined',
    browse: 'folder',
    supportingText: ctx.t('downloads.start.folder.hint', 'An absolute folder path. Browse to pick one.'),
    id: 'downloads-start-folder'
  });

  const destinationRow = detailRow(
    ctx.t('downloads.start.destination', 'It will be written to'),
    joinPath(record.folder, record.filename),
    'downloads-start-destination'
  );
  const destinationValue = destinationRow.querySelector<HTMLElement>('#downloads-start-destination');

  const refreshDestination = (): void => {
    if (!destinationValue) return;
    const chosenFolder = folder.get().trim();
    const chosenName = sanitizeFilename(filename.get(), record.filename);
    destinationValue.textContent = joinPath(chosenFolder, chosenName);
  };
  filename.root.addEventListener('input', refreshDestination);
  folder.root.addEventListener('input', refreshDestination);
  folder.root.addEventListener('change', refreshDestination);

  const overwrite = ctx.components.switchControl({
    label: 'downloads.start.overwrite',
    checked: defaults.overwrite,
    id: 'downloads-start-overwrite'
  });

  const overwriteHint = el('p', {
    className: 'downloads-start__hint md-typescale-body-small',
    text: ctx.t(
      'downloads.start.overwrite.hint',
      'Off writes a numbered variant beside an existing file of the same name. On replaces that file.'
    )
  });

  const details = el('div', { className: 'downloads-start__details' });
  details.append(
    destinationRow,
    detailRow(ctx.t('downloads.start.source', 'Source'), shortenUrl(record.url, 96)),
    detailRow(
      ctx.t('downloads.start.size', 'Size the server declared'),
      record.total === null
        ? ctx.t('downloads.start.size.unknown', 'The server did not declare one.')
        : `${formatBytes(record.total)} (${formatExactBytes(record.total)} bytes)`
    ),
    detailRow(
      ctx.t('downloads.start.type', 'Type the server declared'),
      record.mimeType || ctx.t('downloads.value.none', 'None')
    )
  );
  if (record.referrer) {
    details.append(detailRow(ctx.t('downloads.start.referrer', 'Referred from'), shortenUrl(record.referrer, 96)));
  }

  body.append(filename.root, folder.root, details, overwrite.root, overwriteHint);

  return {
    body,
    read: () => ({
      filename: filename.get(),
      folder: folder.get().trim(),
      overwrite: overwrite.get()
    }),
    focusFilename: () => filename.focus()
  };
}

/**
 * Opens the dialog and resolves once the user has decided.
 *
 * The loop exists because a folder that is not an absolute path is a decision
 * the user has to correct, and silently dropping their captured download to
 * report it would be worse than asking again with what they typed still there.
 */
export async function openStartDialog(ctx: AppContext, record: DownloadRecord): Promise<StartDecision> {
  const release = alwaysOnTop.hold();
  try {
    let working = { ...record };
    for (;;) {
      const fields = buildFields(ctx, working, { overwrite: working.overwrite });
      window.setTimeout(() => fields.focusFilename(), 60);
      const confirmed = await ctx.components.dialog({
        title: 'downloads.start.title',
        icon: 'download',
        body: fields.body,
        confirmLabel: ctx.t('downloads.start.confirm', 'Start the download'),
        cancelLabel: ctx.t('downloads.start.cancel', 'Do not download it')
      });

      const chosen = fields.read();
      if (!confirmed) {
        return {
          started: false,
          filename: working.filename,
          folder: working.folder,
          destination: working.destination,
          overwrite: working.overwrite
        };
      }

      const filename = sanitizeFilename(chosen.filename, working.suggestedFilename || 'download');
      const folder = chosen.folder;

      if (!isAbsolutePath(folder)) {
        ctx.notify.error(
          ctx.t('downloads.start.invalidFolder.title', 'That destination folder cannot be used'),
          ctx.t(
            'downloads.start.invalidFolder.body',
            'The folder must be an absolute path, such as C:\\Users\\you\\Downloads. Nothing has been downloaded.'
          )
        );
        working = { ...working, filename, folder, overwrite: chosen.overwrite };
        continue;
      }

      if (filename !== chosen.filename.trim()) {
        ctx.notify.info(
          ctx.t('downloads.start.nameAdjusted.title', 'The file name was adjusted'),
          ctx.t('downloads.start.nameAdjusted.body', 'It is being saved as {name}.', {
            values: { name: filename }
          })
        );
      }

      return {
        started: true,
        filename,
        folder,
        destination: joinPath(folder, filename),
        overwrite: chosen.overwrite
      };
    }
  } finally {
    release();
  }
}
