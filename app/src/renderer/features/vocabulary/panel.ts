import type { AppContext, SearchBarHandle, SearchQuery, TabContext } from '../../core/registry';
import { VOCABULARY_CONTRACT, exampleDocument } from './schema';
import type { VocabularyEntry } from './schema';
import { renderLocalSettingRow } from './settingrow';
import type { LocalSetting } from './settingrow';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SAMPLE,
  DEFAULT_SHOW_ENTRIES,
  VOCABULARY_KEYS,
  VocabularyStore
} from './store';

/**
 * The personal vocabulary destination.
 *
 * The upload control is here whether or not a file has ever been loaded — that
 * is the whole point of it. A control that only appears once a vocabulary exists
 * is a control nobody can use to create the first one.
 *
 * Nothing in this file invents a value. The empty state says plainly that this
 * application ships no vocabulary of its own; the loaded state reports the real
 * counts; a refused file reports the exact rule it broke and leaves whatever was
 * already loaded untouched; and the preview runs the application's own
 * replacement code rather than an imitation of it, so what it shows is what the
 * rest of the interface will do.
 */

export const VOCABULARY_TAB_ID = 'vocabulary.manager';

export const VOCABULARY_ELEMENT_IDS = {
  status: 'vocabulary-status',
  file: 'vocabulary-file',
  choose: 'vocabulary-choose',
  clear: 'vocabulary-clear',
  template: 'vocabulary-template',
  schema: 'vocabulary-schema',
  entries: 'vocabulary-entries',
  search: 'vocabulary-search',
  preview: 'vocabulary-preview',
  options: 'vocabulary-options',
  privacy: 'vocabulary-privacy'
} as const;

/**
 * Panel state that outlives a remount.
 *
 * Loading, suppressing or restoring a vocabulary changes the language layer,
 * which repaints the active destination so every piece of copy follows the new
 * wording immediately. That is correct, and it means this panel is rebuilt from
 * scratch after each of its own actions. Keeping the search text, the page, the
 * selection and the element that had focus at module scope is what stops a bulk
 * action from throwing away the selection the user just built.
 */
const panelState = {
  query: '',
  page: 0,
  selection: new Set<string>(),
  anchor: -1,
  schemaOpen: false,
  focusId: ''
};

/* ------------------------------------------------------------------ */
/* Small DOM helpers                                                   */
/* ------------------------------------------------------------------ */

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { className?: string; text?: string; attrs?: Record<string, string>; children?: Array<Node | null> } = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.attrs) for (const [key, value] of Object.entries(options.attrs)) element.setAttribute(key, value);
  if (options.children) for (const child of options.children) if (child) element.append(child);
  return element;
}

/** Runs `fn` after `delay` milliseconds of quiet, cancelling the pending run. */
function debounce(fn: (value: string) => void, delay: number): (value: string) => void {
  let timer: number | null = null;
  return (value: string) => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      fn(value);
    }, delay);
  };
}

/* ------------------------------------------------------------------ */
/* This destination's own options                                      */
/* ------------------------------------------------------------------ */

function showEntriesSetting(): LocalSetting<boolean> {
  return {
    id: VOCABULARY_KEYS.showEntries,
    label: 'vocabulary.setting.showEntries',
    description: 'vocabulary.setting.showEntries.description',
    defaultValue: DEFAULT_SHOW_ENTRIES,
    read: (ctx) => ctx.settings.get<boolean>(VOCABULARY_KEYS.showEntries, DEFAULT_SHOW_ENTRIES) !== false,
    control: (ctx, current, commit) =>
      ctx.components.switchControl({
        label: 'vocabulary.setting.showEntries',
        checked: current,
        onChange: (value) => commit(value)
      }).root,
    describeDefault: (value) => (value ? 'shown' : 'hidden')
  };
}

function pageSizeSetting(): LocalSetting<number> {
  return {
    id: VOCABULARY_KEYS.pageSize,
    label: 'vocabulary.setting.pageSize',
    description: 'vocabulary.setting.pageSize.description',
    defaultValue: DEFAULT_PAGE_SIZE,
    read: (ctx) => {
      const raw = Number(ctx.settings.get<number>(VOCABULARY_KEYS.pageSize, DEFAULT_PAGE_SIZE));
      if (!Number.isFinite(raw)) return DEFAULT_PAGE_SIZE;
      return Math.min(200, Math.max(10, Math.round(raw)));
    },
    control: (ctx, current, commit) =>
      ctx.components.slider({
        label: 'vocabulary.setting.pageSize',
        min: 10,
        max: 200,
        step: 10,
        value: current,
        onChange: (value) => commit(value)
      }).root,
    describeDefault: (value) => `${value} rows`
  };
}

function sampleSetting(): LocalSetting<string> {
  return {
    id: VOCABULARY_KEYS.sample,
    label: 'vocabulary.setting.sample',
    description: 'vocabulary.setting.sample.description',
    defaultValue: DEFAULT_SAMPLE,
    read: (ctx) => {
      const raw = ctx.settings.get<string>(VOCABULARY_KEYS.sample, DEFAULT_SAMPLE);
      return typeof raw === 'string' ? raw : DEFAULT_SAMPLE;
    },
    control: (ctx, current, commit) =>
      ctx.components.textField({
        label: 'vocabulary.setting.sample',
        value: current,
        multiline: true,
        rows: 3,
        onCommit: (value) => commit(value)
      }).root,
    describeDefault: (value) => (value === '' ? 'an empty sample' : value)
  };
}

/* ------------------------------------------------------------------ */
/* The destination                                                     */
/* ------------------------------------------------------------------ */

export function mountVocabularyPanel(host: HTMLElement, ctx: TabContext, store: VocabularyStore): void {
  host.classList.add('vocab');

  host.append(
    ctx.components.topAppBar({
      title: 'vocabulary.title',
      subtitle: 'vocabulary.subtitle'
    })
  );

  if (!store.snapshot().available) {
    // Reached only if the destination is somehow opened while the named study
    // mode is on. It says so rather than rendering a capability that mode has
    // taken away.
    host.append(
      ctx.components.emptyState({
        title: ctx.t('vocabulary.status.unavailable', 'Not available while {mode} is on', {
          values: { mode: ctx.i18n.snapshot().schoolModeName }
        })
      })
    );
    return;
  }

  const body = node('div', { className: 'vocab__body' });
  host.append(body);

  /* ---------------- status ---------------- */

  const statusCard = ctx.components.card({ variant: 'filled' });
  statusCard.id = VOCABULARY_ELEMENT_IDS.status;
  statusCard.dataset.appearanceId = 'vocabulary:status';
  statusCard.setAttribute('aria-label', ctx.t('vocabulary.status.label', 'Vocabulary status'));
  statusCard.classList.add('vocab__status');
  body.append(statusCard);

  /**
   * The last headline announced, so a change is announced exactly once.
   *
   * The card is deliberately NOT a live region. Its whole contents are rebuilt
   * on every draw, so a live region here would read the entire card out again
   * on each redraw — and the rejection banner inside it already carries its own
   * alert role, which nested inside a live region announces twice. One explicit
   * announcement of the headline when the headline actually changes is the
   * quieter and more accurate behaviour.
   */
  let announcedStatus: string | null = null;

  const drawStatus = (): void => {
    const state = store.snapshot();
    statusCard.textContent = '';

    const heading = node('p', { className: 'md-typescale-title-medium' });
    const detail = node('p', { className: 'md-typescale-body-medium' });

    if (!state.loaded) {
      heading.textContent = ctx.t('vocabulary.status.none', 'No file loaded');
      detail.textContent = ctx.t(
        'vocabulary.status.none.body',
        'Every surface is showing the wording this build ships with. This application contains no vocabulary of its own: nothing is replaced until you supply a file.'
      );
    } else if (state.loadedElsewhere) {
      heading.textContent = ctx.t('vocabulary.status.loaded', '{active} of {total} replacements active', {
        values: { active: ctx.settings.get<number>('vocabulary.count', 0), total: ctx.settings.get<number>('vocabulary.count', 0) }
      });
      detail.textContent = ctx.t(
        'vocabulary.status.loaded.body',
        "Loaded from a file you chose. The validated replacements are cached in this application's own data folder; the file itself, its name and its location are not stored."
      );
    } else if (state.total === 0) {
      heading.textContent = ctx.t('vocabulary.status.empty', 'A file is loaded and it contains no replacements');
      detail.textContent = ctx.t(
        'vocabulary.status.empty.body',
        'The file is valid and asks for nothing to change, so every surface reads exactly as this build shipped it.'
      );
    } else {
      heading.textContent = ctx.t('vocabulary.status.loaded', '{active} of {total} replacements active', {
        values: { active: state.active, total: state.total }
      });
      detail.textContent = ctx.t(
        'vocabulary.status.loaded.body',
        "Loaded from a file you chose. The validated replacements are cached in this application's own data folder; the file itself, its name and its location are not stored."
      );
    }

    statusCard.append(heading, detail);

    const headline = heading.textContent ?? '';
    if (announcedStatus !== null && announcedStatus !== headline) ctx.a11y.announce(headline);
    announcedStatus = headline;

    if (state.loadedAt) {
      statusCard.append(
        node('p', {
          className: 'md-typescale-body-small vocab__muted',
          text: ctx.t('vocabulary.status.loadedAt', 'Loaded {time}', {
            values: { time: new Date(state.loadedAt).toLocaleString() }
          })
        })
      );
    }

    if (state.cacheDropped) {
      const banner = node('div', { className: 'vocab__banner vocab__banner--warning', attrs: { role: 'status' } });
      banner.append(
        node('p', {
          className: 'md-typescale-title-small',
          text: ctx.t('vocabulary.notify.cacheDropped', 'The cached vocabulary was dropped')
        }),
        node('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t(
            'vocabulary.notify.cacheDropped.body',
            'The stored copy no longer passes validation, so the original wording is in use again. Load your file to restore it.'
          )
        }),
        ctx.components.button({
          label: 'vocabulary.action.dismiss',
          variant: 'text',
          onClick: () => store.acknowledgeCacheDrop()
        })
      );
      statusCard.append(banner);
    }

    if (state.rejection) {
      const banner = node('div', { className: 'vocab__banner vocab__banner--error', attrs: { role: 'alert' } });
      const actions = node('div', { className: 'vocab__row' });
      actions.append(
        ctx.components.button({
          label: 'vocabulary.action.choose',
          variant: 'tonal',
          icon: 'upload',
          onClick: () => void chooseFile()
        }),
        ctx.components.button({
          label: 'vocabulary.action.dismiss',
          variant: 'text',
          onClick: () => store.setRejection(null)
        })
      );
      banner.append(
        node('p', {
          className: 'md-typescale-title-small',
          text: ctx.t('vocabulary.status.rejected', 'The last file was refused')
        }),
        node('p', { className: 'md-typescale-body-medium', text: state.rejection.message }),
        node('p', {
          className: 'md-typescale-body-small',
          text: ctx.t(
            'vocabulary.status.rejectedKept',
            'Nothing was applied from it, and what was already loaded is unchanged.'
          )
        }),
        actions
      );
      statusCard.append(banner);
    }
  };

  /* ---------------- file actions ---------------- */

  const chooseFile = async (): Promise<void> => {
    panelState.focusId = VOCABULARY_ELEMENT_IDS.choose;
    await store.loadFromPicker();
  };

  const fileSection = node('section', {
    className: 'vocab__section',
    attrs: { id: VOCABULARY_ELEMENT_IDS.file, 'data-appearance-id': 'vocabulary:file' }
  });
  fileSection.append(
    ctx.components.sectionHeading({
      title: 'vocabulary.section.file',
      description: 'vocabulary.section.file.description'
    })
  );

  const fileActions = node('div', { className: 'vocab__row' });
  const drawFileActions = (): void => {
    const state = store.snapshot();
    fileActions.textContent = '';

    const choose = ctx.components.button({
      label: state.loaded ? 'vocabulary.action.replace' : 'vocabulary.action.choose',
      variant: 'filled',
      icon: 'upload',
      id: VOCABULARY_ELEMENT_IDS.choose,
      onClick: () => void chooseFile()
    });
    ctx.a11y.assertTouchTarget(choose, 'vocabulary: choose a file');

    const clear = ctx.components.button({
      label: 'vocabulary.action.clear',
      variant: 'outlined',
      icon: 'trash',
      danger: true,
      id: VOCABULARY_ELEMENT_IDS.clear,
      disabled: !state.loaded,
      disabledReason: ctx.t(
        'vocabulary.action.clear.disabled',
        'No vocabulary is loaded, so there is nothing to clear. Every surface is already using the wording this build ships with.'
      ),
      onClick: (event) => void clearVocabulary(event.currentTarget as HTMLElement)
    });

    const template = ctx.components.button({
      label: 'vocabulary.action.template',
      variant: 'text',
      icon: 'save',
      id: VOCABULARY_ELEMENT_IDS.template,
      onClick: () => void store.saveTemplate()
    });

    fileActions.append(choose, clear, template);
  };
  fileSection.append(fileActions);

  const clearVocabulary = async (anchor: HTMLElement): Promise<void> => {
    const state = store.snapshot();
    if (!state.loaded) return;
    const approved = await ctx.confirm.request({
      anchor,
      action: ctx.t('vocabulary.confirm.clear', 'Clear the personal vocabulary and restore the original wording'),
      affected: [
        ctx.t('vocabulary.status.loaded', '{active} of {total} replacements active', {
          values: { active: state.active, total: state.total }
        }),
        `${VOCABULARY_KEYS.source} in ${ctx.settings.filePath() || 'the settings file'}`
      ],
      irreversible: ctx.t(
        'vocabulary.confirm.clear.irreversible',
        'The cached replacements are deleted from this computer and every surface returns to the wording this build ships with. Your own file is not touched, but version history never records vocabulary content, so this cannot be undone from history: load your file again to bring it back.'
      ),
      confirmLabel: ctx.t('vocabulary.action.clear', 'Clear and restore the original wording')
    });
    if (!approved) return;
    panelState.selection.clear();
    panelState.focusId = VOCABULARY_ELEMENT_IDS.choose;
    await store.clear();
  };

  /* ---------------- schema reference ---------------- */

  const schemaSection = node('section', {
    className: 'vocab__section',
    attrs: { id: VOCABULARY_ELEMENT_IDS.schema, 'data-appearance-id': 'vocabulary:schema' }
  });
  schemaSection.append(
    ctx.components.sectionHeading({
      title: 'vocabulary.section.schema',
      description: 'vocabulary.section.schema.description'
    })
  );

  const schemaBody = node('div', { className: 'vocab__schema', attrs: { id: 'vocabulary-schema-body' } });
  const schemaToggle = ctx.components.button({
    label: panelState.schemaOpen ? 'vocabulary.schema.hide' : 'vocabulary.schema.show',
    variant: 'tonal',
    icon: 'code',
    onClick: () => {
      panelState.schemaOpen = !panelState.schemaOpen;
      schemaBody.hidden = !panelState.schemaOpen;
      schemaToggle.setAttribute('aria-expanded', String(panelState.schemaOpen));
      const labelNode = schemaToggle.querySelector('.md-btn__label');
      const text = ctx.t(
        panelState.schemaOpen ? 'vocabulary.schema.hide' : 'vocabulary.schema.show',
        panelState.schemaOpen ? 'Hide the file format' : 'Show the file format'
      );
      if (labelNode) labelNode.textContent = text;
      else schemaToggle.textContent = text;
    }
  });
  schemaToggle.setAttribute('aria-expanded', String(panelState.schemaOpen));
  schemaToggle.setAttribute('aria-controls', 'vocabulary-schema-body');

  schemaBody.hidden = !panelState.schemaOpen;
  schemaBody.append(
    node('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'vocabulary.schema.intro',
        'A vocabulary file is a JSON object with exactly two fields: "version", a whole number, and "replacements", an object whose members are all text. Any other field is refused.'
      )
    }),
    node('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'vocabulary.schema.limits',
        'Limits: at most {bytes} bytes, at most {entries} replacements, keys of 1 to {keyLength} characters, values of at most {valueLength} characters, nesting at most {depth} levels deep. Duplicate member names, reserved object keys, unknown fields and non-text values are all refused.',
        {
          values: {
            bytes: VOCABULARY_CONTRACT.maxBytes,
            entries: VOCABULARY_CONTRACT.maxEntries,
            keyLength: VOCABULARY_CONTRACT.maxKeyLength,
            valueLength: VOCABULARY_CONTRACT.maxValueLength,
            depth: VOCABULARY_CONTRACT.maxDepth
          }
        }
      )
    }),
    node('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'vocabulary.schema.partial',
        'A file that breaks any rule is refused whole. There is no partial load: the replacements you already had stay exactly as they were.'
      )
    }),
    node('p', {
      className: 'md-typescale-body-small vocab__muted',
      text: ctx.t(
        'vocabulary.schema.example',
        'A blank file in this format. It is the whole shape, with no replacements in it — this application ships no vocabulary of its own.'
      )
    }),
    node('pre', { className: 'vocab__code', text: exampleDocument(), attrs: { tabindex: '0' } })
  );
  schemaSection.append(schemaToggle, schemaBody);

  /* ---------------- entries ---------------- */

  const entriesSection = node('section', {
    className: 'vocab__section',
    attrs: { id: VOCABULARY_ELEMENT_IDS.entries, 'data-appearance-id': 'vocabulary:entries' }
  });
  entriesSection.append(
    ctx.components.sectionHeading({
      title: 'vocabulary.section.entries',
      description: 'vocabulary.section.entries.description'
    })
  );

  let query: SearchQuery | null = null;
  const search: SearchBarHandle = ctx.createSearchBar({
    label: 'vocabulary.search.label',
    placeholder: 'vocabulary.search.placeholder',
    initialText: panelState.query,
    // The builder's sample is drawn from the loaded terms so a pattern can be
    // tried against real rows. It is rendered locally and goes nowhere else.
    sample: store
      .entries()
      .slice(0, 20)
      .map((entry) => entry.from)
      .join('\n'),
    onChange: (next) => {
      query = next;
      panelState.query = next.text;
      panelState.page = 0;
      drawEntries();
    }
  });
  search.root.id = VOCABULARY_ELEMENT_IDS.search;
  entriesSection.append(search.root);

  const selectionBar = node('div', { className: 'vocab__toolbar' });
  const selectionStatus = node('p', {
    className: 'md-typescale-body-medium vocab__selection',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const selectionActions = node('div', { className: 'vocab__row' });
  selectionBar.append(selectionStatus, selectionActions);
  entriesSection.append(selectionBar);

  const tableHost = node('div', { className: 'vocab__tablehost' });
  entriesSection.append(tableHost);

  const pager = node('div', { className: 'vocab__pager' });
  entriesSection.append(pager);

  const matching = (): VocabularyEntry[] => {
    const all = store.entries();
    if (!query || query.text.trim() === '') return all;
    return all.filter((entry) => query?.matches(`${entry.from} ${entry.to}`) ?? true);
  };

  const pageSize = (): number => pageSizeSetting().read(ctx);

  const drawSelection = (matches: VocabularyEntry[]): void => {
    const selected = [...panelState.selection];
    selectionStatus.textContent =
      selected.length === 0
        ? ctx.t('vocabulary.selection.none', 'Nothing selected')
        : ctx.t('vocabulary.selection.count', '{count} selected', { values: { count: selected.length } });

    const willSuppress = selected.filter((key) => !store.isSuppressed(key)).length;
    const willRestore = selected.filter((key) => store.isSuppressed(key)).length;

    if (selected.length > 0) {
      // The reviewable preview: what each action would actually change, rather
      // than the selection size repeated three times. "42 selected" and "42 will
      // change" are different numbers whenever part of a selection is already in
      // the requested state.
      selectionStatus.append(
        node('span', {
          className: 'vocab__muted',
          text: ` · ${ctx.t(
            'vocabulary.selection.preview',
            '{suppress} would be suppressed, {restore} would be restored, {remove} would be removed.',
            { values: { suppress: willSuppress, restore: willRestore, remove: selected.length } }
          )}`
        })
      );
    }

    selectionActions.textContent = '';

    const emptyReason = ctx.t('vocabulary.selection.none', 'Nothing selected');

    selectionActions.append(
      ctx.components.button({
        label: 'vocabulary.action.suppress',
        variant: 'tonal',
        icon: 'pause',
        disabled: willSuppress === 0,
        disabledReason:
          selected.length === 0
            ? emptyReason
            : ctx.t('vocabulary.action.suppress.disabled', 'Every selected replacement is already suppressed.'),
        onClick: () => void applySuppression(selected, true)
      }),
      ctx.components.button({
        label: 'vocabulary.action.restore',
        variant: 'tonal',
        icon: 'play',
        disabled: willRestore === 0,
        disabledReason:
          selected.length === 0
            ? emptyReason
            : ctx.t('vocabulary.action.restore.disabled', 'Every selected replacement is already active.'),
        onClick: () => void applySuppression(selected, false)
      }),
      ctx.components.button({
        label: 'vocabulary.action.remove',
        variant: 'outlined',
        icon: 'trash',
        danger: true,
        disabled: selected.length === 0,
        disabledReason: emptyReason,
        onClick: (event) => void removeSelected(selected, event.currentTarget as HTMLElement)
      }),
      ctx.components.divider(true),
      ctx.components.button({
        label: ctx.t('vocabulary.action.selectMatches', 'Select all {count} matching', {
          values: { count: matches.length }
        }),
        variant: 'text',
        disabled: matches.length === 0,
        disabledReason: ctx.t('vocabulary.table.noMatches', 'No loaded replacement matches this search.'),
        onClick: () => {
          for (const entry of matches) panelState.selection.add(entry.from);
          drawEntries();
          ctx.a11y.announce(
            ctx.t('vocabulary.selection.count', '{count} selected', { values: { count: panelState.selection.size } })
          );
        }
      }),
      ctx.components.button({
        label: 'vocabulary.action.invert',
        variant: 'text',
        disabled: matches.length === 0,
        disabledReason: ctx.t('vocabulary.table.noMatches', 'No loaded replacement matches this search.'),
        onClick: () => {
          for (const entry of matches) {
            if (panelState.selection.has(entry.from)) panelState.selection.delete(entry.from);
            else panelState.selection.add(entry.from);
          }
          drawEntries();
        }
      }),
      ctx.components.button({
        label: 'vocabulary.action.clearSelection',
        variant: 'text',
        disabled: selected.length === 0,
        disabledReason: emptyReason,
        onClick: () => {
          panelState.selection.clear();
          panelState.anchor = -1;
          drawEntries();
        }
      })
    );
  };

  const applySuppression = async (keys: string[], suppressed: boolean): Promise<void> => {
    panelState.focusId = VOCABULARY_ELEMENT_IDS.entries;
    await store.setSuppressed(keys, suppressed);
  };

  const removeSelected = async (keys: string[], anchor: HTMLElement): Promise<void> => {
    if (keys.length === 0) return;
    const shown = keys.slice(0, 12);
    const affected = shown.map((key) => key);
    if (keys.length > shown.length) {
      affected.push(
        ctx.t('vocabulary.confirm.andMore', '… and {count} more', {
          values: { count: keys.length - shown.length }
        })
      );
    }
    const approved = await ctx.confirm.request({
      anchor,
      action: ctx.t('vocabulary.confirm.remove', 'Remove {count} replacements from the loaded vocabulary', {
        values: { count: keys.length }
      }),
      affected,
      irreversible: ctx.t(
        'vocabulary.confirm.remove.irreversible',
        'They stop applying and leave the loaded copy on this computer. Your file on disk is not changed, so loading it again brings them back.'
      ),
      confirmLabel: ctx.t('vocabulary.action.remove', 'Remove')
    });
    if (!approved) return;
    panelState.selection.clear();
    panelState.anchor = -1;
    panelState.focusId = VOCABULARY_ELEMENT_IDS.entries;
    await store.remove(keys);
  };

  const rowMenu = (entry: VocabularyEntry, anchor: HTMLElement): void => {
    ctx.components.menu({
      anchor,
      label: ctx.t('vocabulary.table.label', 'Loaded replacements'),
      items: [
        {
          id: 'suppress',
          label: ctx.t('vocabulary.action.suppress', 'Suppress'),
          icon: 'pause',
          disabled: store.isSuppressed(entry.from),
          disabledReason: ctx.t('vocabulary.row.suppress.disabled', 'This replacement is already suppressed.'),
          run: () => void applySuppression([entry.from], true)
        },
        {
          id: 'restore',
          label: ctx.t('vocabulary.action.restore', 'Restore'),
          icon: 'play',
          disabled: !store.isSuppressed(entry.from),
          disabledReason: ctx.t('vocabulary.row.restore.disabled', 'This replacement is already active.'),
          run: () => void applySuppression([entry.from], false)
        },
        {
          id: 'remove',
          label: ctx.t('vocabulary.action.remove', 'Remove'),
          icon: 'trash',
          danger: true,
          separatorBefore: true,
          run: () => void removeSelected([entry.from], anchor)
        }
      ]
    });
  };

  /**
   * Redraws the table and returns focus to one row's checkbox.
   *
   * The redraw replaces every node, so the element to focus has to be found in
   * the NEW table rather than remembered from the old one — a reference captured
   * before the redraw points at a detached node, and focusing it silently does
   * nothing, which reads as a keyboard path that stops working after one press.
   */
  const redrawAndFocusRow = (index: number): void => {
    drawEntries();
    const restored = tableHost.querySelectorAll('tbody input[type="checkbox"]')[index];
    if (restored instanceof HTMLInputElement) restored.focus();
  };

  const drawEntries = (): void => {
    const state = store.snapshot();
    tableHost.textContent = '';
    pager.textContent = '';

    // Two different nothings, said differently. "No file loaded" and "a valid
    // file that asks for nothing" are distinct situations, and collapsing them
    // into one message would tell somebody who just loaded a file that their
    // load had not happened.
    if (!state.loaded) {
      selectionBar.hidden = true;
      search.root.hidden = true;
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('vocabulary.table.none', 'No file is loaded, so there is nothing to list.'),
          body: ctx.t(
            'vocabulary.status.none.body',
            'Every surface is showing the wording this build ships with. This application contains no vocabulary of its own: nothing is replaced until you supply a file.'
          ),
          action: {
            label: 'vocabulary.action.choose',
            variant: 'filled',
            icon: 'upload',
            onClick: () => void chooseFile()
          }
        })
      );
      return;
    }

    if (state.total === 0 && !state.loadedElsewhere) {
      selectionBar.hidden = true;
      search.root.hidden = true;
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('vocabulary.status.empty', 'A file is loaded and it contains no replacements'),
          body: ctx.t(
            'vocabulary.status.empty.body',
            'The file is valid and asks for nothing to change, so every surface reads exactly as this build shipped it.'
          ),
          action: {
            label: 'vocabulary.action.replace',
            variant: 'filled',
            icon: 'upload',
            onClick: () => void chooseFile()
          }
        })
      );
      return;
    }

    if (state.loadedElsewhere) {
      selectionBar.hidden = true;
      search.root.hidden = true;
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('vocabulary.table.hidden', 'The list is hidden'),
          body: ctx.t(
            'vocabulary.table.elsewhere.body',
            'A vocabulary is applied, but it was loaded through the settings surface and its entries cannot be listed here. Loading your file from this destination lists them.'
          ),
          action: {
            label: 'vocabulary.action.replace',
            variant: 'filled',
            icon: 'upload',
            onClick: () => void chooseFile()
          }
        })
      );
      return;
    }

    if (!showEntriesSetting().read(ctx)) {
      selectionBar.hidden = true;
      search.root.hidden = true;
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('vocabulary.table.hidden', 'The list is hidden'),
          body: ctx.t(
            'vocabulary.table.hidden.body',
            '{count} replacements are loaded and working. Turn on "Show the loaded replacements" below to see them.',
            { values: { count: state.total } }
          )
        })
      );
      return;
    }

    selectionBar.hidden = false;
    search.root.hidden = false;

    const matches = matching();
    const size = pageSize();
    const pageCount = Math.max(1, Math.ceil(matches.length / size));
    if (panelState.page >= pageCount) panelState.page = pageCount - 1;
    if (panelState.page < 0) panelState.page = 0;
    const start = panelState.page * size;
    const pageRows = matches.slice(start, start + size);

    drawSelection(matches);

    if (matches.length === 0) {
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('vocabulary.table.noMatches', 'No loaded replacement matches this search.'),
          action: {
            label: 'vocabulary.action.clearSearch',
            variant: 'text',
            onClick: () => {
              search.clear();
            }
          }
        })
      );
      return;
    }

    const wrap = node('div', {
      className: 'md-table-wrap vocab__tablewrap',
      attrs: {
        role: 'region',
        tabindex: '0',
        'aria-label': ctx.t('vocabulary.table.label', 'Loaded replacements')
      }
    });
    const table = node('table', {
      className: 'md-table vocab__table',
      attrs: { 'aria-label': ctx.t('vocabulary.table.label', 'Loaded replacements') }
    });
    const head = node('thead');
    const headRow = node('tr');

    const pageSelectLabel = ctx.t('vocabulary.action.selectPage', 'Select the {count} on this page', {
      values: { count: pageRows.length }
    });
    const selectedOnPage = pageRows.filter((entry) => panelState.selection.has(entry.from)).length;
    const pageSelect = ctx.components.checkbox({
      label: pageSelectLabel,
      checked: selectedOnPage === pageRows.length && pageRows.length > 0,
      indeterminate: selectedOnPage > 0 && selectedOnPage < pageRows.length,
      onChange: (checked) => {
        for (const entry of pageRows) {
          if (checked) panelState.selection.add(entry.from);
          else panelState.selection.delete(entry.from);
        }
        drawEntries();
      }
    });
    pageSelect.root.querySelector('span')?.classList.add('md-visually-hidden');
    const selectHeader = node('th', { attrs: { scope: 'col' } });
    selectHeader.append(pageSelect.root);
    headRow.append(selectHeader);

    headRow.append(
      node('th', { attrs: { scope: 'col' }, text: ctx.t('vocabulary.table.from', 'Text replaced') }),
      node('th', { attrs: { scope: 'col' }, text: ctx.t('vocabulary.table.to', 'Shown instead') }),
      node('th', { attrs: { scope: 'col' }, text: ctx.t('vocabulary.table.state', 'State') }),
      node('th', { attrs: { scope: 'col' }, text: ctx.t('core.action.more', 'More') })
    );
    head.append(headRow);

    const tbody = node('tbody');
    const checkboxes: HTMLInputElement[] = [];

    const extendTo = (index: number): void => {
      if (panelState.anchor < 0) panelState.anchor = index;
      const from = Math.min(panelState.anchor, index);
      const to = Math.max(panelState.anchor, index);
      for (let cursor = from; cursor <= to; cursor += 1) {
        const entry = pageRows[cursor];
        if (entry) panelState.selection.add(entry.from);
      }
    };

    pageRows.forEach((entry, index) => {
      const absolute = start + index + 1;
      const row = node('tr', {
        attrs: { 'aria-selected': String(panelState.selection.has(entry.from)) }
      });

      const selectCell = node('td');
      const box = ctx.components.checkbox({
        label: ctx.t('vocabulary.table.select', 'Select replacement {index}', { values: { index: absolute } }),
        checked: panelState.selection.has(entry.from),
        onChange: (checked) => {
          if (checked) panelState.selection.add(entry.from);
          else panelState.selection.delete(entry.from);
          row.setAttribute('aria-selected', String(checked));
          drawSelection(matches);
        }
      });
      box.root.querySelector('span')?.classList.add('md-visually-hidden');
      const input = box.root.querySelector('input');
      if (input instanceof HTMLInputElement) {
        checkboxes.push(input);
        input.dataset.index = String(index);
        // Shift-click extends from the last plain click, exactly as a file list
        // does. The plain click sets the anchor; the shifted one fills in.
        input.addEventListener('click', (event) => {
          if (event.shiftKey) {
            extendTo(index);
            redrawAndFocusRow(index);
          } else {
            panelState.anchor = index;
          }
        });
        input.addEventListener('keydown', (event) => {
          // The keyboard equivalent of shift-clicking a range.
          if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            const next = index + (event.key === 'ArrowDown' ? 1 : -1);
            if (next < 0 || next >= pageRows.length) return;
            if (panelState.anchor < 0) panelState.anchor = index;
            extendTo(next);
            redrawAndFocusRow(next);
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const next = index + (event.key === 'ArrowDown' ? 1 : -1);
            checkboxes[next]?.focus();
          }
        });
      }
      selectCell.append(box.root);

      const fromCell = node('td', { className: 'vocab__term' });
      fromCell.append(node('code', { className: 'vocab__code-inline', text: entry.from }));

      const toCell = node('td', { className: 'vocab__term' });
      if (entry.to === '') {
        toCell.append(
          node('span', {
            className: 'vocab__muted',
            text: ctx.t('vocabulary.table.emptyValue', '(removed)')
          })
        );
      } else {
        toCell.append(node('code', { className: 'vocab__code-inline', text: entry.to }));
      }

      const stateCell = node('td');
      stateCell.append(
        ctx.components.badge({
          label: store.isSuppressed(entry.from)
            ? ctx.t('vocabulary.table.suppressed', 'Suppressed')
            : ctx.t('vocabulary.table.active', 'Active'),
          severity: store.isSuppressed(entry.from) ? 'warning' : 'success'
        })
      );

      const actionCell = node('td');
      const more = ctx.components.iconButton({
        icon: 'more',
        label: ctx.t('vocabulary.table.select', 'Select replacement {index}', { values: { index: absolute } }),
        onClick: (event) => rowMenu(entry, event.currentTarget as HTMLElement)
      });
      more.setAttribute(
        'aria-label',
        `${ctx.t('core.action.more', 'More')} — ${ctx.t('vocabulary.table.select', 'Select replacement {index}', {
          values: { index: absolute }
        })}`
      );
      actionCell.append(more);

      row.append(selectCell, fromCell, toCell, stateCell, actionCell);
      tbody.append(row);
    });

    table.append(head, tbody);
    wrap.append(table);
    tableHost.append(wrap);

    const first = matches.length === 0 ? 0 : start + 1;
    const last = Math.min(start + size, matches.length);
    pager.append(
      ctx.components.button({
        label: 'vocabulary.action.previous',
        variant: 'text',
        icon: 'chevronLeft',
        disabled: panelState.page === 0,
        disabledReason: 'This is the first page.',
        onClick: () => {
          panelState.page -= 1;
          drawEntries();
        }
      }),
      node('span', {
        className: 'md-typescale-body-small',
        attrs: { role: 'status' },
        text: ctx.t('vocabulary.page.status', 'Showing {from} to {to} of {total}', {
          values: { from: first, to: last, total: matches.length }
        })
      }),
      ctx.components.button({
        label: 'vocabulary.action.next',
        variant: 'text',
        trailingIcon: 'chevronRight',
        disabled: panelState.page >= pageCount - 1,
        disabledReason: 'This is the last page.',
        onClick: () => {
          panelState.page += 1;
          drawEntries();
        }
      })
    );
  };

  /* ---------------- preview ---------------- */

  const previewSection = node('section', {
    className: 'vocab__section',
    attrs: { id: VOCABULARY_ELEMENT_IDS.preview, 'data-appearance-id': 'vocabulary:preview' }
  });
  previewSection.append(
    ctx.components.sectionHeading({
      title: 'vocabulary.section.preview',
      description: 'vocabulary.section.preview.description'
    })
  );

  const previewResult = node('pre', { className: 'vocab__code vocab__preview-result', attrs: { tabindex: '0' } });
  const previewStatus = node('p', {
    className: 'md-typescale-body-small vocab__muted',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const refreshPreview = (text: string): void => {
    const applied = store.preview(text);
    previewResult.textContent = applied;
    if (text.trim() === '') {
      previewStatus.textContent = ctx.t(
        'vocabulary.preview.empty',
        'Type something above to see what the active replacements do to it.'
      );
      return;
    }
    const count = store.countMatches(text);
    previewStatus.textContent =
      applied === text
        ? ctx.t('vocabulary.preview.identical', 'Nothing in this sample changes.')
        : ctx.t('vocabulary.preview.changed', '{count} replacements changed this sample.', { values: { count } });
  };

  // Typing runs the real replacement pass over the sample, which is O(entries)
  // per keystroke. A short quiet period keeps a 2000-entry vocabulary from
  // turning the field sluggish while still feeling immediate.
  const refreshPreviewSoon = debounce((value: string) => refreshPreview(value), 150);

  const sampleField = ctx.components.textField({
    label: 'vocabulary.preview.sample',
    value: sampleSetting().read(ctx),
    multiline: true,
    rows: 4,
    onChange: (value) => refreshPreviewSoon(value),
    onCommit: (value) => {
      ctx.settings.set(VOCABULARY_KEYS.sample, value);
      refreshPreview(value);
    }
  });

  previewSection.append(
    sampleField.root,
    node('p', {
      className: 'md-typescale-label-large',
      text: ctx.t('vocabulary.preview.result', 'With your vocabulary applied')
    }),
    previewResult,
    previewStatus
  );

  /* ---------------- options ---------------- */

  const optionsSection = node('section', {
    className: 'vocab__section',
    attrs: { id: VOCABULARY_ELEMENT_IDS.options, 'data-appearance-id': 'vocabulary:options' }
  });
  optionsSection.append(
    ctx.components.sectionHeading({
      title: 'vocabulary.section.options',
      description: 'vocabulary.section.options.description'
    })
  );
  optionsSection.append(
    renderLocalSettingRow(ctx, showEntriesSetting(), () => drawEntries()),
    renderLocalSettingRow(ctx, pageSizeSetting(), () => {
      panelState.page = 0;
      drawEntries();
    }),
    renderLocalSettingRow(ctx, sampleSetting(), (value) => {
      sampleField.set(value);
      refreshPreview(value);
    })
  );

  /* ---------------- privacy ---------------- */

  const privacySection = node('section', {
    className: 'vocab__section',
    attrs: { id: VOCABULARY_ELEMENT_IDS.privacy, 'data-appearance-id': 'vocabulary:privacy' }
  });
  privacySection.append(
    ctx.components.sectionHeading({ title: 'vocabulary.section.privacy' }),
    node('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'vocabulary.privacy.body',
        'Nothing. Your file is read on this computer, validated on this computer, and cached on this computer.'
      )
    })
  );

  /* ---------------- assembly ---------------- */

  body.append(fileSection, schemaSection, entriesSection, previewSection, optionsSection, privacySection);

  drawStatus();
  drawFileActions();
  drawEntries();
  refreshPreview(sampleField.get());

  // The search field is created with the remembered text but a search bar only
  // emits on user input, so the box would read as filtered while the list showed
  // everything. Re-applying it here — after every draw function exists — makes
  // the field and the rows agree again.
  if (panelState.query !== '') search.setText(panelState.query);

  const unsubscribe = store.subscribe(() => {
    drawStatus();
    drawFileActions();
    drawEntries();
    refreshPreview(sampleField.get());
  });
  ctx.onDispose(() => {
    unsubscribe();
    search.destroy();
  });

  // A remount caused by this panel's own action returns focus where it was.
  if (panelState.focusId) {
    const target = document.getElementById(panelState.focusId);
    panelState.focusId = '';
    if (target) window.requestAnimationFrame(() => ctx.a11y.focusVisible(target));
  }
}

/** Clears the selection and search kept across remounts. Used when a tab closes. */
export function resetVocabularyPanelState(): void {
  panelState.query = '';
  panelState.page = 0;
  panelState.selection.clear();
  panelState.anchor = -1;
  panelState.focusId = '';
}
