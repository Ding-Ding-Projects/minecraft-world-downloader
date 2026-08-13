import { el, nextId } from './a11y';
import { i18n } from './i18n';
import { overlay } from './overlay';
import type { OverlayHandle, RegexBuilderHandle, RegexBuilderOptions, RegexState } from './types';

/**
 * The regular-expression builder.
 *
 * Every search bar in this application has one, anchored to that exact field.
 * The engine is the JavaScript `RegExp` engine and the interface says so, so a
 * pattern written here behaves identically wherever the same string is used.
 *
 * Evaluation is bounded. A pattern like `(a+)+b` against a long sample can
 * backtrack for minutes, and a renderer that hangs is indistinguishable from one
 * that has crashed, so the sample is capped, the match loop is capped and the
 * elapsed time is checked between iterations. When the budget runs out the
 * interface says so plainly rather than showing a partial result as if it were
 * the whole answer.
 */

const MAX_SAMPLE_CHARS = 20_000;
const MAX_MATCHES = 500;
const TIME_BUDGET_MS = 250;

export interface MatchResult {
  matches: Array<{ index: number; text: string; groups: Array<{ name: string; value: string | undefined }> }>;
  truncated: boolean;
  timedOut: boolean;
  elapsedMs: number;
}

/** Compiles a pattern, returning the error rather than throwing it. */
export function compile(pattern: string, flags: string): { regex: RegExp | null; error: string | null } {
  if (pattern === '') return { regex: null, error: null };
  try {
    return { regex: new RegExp(pattern, flags), error: null };
  } catch (error) {
    return { regex: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Runs a compiled pattern over a bounded sample within a time budget. */
export function evaluate(regex: RegExp, sample: string): MatchResult {
  const text = sample.length > MAX_SAMPLE_CHARS ? sample.slice(0, MAX_SAMPLE_CHARS) : sample;
  const global = regex.flags.includes('g') || regex.flags.includes('y');
  const runner = global ? regex : new RegExp(regex.source, `${regex.flags}g`);
  runner.lastIndex = 0;

  const started = performance.now();
  const matches: MatchResult['matches'] = [];
  let truncated = false;
  let timedOut = false;

  for (;;) {
    if (performance.now() - started > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }
    const found = runner.exec(text);
    if (!found) break;
    const groups: Array<{ name: string; value: string | undefined }> = [];
    for (let index = 1; index < found.length; index += 1) {
      groups.push({ name: String(index), value: found[index] });
    }
    if (found.groups) {
      for (const [name, value] of Object.entries(found.groups)) groups.push({ name, value });
    }
    matches.push({ index: found.index, text: found[0], groups });
    // A zero-width match would otherwise loop forever on the same index.
    if (found[0] === '') runner.lastIndex += 1;
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
  }

  return { matches, truncated, timedOut, elapsedMs: Math.round(performance.now() - started) };
}

/** Escapes a literal so it can be dropped into a pattern verbatim. */
export function escapeLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

const FLAG_LIST: Array<{ flag: string; label: string }> = [
  { flag: 'g', label: 'global — find every match, not only the first' },
  { flag: 'i', label: 'ignore case' },
  { flag: 'm', label: 'multiline — ^ and $ match at every line' },
  { flag: 's', label: 'dot matches a newline' },
  { flag: 'u', label: 'unicode' },
  { flag: 'y', label: 'sticky — match only at lastIndex' }
];

interface Insertion {
  label: string;
  snippet: string;
  /** Where to leave the caret inside the snippet, counted from its start. */
  caret?: number;
}

const GUIDED: Array<{ group: string; items: Insertion[] }> = [
  {
    group: 'core.regex.insertClass',
    items: [
      { label: 'Any character  .', snippet: '.' },
      { label: 'Digit  \\d', snippet: '\\d' },
      { label: 'Not a digit  \\D', snippet: '\\D' },
      { label: 'Word character  \\w', snippet: '\\w' },
      { label: 'Not a word character  \\W', snippet: '\\W' },
      { label: 'Whitespace  \\s', snippet: '\\s' },
      { label: 'Not whitespace  \\S', snippet: '\\S' },
      { label: 'Custom set  [abc]', snippet: '[]', caret: 1 },
      { label: 'Excluded set  [^abc]', snippet: '[^]', caret: 2 },
      { label: 'Range  [a-z]', snippet: '[a-z]' }
    ]
  },
  {
    group: 'core.regex.insertAnchor',
    items: [
      { label: 'Start of input  ^', snippet: '^' },
      { label: 'End of input  $', snippet: '$' },
      { label: 'Word boundary  \\b', snippet: '\\b' },
      { label: 'Not a word boundary  \\B', snippet: '\\B' }
    ]
  },
  {
    group: 'core.regex.insertGroup',
    items: [
      { label: 'Capturing group  ( )', snippet: '()', caret: 1 },
      { label: 'Non-capturing group  (?: )', snippet: '(?:)', caret: 3 },
      { label: 'Named group  (?<name> )', snippet: '(?<name>)', caret: 8 },
      { label: 'Look ahead  (?= )', snippet: '(?=)', caret: 3 },
      { label: 'Negative look ahead  (?! )', snippet: '(?!)', caret: 3 },
      { label: 'Look behind  (?<= )', snippet: '(?<=)', caret: 4 },
      { label: 'Negative look behind  (?<! )', snippet: '(?<!)', caret: 4 }
    ]
  },
  {
    group: 'core.regex.insertQuantifier',
    items: [
      { label: 'Zero or more  *', snippet: '*' },
      { label: 'One or more  +', snippet: '+' },
      { label: 'Optional  ?', snippet: '?' },
      { label: 'Exactly n  {2}', snippet: '{2}' },
      { label: 'n or more  {2,}', snippet: '{2,}' },
      { label: 'Between n and m  {2,4}', snippet: '{2,4}' },
      { label: 'Lazy one or more  +?', snippet: '+?' },
      { label: 'Lazy zero or more  *?', snippet: '*?' }
    ]
  },
  {
    group: 'core.regex.insertAlternation',
    items: [{ label: 'Either / or  a|b', snippet: '|' }]
  }
];

class RegexBuilder implements RegexBuilderHandle {
  private handle: OverlayHandle | null = null;
  private pattern: string;
  private flags: string;
  private sample: string;
  private readonly options: RegexBuilderOptions;

  constructor(options: RegexBuilderOptions) {
    this.options = options;
    this.pattern = options.initialPattern ?? '';
    this.flags = options.initialFlags ?? 'g';
    this.sample = options.sample ?? '';
  }

  state(): RegexState {
    const { regex, error } = compile(this.pattern, this.flags);
    return { pattern: this.pattern, flags: this.flags, valid: error === null && (regex !== null || this.pattern === ''), error };
  }

  isOpen(): boolean {
    return this.handle !== null && this.handle.isOpen();
  }

  close(): void {
    this.handle?.close();
    this.handle = null;
  }

  open(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    const handle = overlay.open({
      anchor: this.options.anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: i18n.t('core.regex.title', 'Pattern builder'),
      resizeKey: 'regex-builder',
      onClose: () => {
        this.handle = null;
        this.options.onClose?.();
      }
    });
    this.handle = handle;
    handle.root.classList.add('md-regex');
    this.render(handle.body);
    handle.reposition();
  }

  private render(host: HTMLElement): void {
    host.textContent = '';

    const engineNote = el('p', {
      className: 'md-regex__engine md-typescale-body-small',
      text: i18n.t('core.regex.engine', 'This is the JavaScript RegExp engine.')
    });

    const patternId = nextId('md-regex-pattern');
    const patternLabel = el('label', {
      className: 'md-field__label',
      text: i18n.t('core.regex.pattern', 'Pattern'),
      attrs: { for: patternId }
    });
    const patternInput = el('input', {
      className: 'md-field__input md-regex__pattern',
      attrs: { id: patternId, type: 'text', spellcheck: 'false', autocomplete: 'off' }
    });
    patternInput.value = this.pattern;

    const feedback = el('p', { className: 'md-regex__feedback md-typescale-body-small', attrs: { role: 'status' } });

    const flagsFieldset = el('fieldset', { className: 'md-regex__flags' });
    flagsFieldset.append(el('legend', { className: 'md-typescale-label-medium', text: i18n.t('core.regex.flags', 'Flags') }));
    const flagInputs = new Map<string, HTMLInputElement>();
    for (const { flag, label } of FLAG_LIST) {
      const id = nextId('md-regex-flag');
      const wrapper = el('label', { className: 'md-regex__flag', attrs: { for: id, title: label } });
      const input = el('input', { attrs: { id, type: 'checkbox' } });
      input.checked = this.flags.includes(flag);
      input.addEventListener('change', () => {
        this.flags = FLAG_LIST.filter(({ flag: candidate }) => flagInputs.get(candidate)?.checked).map((entry) => entry.flag).join('');
        update();
      });
      flagInputs.set(flag, input);
      wrapper.append(input, el('span', { className: 'md-typescale-label-large', text: flag }));
      wrapper.title = label;
      flagsFieldset.append(wrapper);
    }

    const guided = el('div', { className: 'md-regex__guided' });
    for (const { group, items } of GUIDED) {
      const details = el('details', { className: 'md-regex__guided-group' });
      details.append(el('summary', { className: 'md-typescale-label-large', text: i18n.t(group, group) }));
      const row = el('div', { className: 'md-regex__guided-items' });
      for (const item of items) {
        const button = el('button', { className: 'md-btn md-btn--text md-regex__token', text: item.label, attrs: { type: 'button' } });
        button.addEventListener('click', () => {
          insert(item.snippet, item.caret);
        });
        row.append(button);
      }
      details.append(row);
      guided.append(details);
    }

    const literalRow = el('div', { className: 'md-regex__literal' });
    const literalId = nextId('md-regex-literal');
    const literalInput = el('input', {
      className: 'md-field__input',
      attrs: { id: literalId, type: 'text', placeholder: 'text to match exactly' }
    });
    const literalButton = el('button', {
      className: 'md-btn md-btn--tonal',
      text: i18n.t('core.regex.insertLiteral', 'Literal text'),
      attrs: { type: 'button' }
    });
    literalButton.addEventListener('click', () => {
      if (!literalInput.value) return;
      insert(escapeLiteral(literalInput.value));
      literalInput.value = '';
    });
    literalRow.append(
      el('label', { className: 'md-field__label', text: i18n.t('core.regex.insertLiteral', 'Literal text'), attrs: { for: literalId } }),
      literalInput,
      literalButton
    );

    const sampleId = nextId('md-regex-sample');
    const sampleArea = el('textarea', {
      className: 'md-field__input md-regex__sample',
      attrs: { id: sampleId, rows: '5', spellcheck: 'false' }
    });
    sampleArea.value = this.sample;

    const results = el('div', { className: 'md-regex__results' });

    const actions = el('div', { className: 'md-regex__actions' });
    const copyButton = el('button', {
      className: 'md-btn md-btn--text',
      text: i18n.t('core.action.copy', 'Copy'),
      attrs: { type: 'button' }
    });
    copyButton.addEventListener('click', () => {
      void navigator.clipboard.writeText(`/${this.pattern}/${this.flags}`);
    });
    const exportButton = el('button', {
      className: 'md-btn md-btn--text',
      text: i18n.t('core.action.export', 'Export'),
      attrs: { type: 'button' }
    });
    exportButton.addEventListener('click', () => {
      const payload = JSON.stringify({ pattern: this.pattern, flags: this.flags, engine: 'javascript-regexp' }, null, 2);
      void navigator.clipboard.writeText(payload);
    });
    const applyButton = el('button', {
      className: 'md-btn md-btn--filled',
      text: i18n.t('core.action.apply', 'Apply'),
      attrs: { type: 'button' }
    });
    applyButton.addEventListener('click', () => {
      this.options.onApply(this.state());
      this.close();
    });
    actions.append(copyButton, exportButton, applyButton);

    host.append(
      engineNote,
      el('div', { className: 'md-field md-field--outlined', children: [patternLabel, patternInput] }),
      feedback,
      flagsFieldset,
      guided,
      literalRow,
      el('div', {
        className: 'md-field md-field--outlined',
        children: [
          el('label', { className: 'md-field__label', text: i18n.t('core.regex.sample', 'Sample text'), attrs: { for: sampleId } }),
          sampleArea
        ]
      }),
      results,
      actions
    );

    const insert = (snippet: string, caret?: number): void => {
      const start = patternInput.selectionStart ?? patternInput.value.length;
      const end = patternInput.selectionEnd ?? start;
      const before = patternInput.value.slice(0, start);
      const after = patternInput.value.slice(end);
      patternInput.value = `${before}${snippet}${after}`;
      const position = start + (caret ?? snippet.length);
      patternInput.setSelectionRange(position, position);
      patternInput.focus();
      this.pattern = patternInput.value;
      update();
    };

    const update = (): void => {
      this.pattern = patternInput.value;
      this.sample = sampleArea.value;
      const { regex, error } = compile(this.pattern, this.flags);
      feedback.classList.toggle('md-regex__feedback--error', error !== null);
      feedback.textContent = error
        ? i18n.t('core.regex.invalid', 'That pattern does not compile: {message}', { values: { message: error } })
        : '';
      results.textContent = '';
      if (!regex) return;

      const outcome = evaluate(regex, this.sample);
      if (outcome.timedOut) {
        results.append(
          el('p', {
            className: 'md-regex__feedback md-regex__feedback--error md-typescale-body-small',
            text: i18n.t('core.regex.timeBudget', 'Evaluation stopped after {ms} ms.', {
              values: { ms: TIME_BUDGET_MS }
            })
          })
        );
      }
      results.append(
        el('p', {
          className: 'md-typescale-label-large',
          text: `${i18n.t('core.regex.matches', 'Matches')}: ${outcome.matches.length}${outcome.truncated ? '+' : ''} (${outcome.elapsedMs} ms)`
        })
      );
      const list = el('ol', { className: 'md-regex__match-list' });
      for (const match of outcome.matches.slice(0, 50)) {
        const item = el('li', { className: 'md-regex__match' });
        item.append(el('code', { className: 'md-regex__match-text', text: match.text === '' ? '(zero-width)' : match.text }));
        item.append(el('span', { className: 'md-regex__match-index md-typescale-body-small', text: `@${match.index}` }));
        if (match.groups.length > 0) {
          const groups = el('ul', { className: 'md-regex__groups' });
          for (const group of match.groups) {
            groups.append(
              el('li', {
                className: 'md-typescale-body-small',
                text: `${group.name}: ${group.value === undefined ? '(no match)' : group.value}`
              })
            );
          }
          item.append(groups);
        }
        list.append(item);
      }
      results.append(list);
    };

    patternInput.addEventListener('input', update);
    sampleArea.addEventListener('input', update);
    update();
    window.requestAnimationFrame(() => patternInput.focus());
  }
}

export function createRegexBuilder(options: RegexBuilderOptions): RegexBuilderHandle {
  return new RegexBuilder(options);
}
