import { a11y, el, nextId } from './a11y';
import { i18n } from './i18n';
import { settings } from './settings';
import { iconElement } from './icons';

/**
 * Collapsible filter rows and statistics panels.
 *
 * A panel that merely DESCRIBES the collection — a read-only statistics
 * summary, a recap of the filters already applied — starts collapsed by
 * default, per the contract; a panel that actively narrows the collection
 * (a live filter row) starts expanded, because collapsing it by default
 * would hide the very control someone needs to find their data. Either way
 * the choice is remembered per panel across restarts, is a real keyboard-
 * operable disclosure with a visible focus ring, and announces its new state
 * to assistive technology rather than only changing visually.
 *
 * The rule that matters most: a collapsed row must never silently exclude
 * results without saying so. When `isActive` reports that a filter inside a
 * collapsed panel is currently narrowing the results, the header carries a
 * visible, honest badge naming that fact instead of leaving the user to
 * wonder why a list looks short.
 */

export interface CollapsibleOptions {
  /** Persistence key. The same key remembers the same state across restarts. */
  key: string;
  /** i18n key used as the header text and the accessible name of the toggle. */
  label: string;
  /**
   * True for a panel that only describes the collection rather than changes
   * it -- these start collapsed. A panel that actively filters starts
   * expanded.
   */
  descriptive: boolean;
  /** Builds the panel body into `host`. Called once; the toggle only shows or hides it. */
  render(host: HTMLElement): void;
  /** True while something inside this panel is actively narrowing the results. */
  isActive?(): boolean;
}

export interface CollapsibleHandle {
  root: HTMLElement;
  expanded(): boolean;
  setExpanded(value: boolean): void;
  /** Re-reads `isActive()` and updates the "filter active" badge. Call after the filter changes. */
  refreshActiveBadge(): void;
}

function storageKey(key: string): string {
  return `ui.collapse.${key}`;
}

export function createCollapsiblePanel(options: CollapsibleOptions): CollapsibleHandle {
  const stored = settings.get<boolean | null>(storageKey(options.key), null);
  let expanded = stored !== null ? stored : !options.descriptive;

  const bodyId = nextId('md-collapse-body');
  const root = el('section', { className: 'md-collapsible' });

  const header = el('button', {
    className: 'md-collapsible__header',
    attrs: {
      type: 'button',
      'aria-expanded': String(expanded),
      'aria-controls': bodyId
    }
  });
  const chevron = iconElement(expanded ? 'chevronUp' : 'chevronDown', 18);
  const headerLabel = el('span', {
    className: 'md-typescale-title-small md-collapsible__label',
    text: i18n.t(options.label, options.label)
  });
  const badge = el('span', {
    className: 'md-collapsible__badge md-typescale-label-small',
    text: i18n.t('core.collapse.filterActive', 'Filter active')
  });
  badge.hidden = true;
  header.append(chevron, headerLabel, badge);

  const body = el('div', {
    className: 'md-collapsible__body',
    attrs: { id: bodyId, role: 'region' }
  });
  body.hidden = !expanded;
  options.render(body);

  function paint(): void {
    header.setAttribute('aria-expanded', String(expanded));
    body.hidden = !expanded;
    chevron.replaceWith(iconElement(expanded ? 'chevronUp' : 'chevronDown', 18));
  }

  function setExpanded(value: boolean): void {
    if (expanded === value) return;
    expanded = value;
    paint();
    settings.set(storageKey(options.key), value);
    a11y.announce(
      value
        ? i18n.t('core.collapse.expanded', '{name} expanded', { values: { name: i18n.t(options.label, options.label) } })
        : i18n.t('core.collapse.collapsed', '{name} collapsed', { values: { name: i18n.t(options.label, options.label) } })
    );
  }

  header.addEventListener('click', () => setExpanded(!expanded));

  function refreshActiveBadge(): void {
    const active = options.isActive?.() ?? false;
    // The badge is what keeps a collapsed panel honest: it is shown whenever
    // a filter inside it is narrowing the results, regardless of whether the
    // panel itself is currently expanded or collapsed.
    badge.hidden = !active;
  }
  refreshActiveBadge();

  root.append(header, body);

  return {
    root,
    expanded: () => expanded,
    setExpanded,
    refreshActiveBadge
  };
}
