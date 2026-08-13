import { a11y, el } from './a11y';
import { components } from './components';
import { i18n } from './i18n';
import { overlay } from './overlay';
import type { ConfirmRequest, ConfirmService } from './types';

/**
 * The destructive-action gate.
 *
 * It is deliberately theatrical and deliberately unambiguous at the same time.
 * Two keys turn independently, and only once both are turned does the
 * confirmation slider become operable; driving that slider to its end is what
 * performs the action. An emergency exit is always available, Escape and the
 * back gesture both cancel, and focus returns to the control that opened it.
 *
 * The humour setting styles the copy around it. What never changes is the list
 * of exactly what will be affected and the sentence naming what cannot be
 * undone, because a warning nobody can act on is a broken warning however funny
 * it is.
 *
 * It anchors beside the originating control. A modal is used only when the
 * viewport genuinely cannot host an anchored surface.
 */

const NARROW_VIEWPORT = 720;

class ConfirmImpl implements ConfirmService {
  request(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const modal = window.innerWidth < NARROW_VIEWPORT;
      const handle = overlay.open({
        anchor: request.anchor,
        placement: 'bottom-start',
        role: 'dialog',
        label: i18n.t('core.confirm.title', 'Confirm: {action}', {
          values: { action: request.action },
          dialog: true
        }),
        lightDismiss: false,
        onClose: () => {
          if (!settled) {
            settled = true;
            a11y.announce(i18n.t('core.confirm.cancelled', 'Cancelled. Nothing was changed.'));
            resolve(false);
          }
        }
      });
      handle.root.classList.add('md-confirm');
      if (modal) handle.root.classList.add('md-confirm--modal');

      let settled = false;
      const finish = (result: boolean): void => {
        if (settled) return;
        settled = true;
        resolve(result);
        handle.close();
      };

      const body = handle.body;

      body.append(
        el('h2', {
          className: 'md-typescale-title-large',
          text: i18n.t('core.confirm.title', 'Confirm: {action}', {
            values: { action: request.action },
            dialog: true
          })
        })
      );

      const facts = el('div', { className: 'md-confirm__facts' });
      facts.append(
        el('h3', { className: 'md-typescale-title-small', text: i18n.t('core.confirm.affected', 'What this affects') })
      );
      const affected = el('ul', { className: 'md-confirm__list' });
      for (const item of request.affected) {
        affected.append(el('li', { className: 'md-typescale-body-medium', text: item }));
      }
      if (request.affected.length === 0) {
        affected.append(el('li', { className: 'md-typescale-body-medium', text: request.action }));
      }
      facts.append(affected);
      facts.append(
        el('h3', {
          className: 'md-typescale-title-small',
          text: i18n.t('core.confirm.irreversible', 'What cannot be undone')
        })
      );
      facts.append(el('p', { className: 'md-typescale-body-medium', text: request.irreversible }));
      body.append(facts);

      /* --- the two keys, operated independently --- */
      const keysRow = el('div', { className: 'md-confirm__keys' });
      const keyState = { a: false, b: false };

      const makeKey = (which: 'a' | 'b', labelKey: string): HTMLButtonElement => {
        const node = el('button', {
          className: 'md-confirm__key',
          attrs: { type: 'button', 'aria-pressed': 'false' }
        });
        node.append(el('span', { className: 'md-confirm__keyglyph', attrs: { 'aria-hidden': 'true' }, text: '🗝' }));
        node.append(el('span', { className: 'md-typescale-label-large', text: i18n.t(labelKey, labelKey) }));
        node.append(
          el('span', { className: 'md-typescale-body-small', text: i18n.t('core.confirm.turnKey', 'Turn') })
        );
        node.addEventListener('click', () => {
          keyState[which] = !keyState[which];
          node.setAttribute('aria-pressed', String(keyState[which]));
          syncSlider();
        });
        return node;
      };

      const keyA = makeKey('a', 'core.confirm.keyA');
      const keyB = makeKey('b', 'core.confirm.keyB');
      keysRow.append(keyA, keyB);
      body.append(keysRow);

      /* --- the slider --- */
      const sliderWrap = el('div', { className: 'md-confirm__slider' });
      const sliderLabel = el('label', {
        className: 'md-field__label',
        text: i18n.t('core.confirm.sliderLocked', 'Turn both keys first')
      });
      const slider = el('input', {
        attrs: { type: 'range', min: '0', max: '100', value: '0', 'aria-label': i18n.t('core.confirm.slider', 'Slide all the way to confirm') }
      });
      slider.disabled = true;
      const charge = el('div', { className: 'md-confirm__charge' });
      const chargeFill = el('div', { className: 'md-confirm__charge-fill' });
      charge.append(chargeFill);
      sliderWrap.append(sliderLabel, slider, charge);
      body.append(sliderWrap);

      const syncSlider = (): void => {
        const unlocked = keyState.a && keyState.b;
        slider.disabled = !unlocked;
        sliderLabel.textContent = unlocked
          ? i18n.t('core.confirm.slider', 'Slide all the way to confirm')
          : i18n.t('core.confirm.sliderLocked', 'Turn both keys first');
        if (!unlocked) {
          slider.value = '0';
          chargeFill.style.inlineSize = '0%';
        }
      };

      const reduced = a11y.reducedMotion();
      slider.addEventListener('input', () => {
        const value = Number(slider.value);
        // The progress animation is decoration and never blocks: the value it
        // shows is the slider's real position, not a fabricated countdown.
        chargeFill.style.inlineSize = `${value}%`;
        if (!reduced) chargeFill.style.filter = `saturate(${1 + value / 60})`;
        if (value >= 100) complete();
      });
      slider.addEventListener('change', () => {
        if (Number(slider.value) < 100) {
          slider.value = '0';
          chargeFill.style.inlineSize = '0%';
        }
      });

      const complete = (): void => {
        if (settled) return;
        slider.disabled = true;
        const done = el('div', { className: 'md-confirm__done' });
        done.append(el('span', { className: 'md-typescale-display-small', attrs: { 'aria-hidden': 'true' }, text: '✔' }));
        done.append(
          el('p', {
            className: 'md-typescale-title-medium',
            text: i18n.t('core.confirm.done', 'Done', { dialog: true })
          })
        );
        body.textContent = '';
        body.append(done);
        a11y.announce(i18n.t('core.confirm.done', 'Done'), true);
        window.setTimeout(() => finish(true), reduced ? 0 : 650);
      };

      /* --- always-available exit --- */
      const actions = el('div', { className: 'md-confirm__actions' });
      actions.append(
        components.button({
          label: 'core.confirm.emergency',
          variant: 'outlined',
          icon: 'close',
          onClick: () => finish(false)
        }),
        components.button({
          label: 'core.action.cancel',
          variant: 'text',
          onClick: () => finish(false)
        })
      );
      body.append(actions);

      const release = a11y.trapFocus(handle.root);
      handle.root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          finish(false);
        }
      });
      window.addEventListener('popstate', () => finish(false), { once: true });

      window.requestAnimationFrame(() => {
        keyA.focus();
        handle.reposition();
      });

      const originalClose = handle.close.bind(handle);
      handle.close = (): void => {
        release();
        originalClose();
      };
    });
  }
}

export const confirmService = new ConfirmImpl();
