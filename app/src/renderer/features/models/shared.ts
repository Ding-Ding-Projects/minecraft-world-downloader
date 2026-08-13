import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';
import type { EvidenceLine, FitVerdict } from './hardware';
import { verdictLabel } from './hardware';
import type { CatalogVariant, ModelsState } from './state';
import { formatBytes, formatTimestamp } from './util';

/**
 * Small pieces of chrome shared by every panel in this feature: the hardware
 * fit chip, the evidence list, and the four-button bulk-selection toolbar
 * every list in this feature carries.
 */

/** A small coloured chip naming a fit verdict. Colour is never the only signal: the label is always the localized verdict name. */
export function fitChip(ctx: AppContext, verdict: FitVerdict): HTMLElement {
  const label = fitLabel(ctx, verdict);
  return el('span', { className: `models-fit-chip models-fit-chip--${verdict}`, text: label, attrs: { role: 'status' } });
}

export function fitLabel(ctx: AppContext, verdict: FitVerdict): string {
  switch (verdict) {
    case 'well':
      return ctx.t('models.fit.well', 'Runs well');
    case 'limits':
      return ctx.t('models.fit.limits', 'Runs with limits');
    case 'unlikely':
      return ctx.t('models.fit.unlikely', 'Unlikely');
    default:
      return ctx.t('models.fit.unknown', 'Unknown');
  }
}

/** Renders the hardware evidence rows. English throughout: these are measured figures, not copy. */
export function evidenceList(lines: EvidenceLine[]): HTMLElement {
  const root = el('div', { className: 'models-evidence' });
  for (const line of lines) {
    root.append(
      el('div', {
        className: `models-evidence__row${line.approximate ? ' models-evidence__approx' : ''}`,
        children: [
          el('span', { className: 'models-evidence__label', text: line.label }),
          el('span', { text: line.value }),
          el('span', { className: 'models-muted', text: `(${line.source})` })
        ]
      })
    );
  }
  return root;
}

export { verdictLabel };

/* ------------------------------------------------------------------ */
/* Bulk-selection toolbar                                              */
/* ------------------------------------------------------------------ */

export interface SelectionToolbarOptions {
  ctx: AppContext;
  selection: Set<string>;
  /** Ids currently visible under the active search and filters. */
  shownIds(): string[];
  /** Every id in the whole inventory, ignoring filters. */
  allIds(): string[];
  onChange(): void;
}

export interface SelectionToolbarHandle {
  root: HTMLElement;
  refresh(): void;
}

/**
 * The four-button bulk-selection toolbar every list in this feature carries:
 * select what is shown, select every match, invert, clear — plus the honest
 * count line naming shown against total.
 */
export function selectionToolbar(options: SelectionToolbarOptions): SelectionToolbarHandle {
  const { ctx, selection, shownIds, allIds, onChange } = options;
  const root = el('div', { className: 'models-panel__toolbar' });
  const summary = el('p', { className: 'md-typescale-body-small models-muted' });

  const selectShown = ctx.components.button({
    label: 'models.action.selectShown',
    variant: 'text',
    onClick: () => {
      for (const id of shownIds()) selection.add(id);
      onChange();
      refresh();
    }
  });
  const selectAll = ctx.components.button({
    label: 'models.action.selectAll',
    variant: 'text',
    onClick: () => {
      for (const id of allIds()) selection.add(id);
      onChange();
      refresh();
    }
  });
  const invert = ctx.components.button({
    label: 'models.action.invert',
    variant: 'text',
    onClick: () => {
      const shown = shownIds();
      for (const id of shown) {
        if (selection.has(id)) selection.delete(id);
        else selection.add(id);
      }
      onChange();
      refresh();
    }
  });
  const clear = ctx.components.button({
    label: 'models.action.clearSelection',
    variant: 'text',
    onClick: () => {
      selection.clear();
      onChange();
      refresh();
    }
  });

  root.append(selectShown, selectAll, invert, clear, summary);

  function refresh(): void {
    const shown = shownIds();
    const total = allIds().length;
    selectShown.textContent = ctx.t('models.action.selectShown', 'Select the {count} shown', {
      values: { count: shown.length }
    });
    selectAll.textContent = ctx.t('models.action.selectAll', 'Select all {count} matching', { values: { count: total } });
    let selected = 0;
    for (const id of shown) if (selection.has(id)) selected += 1;
    summary.textContent = ctx.t('models.selection.count', '{selected} selected of {shown} shown, {total} in the whole inventory.', {
      values: { selected, shown: shown.length, total }
    });
  }
  refresh();

  return { root, refresh };
}

/**
 * Disables a button and states why in the same breath.
 *
 * A disabled button with no explanation reads as broken rather than as
 * blocked, so the reason travels with the state every time it changes.
 */
export function setButtonDisabled(button: HTMLButtonElement, disabled: boolean, reason: string): void {
  button.disabled = disabled;
  if (disabled) {
    button.title = reason;
    button.setAttribute('aria-description', reason);
  } else {
    button.removeAttribute('title');
    button.removeAttribute('aria-description');
  }
}

/** Formats a list of strings for a confirm dialog's affected list, bounded so it never floods the gate. */
export function boundedAffected(items: string[], limit = 25): string[] {
  if (items.length <= limit) return items;
  return [...items.slice(0, limit), `… and ${items.length - limit} more.`];
}

/* ------------------------------------------------------------------ */
/* Variant details                                                     */
/* ------------------------------------------------------------------ */

function row(labelText: string, value: string): HTMLElement {
  return el('div', {
    className: 'models-evidence__row',
    children: [el('span', { className: 'models-evidence__label', text: labelText }), el('span', { text: value })]
  });
}

/**
 * The one detail dialog every panel that lists a variant opens on activation:
 * every published and measured field, the hardware fit reasoning in full, and
 * every metadata gap named rather than hidden.
 */
export function openVariantDetails(
  ctx: AppContext,
  models: ModelsState,
  variant: CatalogVariant,
  onEnrich?: () => Promise<void>
): void {
  const fit = models.fitFor(variant);
  const body = el('div', { className: 'models-evidence' });

  body.append(
    row(ctx.t('models.column.state', 'State'), variant.running
      ? ctx.t('models.state.running', 'Loaded')
      : variant.installed
        ? ctx.t('models.state.installed', 'Installed')
        : ctx.t('models.state.catalog', 'Not installed')),
    row(ctx.t('models.column.download', 'Download'), formatBytes(variant.downloadBytes)),
    row(ctx.t('models.column.size', 'Size'), formatBytes(variant.installedBytes ?? variant.modelBytes)),
    row(ctx.t('models.column.parameters', 'Parameters'), variant.parameterSize ?? '—'),
    row(ctx.t('models.column.quantization', 'Quantization'), variant.quantization ?? '—'),
    row(ctx.t('models.column.family', 'Family'), variant.family ?? '—'),
    row(ctx.t('models.details.format', 'Format'), variant.format ?? '—'),
    row(ctx.t('models.column.context', 'Context'), variant.contextLength ? variant.contextLength.toLocaleString() : '—'),
    row(ctx.t('models.column.capabilities', 'Capabilities'), variant.capabilities.length > 0 ? variant.capabilities.join(', ') : '—'),
    row(ctx.t('models.column.modified', 'Last changed'), formatTimestamp(variant.modifiedAt)),
    row(ctx.t('models.details.digest', 'Digest'), variant.digest ?? '—'),
    row(ctx.t('models.details.verifiedAt', 'Metadata last verified'), formatTimestamp(variant.verifiedAt))
  );

  const evidence = el('p', { className: 'md-typescale-body-small models-muted', text: variant.capabilityEvidence });
  body.append(evidence);

  if (variant.metadataGaps.length > 0) {
    const gaps = el('div', { className: 'models-gaps' });
    gaps.append(el('p', { className: 'md-typescale-title-small', text: ctx.t('models.hardware.gaps', 'Not measured') }));
    for (const gap of variant.metadataGaps) gaps.append(el('p', { className: 'md-typescale-body-small', text: gap }));
    body.append(gaps);
  }

  const fitTitle = el('h3', {
    className: 'md-typescale-title-small',
    text: ctx.t('models.fit.title', 'Hardware fit for {ref}', { values: { ref: variant.ref } })
  });
  body.append(fitTitle, fitChip(ctx, fit.verdict));
  const reasonsList = el('ul', { className: 'models-reasoning' });
  for (const reason of fit.reasons) reasonsList.append(el('li', { className: 'md-typescale-body-small', text: reason }));
  body.append(el('p', { className: 'md-typescale-body-small', text: fit.headline }), reasonsList);
  if (fit.assumptions.length > 0) {
    const assumptions = el('ul', { className: 'models-reasoning' });
    for (const assumption of fit.assumptions) assumptions.append(el('li', { className: 'md-typescale-body-small', text: assumption }));
    body.append(el('p', { className: 'md-typescale-label-medium', text: ctx.t('models.fit.assumptions', 'What was assumed') }), assumptions);
  }
  body.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.fit.notAPromise', 'A verdict is evidence about this machine, not a promise about a run. It is recomputed whenever the hardware figures, the storage figures, the model metadata or the overhead setting change.') }));

  const extraActions = onEnrich
    ? [
        {
          label: ctx.t('models.details.readManifest', 'Read this manifest'),
          variant: 'text' as const,
          onClick: () => void onEnrich()
        }
      ]
    : [];

  void ctx.components.dialog({
    title: variant.ref,
    body,
    confirmLabel: ctx.t('core.action.close', 'Close'),
    extraActions
  });
}
