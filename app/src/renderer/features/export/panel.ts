import { el } from '../../core/a11y';
import type { SearchQuery, SettingOption, TabContext } from '../../core/registry';
import {
  ARCHIVE_LEVELS,
  DEFAULT_ARCHIVE_OPTIONS,
  DICTIONARY_SIZES,
  METHODS_BY_FORMAT,
  SOLID_BLOCK_SIZES,
  VOLUME_SIZES,
  describeCost,
  dictionaryApplies,
  encryptHeadersApplies,
  normalizeArchiveOptions,
  planArchive,
  probeArchiver,
  renderCommandLine,
  safeRelativePath,
  solidApplies,
  wordSizeApplies,
  type ArchiveFormat,
  type ArchiveMethod,
  type ArchiveOptions,
  type ArchiverProbe
} from './archive';
import { VS_CODE_DOWNLOAD_URL, detectEditors, openInEditor, type EditorAvailability } from './editor';
import {
  eolName,
  formatById,
  formatsForShape,
  preflightFor,
  resolveFormat,
  serializeExport,
  SCHEMA_VERSION,
  type ExtendedFormat,
  type LineEnding
} from './formats';
import {
  createArchive,
  createCancelToken,
  fileNameFor,
  joinPath,
  parentOf,
  runExport,
  separatorFor,
  stageArchiveEntries,
  summarize,
  type ExportOutcome
} from './runner';
import { EXPORT_SETTINGS } from './settingsIds';
import { listExportSources, type ExportSource } from './sources';

/**
 * The export surface.
 *
 * One row per exportable thing, each choosing its own format, because tabular
 * data belongs in CSV and a nested record does not. Nothing is written until the
 * surface has said what the chosen format cannot carry, what will be replaced,
 * and exactly where the files are going.
 *
 * Every control here is the real control. The format select on a row writes the
 * same state the run reads; the archive knobs build the command line shown on
 * the screen; and the create button either starts a genuine archiver or is
 * disabled with the exact reason it could not be started.
 */

interface Row {
  source: ExportSource;
  node: HTMLElement;
  checkbox: HTMLInputElement;
  count: HTMLElement;
  formatHost: HTMLElement;
  visible: boolean;
}

export function mountExportPanel(host: HTMLElement, ctx: TabContext): void {
  const separator = separatorFor(ctx.studio.info.platform);
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  /* ---------------- state ---------------- */

  let sources: ExportSource[] = [];
  const rows = new Map<string, Row>();
  const selected = new Set<string>();
  const formats = new Map<string, ExtendedFormat>();
  const counts = new Map<string, { records: number | null; error: string | null }>();
  let lastTouchedIndex = -1;
  let query: SearchQuery | null = null;
  let results: ExportOutcome[] = [];
  const resultSelection = new Set<string>();
  let probe: ArchiverProbe | null = null;
  let editors: EditorAvailability | null = null;
  let running = false;
  let password = '';
  let encrypt = false;
  let disposed = false;

  const readArchiveOptions = (): ArchiveOptions => {
    const stored: ArchiveOptions = {
      format: ctx.settings.get<ArchiveFormat>(EXPORT_SETTINGS.archiveFormat, DEFAULT_ARCHIVE_OPTIONS.format),
      method: ctx.settings.get<ArchiveMethod>(EXPORT_SETTINGS.archiveMethod, DEFAULT_ARCHIVE_OPTIONS.method),
      level: Number(ctx.settings.get(EXPORT_SETTINGS.archiveLevel, DEFAULT_ARCHIVE_OPTIONS.level)),
      dictionary: ctx.settings.get<string>(EXPORT_SETTINGS.archiveDictionary, DEFAULT_ARCHIVE_OPTIONS.dictionary),
      wordSize: Number(ctx.settings.get(EXPORT_SETTINGS.archiveWordSize, DEFAULT_ARCHIVE_OPTIONS.wordSize)),
      solid: ctx.settings.get<boolean>(EXPORT_SETTINGS.archiveSolid, DEFAULT_ARCHIVE_OPTIONS.solid) === true,
      solidBlock: ctx.settings.get<string>(EXPORT_SETTINGS.archiveSolidBlock, DEFAULT_ARCHIVE_OPTIONS.solidBlock),
      threads: String(ctx.settings.get(EXPORT_SETTINGS.archiveThreads, DEFAULT_ARCHIVE_OPTIONS.threads)),
      volume: String(ctx.settings.get(EXPORT_SETTINGS.archiveVolume, '')),
      encrypt,
      password,
      encryptHeaders:
        ctx.settings.get<boolean>(EXPORT_SETTINGS.archiveEncryptHeaders, DEFAULT_ARCHIVE_OPTIONS.encryptHeaders) === true
    };
    return normalizeArchiveOptions(stored);
  };

  const lineEnding = (): LineEnding =>
    ctx.settings.get<LineEnding>(EXPORT_SETTINGS.lineEnding, 'lf') === 'crlf' ? 'crlf' : 'lf';
  const byteOrderMark = (): boolean => ctx.settings.get<boolean>(EXPORT_SETTINGS.byteOrderMark, false) === true;
  const destination = (): string => String(ctx.settings.get(EXPORT_SETTINGS.destination, '') ?? '');
  const archiveBaseName = (): string =>
    safeRelativePath(String(ctx.settings.get(EXPORT_SETTINGS.archiveName, 'studio-export') || 'studio-export'));

  const formatFor = (source: ExportSource): ExtendedFormat => {
    const chosen = formats.get(source.id);
    if (chosen) return chosen;
    const preferred = String(ctx.settings.get(EXPORT_SETTINGS.defaultFormat, 'json'));
    return resolveFormat(preferred, source.shape).id;
  };

  const selectedSources = (): ExportSource[] => sources.filter((source) => selected.has(source.id));
  const visibleSources = (): ExportSource[] =>
    sources.filter((source) => rows.get(source.id)?.visible !== false);

  /* ---------------- shell ---------------- */

  const panel = el('div', { className: 'md-panel export-panel' });
  const header = el('div', { className: 'md-panel__header' });
  const titlePair = ctx.i18n.pair('export.title', 'Export anything');
  header.append(el('h1', { className: 'md-typescale-headline-medium', text: titlePair.primary }));
  if (titlePair.secondary) {
    header.append(el('p', { className: 'md-typescale-title-small export-secondary', text: titlePair.secondary }));
  }
  header.append(el('p', { className: 'md-typescale-body-large', text: t('export.lede', 'Everything can be exported.') }));
  panel.append(header);

  // A stable id for the palette to teleport to, and a stable appearance id so a
  // per-element appearance override survives a restart.
  const section = (id: string): HTMLElement =>
    el('section', { className: 'export-section', attrs: { id, 'data-appearance-id': `export:${id}` } });

  const sourcesSection = section('export-sources');
  const formatSection = section('export-format');
  const runSection = section('export-run');
  const archiveSection = section('export-archive');
  const resultsSection = section('export-results');
  panel.append(sourcesSection, formatSection, runSection, archiveSection, resultsSection);
  host.append(panel);

  /* ================================================================ */
  /* Sources                                                           */
  /* ================================================================ */

  const listNode = el('ul', { className: 'md-list export-list', attrs: { role: 'list' } });
  const emptyHost = el('div');
  const selectionStatus = el('p', { className: 'md-typescale-body-medium export-selection-status', attrs: { role: 'status' } });

  function refreshSelectionStatus(): void {
    const shown = visibleSources().length;
    selectionStatus.textContent = t('export.select.count', '{selected} selected of {shown} shown, {total} in total', {
      selected: selected.size,
      shown,
      total: sources.length
    });
    updateRunControls();
    updateArchiveControls();
  }

  function setSelected(source: ExportSource, on: boolean): void {
    if (on) selected.add(source.id);
    else selected.delete(source.id);
    const row = rows.get(source.id);
    if (row) {
      row.checkbox.checked = on;
      // The checkbox is the accessible selection state; a listitem carrying
      // aria-selected is invalid ARIA and reads as nothing to a screen reader.
      row.node.dataset.selected = String(on);
      row.node.classList.toggle('export-row--selected', on);
    }
    refreshSelectionStatus();
  }

  /**
   * Extends the selection from the last row touched to this one.
   *
   * The range is applied over the VISIBLE rows rather than over the whole list,
   * because a shift-range that quietly reaches through rows the search has
   * hidden selects things the user cannot see.
   */
  function extendSelection(toIndex: number): void {
    const visible = visibleSources();
    if (lastTouchedIndex < 0 || lastTouchedIndex >= visible.length) {
      lastTouchedIndex = toIndex;
      return;
    }
    const start = Math.min(lastTouchedIndex, toIndex);
    const end = Math.max(lastTouchedIndex, toIndex);
    for (let index = start; index <= end; index += 1) {
      const source = visible[index];
      if (source) setSelected(source, true);
    }
  }

  function buildRow(source: ExportSource, index: number): Row {
    const node = el('li', {
      className: 'md-list-item export-row',
      attrs: { id: `export-source-${safeRelativePath(source.id)}`, 'data-appearance-id': `export-row:${source.id}` }
    });

    const checkbox = el('input', {
      className: 'export-row__check',
      attrs: {
        type: 'checkbox',
        'aria-label': t('export.row.select', 'Select {name}', { name: source.name })
      }
    });
    checkbox.checked = selected.has(source.id);
    checkbox.addEventListener('click', (event) => {
      const visible = visibleSources();
      const position = visible.indexOf(source);
      if ((event as MouseEvent).shiftKey) {
        extendSelection(position);
        checkbox.checked = selected.has(source.id);
      } else {
        setSelected(source, checkbox.checked);
      }
      lastTouchedIndex = position;
    });
    // The keyboard equivalent of a shift-range: Shift with Space, on the row.
    node.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Spacebar') return;
      if (document.activeElement !== node && document.activeElement !== checkbox) return;
      event.preventDefault();
      const visible = visibleSources();
      const position = visible.indexOf(source);
      if (event.shiftKey) extendSelection(position);
      else setSelected(source, !selected.has(source.id));
      lastTouchedIndex = position;
    });
    node.tabIndex = 0;

    const text = el('div', { className: 'md-list-item__text export-row__text' });
    const namePair = ctx.i18n.pair(source.name, source.name);
    text.append(el('span', { className: 'md-typescale-body-large', text: namePair.primary }));
    if (namePair.secondary) {
      text.append(el('span', { className: 'export-secondary', text: namePair.secondary }));
    }
    text.append(
      el('span', { className: 'md-list-item__supporting', text: ctx.t(source.description, source.description) })
    );

    const meta = el('div', { className: 'export-row__meta' });
    meta.append(ctx.components.badge({ label: source.category }));
    const count = el('span', { className: 'md-typescale-body-small', text: t('export.row.counting', 'Counting…') });
    meta.append(count);
    if (source.sensitive) {
      meta.append(ctx.components.badge({ label: 'Sensitive', severity: 'warning' }));
    }
    text.append(meta);

    const omits = source.omits?.(ctx.i18n.schoolModeActive()) ?? null;
    if (omits) {
      text.append(
        el('span', {
          className: 'md-typescale-body-small export-row__omits',
          text: t('export.row.omits', 'Omitted: {what}', { what: omits })
        })
      );
    }

    const formatHost = el('div', { className: 'export-row__format' });
    const usable = formatsForShape(source.shape);
    const options: SettingOption[] = usable.map((descriptor) => ({ value: descriptor.id, label: descriptor.name }));
    const select = ctx.components.select({
      label: 'export.row.format',
      options,
      value: formatFor(source),
      onChange: (value) => {
        formats.set(source.id, value as ExtendedFormat);
        renderArchiveContents();
        updateEncodingStatement();
        ctx.a11y.announce(`${source.name}: ${formatById(value)?.name ?? value}`);
      }
    });
    formatHost.append(select.root);

    const actions = el('div', { className: 'export-row__actions' });
    actions.append(
      ctx.components.button({
        label: 'export.row.preview',
        variant: 'text',
        icon: 'visibility',
        onClick: (event) => void openPreview(source, event.currentTarget as HTMLElement)
      }),
      ctx.components.button({
        label: 'export.row.exportOne',
        variant: 'text',
        icon: 'download',
        onClick: () => void startRun([source])
      })
    );

    node.append(checkbox, text, formatHost, actions);
    ctx.appearance.applyTo(node, `export-row:${source.id}`);

    const row: Row = { source, node, checkbox, count, formatHost, visible: true };
    void loadCount(row);
    if (index === 0) lastTouchedIndex = -1;
    return row;
  }

  async function loadCount(row: Row): Promise<void> {
    try {
      const payload = await row.source.load(ctx);
      if (disposed) return;
      const records = payload.kind === 'records' ? payload.records.length : 1;
      counts.set(row.source.id, { records, error: null });
      row.count.textContent =
        payload.kind === 'records'
          ? t('export.row.records', '{count} records', { count: records })
          : t('export.row.document', 'A document');
    } catch (error) {
      if (disposed) return;
      const reason = error instanceof Error ? error.message : String(error);
      counts.set(row.source.id, { records: null, error: reason });
      row.count.textContent = t('export.row.failed', 'This source could not be read: {reason}', { reason });
      row.count.classList.add('export-row__error');
    }
  }

  function applyFilter(): void {
    let visible = 0;
    for (const source of sources) {
      const row = rows.get(source.id);
      if (!row) continue;
      const haystack = [
        ctx.t(source.name, source.name),
        ctx.t(source.description, source.description),
        source.category,
        source.id,
        formatById(formatFor(source))?.name ?? ''
      ].join(' ');
      const matched = query ? query.matches(haystack) : true;
      row.visible = matched;
      row.node.hidden = !matched;
      if (matched) visible += 1;
    }
    emptyHost.textContent = '';
    if (sources.length === 0) {
      emptyHost.append(
        ctx.components.emptyState({
          title: 'export.sources.none',
          body: 'export.sources.noneBody',
          action: { label: 'export.action.refresh', variant: 'tonal', icon: 'refresh', onClick: () => rebuildSources() }
        })
      );
    } else if (visible === 0) {
      emptyHost.append(ctx.components.emptyState({ title: 'export.sources.empty' }));
    }
    lastTouchedIndex = -1;
    refreshSelectionStatus();
  }

  function rebuildSources(): void {
    sources = listExportSources(ctx);
    rows.clear();
    listNode.textContent = '';
    sources.forEach((source, index) => {
      const row = buildRow(source, index);
      rows.set(source.id, row);
      listNode.append(row.node);
    });
    for (const id of [...selected]) {
      if (!rows.has(id)) selected.delete(id);
    }
    applyFilter();
    renderArchiveContents();
  }

  function renderSourcesSection(): void {
    sourcesSection.textContent = '';
    sourcesSection.append(
      ctx.components.sectionHeading({
        title: 'export.section.sources',
        description: 'export.section.sources.desc'
      })
    );

    const search = ctx.createSearchBar({
      label: 'export.search.label',
      placeholder: 'export.search.placeholder',
      sample: sources.map((source) => `${ctx.t(source.name, source.name)} — ${source.category}`).join('\n'),
      onChange: (next) => {
        query = next;
        applyFilter();
      }
    });
    ctx.onDispose(() => search.destroy());

    const toolbar = el('div', { className: 'export-toolbar' });

    // Two distinct select-alls, because "all" is ambiguous the moment a search
    // is active and a button that means one of them while reading like the other
    // is how a user selects forty things believing they selected six.
    const selectShown = ctx.components.button({
      label: 'export.select.allShown',
      variant: 'text',
      icon: 'check',
      onClick: () => {
        for (const source of visibleSources()) setSelected(source, true);
        ctx.a11y.announce(selectionStatus.textContent ?? '');
      }
    });
    const selectEverything = ctx.components.button({
      label: 'export.select.allSources',
      variant: 'text',
      icon: 'check',
      onClick: () => {
        for (const source of sources) setSelected(source, true);
        ctx.a11y.announce(selectionStatus.textContent ?? '');
      }
    });

    toolbar.append(
      search.root,
      selectShown,
      selectEverything,
      ctx.components.button({
        label: 'export.select.invert',
        variant: 'text',
        icon: 'refresh',
        onClick: () => {
          for (const source of visibleSources()) setSelected(source, !selected.has(source.id));
          ctx.a11y.announce(selectionStatus.textContent ?? '');
        }
      }),
      ctx.components.button({
        label: 'export.select.clear',
        variant: 'text',
        icon: 'close',
        onClick: () => {
          for (const source of sources) setSelected(source, false);
          ctx.a11y.announce(selectionStatus.textContent ?? '');
        }
      }),
      ctx.components.button({
        label: 'export.action.refresh',
        variant: 'text',
        icon: 'refresh',
        onClick: () => rebuildSources()
      })
    );

    // The select-all buttons carry their real counts, so "select all" can never
    // mean something different from what the label says.
    const relabel = (): void => {
      const shownLabel = selectShown.querySelector('.md-btn__label');
      const everythingLabel = selectEverything.querySelector('.md-btn__label');
      if (shownLabel) {
        shownLabel.textContent = t('export.select.allShown', 'Select the {count} shown', {
          count: visibleSources().length
        });
      }
      if (everythingLabel) {
        everythingLabel.textContent = t('export.select.allSources', 'Select every source ({count})', {
          count: sources.length
        });
      }
    };

    sourcesSection.append(
      toolbar,
      selectionStatus,
      el('p', {
        className: 'md-typescale-body-small export-hint',
        text: t('export.select.keyboardHint', 'Space toggles a row; Shift and Space extends the selection.')
      }),
      listNode,
      emptyHost
    );

    const observer = new MutationObserver(relabel);
    observer.observe(listNode, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    ctx.onDispose(() => observer.disconnect());
    relabel();
  }

  /* ================================================================ */
  /* Preview                                                           */
  /* ================================================================ */

  async function openPreview(source: ExportSource, anchor: HTMLElement): Promise<void> {
    const format = formatFor(source);
    const overlay = ctx.overlay.open({
      anchor,
      role: 'dialog',
      label: ctx.t(source.name, source.name),
      placement: 'bottom-start',
      resizeKey: 'export-preview',
      dragKey: 'export-preview'
    });

    const body = overlay.body;
    body.append(el('p', { className: 'md-typescale-body-medium', text: t('export.row.counting', 'Counting…') }));

    try {
      const payload = await source.load(ctx);
      const serialized = serializeExport(
        payload,
        { name: source.id, format, lineEnding: lineEnding(), byteOrderMark: byteOrderMark() },
        ctx.exporter
      );
      const losses = preflightFor(payload, format, ctx.exporter).losses;
      const descriptor = formatById(format);
      body.textContent = '';
      body.append(
        el('h2', { className: 'md-typescale-title-medium', text: `${descriptor?.name ?? format} — ${fileNameFor(source.id, format)}` }),
        el('p', { className: 'md-typescale-body-small', text: descriptor?.purpose ?? '' }),
        el('p', {
          className: 'md-typescale-body-small',
          text: t('export.encoding.statement', 'UTF-8, {eol} line endings, schema version {version}.', {
            eol: eolName(lineEnding()),
            version: SCHEMA_VERSION
          })
        })
      );

      if (serialized.schemaOnly) {
        body.append(
          el('p', {
            className: 'md-typescale-body-medium export-warning',
            text: t('export.preflight.schemaOnly', 'This is a schema and contains none of the records.')
          })
        );
      }

      if (losses.length === 0) {
        body.append(
          el('p', { className: 'md-typescale-body-medium', text: t('export.preflight.clean', 'Nothing is lost.') })
        );
      } else {
        body.append(
          el('h3', { className: 'md-typescale-title-small', text: t('export.preflight.title', 'What this format cannot carry') }),
          el('p', {
            className: 'md-typescale-body-medium export-warning',
            text: t('export.preflight.lossy', '{count} fields cannot be carried faithfully.', { count: losses.length })
          })
        );
        const lossList = el('ul', { className: 'export-losses' });
        for (const loss of losses) {
          lossList.append(el('li', { className: 'md-typescale-body-small', text: `${loss.field} — ${loss.reason}` }));
        }
        body.append(lossList);
      }

      const sample = serialized.text.slice(0, 4000);
      const pre = el('pre', { className: 'export-preview', text: sample });
      pre.setAttribute('tabindex', '0');
      pre.setAttribute('aria-label', 'Preview of the file contents');
      body.append(pre);
      if (serialized.text.length > sample.length) {
        body.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: `Showing the first ${sample.length} of ${serialized.text.length} characters.`
          })
        );
      }
      overlay.reposition();
    } catch (error) {
      body.textContent = '';
      body.append(
        el('p', {
          className: 'md-typescale-body-medium export-warning',
          text: t('export.row.failed', 'This source could not be read: {reason}', {
            reason: error instanceof Error ? error.message : String(error)
          })
        })
      );
    }
  }

  /* ================================================================ */
  /* Format and encoding                                               */
  /* ================================================================ */

  const encodingStatement = el('p', { className: 'md-typescale-body-medium export-statement' });

  function updateEncodingStatement(): void {
    const parts = [
      t('export.encoding.statement', 'UTF-8, {eol} line endings, schema version {version}.', {
        eol: eolName(lineEnding()),
        version: SCHEMA_VERSION
      }),
      byteOrderMark()
        ? t('export.encoding.bomOn', 'A UTF-8 byte-order mark is written.')
        : t('export.encoding.bomOff', 'No byte-order mark is written.')
    ];
    encodingStatement.textContent = parts.join(' ');
  }

  function renderFormatSection(): void {
    formatSection.textContent = '';
    formatSection.append(
      ctx.components.sectionHeading({ title: 'export.section.format', description: 'export.section.format.desc' })
    );

    const grid = el('div', { className: 'export-grid' });

    const eol = ctx.components.segmentedButton({
      label: 'export.setting.eol.label',
      options: [
        { value: 'lf', label: 'LF' },
        { value: 'crlf', label: 'CRLF' }
      ],
      value: lineEnding(),
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.lineEnding, value);
        updateEncodingStatement();
      }
    });

    const bom = ctx.components.switchControl({
      label: 'export.setting.bom.label',
      checked: byteOrderMark(),
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.byteOrderMark, value);
        updateEncodingStatement();
      }
    });

    const defaultFormat = ctx.components.select({
      label: 'export.setting.format.label',
      options: formatsForShape('structured').map((descriptor) => ({ value: descriptor.id, label: descriptor.name })),
      value: String(ctx.settings.get(EXPORT_SETTINGS.defaultFormat, 'json')),
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.defaultFormat, value);
        formats.clear();
        rebuildSources();
      }
    });

    grid.append(defaultFormat.root, eol.root, bom.root);
    updateEncodingStatement();
    formatSection.append(grid, encodingStatement);
  }

  /* ================================================================ */
  /* Running                                                           */
  /* ================================================================ */

  const progressHost = el('div', { className: 'export-progress' });
  const runButton = ctx.components.button({
    label: 'export.run.selected',
    variant: 'filled',
    icon: 'download',
    onClick: () => void startRun(selectedSources())
  });
  const destinationField = ctx.components.textField({
    label: 'export.destination',
    value: destination(),
    supportingText: 'export.destination.hint',
    browse: 'folder',
    onCommit: (value) => {
      ctx.settings.set(EXPORT_SETTINGS.destination, value.trim());
      updateRunControls();
      updateArchiveControls();
    }
  });

  function updateRunControls(): void {
    const count = selectedSources().length;
    const labelNode = runButton.querySelector('.md-btn__label');
    if (labelNode) {
      labelNode.textContent = t('export.run.selected', 'Export the {count} selected…', { count });
    }
    runButton.disabled = running || count === 0;
    if (runButton.disabled) {
      const reason = running
        ? ctx.t('export.archive.creating', 'An export is already running.')
        : t('export.run.nothingSelected', 'Select at least one source first.');
      runButton.title = reason;
      runButton.setAttribute('aria-description', reason);
    } else {
      runButton.removeAttribute('title');
      runButton.removeAttribute('aria-description');
    }
  }

  function renderRunSection(): void {
    runSection.textContent = '';
    runSection.append(ctx.components.sectionHeading({ title: 'export.section.run' }));
    const row = el('div', { className: 'export-grid' });
    row.append(destinationField.root);
    runSection.append(row, progressHost, runButton);
    updateRunControls();
  }

  /** Asks for a destination when one has not been chosen, rather than guessing. */
  async function ensureDestination(): Promise<string | null> {
    const stored = destination();
    if (stored) return stored;
    const chosen = await ctx.studio.dialog.openFolder({ title: ctx.t('export.destination', 'Destination folder') });
    if (!chosen.ok || !chosen.value || chosen.value.length === 0) return null;
    ctx.settings.set(EXPORT_SETTINGS.destination, chosen.value[0]);
    destinationField.set(chosen.value[0]);
    return chosen.value[0];
  }

  /**
   * Which target files already exist.
   *
   * Replacing a file cannot be undone from inside this application, so a run
   * that would replace one goes through the two-key gate with the exact list.
   */
  async function existingTargets(folder: string, chosen: ExportSource[]): Promise<string[]> {
    const existing: string[] = [];
    for (const source of chosen) {
      const path = joinPath(separator, folder, fileNameFor(source.id, formatFor(source)));
      const stat = await ctx.studio.fs.stat(path);
      if (stat.ok && stat.value.exists) existing.push(path);
    }
    return existing;
  }

  async function startRun(chosen: ExportSource[]): Promise<void> {
    if (running) return;
    if (chosen.length === 0) {
      ctx.notify.warn(
        ctx.t('export.notify.title', 'Export', { dialog: true }),
        t('export.run.nothingSelected', 'Select at least one source first.')
      );
      return;
    }
    const folder = await ensureDestination();
    if (!folder) return;

    const existing = await existingTargets(folder, chosen);
    if (existing.length > 0) {
      const allowed = await ctx.confirm.request({
        action: `Replace ${existing.length} existing ${existing.length === 1 ? 'file' : 'files'} in ${folder}`,
        affected: existing,
        irreversible:
          'The current contents of those files are overwritten. This application has no route to bring them back.',
        anchor: runButton,
        confirmLabel: ctx.t('core.action.export', 'Export')
      });
      if (!allowed) return;
    }

    running = true;
    updateRunControls();
    updateArchiveControls();

    const token = createCancelToken();
    const progress = ctx.components.linearProgress({ value: 0, label: ctx.t('export.section.run', 'Write the files') });
    const status = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
    const cancel = ctx.components.button({
      label: 'export.run.cancel',
      variant: 'outlined',
      icon: 'stop',
      onClick: () => {
        token.cancel();
        status.textContent = ctx.t('export.run.cancel', 'Cancelling…');
      }
    });
    progressHost.textContent = '';
    progressHost.append(progress.root, status, cancel);

    const notification = ctx.notify.show({
      title: ctx.t('export.notify.title', 'Export', { dialog: true }),
      severity: 'progress',
      progress: 0,
      source: 'export',
      timeoutMs: 0
    });

    try {
      const outcomes = await runExport(ctx, {
        sources: chosen,
        formats: new Map(chosen.map((source) => [source.id, formatFor(source)])),
        destination: folder,
        lineEnding: lineEnding(),
        byteOrderMark: byteOrderMark(),
        token,
        onProgress: ({ done, total, current }) => {
          const fraction = total === 0 ? 1 : done / total;
          progress.set(fraction);
          notification.update({ progress: fraction });
          status.textContent = t('export.run.progress', 'Exported {done} of {total}: {current}', {
            done,
            total,
            current
          });
        }
      });

      results = [...outcomes, ...results].slice(0, 200);
      const summary = summarize(outcomes);
      notification.dismiss();

      const message = token.cancelled
        ? t('export.run.cancelled', 'Cancelled after {written} of {total} files.', {
            written: summary.written,
            total: chosen.length
          })
        : t('export.run.finished', '{written} written, {skipped} skipped, {failed} failed', {
            written: summary.written,
            skipped: summary.skipped,
            failed: summary.failed
          });

      status.textContent = message;
      ctx.a11y.announce(message, true);
      if (summary.failed > 0) {
        ctx.notify.warn(ctx.t('export.notify.title', 'Export', { dialog: true }), message);
      } else {
        ctx.notify.success(ctx.t('export.notify.title', 'Export', { dialog: true }), message);
      }

      void ctx.history.record('Exported data to files', 'features.export', {
        destination: folder,
        written: summary.written,
        failed: summary.failed,
        cancelled: token.cancelled,
        sources: outcomes.map((outcome) => ({ id: outcome.sourceId, format: outcome.format, status: outcome.status }))
      });

      renderResultsSection();

      if (ctx.settings.get<boolean>(EXPORT_SETTINGS.openInEditor, false) === true && summary.written > 0) {
        await handOff(folder, true, runButton);
      }
    } catch (error) {
      notification.dismiss();
      const reason = error instanceof Error ? error.message : String(error);
      status.textContent = reason;
      ctx.notify.error(ctx.t('export.notify.title', 'Export', { dialog: true }), reason);
    } finally {
      running = false;
      updateRunControls();
      updateArchiveControls();
      cancel.disabled = true;
      cancel.title = ctx.t('export.run.finished', 'The run has finished.');
    }
  }

  /* ================================================================ */
  /* Archives                                                          */
  /* ================================================================ */

  const archiveContents = el('div', { className: 'export-archive__contents' });
  const archiveCost = el('ul', { className: 'export-cost' });
  const archiveCommand = el('pre', { className: 'export-command', attrs: { tabindex: '0' } });
  const archiveStatus = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
  const headerNotice = el('p', { className: 'md-typescale-body-medium export-statement' });
  const archiveButton = ctx.components.button({
    label: 'export.archive.create',
    variant: 'filled',
    icon: 'save',
    onClick: (event) => void startArchive(event.currentTarget as HTMLElement)
  });
  const fallbackButton = ctx.components.button({
    label: 'export.archive.fallback.action',
    variant: 'tonal',
    icon: 'folder',
    onClick: (event) => void startStagingOnly(event.currentTarget as HTMLElement)
  });
  const probeBanner = el('div', {
    className: 'export-banner',
    attrs: { 'data-appearance-id': 'export:archiver-banner' }
  });

  function currentPlanRoot(): string {
    return `${archiveBaseName()}-${new Date().toISOString().slice(0, 10)}`;
  }

  function renderArchiveContents(): void {
    const chosen = selectedSources();
    archiveContents.textContent = '';
    const root = currentPlanRoot();
    archiveContents.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: t('export.archive.contents.count', '{count} entries under {root}/', {
          count: chosen.length + 1,
          root
        })
      })
    );
    const list = el('ul', { className: 'export-entries' });
    for (const source of chosen) {
      const entry = fileNameFor(source.id, formatFor(source));
      const line = `${root}/${entry} — ${ctx.t(source.name, source.name)}`;
      list.append(el('li', { className: 'md-typescale-body-small', text: line }));
    }
    list.append(
      el('li', {
        className: 'md-typescale-body-small',
        text: `${root}/MANIFEST.md — the list naming everything inside`
      })
    );
    archiveContents.append(list);

    const sensitive = chosen.filter((source) => source.sensitive);
    if (sensitive.length > 0) {
      archiveContents.append(
        el('p', {
          className: 'md-typescale-body-medium export-warning',
          text: `${sensitive.length} of these are marked sensitive and are named in the manifest: ${sensitive
            .map((source) => ctx.t(source.name, source.name))
            .join(', ')}.`
        })
      );
    }
    archiveContents.append(
      el('p', {
        className: 'md-typescale-body-small',
        text: t('export.archive.secrets', 'No credential or secret is ever placed in an archive by this surface.')
      })
    );

    updateCommandPreview();
  }

  function updateCommandPreview(): void {
    const options = readArchiveOptions();
    const plan = planArchive({
      command: probe?.command ?? String(ctx.settings.get(EXPORT_SETTINGS.archiverCommand, '7z') || '7z'),
      options,
      parentDirectory: destination() || '<destination folder>',
      root: currentPlanRoot(),
      separator
    });
    archiveCommand.textContent = renderCommandLine(plan.command, plan.displayArgs);

    archiveCost.textContent = '';
    for (const line of describeCost(options)) {
      archiveCost.append(el('li', { className: 'md-typescale-body-small', text: line }));
    }

    const headers = encryptHeadersApplies(options);
    headerNotice.className = 'md-typescale-body-medium export-statement';
    if (!options.encrypt) {
      headerNotice.textContent = t('export.archive.encryption.none', 'No encryption.');
    } else if (options.format === 'zip') {
      headerNotice.textContent = t(
        'export.archive.headers.zip',
        'ZIP cannot encrypt file names, so they stay readable to anybody.'
      );
      headerNotice.classList.add('export-warning');
    } else if (options.encryptHeaders && headers.applies) {
      headerNotice.textContent = t('export.archive.headers.on', 'The file names inside are encrypted as well.');
    } else {
      headerNotice.textContent = t('export.archive.headers.off', 'The file names inside are NOT encrypted.');
      headerNotice.classList.add('export-warning');
    }
  }

  function updateArchiveControls(): void {
    const chosen = selectedSources();
    const options = readArchiveOptions();
    const blockers: string[] = [];
    if (running) blockers.push('An export is already running.');
    if (chosen.length === 0) blockers.push(t('export.run.nothingSelected', 'Select at least one source first.'));
    if (!probe) blockers.push(t('export.archive.probe.checking', 'Looking for an archiver…'));
    else if (!probe.available) blockers.push(t('export.archive.probe.unavailable', 'No archiver can be started from here.'));
    if (options.encrypt && options.password.length === 0) {
      blockers.push(t('export.archive.password.missing', 'Encryption is selected but no password was entered.'));
    }

    archiveButton.disabled = blockers.length > 0;
    if (archiveButton.disabled) {
      archiveButton.title = blockers.join(' ');
      archiveButton.setAttribute('aria-description', blockers.join(' '));
    } else {
      archiveButton.removeAttribute('title');
      archiveButton.removeAttribute('aria-description');
    }

    const fallbackBlocked = running || chosen.length === 0;
    fallbackButton.disabled = fallbackBlocked;
    if (fallbackBlocked) {
      const reason = running ? 'An export is already running.' : t('export.run.nothingSelected', 'Select at least one source first.');
      fallbackButton.title = reason;
      fallbackButton.setAttribute('aria-description', reason);
    } else {
      fallbackButton.removeAttribute('title');
      fallbackButton.removeAttribute('aria-description');
    }

    updateCommandPreview();
  }

  function renderProbeBanner(): void {
    probeBanner.textContent = '';
    if (!probe) {
      probeBanner.append(
        el('p', { className: 'md-typescale-body-medium', text: t('export.archive.probe.checking', 'Looking for an archiver…') })
      );
      return;
    }
    if (probe.available && probe.command) {
      probeBanner.classList.remove('export-banner--warning');
      probeBanner.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: t('export.archive.probe.available', '{command} answered and will be used.', { command: probe.command })
        })
      );
      return;
    }
    probeBanner.classList.add('export-banner--warning');
    probeBanner.append(
      el('p', {
        className: 'md-typescale-title-small',
        text: t('export.archive.probe.unavailable', 'No archiver can be started from here.')
      }),
      el('p', {
        className: 'md-typescale-body-medium',
        text: t('export.archive.probe.reason', 'The privileged bridge reported: {reason}', { reason: probe.reason })
      }),
      el('p', {
        className: 'md-typescale-body-small',
        text: t('export.archive.probe.tried', 'Tried: {commands}', { commands: probe.tried.join(', ') })
      }),
      el('h3', {
        className: 'md-typescale-title-small',
        text: t('export.archive.fallback.title', 'Write the archive contents as a folder instead')
      }),
      el('p', {
        className: 'md-typescale-body-medium',
        text: t('export.archive.fallback.body', 'The same entries at the same relative paths, in a folder.')
      })
    );
  }

  function archiveOptionControls(): HTMLElement {
    const options = readArchiveOptions();
    const grid = el('div', { className: 'export-grid' });

    const rerender = (): void => {
      renderArchiveSection();
    };

    const formatSelect = ctx.components.select({
      label: 'export.archive.format',
      options: [
        { value: '7z', label: '7z' },
        { value: 'zip', label: 'ZIP' }
      ],
      value: options.format,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveFormat, value);
        rerender();
      }
    });

    const methodSelect = ctx.components.select({
      label: 'export.archive.method',
      options: METHODS_BY_FORMAT[options.format].map((method) => ({ value: method, label: method })),
      value: options.method,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveMethod, value);
        rerender();
      }
    });

    const levelSelect = ctx.components.select({
      label: 'export.archive.level',
      options: ARCHIVE_LEVELS,
      value: String(options.level),
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveLevel, Number(value));
        rerender();
      }
    });

    const dictionary = dictionaryApplies(options);
    const dictionarySelect = ctx.components.select({
      label: 'export.archive.dictionary',
      options: DICTIONARY_SIZES.map((size) => ({ value: size, label: size })),
      value: options.dictionary,
      disabled: !dictionary.applies,
      disabledReason: dictionary.reason,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveDictionary, value);
        rerender();
      }
    });

    const wordSize = wordSizeApplies(options);
    const wordSlider = ctx.components.slider({
      label: 'export.archive.wordSize',
      min: 8,
      max: 273,
      step: 1,
      value: options.wordSize,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveWordSize, value);
        updateCommandPreview();
      }
    });
    if (!wordSize.applies) wordSlider.setDisabled(true, wordSize.reason);

    const solid = solidApplies(options);
    const solidSwitch = ctx.components.switchControl({
      label: 'export.archive.solid',
      checked: options.solid,
      disabled: !solid.applies,
      disabledReason: solid.reason,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveSolid, value);
        rerender();
      }
    });

    const solidSelect = ctx.components.select({
      label: 'export.archive.solidBlock',
      options: SOLID_BLOCK_SIZES.map((size) => ({ value: size, label: size === 'on' ? 'on — one block for everything' : size })),
      value: options.solidBlock,
      disabled: !solid.applies || !options.solid,
      disabledReason: solid.applies ? 'Solid mode is off, so there are no blocks to size.' : solid.reason,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveSolidBlock, value);
        rerender();
      }
    });

    const threadOptions: SettingOption[] = [
      { value: 'off', label: 'off — one thread' },
      { value: 'on', label: 'on — the archiver chooses' },
      ...[1, 2, 4, 6, 8, 12, 16, 24, 32].map((count) => ({ value: String(count), label: String(count) }))
    ];
    const threadSelect = ctx.components.select({
      label: 'export.archive.threads',
      options: threadOptions,
      value: options.threads,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveThreads, value);
        rerender();
      }
    });

    const volumeSelect = ctx.components.select({
      label: 'export.archive.volume',
      options: VOLUME_SIZES.map((size) => ({ value: size, label: size === '' ? 'one file' : size })),
      value: options.volume,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveVolume, value);
        rerender();
      }
    });

    const nameField = ctx.components.textField({
      label: 'export.archive.name',
      value: String(ctx.settings.get(EXPORT_SETTINGS.archiveName, 'studio-export')),
      onCommit: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveName, value.trim() || 'studio-export');
        renderArchiveContents();
      }
    });

    const encryptSwitch = ctx.components.switchControl({
      label: 'export.archive.encryption',
      checked: encrypt,
      onChange: (value) => {
        encrypt = value;
        if (!value) password = '';
        rerender();
      }
    });

    const passwordField = ctx.components.textField({
      label: 'export.archive.password',
      type: 'password',
      value: password,
      supportingText: 'export.archive.password.note',
      onChange: (value) => {
        password = value;
        updateArchiveControls();
      }
    });
    if (!encrypt) passwordField.setDisabled(true, ctx.t('export.archive.encryption.none', 'Encryption is off.'));

    const headersApplies = encryptHeadersApplies({ ...options, encrypt });
    const headerSwitch = ctx.components.switchControl({
      label: 'export.archive.encryptHeaders',
      checked: options.encryptHeaders && headersApplies.applies,
      disabled: !headersApplies.applies,
      disabledReason: headersApplies.reason,
      onChange: (value) => {
        ctx.settings.set(EXPORT_SETTINGS.archiveEncryptHeaders, value);
        rerender();
      }
    });

    grid.append(
      nameField.root,
      formatSelect.root,
      methodSelect.root,
      levelSelect.root,
      dictionarySelect.root,
      wordSlider.root,
      solidSwitch.root,
      solidSelect.root,
      threadSelect.root,
      volumeSelect.root,
      encryptSwitch.root,
      passwordField.root,
      headerSwitch.root
    );
    return grid;
  }

  function renderArchiveSection(): void {
    archiveSection.textContent = '';
    archiveSection.append(
      ctx.components.sectionHeading({ title: 'export.section.archive', description: 'export.archive.desc' }),
      probeBanner,
      archiveOptionControls(),
      headerNotice,
      el('h3', { className: 'md-typescale-title-small', text: t('export.archive.cost', 'Cost') }),
      archiveCost,
      el('h3', { className: 'md-typescale-title-small', text: t('export.archive.contents', 'What goes inside') }),
      archiveContents,
      el('h3', { className: 'md-typescale-title-small', text: t('export.archive.command', 'The command that will run') }),
      archiveCommand,
      el('p', {
        className: 'md-typescale-body-small',
        text: t('export.archive.command.redacted', 'The password is shown as ******** and is never written anywhere.')
      })
    );

    const actions = el('div', { className: 'export-actions' });
    actions.append(
      archiveButton,
      fallbackButton,
      ctx.components.button({
        label: 'export.archive.copyCommand',
        variant: 'text',
        icon: 'copy',
        onClick: () => {
          void navigator.clipboard
            .writeText(archiveCommand.textContent ?? '')
            .then(() =>
              ctx.notify.success(
                ctx.t('export.notify.title', 'Export', { dialog: true }),
                t('export.result.copied', 'Copied {name} to the clipboard.', { name: 'the command' })
              )
            )
            .catch((error: unknown) =>
              ctx.notify.error(
                ctx.t('export.notify.title', 'Export', { dialog: true }),
                error instanceof Error ? error.message : String(error)
              )
            );
        }
      }),
      ctx.components.button({
        label: 'export.vscode.recheck',
        variant: 'text',
        icon: 'refresh',
        onClick: () => void refreshProbe()
      })
    );
    archiveSection.append(actions, archiveStatus);

    renderProbeBanner();
    renderArchiveContents();
    updateArchiveControls();
  }

  async function refreshProbe(): Promise<void> {
    probe = null;
    renderProbeBanner();
    updateArchiveControls();
    const preferred = String(ctx.settings.get(EXPORT_SETTINGS.archiverCommand, '') ?? '');
    const found = await probeArchiver(ctx.studio, preferred);
    if (disposed) return;
    probe = found;
    renderProbeBanner();
    updateArchiveControls();
  }

  async function stagingRequest(folder: string, chosen: ExportSource[], token = createCancelToken()) {
    const options = readArchiveOptions();
    const root = currentPlanRoot();
    const plan = planArchive({
      command: probe?.command ?? '7z',
      options,
      parentDirectory: folder,
      root,
      separator
    });
    return {
      request: {
        sources: chosen,
        formats: new Map(chosen.map((source) => [source.id, formatFor(source)])),
        destination: folder,
        lineEnding: lineEnding(),
        byteOrderMark: byteOrderMark(),
        token,
        onProgress: ({ done, total, current }: { done: number; total: number; current: string }) => {
          archiveStatus.textContent = t('export.run.progress', 'Exported {done} of {total}: {current}', {
            done,
            total,
            current
          });
        },
        root,
        options,
        commandLine: renderCommandLine(plan.command, plan.displayArgs)
      },
      options,
      root
    };
  }

  /**
   * One gate for everything a run would replace.
   *
   * Staging a second archive on the same day writes into the same dated folder,
   * so the staged entries are listed here beside the archive itself rather than
   * being replaced quietly on the way to a gate that only guarded the archive.
   */
  async function gateOverwrite(paths: string[], anchor: HTMLElement, action: string): Promise<boolean> {
    const existing: string[] = [];
    for (const path of paths) {
      const stat = await ctx.studio.fs.stat(path);
      if (stat.ok && stat.value.exists) existing.push(path);
    }
    if (existing.length === 0) return true;
    return ctx.confirm.request({
      action: `${action}: replace ${existing.length} existing ${existing.length === 1 ? 'file' : 'files'}`,
      affected: existing,
      irreversible:
        'The current contents of those files are overwritten. This application has no route to bring them back.',
      anchor,
      confirmLabel: ctx.t('core.action.confirm', 'Confirm')
    });
  }

  function stagedPaths(folder: string, chosen: ExportSource[]): string[] {
    const root = joinPath(separator, folder, currentPlanRoot());
    return [
      ...chosen.map((source) => joinPath(separator, root, fileNameFor(source.id, formatFor(source)))),
      joinPath(separator, root, 'MANIFEST.md')
    ];
  }

  async function startStagingOnly(anchor: HTMLElement): Promise<void> {
    const chosen = selectedSources();
    if (chosen.length === 0 || running) return;
    const folder = await ensureDestination();
    if (!folder) return;

    const approved = await gateOverwrite(
      stagedPaths(folder, chosen),
      anchor,
      ctx.t('export.archive.fallback.title', 'Write the archive contents as a folder')
    );
    if (!approved) return;

    running = true;
    updateRunControls();
    updateArchiveControls();
    try {
      const { request, root } = await stagingRequest(folder, chosen);
      const staged = await stageArchiveEntries(ctx, request);
      results = [...staged.outcomes, ...results].slice(0, 200);
      const message = t('export.archive.fallback.done', 'Wrote {count} entries into {path}', {
        count: staged.entries.length,
        path: staged.rootDirectory
      });
      archiveStatus.textContent = message;
      ctx.a11y.announce(message, true);
      ctx.notify.success(ctx.t('export.notify.title', 'Export', { dialog: true }), message);
      void ctx.history.record('Wrote an archive contents folder', 'features.export', {
        folder: staged.rootDirectory,
        root,
        entries: staged.entries.map((entry) => entry.relativePath)
      });
      renderResultsSection();
      await handOff(staged.rootDirectory, true, anchor);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      archiveStatus.textContent = reason;
      ctx.notify.error(ctx.t('export.notify.title', 'Export', { dialog: true }), reason);
    } finally {
      running = false;
      updateRunControls();
      updateArchiveControls();
    }
  }

  async function startArchive(anchor: HTMLElement): Promise<void> {
    const chosen = selectedSources();
    if (chosen.length === 0 || running || !probe?.available || !probe.command) return;
    const folder = await ensureDestination();
    if (!folder) return;

    const options = readArchiveOptions();
    if (options.encrypt && options.password.length === 0) {
      ctx.notify.warn(
        ctx.t('export.notify.title', 'Export', { dialog: true }),
        t('export.archive.password.missing', 'Encryption is selected but no password was entered.')
      );
      return;
    }

    const archivePath = joinPath(separator, folder, `${currentPlanRoot()}.${options.format}`);
    const allowed = await gateOverwrite(
      [archivePath, ...stagedPaths(folder, chosen)],
      anchor,
      ctx.t('export.archive.create', 'Create the archive')
    );
    if (!allowed) return;

    running = true;
    updateRunControls();
    updateArchiveControls();
    archiveStatus.textContent = t('export.archive.creating', 'Creating the archive…');

    try {
      const { request } = await stagingRequest(folder, chosen);
      const result = await createArchive(ctx, { ...request, archiverCommand: probe.command });
      results = [...result.staging.outcomes, ...results].slice(0, 200);

      if (result.created) {
        const message = t('export.archive.created', 'Created {path}', { path: result.archivePath });
        archiveStatus.textContent = `${message} (${result.bytes} bytes). The staged folder ${result.staging.rootDirectory} was left in place; this application has no route to delete files.`;
        ctx.a11y.announce(message, true);
        ctx.notify.success(ctx.t('export.notify.title', 'Export', { dialog: true }), message);
        void ctx.history.record('Created an archive', 'features.export', {
          archive: result.archivePath,
          bytes: result.bytes,
          format: options.format,
          method: options.method,
          level: options.level,
          encrypted: options.encrypt,
          fileNamesEncrypted: options.encrypt ? options.encryptHeaders : null,
          entries: result.staging.entries.map((entry) => entry.relativePath)
        });
      } else {
        const reason = result.refusal ?? result.failure ?? 'The archiver produced no archive and gave no reason.';
        archiveStatus.textContent = t('export.archive.failed', 'The archiver failed: {reason}', { reason });
        archiveStatus.classList.add('export-warning');
        ctx.notify.error(
          ctx.t('export.notify.title', 'Export', { dialog: true }),
          t('export.archive.failed', 'The archiver failed: {reason}', { reason })
        );
        void ctx.history.record('An archive was attempted and not written', 'features.export', {
          archive: result.archivePath,
          reason
        });
      }
      renderResultsSection();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      archiveStatus.textContent = reason;
      ctx.notify.error(ctx.t('export.notify.title', 'Export', { dialog: true }), reason);
    } finally {
      running = false;
      updateRunControls();
      updateArchiveControls();
    }
  }

  /* ================================================================ */
  /* Results and the editor handoff                                    */
  /* ================================================================ */

  async function handOff(target: string, asFolder: boolean, anchor: HTMLElement): Promise<void> {
    if (!editors) editors = await detectEditors(ctx.studio);
    const outcome = await openInEditor(ctx.studio, target, {
      availability: editors,
      preferredId: String(ctx.settings.get(EXPORT_SETTINGS.editorId, '') ?? ''),
      asFolder
    });
    if (outcome.ok) {
      ctx.notify.success(
        ctx.t('export.vscode.title', 'Visual Studio Code', { dialog: true }),
        t('export.vscode.opened', 'Asked Visual Studio Code to open {path}.', { path: target })
      );
      return;
    }
    const handle = ctx.notify.show({
      title: ctx.t('export.vscode.title', 'Visual Studio Code', { dialog: true }),
      body: outcome.error ?? ctx.t('export.vscode.missing', 'Visual Studio Code was not found.'),
      severity: 'warning',
      source: 'export',
      actions: [
        {
          label: 'export.vscode.download',
          run: () => void ctx.studio.shell.openExternal(VS_CODE_DOWNLOAD_URL)
        },
        {
          label: 'export.vscode.recheck',
          run: () => {
            editors = null;
            handle.dismiss();
            void handOff(target, asFolder, anchor);
          }
        }
      ]
    });
  }

  function renderEditorBanner(): HTMLElement {
    const banner = el('div', {
      className: 'export-banner',
      attrs: { id: 'export-vscode', 'data-appearance-id': 'export:vscode-banner' }
    });
    banner.append(
      el('h3', { className: 'md-typescale-title-small', text: t('export.vscode.title', 'Visual Studio Code') }),
      el('p', { className: 'md-typescale-body-medium', text: t('export.vscode.desc', 'Every export can be opened in it.') })
    );

    const status = el('p', { className: 'md-typescale-body-medium' });
    banner.append(status);

    const actions = el('div', { className: 'export-actions' });
    banner.append(actions);

    const paint = (): void => {
      actions.textContent = '';
      if (!editors) {
        status.textContent = t('export.archive.probe.checking', 'Looking…');
        return;
      }
      if (editors.probeError) {
        banner.classList.add('export-banner--warning');
        status.textContent = editors.probeError;
      } else if (editors.preferred) {
        banner.classList.remove('export-banner--warning');
        status.textContent = t('export.vscode.found', '{name} was found at {path}.', {
          name: editors.preferred.name,
          path: editors.preferred.command
        });
      } else {
        banner.classList.add('export-banner--warning');
        status.textContent = `${t('export.vscode.missing', 'Visual Studio Code was not found on this computer.')} ${t(
          'export.vscode.missingBody',
          'The code command is not on PATH and no usual install path exists.'
        )}`;
        actions.append(
          ctx.components.button({
            label: 'export.vscode.download',
            variant: 'tonal',
            icon: 'cloud',
            onClick: () => void ctx.studio.shell.openExternal(VS_CODE_DOWNLOAD_URL)
          })
        );
      }
      actions.append(
        ctx.components.button({
          label: 'export.vscode.recheck',
          variant: 'text',
          icon: 'refresh',
          onClick: () => {
            editors = null;
            paint();
            void detectEditors(ctx.studio).then((found) => {
              if (disposed) return;
              editors = found;
              paint();
            });
          }
        })
      );

      if (editors && editors.usable.length > 1) {
        const chooser = ctx.components.select({
          label: 'export.vscode.editor',
          options: editors.usable.map((candidate) => ({ value: candidate.id, label: candidate.name })),
          value: String(ctx.settings.get(EXPORT_SETTINGS.editorId, editors.usable[0].id)),
          onChange: (value) => ctx.settings.set(EXPORT_SETTINGS.editorId, value)
        });
        actions.append(chooser.root);
      }
    };

    paint();
    void detectEditors(ctx.studio).then((found) => {
      if (disposed) return;
      editors = found;
      paint();
    });

    return banner;
  }

  const resultKey = (outcome: ExportOutcome): string => `${outcome.sourceId}|${outcome.finishedAt}`;

  function renderResultsSection(): void {
    resultsSection.textContent = '';
    resultsSection.append(ctx.components.sectionHeading({ title: 'export.section.results' }), renderEditorBanner());

    if (results.length === 0) {
      resultsSection.append(
        ctx.components.emptyState({ title: 'export.results.empty', body: 'export.results.emptyBody' })
      );
      return;
    }

    // The results are a list, so they carry the same selection contract as every
    // other list here: shift ranges, an honestly-scoped select-all, inverse
    // selection and the full action set rather than a token subset.
    for (const key of [...resultSelection]) {
      if (!results.some((outcome) => resultKey(outcome) === key)) resultSelection.delete(key);
    }

    const resultStatus = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
    const refreshResultStatus = (): void => {
      resultStatus.textContent = t('export.results.selected', '{selected} of {total} results selected', {
        selected: resultSelection.size,
        total: results.length
      });
    };

    const selectedResults = (): ExportOutcome[] => results.filter((outcome) => resultSelection.has(resultKey(outcome)));

    const bulk = el('div', { className: 'export-toolbar' });
    bulk.append(
      ctx.components.button({
        label: 'core.action.selectAll',
        variant: 'text',
        icon: 'check',
        onClick: () => {
          for (const outcome of results) resultSelection.add(resultKey(outcome));
          renderResultsSection();
        }
      }),
      ctx.components.button({
        label: 'core.action.invertSelection',
        variant: 'text',
        icon: 'refresh',
        onClick: () => {
          for (const outcome of results) {
            const key = resultKey(outcome);
            if (resultSelection.has(key)) resultSelection.delete(key);
            else resultSelection.add(key);
          }
          renderResultsSection();
        }
      }),
      ctx.components.button({
        label: 'export.select.clear',
        variant: 'text',
        icon: 'close',
        onClick: () => {
          resultSelection.clear();
          renderResultsSection();
        }
      }),
      ctx.components.button({
        label: t('export.results.bulk.openEditor', 'Open the {count} selected in Visual Studio Code', {
          count: resultSelection.size
        }),
        variant: 'text',
        icon: 'code',
        onClick: async (event) => {
          const chosen = selectedResults().filter((outcome) => outcome.path);
          if (chosen.length === 0) {
            ctx.notify.warn(
              ctx.t('export.notify.title', 'Export', { dialog: true }),
              t('export.results.bulk.noPaths', 'None of the selected results has a file.')
            );
            return;
          }
          for (const outcome of chosen) {
            if (outcome.path) await handOff(outcome.path, false, event.currentTarget as HTMLElement);
          }
        }
      }),
      ctx.components.button({
        label: t('export.results.bulk.copyPaths', 'Copy the {count} selected paths', { count: resultSelection.size }),
        variant: 'text',
        icon: 'copy',
        onClick: () => {
          const paths = selectedResults()
            .map((outcome) => outcome.path)
            .filter((path): path is string => path !== null);
          if (paths.length === 0) {
            ctx.notify.warn(
              ctx.t('export.notify.title', 'Export', { dialog: true }),
              t('export.results.bulk.noPaths', 'None of the selected results has a file.')
            );
            return;
          }
          void navigator.clipboard.writeText(paths.join('\n')).then(() =>
            ctx.notify.success(
              ctx.t('export.notify.title', 'Export', { dialog: true }),
              t('export.result.copied', 'Copied {name} to the clipboard.', { name: `${paths.length} paths` })
            )
          );
        }
      }),
      ctx.components.button({
        label: t('export.results.bulk.remove', 'Remove the {count} selected from this list', {
          count: resultSelection.size
        }),
        variant: 'text',
        icon: 'trash',
        onClick: async () => {
          const chosen = selectedResults();
          if (chosen.length === 0) {
            ctx.notify.warn(
              ctx.t('export.notify.title', 'Export', { dialog: true }),
              t('export.results.bulk.noneSelected', 'Select at least one result first.')
            );
            return;
          }
          // Not a destructive action: it removes rows from a session list and
          // touches no file, so it asks with an ordinary decision dialog that
          // says exactly that rather than with the two-key gate.
          const body = el('div');
          body.append(
            el('p', {
              className: 'md-typescale-body-medium',
              text: t('export.results.bulk.note', 'Removing an entry does not delete the file it names.')
            })
          );
          const preview = el('ul', { className: 'export-entries' });
          for (const outcome of chosen.slice(0, 12)) {
            preview.append(
              el('li', {
                className: 'md-typescale-body-small',
                text: outcome.path ?? `${ctx.t(outcome.name, outcome.name)} — no file was written`
              })
            );
          }
          if (chosen.length > 12) {
            preview.append(
              el('li', { className: 'md-typescale-body-small', text: `…and ${chosen.length - 12} more` })
            );
          }
          body.append(preview);
          const agreed = await ctx.components.dialog({
            title: t('export.results.bulk.remove', 'Remove the {count} selected from this list', {
              count: chosen.length
            }),
            body,
            confirmLabel: 'core.action.confirm',
            cancelLabel: 'core.action.cancel'
          });
          if (!agreed) return;
          const keys = new Set(chosen.map(resultKey));
          results = results.filter((outcome) => !keys.has(resultKey(outcome)));
          resultSelection.clear();
          ctx.a11y.announce(
            t('export.results.bulk.removed', 'Removed {count} entries from the list. No file was deleted.', {
              count: chosen.length
            }),
            true
          );
          renderResultsSection();
        }
      })
    );

    refreshResultStatus();
    resultsSection.append(
      bulk,
      resultStatus,
      el('p', {
        className: 'md-typescale-body-small export-hint',
        text: t('export.results.bulk.note', 'Removing an entry does not delete the file it names.')
      })
    );

    const list = el('ul', { className: 'md-list export-results', attrs: { role: 'list' } });
    let lastResultIndex = -1;
    results.forEach((outcome, index) => {
      const item = el('li', { className: 'md-list-item export-result' });
      const key = resultKey(outcome);
      const check = el('input', {
        className: 'export-row__check',
        attrs: {
          type: 'checkbox',
          'aria-label': t('export.results.select', 'Select the export of {name}', {
            name: ctx.t(outcome.name, outcome.name)
          })
        }
      });
      check.checked = resultSelection.has(key);
      const applyRange = (toIndex: number): void => {
        if (lastResultIndex < 0) return;
        const start = Math.min(lastResultIndex, toIndex);
        const end = Math.max(lastResultIndex, toIndex);
        for (let cursor = start; cursor <= end; cursor += 1) {
          const row = results[cursor];
          if (row) resultSelection.add(resultKey(row));
        }
      };
      check.addEventListener('click', (event) => {
        if (event.shiftKey) applyRange(index);
        else if (check.checked) resultSelection.add(key);
        else resultSelection.delete(key);
        lastResultIndex = index;
        renderResultsSection();
      });
      item.addEventListener('keydown', (event) => {
        if (event.key !== ' ' && event.key !== 'Spacebar') return;
        if (document.activeElement !== item && document.activeElement !== check) return;
        event.preventDefault();
        if (event.shiftKey) applyRange(index);
        else if (resultSelection.has(key)) resultSelection.delete(key);
        else resultSelection.add(key);
        lastResultIndex = index;
        renderResultsSection();
      });
      item.tabIndex = 0;
      item.dataset.selected = String(resultSelection.has(key));
      item.append(check);
      const text = el('div', { className: 'md-list-item__text' });
      const statusLabel =
        outcome.status === 'written'
          ? t('export.result.written', 'Written')
          : outcome.status === 'failed'
            ? t('export.result.failed', 'Failed')
            : outcome.status === 'skipped'
              ? t('export.result.skipped', 'Skipped')
              : t('export.result.cancelled', 'Cancelled');
      text.append(
        el('span', {
          className: 'md-typescale-body-large',
          text: `${ctx.t(outcome.name, outcome.name)} — ${formatById(outcome.format)?.name ?? outcome.format}`
        }),
        el('span', {
          className: 'md-list-item__supporting',
          text: outcome.path
            ? `${statusLabel} · ${outcome.path} · ${outcome.bytes} bytes · ${outcome.records} ${
                outcome.records === 1 ? 'record' : 'records'
              }`
            : `${statusLabel}${outcome.error ? ` · ${outcome.error}` : ''}`
        })
      );
      if (outcome.losses.length > 0) {
        text.append(
          el('span', {
            className: 'md-typescale-body-small export-row__omits',
            text: `${outcome.losses.length} ${outcome.losses.length === 1 ? 'field was' : 'fields were'} flattened: ${outcome.losses
              .map((loss) => loss.field)
              .join(', ')}`
          })
        );
      }
      item.append(
        ctx.components.badge({
          label: statusLabel,
          severity: outcome.status === 'written' ? 'success' : outcome.status === 'failed' ? 'error' : 'warning'
        }),
        text
      );

      if (outcome.path) {
        const path = outcome.path;
        const actions = el('div', { className: 'export-actions' });
        actions.append(
          ctx.components.button({
            label: 'export.vscode.openFile',
            variant: 'text',
            icon: 'code',
            onClick: (event) => void handOff(path, false, event.currentTarget as HTMLElement)
          }),
          ctx.components.button({
            label: 'export.vscode.openFolder',
            variant: 'text',
            icon: 'folder',
            onClick: (event) => void handOff(parentOf(path, separator), true, event.currentTarget as HTMLElement)
          }),
          ctx.components.button({
            label: 'export.result.openFolder',
            variant: 'text',
            icon: 'visibility',
            onClick: () => void ctx.studio.shell.showItemInFolder(path)
          }),
          ctx.components.button({
            label: 'export.result.copy',
            variant: 'text',
            icon: 'copy',
            onClick: () => {
              void ctx.studio.fs.readText(path, 4 * 1024 * 1024).then(async (read) => {
                if (!read.ok) {
                  ctx.notify.error(ctx.t('export.notify.title', 'Export', { dialog: true }), read.error);
                  return;
                }
                await navigator.clipboard.writeText(read.value);
                ctx.notify.success(
                  ctx.t('export.notify.title', 'Export', { dialog: true }),
                  t('export.result.copied', 'Copied {name} to the clipboard.', { name: path })
                );
              });
            }
          })
        );
        item.append(actions);
      }
      list.append(item);
    });
    resultsSection.append(list);
  }

  /* ================================================================ */
  /* Boot                                                              */
  /* ================================================================ */

  renderSourcesSection();
  rebuildSources();
  renderFormatSection();
  renderRunSection();
  renderArchiveSection();
  renderResultsSection();
  void refreshProbe();

  const unsubscribeSettings = ctx.settings.onChange((change) => {
    if (!change.id.startsWith('export.')) return;
    updateEncodingStatement();
    updateArchiveControls();
  });

  ctx.onDispose(() => {
    disposed = true;
    unsubscribeSettings();
  });
}
