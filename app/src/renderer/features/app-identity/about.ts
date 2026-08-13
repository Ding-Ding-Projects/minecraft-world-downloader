import { a11y, el } from '../../core/a11y';
import { components } from '../../core/components';
import { DISHES } from '../../core/dimsum';
import { createBulkTable } from './bulk';
import { CREDITS, GROUP_KEYS, ROLE_KEYS, type Credit } from './credits';
import {
  CODE_NAME_SETTING,
  DIM_SUM_CATALOGUE_URL,
  DISPLAY_NAME_SETTING,
  LICENCE_ID,
  LICENCE_URL,
  MAX_DISPLAY_NAME_LENGTH,
  chosenName,
  checkSummary,
  diagnosticReport,
  displayName,
  hasChosenName,
  identityChecks,
  identityFacts,
  shippedName,
  validateDisplayName,
  type IdentityCheck,
  type IdentityFact
} from './identity';
import type { TabContext } from '../../core/registry';

/**
 * The About surface.
 *
 * It answers four questions, in the order somebody actually asks them: what do
 * I want this thing to call itself, what does that change, what exactly am I
 * running, and whose work is this built on.
 *
 * The rename editor and the identity checks sit next to each other deliberately.
 * A rename is safe precisely because display and identity are separate values,
 * and the only convincing way to say so is to read the real paths and the real
 * settings store in front of the person doing the renaming.
 */

/** Section ids, so the palette can teleport to the exact element. */
export const SECTION_IDS = {
  name: 'app-identity-name',
  preview: 'app-identity-preview',
  checks: 'app-identity-checks',
  facts: 'app-identity-facts',
  codeName: 'app-identity-codename',
  licence: 'app-identity-licence',
  credits: 'app-identity-credits',
  diagnostics: 'app-identity-diagnostics'
} as const;

interface CardParts {
  section: HTMLElement;
  body: HTMLElement;
}

function card(ctx: TabContext, id: string, titleKey: string, descriptionKey?: string): CardParts {
  const section = el('section', {
    className: 'app-identity-card',
    attrs: { id, 'data-appearance-id': `app-identity:card:${id}`, 'aria-labelledby': `${id}-heading` }
  });

  const header = el('div', { className: 'app-identity-card__header' });
  const pair = ctx.i18n.pair(titleKey, titleKey);
  const heading = el('h2', { className: 'md-typescale-title-large', attrs: { id: `${id}-heading` }, text: pair.primary });
  header.append(heading);
  if (pair.secondary) {
    header.append(el('p', { className: 'app-identity-card__secondary md-typescale-title-small', text: pair.secondary }));
  }
  section.append(header);

  if (descriptionKey) {
    const explain = el('button', {
      className: 'md-setting__explain',
      text: '?',
      attrs: {
        type: 'button',
        'aria-label': ctx.t('core.settings.explain', 'What this does'),
        'aria-expanded': 'false',
        'aria-controls': `${id}-description`
      }
    });
    const description = el('p', {
      className: 'md-setting__description md-typescale-body-medium',
      attrs: { id: `${id}-description` },
      text: ctx.t(descriptionKey, descriptionKey)
    });
    description.hidden = true;
    explain.addEventListener('click', () => {
      description.hidden = !description.hidden;
      explain.setAttribute('aria-expanded', String(!description.hidden));
    });
    header.append(explain);
    section.append(description);
  }

  const body = el('div', { className: 'app-identity-card__body' });
  section.append(body);
  return { section, body };
}

function previewRow(labelText: string, valueText: string): HTMLElement {
  const row = el('div', { className: 'app-identity-preview__row' });
  row.append(el('span', { className: 'app-identity-preview__label md-typescale-label-medium', text: labelText }));
  row.append(el('span', { className: 'app-identity-preview__value md-typescale-body-medium', text: valueText }));
  return row;
}

export function mountAbout(host: HTMLElement, ctx: TabContext): void {
  const info = ctx.studio.info;
  const panel = el('div', { className: 'md-panel app-identity-panel' });

  /* ---------------- header ---------------- */

  const openDataFolder = components.button({
    label: 'app-identity.dataFolder.open',
    variant: 'tonal',
    icon: 'folder',
    onClick: async () => {
      const result = await ctx.studio.app.revealUserData();
      if (!result.ok) {
        ctx.notify.error(
          ctx.t('app-identity.dataFolder.failed', 'The file manager did not open: {reason}', {
            values: { reason: result.error }
          })
        );
      }
    }
  });

  panel.append(
    components.topAppBar({
      title: 'app-identity.tab',
      subtitle: ctx.t('app-identity.subtitle', 'Version {version} · {licence}', {
        values: { version: info.version, licence: LICENCE_ID }
      }),
      actions: [openDataFolder]
    })
  );

  /* ---------------- 1. the name ---------------- */

  const nameCard = card(ctx, SECTION_IDS.name, 'app-identity.name.heading', 'app-identity.name.explain');

  const error = el('p', {
    className: 'app-identity-error md-typescale-body-small',
    attrs: { role: 'alert' }
  });
  error.hidden = true;

  const provenanceLine = el('p', { className: 'md-setting__provenance md-typescale-body-small' });

  const field = components.textField({
    id: 'app-identity-name-field',
    label: 'app-identity.name.label',
    value: chosenName(ctx),
    placeholder: shippedName(ctx),
    supportingText: ctx.t(
      'app-identity.name.hint',
      'Leave it empty to use the shipped name, {shipped}. At most {max} characters.',
      { values: { shipped: shippedName(ctx), max: MAX_DISPLAY_NAME_LENGTH } }
    ),
    onChange: () => {
      error.hidden = true;
      refreshPreview(field.get());
    },
    onCommit: (value) => void apply(value)
  });
  field.root.dataset.appearanceId = 'app-identity:name-field';

  const applyButton = components.button({
    label: 'app-identity.name.apply',
    variant: 'filled',
    icon: 'check',
    onClick: () => void apply(field.get())
  });

  const resetButton = components.button({
    label: 'app-identity.name.reset',
    variant: 'text',
    icon: 'refresh',
    onClick: () => void resetName()
  });

  const nameActions = el('div', { className: 'app-identity-actions' });
  nameActions.append(applyButton, resetButton);

  const diagnosticsNote = el('p', {
    className: 'app-identity-note md-typescale-body-small',
    text: ctx.t(
      'app-identity.name.diagnosticsNote',
      'Diagnostic reports, crash logs and anything you file as an issue use the shipped name {shipped}, not the name you choose here, so a reader can tell what software they are looking at.',
      { values: { shipped: shippedName(ctx) } }
    )
  });

  nameCard.body.append(field.root, error, nameActions, provenanceLine, diagnosticsNote);

  async function apply(raw: string): Promise<void> {
    const refusal = validateDisplayName(raw);
    if (refusal) {
      const message = ctx.t(refusal, refusal, { values: { max: MAX_DISPLAY_NAME_LENGTH } });
      error.textContent = message;
      error.hidden = false;
      a11y.announce(message, true);
      field.focus();
      return;
    }
    error.hidden = true;
    const trimmed = raw.trim();
    const previous = chosenName(ctx);
    if (trimmed === previous) {
      refreshAll();
      return;
    }
    if (trimmed === '') {
      await resetName();
      return;
    }
    ctx.settings.set(DISPLAY_NAME_SETTING, trimmed);
    await ctx.history.record('Renamed the application display name', 'app-identity', {
      from: previous === '' ? null : previous,
      to: trimmed,
      shippedName: shippedName(ctx),
      packageIdentity: info.packageName,
      note: 'Display only. The package identity, data directory, installer identity and update feed are unchanged.'
    });
    ctx.notify.success(
      ctx.t('app-identity.name.saved', 'The display name is now {name}', { values: { name: trimmed } }),
      ctx.t(
        'app-identity.name.savedBody',
        'The title bar, notifications and this surface follow it. The data directory, the package identity, the installer and the update feed did not move.'
      )
    );
    refreshAll();
  }

  async function resetName(): Promise<void> {
    const previous = chosenName(ctx);
    if (previous === '') {
      ctx.notify.info(
        ctx.t('app-identity.name.alreadyShipped', 'It is already using the shipped name {name}. Nothing was changed.', {
          values: { name: shippedName(ctx) }
        })
      );
      refreshAll();
      return;
    }
    ctx.settings.reset(DISPLAY_NAME_SETTING);
    await ctx.history.record('Restored the shipped application name', 'app-identity', {
      from: previous,
      to: null,
      shippedName: shippedName(ctx)
    });
    ctx.notify.success(
      ctx.t('app-identity.name.resetDone', 'The shipped name is back: {name}', { values: { name: shippedName(ctx) } }),
      ctx.t(
        'app-identity.name.resetBody',
        'Your previous name was "{previous}". The change is in the local version history, so you can read it back or type that name again.',
        { values: { previous } }
      )
    );
    refreshAll();
  }

  function refreshProvenance(): void {
    const source = ctx.settings.provenanceOf(DISPLAY_NAME_SETTING);
    if (source === 'default') {
      provenanceLine.textContent = ctx.t(
        'app-identity.name.provenance.default',
        'No file has ever set this. The application is using its shipped name: {value}.',
        { values: { value: shippedName(ctx) } }
      );
      return;
    }
    if (source === 'user') {
      provenanceLine.textContent = ctx.t('app-identity.name.provenance.user', 'Set by you, and stored in {path}.', {
        values: { path: ctx.settings.filePath() || ctx.t('app-identity.value.unknown', 'Not reported yet') }
      });
      return;
    }
    provenanceLine.textContent = ctx.t(
      'app-identity.name.provenance.other',
      'Set by {source}, and stored in {path}.',
      { values: { source, path: ctx.settings.filePath() || '—' } }
    );
  }

  /* ---------------- 2. the preview ---------------- */

  const previewCard = card(ctx, SECTION_IDS.preview, 'app-identity.preview.heading');
  previewCard.body.append(
    el('p', {
      className: 'app-identity-note md-typescale-body-small',
      text: ctx.t(
        'app-identity.preview.static',
        'These three lines are a static preview. They show the text, not working controls.'
      )
    })
  );
  const previewBox = el('div', { className: 'app-identity-preview', attrs: { role: 'group' } });
  previewCard.body.append(previewBox);

  function refreshPreview(candidateRaw?: string): void {
    const candidate = (candidateRaw ?? chosenName(ctx)).trim();
    const shown = validateDisplayName(candidate) ? displayName(ctx) : candidate || shippedName(ctx);
    previewBox.textContent = '';
    previewBox.append(
      previewRow(ctx.t('app-identity.preview.titleBar', 'Title bar'), shown),
      previewRow(
        ctx.t('app-identity.preview.notification', 'A notification'),
        ctx.t('app-identity.preview.notificationBody', '{name} finished writing the world.', { values: { name: shown } })
      ),
      previewRow(
        ctx.t('app-identity.preview.about', 'This surface'),
        ctx.t('app-identity.preview.aboutBody', '{name}, version {version}', {
          values: { name: shown, version: info.version }
        })
      ),
      previewRow(ctx.t('app-identity.preview.diagnostic', 'A diagnostic report'), shippedName(ctx))
    );
  }

  /* ---------------- 3. the checks ---------------- */

  const checksCard = card(ctx, SECTION_IDS.checks, 'app-identity.checks.heading', 'app-identity.checks.explain');
  const checksSummary = el('p', {
    className: 'app-identity-summary md-typescale-body-medium',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const checksList = el('ul', { className: 'app-identity-checks', attrs: { role: 'list' } });
  const rerun = components.button({
    label: 'app-identity.checks.rerun',
    variant: 'tonal',
    icon: 'refresh',
    onClick: () => {
      refreshChecks();
      a11y.announce(checksSummary.textContent ?? '');
    }
  });
  checksCard.body.append(checksSummary, checksList, rerun);

  function stateLabel(state: IdentityCheck['state']): string {
    if (state === 'pass') return ctx.t('app-identity.checks.state.pass', 'Passed');
    if (state === 'fail') return ctx.t('app-identity.checks.state.fail', 'Failed');
    return ctx.t('app-identity.checks.state.unknown', 'Inconclusive');
  }

  function refreshChecks(): void {
    const checks = identityChecks(ctx);
    const summary = checkSummary(checks);
    checksSummary.textContent = ctx.t('app-identity.checks.summary', '{passed} of {total} passed, {failed} failed.', {
      values: { passed: summary.passed, total: summary.total, failed: summary.failed }
    });
    checksList.textContent = '';
    for (const check of checks) {
      const item = el('li', {
        className: `app-identity-check app-identity-check--${check.state}`,
        attrs: { 'data-appearance-id': `app-identity:check:${check.id}` }
      });
      const badge = components.badge({
        label: stateLabel(check.state),
        severity: check.state === 'pass' ? 'success' : check.state === 'fail' ? 'error' : 'warning'
      });
      // The state is in words as well as in colour: a badge alone would leave a
      // verdict readable only to somebody who can see the palette.
      const text = el('div', { className: 'app-identity-check__text' });
      text.append(
        el('p', { className: 'md-typescale-title-small', text: ctx.t(check.titleKey, check.titleKey) }),
        el('p', { className: 'app-identity-check__evidence md-typescale-body-small', text: check.evidence })
      );
      item.append(badge, text);
      checksList.append(item);
    }
  }

  /* ---------------- 4. the facts ---------------- */

  const factsCard = card(ctx, SECTION_IDS.facts, 'app-identity.facts.heading', 'app-identity.facts.explain');

  const factsTable = createBulkTable<IdentityFact>({
    ctx,
    labelKey: 'app-identity.facts.heading',
    searchLabelKey: 'app-identity.facts.search',
    rows: identityFacts(ctx),
    rowId: (fact) => fact.id,
    rowName: (fact) => `${ctx.t(fact.labelKey, fact.labelKey)}: ${fact.value}`,
    exportName: 'application-identity',
    onDispose: (fn) => ctx.onDispose(fn),
    columns: [
      {
        id: 'label',
        labelKey: 'app-identity.facts.column.label',
        value: (fact) => ctx.t(fact.labelKey, fact.labelKey)
      },
      { id: 'value', labelKey: 'app-identity.facts.column.value', value: (fact) => fact.value, mono: true },
      {
        id: 'kind',
        labelKey: 'app-identity.facts.column.kind',
        value: (fact) => ctx.t(`app-identity.kind.${fact.kind}`, fact.kind)
      }
    ],
    rowAction: (fact) =>
      components.iconButton({
        icon: 'copy',
        label: ctx.t('app-identity.facts.copyRow', 'Copy the value of {label}', {
          values: { label: ctx.t(fact.labelKey, fact.labelKey) }
        }),
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(fact.value);
            ctx.notify.success(
              ctx.t('app-identity.bulk.copied', '{count} rows are on the clipboard', { values: { count: 1 } })
            );
          } catch (clipboardError) {
            ctx.notify.error(
              ctx.t('app-identity.bulk.copyFailed', 'The clipboard refused the text: {reason}', {
                values: {
                  reason: clipboardError instanceof Error ? clipboardError.message : String(clipboardError)
                }
              })
            );
          }
        }
      })
  });
  factsCard.body.append(factsTable.root);

  /* ---------------- 5. the release code name ---------------- */

  let refreshCodeName: () => void = () => undefined;

  if (!ctx.i18n.schoolModeActive()) {
    const codeCard = card(ctx, SECTION_IDS.codeName, 'app-identity.codename.heading', 'app-identity.codename.explain');
    const current = el('p', { className: 'md-typescale-body-large', attrs: { role: 'status' } });

    const dishOptions = DISHES.map((dish) => ({
      value: dish.id,
      label: `${dish.nameEn} · ${dish.nameZhHant}`
    }));

    const recorded = (): string => String(ctx.settings.get<string>(CODE_NAME_SETTING, '') ?? '');
    const dishLabel = (id: string): string => {
      const dish = DISHES.find((candidate) => candidate.id === id);
      return dish ? `${dish.nameEn} · ${dish.nameZhHant}` : id;
    };

    const initial = DISHES.find((dish) => dishLabel(dish.id) === recorded())?.id ?? DISHES[0].id;
    let chosenDish = initial;

    const picker = components.select({
      id: 'app-identity-codename-picker',
      label: 'app-identity.codename.picker',
      value: initial,
      options: dishOptions,
      onChange: (value) => {
        chosenDish = value;
      }
    });

    const record = components.button({
      label: 'app-identity.codename.record',
      variant: 'filled',
      icon: 'save',
      onClick: async () => {
        const name = dishLabel(chosenDish);
        ctx.settings.set(CODE_NAME_SETTING, name);
        await ctx.history.record('Recorded the release code name', 'app-identity', {
          codeName: name,
          version: info.version
        });
        ctx.notify.success(
          ctx.t('app-identity.codename.recorded', '{name} recorded as this build’s code name', { values: { name } })
        );
        refreshCodeName();
      }
    });

    const clearCodeName = components.button({
      label: 'app-identity.codename.clear',
      variant: 'text',
      icon: 'close',
      onClick: async () => {
        if (recorded() === '') return;
        ctx.settings.reset(CODE_NAME_SETTING);
        await ctx.history.record('Cleared the recorded release code name', 'app-identity', { version: info.version });
        ctx.notify.info(
          ctx.t('app-identity.codename.cleared', 'The recorded code name was cleared. The version number is unchanged.')
        );
        refreshCodeName();
      }
    });

    const catalogue = components.button({
      label: 'app-identity.codename.catalogue',
      variant: 'text',
      icon: 'world',
      onClick: async () => {
        const opened = await ctx.studio.shell.openExternal(DIM_SUM_CATALOGUE_URL);
        if (!opened.ok) {
          ctx.notify.error(
            ctx.t('app-identity.credits.openFailed', 'That link did not open: {reason}', {
              values: { reason: opened.error }
            })
          );
        }
      }
    });

    const codeActions = el('div', { className: 'app-identity-actions' });
    codeActions.append(record, clearCodeName, catalogue);

    codeCard.body.append(
      current,
      picker.root,
      codeActions,
      el('p', {
        className: 'app-identity-note md-typescale-body-small',
        text: ctx.t(
          'app-identity.codename.notBundled',
          'No photograph is bundled in this build. The catalogue link opens in your browser.'
        )
      })
    );

    refreshCodeName = (): void => {
      const name = recorded();
      current.textContent =
        name === ''
          ? ctx.t(
              'app-identity.codename.none',
              'This build has no code name recorded. The release notes are where the authoritative one lives; you can record it here so this window agrees with them.'
            )
          : ctx.t('app-identity.codename.current', 'Recorded for this build: {name}', { values: { name } });
      const missing = name === '';
      clearCodeName.disabled = missing;
      if (missing) {
        const reason = ctx.t(
          'app-identity.codename.none',
          'This build has no code name recorded. The release notes are where the authoritative one lives; you can record it here so this window agrees with them.'
        );
        clearCodeName.title = reason;
        clearCodeName.setAttribute('aria-description', reason);
      } else {
        clearCodeName.removeAttribute('title');
        clearCodeName.removeAttribute('aria-description');
      }
    };

    panel.append(nameCard.section, previewCard.section, checksCard.section, factsCard.section, codeCard.section);
  } else {
    panel.append(nameCard.section, previewCard.section, checksCard.section, factsCard.section);
  }

  /* ---------------- 6. licence and money ---------------- */

  const licenceCard = card(ctx, SECTION_IDS.licence, 'app-identity.licence.heading');
  licenceCard.body.append(
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'app-identity.licence.body',
        'This application is distributed under {licence}. You may use it, read its source, change it and pass it on under the same terms.',
        { values: { licence: LICENCE_ID } }
      )
    }),
    components.button({
      label: 'app-identity.licence.open',
      variant: 'tonal',
      icon: 'book',
      onClick: async () => {
        const opened = await ctx.studio.shell.openExternal(LICENCE_URL);
        if (!opened.ok) {
          ctx.notify.error(
            ctx.t('app-identity.credits.openFailed', 'That link did not open: {reason}', {
              values: { reason: opened.error }
            })
          );
        }
      }
    }),
    el('h3', { className: 'md-typescale-title-small', text: ctx.t('app-identity.money.heading', 'What this costs') }),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'app-identity.money.body',
        'Nothing, ever. There is no purchase, no licence fee, no subscription, no trial that lapses and no capability held back for anyone. Nothing on this surface asks you for money, and nothing here routes a payment through this project.'
      )
    }),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'app-identity.money.upstream',
        'This application is built on other people’s work. If you want to fund any of it, fund them: each entry below links to that project’s own page, anything they accept goes to them, and no link here passes through this project.'
      )
    }),
    el('p', {
      className: 'app-identity-note md-typescale-body-small',
      text: ctx.t(
        'app-identity.money.noKnownFunding',
        'Whether a project accepts money at all is stated on its own page, not guessed at here.'
      )
    })
  );

  /* ---------------- 7. credits ---------------- */

  const creditsCard = card(ctx, SECTION_IDS.credits, 'app-identity.credits.heading', 'app-identity.credits.explain');
  const creditsTable = createBulkTable<Credit>({
    ctx,
    labelKey: 'app-identity.credits.heading',
    searchLabelKey: 'app-identity.credits.search',
    rows: CREDITS,
    rowId: (credit) => credit.id,
    rowName: (credit) => credit.name,
    exportName: 'credits',
    onDispose: (fn) => ctx.onDispose(fn),
    columns: [
      { id: 'name', labelKey: 'app-identity.credits.column.name', value: (credit) => credit.name },
      {
        id: 'role',
        labelKey: 'app-identity.credits.column.role',
        value: (credit) => ctx.t(ROLE_KEYS[credit.role], ROLE_KEYS[credit.role])
      },
      {
        id: 'group',
        labelKey: 'app-identity.credits.column.group',
        value: (credit) => ctx.t(GROUP_KEYS[credit.group], GROUP_KEYS[credit.group])
      },
      { id: 'url', labelKey: 'app-identity.credits.column.url', value: (credit) => credit.url, mono: true }
    ],
    rowAction: (credit) =>
      components.iconButton({
        icon: 'world',
        label: ctx.t('app-identity.credits.open', 'Open the page for {name}', { values: { name: credit.name } }),
        onClick: async () => {
          const opened = await ctx.studio.shell.openExternal(credit.url);
          if (!opened.ok) {
            ctx.notify.error(
              ctx.t('app-identity.credits.openFailed', 'That link did not open: {reason}', {
                values: { reason: opened.error }
              })
            );
          }
        }
      })
  });
  creditsCard.body.append(creditsTable.root);

  /* ---------------- 8. diagnostics ---------------- */

  const diagnosticsCard = card(
    ctx,
    SECTION_IDS.diagnostics,
    'app-identity.diagnostics.heading',
    'app-identity.diagnostics.explain'
  );

  const reportBox = el('pre', {
    className: 'app-identity-report',
    attrs: { tabindex: '0', role: 'region', 'aria-label': ctx.t('app-identity.diagnostics.heading', 'Diagnostic report') }
  });

  let savedReportPath: string | null = null;

  const copyReport = components.button({
    label: 'app-identity.diagnostics.copy',
    variant: 'tonal',
    icon: 'copy',
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(reportBox.textContent ?? '');
        ctx.notify.success(ctx.t('app-identity.diagnostics.copied', 'The report is on the clipboard'));
      } catch (clipboardError) {
        ctx.notify.error(
          ctx.t('app-identity.bulk.copyFailed', 'The clipboard refused the text: {reason}', {
            values: { reason: clipboardError instanceof Error ? clipboardError.message : String(clipboardError) }
          })
        );
      }
    }
  });

  const saveReport = components.button({
    label: 'app-identity.diagnostics.save',
    variant: 'text',
    icon: 'save',
    onClick: async () => {
      const chosen = await ctx.studio.dialog.saveFile({
        defaultPath: `${info.packageName}-diagnostics.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      });
      if (!chosen.ok) {
        ctx.notify.error(
          ctx.t('app-identity.diagnostics.saveFailed', 'The report was not written: {reason}', {
            values: { reason: chosen.error }
          })
        );
        return;
      }
      if (!chosen.value) {
        ctx.notify.info(ctx.t('app-identity.export.cancelled', 'No file was chosen, so nothing was written.'));
        return;
      }
      const written = await ctx.studio.fs.writeText(chosen.value, reportBox.textContent ?? '');
      if (!written.ok) {
        ctx.notify.error(
          ctx.t('app-identity.diagnostics.saveFailed', 'The report was not written: {reason}', {
            values: { reason: written.error }
          })
        );
        return;
      }
      savedReportPath = chosen.value;
      openInEditor.disabled = false;
      openInEditor.removeAttribute('title');
      openInEditor.removeAttribute('aria-description');
      ctx.notify.success(
        ctx.t('app-identity.diagnostics.saved', 'Report written to {path}', { values: { path: chosen.value } })
      );
    }
  });

  const openInEditor = components.button({
    label: 'app-identity.diagnostics.openEditor',
    variant: 'text',
    icon: 'edit',
    disabled: true,
    disabledReason: 'app-identity.diagnostics.needSave',
    onClick: async () => {
      if (!savedReportPath) return;
      const editors = await ctx.studio.editor.detect();
      if (!editors.ok || editors.value.every((candidate) => !candidate.available)) {
        ctx.notify.warn(
          ctx.t(
            'app-identity.diagnostics.editorMissing',
            'No editor was found on this machine, so the report was left where it was saved.'
          ),
          savedReportPath
        );
        return;
      }
      const opened = await ctx.studio.editor.open(savedReportPath);
      if (!opened.ok) {
        ctx.notify.error(
          ctx.t('app-identity.diagnostics.saveFailed', 'The report was not written: {reason}', {
            values: { reason: opened.error }
          })
        );
      }
    }
  });

  const diagnosticsActions = el('div', { className: 'app-identity-actions' });
  diagnosticsActions.append(copyReport, saveReport, openInEditor);
  diagnosticsCard.body.append(reportBox, diagnosticsActions);

  panel.append(licenceCard.section, creditsCard.section, diagnosticsCard.section);

  /* ---------------- refresh plumbing ---------------- */

  function refreshAll(): void {
    field.set(chosenName(ctx));
    refreshProvenance();
    refreshPreview();
    refreshChecks();
    factsTable.setRows(identityFacts(ctx));
    refreshCodeName();
    reportBox.textContent = diagnosticReport(ctx);
  }

  const unsubscribe = ctx.settings.onChange((change) => {
    if (
      change.id === DISPLAY_NAME_SETTING ||
      change.id === CODE_NAME_SETTING ||
      change.id.startsWith('app-identity.diagnostics.')
    ) {
      refreshAll();
    }
  });
  ctx.onDispose(unsubscribe);

  refreshAll();
  host.append(panel);

  // A person arriving here from the palette's rename command should land on the
  // field ready to type, without the tab stealing focus in any other case.
  if (!hasChosenName(ctx)) field.root.dataset.identityState = 'shipped';
  else field.root.dataset.identityState = 'renamed';
}
