/**
 * The PDF tools tab: inventory row 11.3.
 *
 * Inspect, extract, reorder, rotate and edit metadata all run the exact
 * `documents.pdf.*` adapters the catalog already lists, through the same
 * `runSingleFileAdapter` path the queue uses — so this tab is a UI over the
 * same validated routes, not a second implementation of them.
 *
 * Split and merge have no single-source `run` (they are declared
 * `multiFile: 'split' | 'merge'` in the registry, deliberately, because they
 * do not fit the one-file-in-one-file-out shape every other route has), so
 * this tab drives `pdf.ts`'s `buildDocument` and `mergeDocuments` directly —
 * the same object-graph copier and the same post-write reopen validation
 * every other PDF route already relies on.
 */

import { adapterById, type ValidationCheck } from './adapters';
import { utf8ToBytes } from './bytes';
import { joinPath, stemOf } from './formats';
import { ConverterBoundary, Deadline, isBoundary, readLimits, safeFailureMessage } from './limits';
import {
  buildDocument,
  mergeDocuments,
  normaliseRotation,
  PdfDocument,
  validateWritten,
  type PageSelection,
  type MergeSource
} from './pdf';
import { producerString, readSourceBytes, renderAdapterOption, defaultAdapterOptions, runSingleFileAdapter, writeOutput } from './runtime';
import { el } from '../../core/a11y';
import type { AppContext, TabContext } from '../../core/registry';

function checksTable(ctx: AppContext, checks: ValidationCheck[]): HTMLElement {
  const wrap = el('div', { className: 'converter-pdf-checks' });
  const allOk = checks.every((check) => check.ok);
  wrap.append(
    el('p', {
      className: `converter-pdf-checks__summary md-typescale-label-large ${allOk ? 'is-ok' : 'is-failed'}`,
      text: allOk
        ? ctx.t('converter.pdftools.checksPassed', 'Every reopen check passed.')
        : ctx.t('converter.pdftools.checksFailed', 'The reopen check found a mismatch. Nothing was written.')
    })
  );
  if (checks.length > 0) {
    const list = el('ul', { className: 'converter-pdf-checks__list' });
    for (const check of checks) {
      list.append(
        el('li', {
          className: check.ok ? 'is-ok' : 'is-failed',
          text: `${check.name}: ${check.ok ? check.actual : `expected ${check.expected}, got ${check.actual}`}`
        })
      );
    }
    wrap.append(list);
  }
  return wrap;
}

function encryptedNotice(ctx: AppContext): HTMLElement {
  return el('p', { className: 'converter-pdf-encrypted md-typescale-body-medium', text: ctx.t('converter.pdftools.encrypted', 'This document is encrypted. Only the trailer could be read, so no page tool can run on it.') });
}

/* ------------------------------------------------------------------ */
/* Inspect / extract / reorder / rotate / metadata                     */
/* ------------------------------------------------------------------ */

function singleDocumentSection(host: HTMLElement, ctx: TabContext): void {
  let sourcePath: string | null = null;
  const optionValues: Record<string, Record<string, string>> = {};
  for (const id of ['documents.pdf.extract', 'documents.pdf.reorder', 'documents.pdf.rotate', 'documents.pdf.metadata']) {
    const adapter = adapterById(id);
    if (adapter) optionValues[id] = defaultAdapterOptions(adapter);
  }

  const section = el('section', { className: 'converter-pdf-section' });
  section.append(
    ctx.components.sectionHeading({ title: 'converter.pdftools.action.inspect', description: 'converter.pdftools.subtitle' })
  );

  const fileLabel = el('p', { className: 'converter-pdf-section__file md-typescale-body-medium', text: ctx.t('converter.pdftools.noFile', 'No PDF chosen yet.') });
  const chooseButton = ctx.components.button({
    label: 'converter.pdftools.chooseFile',
    variant: 'tonal',
    icon: 'file',
    onClick: async () => {
      const result = await ctx.studio.dialog.openFile({ filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!result.ok || !result.value || result.value.length === 0) return;
      sourcePath = result.value[0];
      fileLabel.textContent = sourcePath;
      resultsHost.textContent = '';
    }
  });
  section.append(el('div', { className: 'converter-pdf-section__chooser', children: [chooseButton, fileLabel] }));

  const resultsHost = el('div', { className: 'converter-pdf-section__results' });
  section.append(resultsHost);

  async function runAndOfferSave(adapterId: string, extraNotify?: string): Promise<void> {
    if (!sourcePath) return;
    const adapter = adapterById(adapterId);
    if (!adapter) return;
    resultsHost.textContent = '';
    const busy = el('p', { className: 'md-typescale-body-medium', text: ctx.t(adapter.detailKey, adapter.detailKey) });
    resultsHost.append(busy);
    try {
      const output = await runSingleFileAdapter(ctx, sourcePath, adapter, optionValues[adapterId] ?? {});
      resultsHost.textContent = '';

      if (adapter.targetFormat === 'pdfReport' || adapter.targetFormat === 'pdfPages') {
        const pre = el('pre', { className: 'converter-pdf-report', text: output.text.length > 20_000 ? `${output.text.slice(0, 20_000)}\n…` : output.text });
        resultsHost.append(pre);
        return;
      }

      resultsHost.append(checksTable(ctx, output.checks));
      const notesList = el('ul', { className: 'converter-pdf-notes' });
      for (const note of output.notes) notesList.append(el('li', { text: note }));
      resultsHost.append(notesList);

      const saveButton = ctx.components.button({
        label: 'converter.pdftools.saveAs',
        variant: 'filled',
        icon: 'save',
        onClick: async () => {
          const suggested = `${stemOf(sourcePath!)}.${output.extension}`;
          const target = await ctx.studio.dialog.saveFile({
            defaultPath: suggested,
            filters: [{ name: 'PDF', extensions: [output.extension] }]
          });
          if (!target.ok || !target.value) return;
          await writeOutput(ctx, target.value, output.text);
          await ctx.history.record(`Wrote a PDF from "${adapter.id}"`, 'converter', { adapterId: adapter.id, source: sourcePath, destination: target.value });
          ctx.notify.success('converter.notify.saved', ctx.t('converter.notify.saved', 'Saved to {path}.', { values: { path: target.value } }));
        }
      });
      resultsHost.append(saveButton);
    } catch (error) {
      resultsHost.textContent = '';
      if (isBoundary(error) && error.kind === 'encrypted') resultsHost.append(encryptedNotice(ctx));
      else resultsHost.append(el('p', { className: 'converter-pdf-error md-typescale-body-medium', text: safeFailureMessage(error) }));
    }
  }

  const actionsHost = el('div', { className: 'converter-pdf-section__actions' });

  actionsHost.append(
    ctx.components.button({
      label: 'converter.pdftools.action.inspect',
      variant: 'outlined',
      onClick: () => void runAndOfferSave('documents.pdf.inspect')
    })
  );

  const extractOptionsHost = el('div', { className: 'converter-pdf-section__options' });
  const extractAdapter = adapterById('documents.pdf.extract');
  if (extractAdapter) for (const option of extractAdapter.options ?? []) renderAdapterOption(extractOptionsHost, ctx, option, optionValues['documents.pdf.extract'], () => {});
  actionsHost.append(
    el('div', {
      className: 'converter-pdf-section__group',
      children: [
        extractOptionsHost,
        ctx.components.button({ label: 'converter.pdftools.action.extract', variant: 'outlined', onClick: () => void runAndOfferSave('documents.pdf.extract') })
      ]
    })
  );

  const reorderOptionsHost = el('div', { className: 'converter-pdf-section__options' });
  const reorderAdapter = adapterById('documents.pdf.reorder');
  if (reorderAdapter) for (const option of reorderAdapter.options ?? []) renderAdapterOption(reorderOptionsHost, ctx, option, optionValues['documents.pdf.reorder'], () => {});
  actionsHost.append(
    el('div', {
      className: 'converter-pdf-section__group',
      children: [
        reorderOptionsHost,
        ctx.components.button({ label: 'converter.pdftools.action.reorder', variant: 'outlined', onClick: () => void runAndOfferSave('documents.pdf.reorder') })
      ]
    })
  );

  const rotateOptionsHost = el('div', { className: 'converter-pdf-section__options' });
  const rotateAdapter = adapterById('documents.pdf.rotate');
  if (rotateAdapter) for (const option of rotateAdapter.options ?? []) renderAdapterOption(rotateOptionsHost, ctx, option, optionValues['documents.pdf.rotate'], () => {});
  actionsHost.append(
    el('div', {
      className: 'converter-pdf-section__group',
      children: [
        rotateOptionsHost,
        ctx.components.button({ label: 'converter.pdftools.action.rotate', variant: 'outlined', onClick: () => void runAndOfferSave('documents.pdf.rotate') })
      ]
    })
  );

  const metadataOptionsHost = el('div', { className: 'converter-pdf-section__options' });
  const metadataAdapter = adapterById('documents.pdf.metadata');
  if (metadataAdapter) for (const option of metadataAdapter.options ?? []) renderAdapterOption(metadataOptionsHost, ctx, option, optionValues['documents.pdf.metadata'], () => {});
  actionsHost.append(
    el('div', {
      className: 'converter-pdf-section__group',
      children: [
        metadataOptionsHost,
        ctx.components.button({ label: 'converter.pdftools.action.metadata', variant: 'outlined', onClick: () => void runAndOfferSave('documents.pdf.metadata') })
      ]
    })
  );

  section.append(actionsHost);
  host.append(section);
}

/* ------------------------------------------------------------------ */
/* Split                                                               */
/* ------------------------------------------------------------------ */

function splitSection(host: HTMLElement, ctx: TabContext): void {
  let sourcePath: string | null = null;
  let pagesPerFile = 1;

  const section = el('section', { className: 'converter-pdf-section' });
  section.append(ctx.components.sectionHeading({ title: 'converter.pdftools.action.split' }));

  const fileLabel = el('p', { className: 'converter-pdf-section__file md-typescale-body-medium', text: ctx.t('converter.pdftools.noFile', 'No PDF chosen yet.') });
  const chooseButton = ctx.components.button({
    label: 'converter.pdftools.chooseFile',
    variant: 'tonal',
    icon: 'file',
    onClick: async () => {
      const result = await ctx.studio.dialog.openFile({ filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!result.ok || !result.value || result.value.length === 0) return;
      sourcePath = result.value[0];
      fileLabel.textContent = sourcePath;
      resultsHost.textContent = '';
    }
  });
  section.append(el('div', { className: 'converter-pdf-section__chooser', children: [chooseButton, fileLabel] }));

  const pagesField = ctx.components.textField({
    label: 'converter.pdftools.split.pagesPerFile',
    type: 'number',
    value: '1',
    min: 1,
    supportingText: ctx.t('converter.pdftools.split.pagesPerFile.description', ''),
    onCommit: (value) => {
      const parsed = Number(value);
      pagesPerFile = Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : 1;
    }
  });
  section.append(pagesField.root);

  const resultsHost = el('div', { className: 'converter-pdf-section__results' });
  section.append(resultsHost);

  section.append(
    ctx.components.button({
      label: 'converter.pdftools.split.run',
      variant: 'filled',
      icon: 'save',
      onClick: async () => {
        if (!sourcePath) return;
        const destination = await ctx.studio.dialog.openFolder();
        if (!destination.ok || !destination.value || destination.value.length === 0) return;
        const destinationFolder = destination.value[0];

        resultsHost.textContent = '';
        try {
          const limits = readLimits(ctx.settings);
          const deadline = new Deadline(limits.cpuMs);
          const bytes = await readSourceBytes(ctx, sourcePath, limits);
          const doc = await PdfDocument.open(bytes, limits, deadline);
          const report = await doc.inspect();
          if (report.encrypted) {
            resultsHost.append(encryptedNotice(ctx));
            return;
          }

          const groups: PageSelection[][] = [];
          for (let start = 0; start < report.pageCount; start += pagesPerFile) {
            const group: PageSelection[] = [];
            for (let page = start + 1; page <= Math.min(start + pagesPerFile, report.pageCount); page += 1) {
              group.push({ page, rotation: report.pages[page - 1].rotation });
            }
            groups.push(group);
          }

          const stem = stemOf(sourcePath);
          const producer = producerString(ctx);
          const written: string[] = [];
          const allChecks: ValidationCheck[] = [];

          for (let index = 0; index < groups.length; index += 1) {
            deadline.check();
            const selection = groups[index];
            const built = await buildDocument(doc, { selection, info: {}, producer }, limits, deadline);
            const outBytes = utf8ToBytes(built.text);
            const outcome = await validateWritten(
              outBytes,
              {
                pageCount: selection.length,
                rotations: selection.map((entry) => normaliseRotation(entry.rotation)),
                sizes: selection.map((entry) => {
                  const source = report.pages[entry.page - 1];
                  const swap = normaliseRotation(entry.rotation) === 90 || normaliseRotation(entry.rotation) === 270;
                  const sourceSwapped = source.rotation === 90 || source.rotation === 270;
                  const width = sourceSwapped ? source.heightPt : source.widthPt;
                  const height = sourceSwapped ? source.widthPt : source.heightPt;
                  return swap ? `${Math.round(height)}x${Math.round(width)}` : `${Math.round(width)}x${Math.round(height)}`;
                }),
                info: {}
              },
              limits,
              deadline
            );
            allChecks.push(...outcome.checks);
            if (!outcome.ok) {
              throw new ConverterBoundary('validation', `Part ${index + 1} failed its reopen check — ${outcome.failure ?? 'a check failed'}. Nothing from this split was written.`);
            }
            const path = joinPath(destinationFolder, `${stem}-part${index + 1}.pdf`);
            await writeOutput(ctx, path, built.text);
            written.push(path);
          }

          resultsHost.append(checksTable(ctx, allChecks));
          await ctx.history.record('Split a PDF into several files', 'converter', { source: sourcePath, destinationFolder, files: written });
          ctx.notify.success('converter.notify.splitSaved', ctx.t('converter.notify.splitSaved', 'Split into {count} file(s) in {path}.', { values: { count: written.length, path: destinationFolder } }));
        } catch (error) {
          resultsHost.append(el('p', { className: 'converter-pdf-error md-typescale-body-medium', text: safeFailureMessage(error) }));
        }
      }
    })
  );

  host.append(section);
}

/* ------------------------------------------------------------------ */
/* Merge                                                               */
/* ------------------------------------------------------------------ */

function mergeSection(host: HTMLElement, ctx: TabContext): void {
  let order: string[] = [];

  const section = el('section', { className: 'converter-pdf-section' });
  section.append(ctx.components.sectionHeading({ title: 'converter.pdftools.action.merge' }));

  const listHost = el('ul', { className: 'converter-pdf-merge-list' });
  section.append(listHost);

  function drawList(): void {
    listHost.textContent = '';
    order.forEach((path, index) => {
      const name = path.replace(/\\/g, '/').split('/').pop() ?? path;
      const up = ctx.components.iconButton({
        icon: 'chevronUp',
        label: ctx.t('converter.pdftools.merge.moveUp', 'Move up'),
        disabled: index === 0,
        disabledReason: ctx.t('converter.pdftools.merge.disabledReason.first', 'This file is already first.'),
        onClick: () => {
          [order[index - 1], order[index]] = [order[index], order[index - 1]];
          drawList();
        }
      });
      const down = ctx.components.iconButton({
        icon: 'chevronDown',
        label: ctx.t('converter.pdftools.merge.moveDown', 'Move down'),
        disabled: index === order.length - 1,
        disabledReason: ctx.t('converter.pdftools.merge.disabledReason.last', 'This file is already last.'),
        onClick: () => {
          [order[index + 1], order[index]] = [order[index], order[index + 1]];
          drawList();
        }
      });
      const remove = ctx.components.iconButton({
        icon: 'close',
        label: ctx.t('converter.convert.remove', 'Remove'),
        onClick: () => {
          order = order.filter((p) => p !== path);
          drawList();
        }
      });
      listHost.append(el('li', { className: 'converter-pdf-merge-list__row', children: [el('span', { text: `${index + 1}. ${name}` }), up, down, remove] }));
    });
  }

  section.append(
    ctx.components.button({
      label: 'converter.pdftools.chooseFiles',
      variant: 'tonal',
      icon: 'file',
      onClick: async () => {
        const result = await ctx.studio.dialog.openFile({ multiSelections: true, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
        if (!result.ok || !result.value || result.value.length === 0) return;
        order = [...order, ...result.value.filter((path) => !order.includes(path))];
        drawList();
      }
    })
  );

  const resultsHost = el('div', { className: 'converter-pdf-section__results' });
  section.append(resultsHost);

  section.append(
    ctx.components.button({
      label: 'converter.pdftools.merge.run',
      variant: 'filled',
      icon: 'save',
      onClick: async () => {
        if (order.length === 0) return;
        const target = await ctx.studio.dialog.saveFile({ defaultPath: 'merged.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
        if (!target.ok || !target.value) return;

        resultsHost.textContent = '';
        try {
          const limits = readLimits(ctx.settings);
          const deadline = new Deadline(limits.cpuMs);
          const sources: MergeSource[] = [];
          const expectedRotations: number[] = [];
          const expectedSizes: string[] = [];

          for (const path of order) {
            deadline.check();
            const bytes = await readSourceBytes(ctx, path, limits);
            const doc = await PdfDocument.open(bytes, limits, deadline);
            const report = await doc.inspect();
            if (report.encrypted) {
              throw new ConverterBoundary('encrypted', `"${path}" is encrypted and cannot take part in a merge.`);
            }
            const selection: PageSelection[] = report.pages.map((page) => ({ page: page.index, rotation: page.rotation }));
            sources.push({ doc, selection, label: path.replace(/\\/g, '/').split('/').pop() ?? path });
            for (const page of report.pages) {
              expectedRotations.push(normaliseRotation(page.rotation));
              expectedSizes.push(`${Math.round(page.widthPt)}x${Math.round(page.heightPt)}`);
            }
          }

          const built = await mergeDocuments(sources, {}, producerString(ctx), limits, deadline);
          const outBytes = utf8ToBytes(built.text);
          const outcome = await validateWritten(
            outBytes,
            {
              pageCount: built.pageCount,
              rotations: expectedRotations,
              sizes: expectedSizes,
              info: {}
            },
            limits,
            deadline
          );
          resultsHost.append(checksTable(ctx, outcome.checks));
          if (!outcome.ok) {
            throw new ConverterBoundary('validation', `The merged document did not reopen as expected — ${outcome.failure ?? 'a check failed'}. Nothing was written.`);
          }

          await writeOutput(ctx, target.value, built.text);
          await ctx.history.record('Merged several PDFs into one file', 'converter', { sources: order, destination: target.value, pageCount: built.pageCount });
          ctx.notify.success('converter.notify.mergeSaved', ctx.t('converter.notify.mergeSaved', 'Merged {count} document(s) into {path}.', { values: { count: order.length, path: target.value } }));
        } catch (error) {
          resultsHost.append(el('p', { className: 'converter-pdf-error md-typescale-body-medium', text: safeFailureMessage(error) }));
        }
      }
    })
  );

  drawList();
  host.append(section);
}

export function mountPdfToolsTab(host: HTMLElement, ctx: TabContext): void {
  host.append(ctx.components.topAppBar({ title: 'converter.tab.pdftools', subtitle: 'converter.pdftools.subtitle' }));
  singleDocumentSection(host, ctx);
  splitSection(host, ctx);
  mergeSection(host, ctx);
}
