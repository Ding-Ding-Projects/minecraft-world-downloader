import type { AppContext } from '../../core/registry';

/**
 * A settings row that lives inside this destination rather than in the
 * application's settings surface.
 *
 * It is deliberately self-contained. The obligations it has to meet are the same
 * as any other settings row — the real live control, its explanation behind
 * progressive disclosure, a truthful default-provenance line that names the
 * actual value rather than the word "default", and a per-key reset — and it
 * meets them here, in this feature's own directory, so this feature can be added
 * and removed without touching a shared file.
 *
 * These options are not registered in the application-wide settings registry on
 * purpose. The whole personal-vocabulary capability has to disappear while the
 * named study mode is on, and a registered section stays on the settings surface
 * whether this feature wants it to or not. The upload control that belongs on
 * the settings surface already lives in the language section, which that surface
 * omits correctly.
 */

export interface LocalSetting<T> {
  /** Stable and dotted, and unique across the whole application. */
  id: string;
  /** i18n key for the visible label and the control's accessible name. */
  label: string;
  /** i18n key for the explanation. It says what the option does. */
  description: string;
  defaultValue: T;
  /** Reads the stored value, coercing anything unexpected to the default. */
  read(ctx: AppContext): T;
  /** Builds the real control. `commit` is the only write path. */
  control(ctx: AppContext, current: T, commit: (value: T) => void): HTMLElement;
  /** How the shipped default reads in the provenance line. */
  describeDefault(value: T): string;
}

export function renderLocalSettingRow<T>(
  ctx: AppContext,
  setting: LocalSetting<T>,
  onChange?: (value: T) => void
): HTMLElement {
  ctx.settings.declareDefault(setting.id, setting.defaultValue);

  const row = document.createElement('div');
  row.className = 'md-setting';
  row.id = `setting-${setting.id}`;
  row.dataset.appearanceId = `setting-row:${setting.id}`;

  const head = document.createElement('div');
  head.className = 'md-setting__head';

  const pair = ctx.i18n.pair(setting.label, setting.label);
  const title = document.createElement('div');
  title.className = 'md-setting__title';
  const primary = document.createElement('span');
  primary.className = 'md-typescale-title-small';
  primary.textContent = pair.primary;
  title.append(primary);
  if (pair.secondary) {
    const secondary = document.createElement('span');
    secondary.className = 'md-setting__secondary';
    secondary.textContent = pair.secondary;
    title.append(secondary);
  }

  const descriptionId = `setting-description-${setting.id}`;
  const explain = document.createElement('button');
  explain.type = 'button';
  explain.className = 'md-setting__explain';
  explain.textContent = '?';
  explain.setAttribute('aria-label', ctx.t('core.settings.explain', 'What this does'));
  explain.setAttribute('aria-expanded', 'false');
  explain.setAttribute('aria-controls', descriptionId);

  head.append(title, explain);

  const description = document.createElement('p');
  description.className = 'md-setting__description md-typescale-body-small';
  description.id = descriptionId;
  description.textContent = ctx.t(setting.description, setting.description);
  description.hidden = true;
  explain.addEventListener('click', () => {
    description.hidden = !description.hidden;
    explain.setAttribute('aria-expanded', String(!description.hidden));
  });

  const provenance = document.createElement('p');
  provenance.className = 'md-setting__provenance';
  const refreshProvenance = (): void => {
    const source = ctx.settings.provenanceOf(setting.id);
    provenance.textContent =
      source === 'default'
        ? ctx.t(
            'core.settings.provenance.default',
            'No file has ever set this. The application is using its own value: {value}.',
            { values: { value: setting.describeDefault(setting.defaultValue) } }
          )
        : source === 'user'
          ? ctx.t('core.settings.provenance.user', 'Set by you, and stored in {path}.', {
              values: { path: ctx.settings.filePath() || 'the settings file' }
            })
          : ctx.t(`core.settings.provenance.${source}`, source);
  };

  const body = document.createElement('div');
  body.className = 'md-setting__body';

  const commit = (value: T): void => {
    ctx.settings.set(setting.id, value);
    refreshProvenance();
    onChange?.(value);
  };

  const draw = (): void => {
    body.textContent = '';
    body.append(setting.control(ctx, setting.read(ctx), commit));
    refreshProvenance();
  };
  draw();

  const reset = ctx.components.button({
    label: 'core.settings.resetOne',
    variant: 'text',
    onClick: () => {
      ctx.settings.reset(setting.id);
      draw();
      onChange?.(setting.read(ctx));
    }
  });

  row.append(head, description, body, provenance, reset);
  return row;
}
