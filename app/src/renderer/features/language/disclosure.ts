import type { AppContext } from '../../core/registry';
import { el } from './dom';
import {
  TAB_ID,
  acknowledgeDisclosure,
  disclosureAcknowledgedAt,
  formatWhen
} from './state';

/**
 * The humour-level disclosure.
 *
 * The rule it satisfies is specific: a person must be told, before they opt into
 * a playful voice, that the level styles EVERY message including errors and
 * warnings, and that they can change or reset it at any time. So the disclosure
 * says exactly that, in both languages, and it is stated twice — once as a
 * notification at first run, and permanently on the language surface, where
 * somebody who dismissed the notification a year ago can still find it.
 *
 * It is a notification rather than a modal dialog because it informs; it does
 * not ask for a decision that must be made before anything else can happen. It
 * carries `timeoutMs: 0`, so it stays until it is dismissed rather than
 * vanishing while the user is reading it.
 */

export const DISCLOSURE_ELEMENT_ID = 'language-disclosure';

function disclosureTitle(ctx: AppContext): string {
  return ctx.t('language.disclosure.title', 'Before you move that slider');
}

function disclosureBody(ctx: AppContext): string {
  return ctx.t(
    'language.disclosure.body',
    'The humour level styles every message this application writes in that language, including errors, warnings and the confirmation before something is deleted. It never changes the content: at every level a message still names what happened, what it affects and what your options are. You can change or reset either level at any time.'
  );
}

/**
 * The permanent card.
 *
 * `mountedIn` names where the caller put it, so the acknowledgement history
 * entry records which surface the person was looking at.
 */
export function renderDisclosure(ctx: AppContext, mountedIn: string): HTMLElement {
  const card = ctx.components.card({ variant: 'outlined' });
  card.id = DISCLOSURE_ELEMENT_ID;
  card.classList.add('lang-disclosure');
  card.setAttribute('data-appearance-id', 'language:disclosure');

  const heading = el('h3', { className: 'md-typescale-title-medium', text: disclosureTitle(ctx) });
  const body = el('p', { className: 'md-typescale-body-medium', text: disclosureBody(ctx) });

  const status = el('p', {
    className: 'lang-disclosure__status md-typescale-body-small',
    attrs: { role: 'status' }
  });

  const actions = el('div', { className: 'lang-disclosure__actions' });

  const refresh = (): void => {
    const when = disclosureAcknowledgedAt(ctx);
    actions.textContent = '';
    if (when) {
      status.textContent = ctx.t(
        'language.disclosure.acknowledged',
        'You acknowledged this on {when}. It stays here so you can read it again.',
        { values: { when: formatWhen(when) } }
      );
      return;
    }
    status.textContent = ctx.t(
      'language.disclosure.pending',
      'Not acknowledged yet. Reading it changes nothing on its own.'
    );
    actions.append(
      ctx.components.button({
        label: ctx.t('language.disclosure.ack', 'I understand'),
        variant: 'tonal',
        onClick: () => {
          acknowledgeDisclosure(ctx);
          refresh();
          ctx.a11y.announce(
            ctx.t('language.disclosure.acknowledged', 'You acknowledged this on {when}.', {
              values: { when: formatWhen(disclosureAcknowledgedAt(ctx)) }
            })
          );
        }
      })
    );
  };

  refresh();
  card.append(heading, body, status, actions);

  const unsubscribe = ctx.settings.onChange((change) => {
    if (change.id === 'language.disclosure.acknowledgedAt') refresh();
  });
  card.addEventListener('md-dispose', () => unsubscribe());
  card.dataset.mountedIn = mountedIn;

  return card;
}

/**
 * Raises the first-run notification, once, and only when there is something to
 * disclose.
 *
 * While the study mode is on the humour levels behave as though they are not
 * installed, so disclosing them would be announcing a capability the person
 * cannot see. Nothing is raised and nothing is recorded.
 */
export function showFirstRunDisclosure(ctx: AppContext): void {
  if (ctx.i18n.schoolModeActive()) return;
  if (disclosureAcknowledgedAt(ctx)) return;

  const emoji = ctx.i18n.snapshot().emojiInDialogs;
  const handle = ctx.notify.show({
    // A message box is the one place a decorative emoji is allowed. The action
    // labels below never carry one.
    title: `${emoji ? 'ℹ️ ' : ''}${disclosureTitle(ctx)}`,
    body: disclosureBody(ctx),
    severity: 'info',
    // Zero means it waits for the reader rather than for a timer.
    timeoutMs: 0,
    source: 'language',
    actions: [
      {
        label: ctx.t('language.disclosure.read', 'Read it'),
        run: () => ctx.tabs.teleport(TAB_ID, DISCLOSURE_ELEMENT_ID)
      },
      {
        label: ctx.t('language.disclosure.ack', 'I understand'),
        run: () => {
          acknowledgeDisclosure(ctx);
          handle.dismiss();
        }
      }
    ]
  });
}

/** Opens the language surface at the disclosure, from a command or a setting. */
export function openDisclosure(ctx: AppContext): void {
  ctx.tabs.teleport(TAB_ID, DISCLOSURE_ELEMENT_ID);
  void ctx.history.record('Opened the humour-level disclosure', 'language', { target: DISCLOSURE_ELEMENT_ID });
}
