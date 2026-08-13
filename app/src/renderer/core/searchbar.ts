import { el, nextId } from './a11y';
import { i18n } from './i18n';
import { compile, createRegexBuilder, escapeLiteral } from './regexbuilder';
import type { RegexBuilderHandle, SearchBarHandle, SearchBarOptions, SearchQuery } from './types';

/**
 * The search field every list, menu, dropdown, settings surface and tab strip
 * carries.
 *
 * Plain text is the default and regular expressions are an explicit opt-in, but
 * the BUILDER is never optional: the affordance sits inside the field it belongs
 * to, and its popover stays visually attached to that exact field. Each instance
 * owns its own query, pattern, flags and mode — there is no shared builder that
 * silently applies to whichever field was last touched.
 */

function plainPredicate(text: string): (value: string) => boolean {
  const needle = text.trim().toLowerCase();
  if (needle === '') return () => true;
  return (value: string) => value.toLowerCase().includes(needle);
}

function buildQuery(text: string, regexOn: boolean, pattern: string, flags: string): SearchQuery {
  if (!regexOn) {
    const matches = plainPredicate(text);
    return { text, regex: false, pattern: escapeLiteral(text), flags, matches, compiled: null, error: null };
  }
  const { regex, error } = compile(pattern, flags.includes('g') ? flags.replace(/g/g, '') : flags);
  if (!regex) {
    // An invalid pattern must not silently hide every row: it matches nothing
    // and the field says why, which is the honest empty state.
    return {
      text,
      regex: true,
      pattern,
      flags,
      matches: () => false,
      compiled: null,
      error: error ?? (pattern === '' ? null : 'The pattern is empty.')
    };
  }
  return {
    text,
    regex: true,
    pattern,
    flags,
    matches: (value: string) => {
      regex.lastIndex = 0;
      return regex.test(value);
    },
    compiled: regex,
    error: null
  };
}

export function createSearchBar(options: SearchBarOptions): SearchBarHandle {
  const id = nextId('md-search');
  const root = el('div', {
    className: `md-search ${options.compact ? 'md-search--compact' : ''}`.trim(),
    attrs: { role: 'search' }
  });

  const label = el('label', {
    className: 'md-search__label md-typescale-label-medium',
    text: i18n.t(options.label, options.label),
    attrs: { for: id }
  });
  if (options.compact) label.classList.add('md-visually-hidden');

  const field = el('div', { className: 'md-search__field' });
  const leading = el('span', { className: 'md-search__icon', attrs: { 'aria-hidden': 'true' }, text: '⌕' });
  const input = el('input', {
    className: 'md-search__input',
    attrs: {
      id,
      type: 'search',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: options.placeholder
        ? i18n.t(options.placeholder, options.placeholder)
        : i18n.t('core.search.placeholder', 'Search…'),
      'aria-label': i18n.t(options.label, options.label)
    }
  });
  input.value = options.initialText ?? '';

  const regexToggle = el('button', {
    className: 'md-search__toggle',
    text: '.*',
    attrs: {
      type: 'button',
      'aria-pressed': 'false',
      title: i18n.t('core.search.regexToggle', 'Use a regular expression'),
      'aria-label': i18n.t('core.search.regexToggle', 'Use a regular expression')
    }
  });

  const builderButton = el('button', {
    className: 'md-search__builder',
    text: '⚙',
    attrs: {
      type: 'button',
      title: i18n.t('core.search.builder', 'Open the pattern builder'),
      'aria-label': i18n.t('core.search.builder', 'Open the pattern builder'),
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false'
    }
  });

  const status = el('p', { className: 'md-search__status md-typescale-body-small', attrs: { role: 'status' } });

  field.append(leading, input, regexToggle, builderButton);
  root.append(label, field, status);

  let regexOn = false;
  let pattern = '';
  let flags = 'i';

  const emit = (): void => {
    const query = buildQuery(input.value, regexOn, pattern, flags);
    status.textContent = query.error ?? '';
    status.classList.toggle('md-search__status--error', Boolean(query.error));
    options.onChange(query);
  };

  input.addEventListener('input', () => {
    if (regexOn) pattern = input.value;
    emit();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (input.value !== '') {
        event.stopPropagation();
        input.value = '';
        if (regexOn) pattern = '';
        emit();
      } else {
        options.onEscape?.();
      }
    }
  });

  regexToggle.addEventListener('click', () => {
    regexOn = !regexOn;
    regexToggle.setAttribute('aria-pressed', String(regexOn));
    regexToggle.classList.toggle('md-search__toggle--on', regexOn);
    if (regexOn && pattern === '') pattern = escapeLiteral(input.value);
    if (regexOn) input.value = pattern;
    emit();
  });

  let builder: RegexBuilderHandle | null = null;
  builderButton.addEventListener('click', () => {
    if (!builder) {
      builder = createRegexBuilder({
        anchor: builderButton,
        initialPattern: regexOn ? pattern : escapeLiteral(input.value),
        initialFlags: flags,
        sample: options.sample ?? '',
        onApply: (state) => {
          pattern = state.pattern;
          flags = state.flags;
          regexOn = true;
          regexToggle.setAttribute('aria-pressed', 'true');
          regexToggle.classList.add('md-search__toggle--on');
          input.value = pattern;
          emit();
          input.focus();
        },
        onClose: () => {
          builderButton.setAttribute('aria-expanded', 'false');
          builder = null;
        }
      });
    }
    builderButton.setAttribute('aria-expanded', 'true');
    builder.open();
  });

  return {
    root,
    input,
    query: () => buildQuery(input.value, regexOn, pattern, flags),
    setText: (text: string) => {
      input.value = text;
      if (regexOn) pattern = text;
      emit();
    },
    clear: () => {
      input.value = '';
      pattern = '';
      emit();
    },
    focus: () => input.focus(),
    destroy: () => {
      builder?.close();
      root.remove();
    }
  };
}
