import { el, nextId } from '../../core/a11y';
import type { AppContext, OverlayHandle } from '../../core/registry';
import { isoDay } from './util';

/**
 * The advanced date-range control.
 *
 * Two rules shape the whole thing.
 *
 * Typing never destroys what was typed. A partial entry — somebody four
 * characters into a date — is reported as "keep going", an unreadable one as
 * "this cannot be read", and in both cases the characters stay exactly where the
 * user left them. Clearing a field under somebody mid-entry is the fastest way
 * to make a date control unusable.
 *
 * Typing and the calendar stay in step, in both directions. A date accepted from
 * the keyboard moves the calendar to that month and marks that day; a day picked
 * in the calendar rewrites the field it belongs to and leaves the other field
 * alone.
 */

export interface DateRangeValue {
  /** Inclusive `YYYY-MM-DD` lower bound, or null for "no lower bound". */
  start: string | null;
  /** Inclusive `YYYY-MM-DD` upper bound, or null for "no upper bound". */
  end: string | null;
}

export interface DateRangeHandle {
  root: HTMLElement;
  value(): DateRangeValue;
  set(value: DateRangeValue): void;
  clear(): void;
  focus(): void;
  destroy(): void;
}

export interface DateRangeOptions {
  /** i18n key for the group's accessible name. */
  label: string;
  id?: string;
  /** Earliest year the year jump offers. Defaults to thirty years back. */
  earliestYear?: number;
  onChange(value: DateRangeValue): void;
}

type ParseStatus = 'empty' | 'ok' | 'partial' | 'invalid';

interface ParseResult {
  day: string | null;
  status: ParseStatus;
}

const MONTH_KEYS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

/** Month names in the machine's own locale, falling back to English. */
function monthNames(): string[] {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'long' });
    return MONTH_KEYS.map((_unused, index) => formatter.format(new Date(2026, index, 1)));
  } catch {
    return MONTH_KEYS;
  }
}

/** Weekday initials, starting on the locale's own first day where known. */
function weekdayNames(): string[] {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    // 2026-02-01 is a Sunday, which anchors the array to index 0 = Sunday.
    return Array.from({ length: 7 }, (_unused, index) => formatter.format(new Date(2026, 1, 1 + index)));
  } catch {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }
}

/**
 * Whether this locale writes day, month or year first for a numeric date.
 *
 * Read from the platform rather than assumed, because a control that silently
 * reads 08/09 as the wrong month produces a filter that looks like it worked.
 */
export function localeOrder(): 'dmy' | 'mdy' | 'ymd' {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(2026, 7, 13))
      .filter((part) => part.type === 'day' || part.type === 'month' || part.type === 'year')
      .map((part) => part.type);
    if (parts[0] === 'year') return 'ymd';
    if (parts[0] === 'month') return 'mdy';
    return 'dmy';
  } catch {
    return 'ymd';
  }
}

/** An example in the order this machine actually writes dates. */
export function localeExample(order: 'dmy' | 'mdy' | 'ymd'): string {
  if (order === 'mdy') return '08/13/2026';
  if (order === 'dmy') return '13/08/2026';
  return '2026-08-13';
}

function realDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return isoDay(date);
}

/**
 * Parses one typed date.
 *
 * `partial` and `invalid` are deliberately different answers: the first means
 * "you are not finished", the second means "this cannot be read at all", and
 * telling somebody mid-entry that their input is wrong is its own small
 * annoyance.
 */
export function parseTypedDate(input: string, order: 'dmy' | 'mdy' | 'ymd'): ParseResult {
  const value = input.trim();
  if (value === '') return { day: null, status: 'empty' };

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) {
    const day = realDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return day ? { day, status: 'ok' } : { day: null, status: 'invalid' };
  }

  const numeric = value.split(/[/.\-\s]+/).filter((part) => part.length > 0);
  if (numeric.length > 0 && numeric.every((part) => /^\d+$/.test(part))) {
    if (numeric.length < 3) return { day: null, status: 'partial' };
    if (numeric.length > 3) return { day: null, status: 'invalid' };
    const [a, b, c] = numeric.map(Number);
    let year: number;
    let month: number;
    let dayOfMonth: number;
    if (order === 'ymd' || numeric[0].length === 4) {
      year = a;
      month = b;
      dayOfMonth = c;
    } else if (order === 'mdy') {
      month = a;
      dayOfMonth = b;
      year = c;
    } else {
      dayOfMonth = a;
      month = b;
      year = c;
    }
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const day = realDate(year, month, dayOfMonth);
    return day ? { day, status: 'ok' } : { day: null, status: 'invalid' };
  }

  // Anything with letters in it — "13 August 2026" — goes to the platform
  // parser, which knows the month names this machine uses.
  if (/[A-Za-z一-鿿]/.test(value)) {
    const probe = new Date(value);
    if (!Number.isNaN(probe.getTime())) return { day: isoDay(probe), status: 'ok' };
    return { day: null, status: 'partial' };
  }

  return { day: null, status: 'invalid' };
}

export function createDateRange(ctx: AppContext, options: DateRangeOptions): DateRangeHandle {
  const order = localeOrder();
  const example = localeExample(order);
  const months = monthNames();
  const weekdays = weekdayNames();
  const groupId = options.id ?? nextId('history-daterange');

  let start: string | null = null;
  let end: string | null = null;
  let calendar: OverlayHandle | null = null;
  let redrawCalendar: (() => void) | null = null;

  const root = el('div', {
    className: 'history-daterange',
    attrs: { role: 'group', 'aria-label': ctx.t(options.label, 'Date range'), id: groupId }
  });

  const buildField = (
    which: 'start' | 'end'
  ): { wrap: HTMLElement; input: HTMLInputElement; status: HTMLElement } => {
    const fieldId = `${groupId}-${which}`;
    const statusId = `${fieldId}-status`;
    const wrap = el('div', { className: 'history-daterange__field md-field md-field--outlined' });
    const labelKey = which === 'start' ? 'history.date.from' : 'history.date.to';
    wrap.append(
      el('label', {
        className: 'md-field__label',
        text: ctx.t(labelKey, which === 'start' ? 'From' : 'To'),
        attrs: { for: fieldId }
      })
    );
    const row = el('div', { className: 'md-field__row' });
    const input = el('input', {
      className: 'md-field__input',
      attrs: {
        id: fieldId,
        type: 'text',
        inputmode: 'numeric',
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: example,
        'aria-describedby': statusId
      }
    });
    row.append(input);
    wrap.append(row);
    const status = el('p', {
      className: 'md-field__support md-typescale-body-small',
      attrs: { id: statusId, role: 'status' }
    });
    wrap.append(status);
    return { wrap, input, status };
  };

  const startField = buildField('start');
  const endField = buildField('end');

  const hint = el('p', {
    className: 'history-daterange__hint md-typescale-body-small',
    text: ctx.t('history.date.hint', 'Type a date such as {example}, or open the calendar. Both stay in step.', {
      values: { example }
    })
  });

  const rangeWarning = el('p', {
    className: 'history-daterange__warning md-typescale-body-small',
    attrs: { role: 'status' }
  });
  rangeWarning.hidden = true;

  const openButton = ctx.components.iconButton({
    icon: 'calendar',
    label: ctx.t('history.date.open', 'Open the calendar'),
    onClick: () => openCalendar()
  });
  openButton.setAttribute('aria-haspopup', 'dialog');
  openButton.setAttribute('aria-expanded', 'false');

  const clearButton = ctx.components.button({
    label: 'history.date.clear',
    variant: 'text',
    onClick: () => {
      clear();
      ctx.a11y.announce(ctx.t('history.date.all', 'Every date'));
    }
  });

  const controls = el('div', { className: 'history-daterange__controls' });
  controls.append(startField.wrap, endField.wrap, openButton, clearButton);
  root.append(controls, hint, rangeWarning);

  const setStatus = (field: { status: HTMLElement }, text: string, error: boolean): void => {
    field.status.textContent = text;
    field.status.classList.toggle('md-field__support--error', error);
  };

  const checkOrder = (): void => {
    if (start && end && start > end) {
      rangeWarning.hidden = false;
      rangeWarning.textContent = ctx.t(
        'history.date.reversed',
        'The start is after the end, so nothing can fall between them.'
      );
    } else {
      rangeWarning.hidden = true;
      rangeWarning.textContent = '';
    }
  };

  const emit = (): void => {
    checkOrder();
    options.onChange({ start, end });
  };

  const syncFields = (): void => {
    startField.input.value = start ?? '';
    endField.input.value = end ?? '';
    setStatus(startField, '', false);
    setStatus(endField, '', false);
    checkOrder();
  };

  const wireField = (
    field: { input: HTMLInputElement; status: HTMLElement },
    which: 'start' | 'end'
  ): void => {
    const apply = (announce: boolean): void => {
      const parsed = parseTypedDate(field.input.value, order);
      if (parsed.status === 'partial') {
        setStatus(
          field,
          ctx.t('history.date.partial', 'Keep going — a full date looks like {example}. Nothing was cleared.', {
            values: { example }
          }),
          false
        );
        return;
      }
      if (parsed.status === 'invalid') {
        setStatus(
          field,
          ctx.t('history.date.invalid', 'That is not a date this can read. Try {example}. Nothing was cleared.', {
            values: { example }
          }),
          true
        );
        return;
      }
      setStatus(field, '', false);
      const next = parsed.status === 'empty' ? null : parsed.day;
      if (which === 'start') {
        if (next === start) return;
        start = next;
      } else {
        if (next === end) return;
        end = next;
      }
      // The calendar follows the keyboard rather than the other way round.
      redrawCalendar?.();
      emit();
      if (announce && next) ctx.a11y.announce(next);
    };

    field.input.addEventListener('input', () => apply(false));
    field.input.addEventListener('change', () => apply(true));
    field.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        apply(true);
      }
    });
  };

  wireField(startField, 'start');
  wireField(endField, 'end');

  /* ---------------- the anchored calendar ---------------- */

  function openCalendar(): void {
    if (calendar?.isOpen()) {
      calendar.close();
      return;
    }
    const handle = ctx.overlay.open({
      anchor: openButton,
      placement: 'bottom-start',
      role: 'dialog',
      label: ctx.t(options.label, 'Date range'),
      onClose: () => {
        openButton.setAttribute('aria-expanded', 'false');
        calendar = null;
        redrawCalendar = null;
        openButton.focus();
      }
    });
    calendar = handle;
    openButton.setAttribute('aria-expanded', 'true');
    handle.root.classList.add('history-calendar');

    const anchorDate = new Date(start ? `${start}T00:00:00` : Date.now());
    let cursorYear = anchorDate.getFullYear();
    let cursorMonth = anchorDate.getMonth();
    let focusedDay = start ?? isoDay(new Date());

    const header = el('div', { className: 'history-calendar__header' });
    const grid = el('div', { className: 'history-calendar__grid', attrs: { role: 'grid' } });
    const presets = el('div', { className: 'history-calendar__presets' });

    const thisYear = new Date().getFullYear();
    const firstYear = Math.min(options.earliestYear ?? thisYear - 30, thisYear - 1);
    const yearOptions = Array.from({ length: thisYear + 1 - firstYear + 1 }, (_unused, index) => {
      const year = firstYear + index;
      return { value: String(year), label: String(year) };
    });

    const monthSelect = ctx.components.select({
      label: 'history.date.month',
      options: months.map((name, index) => ({ value: String(index), label: name })),
      value: String(cursorMonth),
      onChange: (value) => {
        cursorMonth = Number(value);
        draw();
      }
    });

    const yearSelect = ctx.components.select({
      label: 'history.date.year',
      options: yearOptions,
      value: String(cursorYear),
      onChange: (value) => {
        cursorYear = Number(value);
        draw();
      }
    });

    const previousMonth = ctx.components.iconButton({
      icon: 'chevronLeft',
      label: ctx.t('history.date.month', 'Month'),
      onClick: () => {
        step(-1);
      }
    });
    const nextMonth = ctx.components.iconButton({
      icon: 'chevronRight',
      label: ctx.t('history.date.month', 'Month'),
      onClick: () => {
        step(1);
      }
    });

    const step = (delta: number): void => {
      const moved = new Date(cursorYear, cursorMonth + delta, 1);
      cursorYear = moved.getFullYear();
      cursorMonth = moved.getMonth();
      monthSelect.set(String(cursorMonth));
      yearSelect.set(String(cursorYear));
      draw();
    };

    header.append(previousMonth, monthSelect.root, yearSelect.root, nextMonth);

    const pick = (day: string): void => {
      if (!start || (start && end)) {
        start = day;
        end = null;
      } else if (day < start) {
        end = start;
        start = day;
      } else {
        end = day;
      }
      focusedDay = day;
      syncFields();
      emit();
      draw();
      ctx.a11y.announce(
        end
          ? `${ctx.t('history.date.from', 'From')} ${start} ${ctx.t('history.date.to', 'To')} ${end}`
          : `${ctx.t('history.date.from', 'From')} ${start ?? ''}`
      );
    };

    const moveFocus = (deltaDays: number, months_ = 0): void => {
      const base = new Date(`${focusedDay}T00:00:00`);
      const moved = new Date(base.getFullYear(), base.getMonth() + months_, base.getDate() + deltaDays);
      focusedDay = isoDay(moved);
      cursorYear = moved.getFullYear();
      cursorMonth = moved.getMonth();
      monthSelect.set(String(cursorMonth));
      yearSelect.set(String(cursorYear));
      draw();
      grid.querySelector<HTMLElement>(`[data-day="${focusedDay}"]`)?.focus();
    };

    const draw = (): void => {
      grid.textContent = '';
      for (const name of weekdays) {
        grid.append(
          el('span', {
            className: 'history-calendar__weekday md-typescale-label-small',
            text: name.slice(0, 3),
            attrs: { role: 'columnheader' }
          })
        );
      }
      const offset = new Date(cursorYear, cursorMonth, 1).getDay();
      for (let blank = 0; blank < offset; blank += 1) {
        grid.append(el('span', { className: 'history-calendar__blank', attrs: { role: 'gridcell' } }));
      }
      const days = new Date(cursorYear, cursorMonth + 1, 0).getDate();
      for (let day = 1; day <= days; day += 1) {
        const iso = isoDay(new Date(cursorYear, cursorMonth, day));
        const isStart = iso === start;
        const isEnd = iso === end;
        const inRange = Boolean(start && end && iso > start && iso < end);
        const cell = el('button', {
          className: `history-calendar__day${isStart || isEnd ? ' history-calendar__day--edge' : ''}${
            inRange ? ' history-calendar__day--between' : ''
          }`,
          text: String(day),
          attrs: {
            type: 'button',
            role: 'gridcell',
            'data-day': iso,
            'aria-label': iso,
            'aria-selected': String(isStart || isEnd),
            tabindex: iso === focusedDay ? '0' : '-1'
          }
        });
        cell.addEventListener('click', () => pick(iso));
        grid.append(cell);
      }
      handle.reposition();
    };

    grid.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          moveFocus(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveFocus(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveFocus(-7);
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveFocus(7);
          break;
        case 'PageUp':
          event.preventDefault();
          moveFocus(0, -1);
          break;
        case 'PageDown':
          event.preventDefault();
          moveFocus(0, 1);
          break;
        case 'Home':
          event.preventDefault();
          moveFocus(-new Date(`${focusedDay}T00:00:00`).getDay());
          break;
        case 'End':
          event.preventDefault();
          moveFocus(6 - new Date(`${focusedDay}T00:00:00`).getDay());
          break;
        default:
          break;
      }
    });

    const applyPreset = (from: Date | null, to: Date | null): void => {
      start = from ? isoDay(from) : null;
      end = to ? isoDay(to) : null;
      focusedDay = start ?? isoDay(new Date());
      if (start) {
        const parsed = new Date(`${start}T00:00:00`);
        cursorYear = parsed.getFullYear();
        cursorMonth = parsed.getMonth();
        monthSelect.set(String(cursorMonth));
        yearSelect.set(String(cursorYear));
      }
      syncFields();
      emit();
      draw();
    };

    const today = new Date();
    const presetList: Array<{ key: string; fallback: string; run: () => void }> = [
      {
        key: 'history.date.today',
        fallback: 'Today',
        run: () => applyPreset(today, today)
      },
      {
        key: 'history.date.last7',
        fallback: 'Last 7 days',
        run: () => applyPreset(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), today)
      },
      {
        key: 'history.date.last30',
        fallback: 'Last 30 days',
        run: () => applyPreset(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29), today)
      },
      {
        key: 'history.date.last90',
        fallback: 'Last 90 days',
        run: () => applyPreset(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89), today)
      },
      {
        key: 'history.date.thisMonth',
        fallback: 'This month',
        run: () =>
          applyPreset(new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0))
      },
      {
        key: 'history.date.lastMonth',
        fallback: 'Last month',
        run: () =>
          applyPreset(
            new Date(today.getFullYear(), today.getMonth() - 1, 1),
            new Date(today.getFullYear(), today.getMonth(), 0)
          )
      },
      {
        key: 'history.date.thisYear',
        fallback: 'This year',
        run: () => applyPreset(new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31))
      },
      {
        key: 'history.date.all',
        fallback: 'Every date',
        run: () => applyPreset(null, null)
      }
    ];

    presets.append(
      el('h3', {
        className: 'history-calendar__presets-title md-typescale-label-large',
        text: ctx.t('history.date.presets', 'Quick ranges')
      })
    );
    for (const preset of presetList) {
      presets.append(
        ctx.components.button({
          label: ctx.t(preset.key, preset.fallback),
          variant: 'text',
          onClick: preset.run
        })
      );
    }

    const layout = el('div', { className: 'history-calendar__layout' });
    const left = el('div', { className: 'history-calendar__month' });
    left.append(header, grid);
    layout.append(left, presets);
    handle.body.append(layout);

    redrawCalendar = draw;
    draw();
    window.requestAnimationFrame(() => {
      grid.querySelector<HTMLElement>(`[data-day="${focusedDay}"]`)?.focus();
      handle.reposition();
    });
  }

  function clear(): void {
    if (start === null && end === null) return;
    start = null;
    end = null;
    syncFields();
    redrawCalendar?.();
    emit();
  }

  return {
    root,
    value: () => ({ start, end }),
    set: (value) => {
      start = value.start;
      end = value.end;
      syncFields();
      redrawCalendar?.();
      options.onChange({ start, end });
    },
    clear,
    focus: () => startField.input.focus(),
    destroy: () => {
      calendar?.close();
      root.remove();
    }
  };
}
