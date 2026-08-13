import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';

/**
 * The one plain line that sits outside the comedy.
 *
 * Everything else on this surface is styled by the humour level. This is not,
 * and deliberately so: it is the sentence that stops somebody sitting there
 * waiting for a reply that was never coming. It therefore does not go through
 * the funny ladder at all — it is written once per language, exactly, and read
 * back exactly, at every level from 1 to 5.
 *
 * It still honours the LANGUAGE mode, because a person reading the application
 * in Cantonese needs this sentence more than any other, not less. In bilingual
 * mode both halves are rendered, one under the other, so neither is compressed
 * into a footnote.
 *
 * Do not route this through `t()`. A key with a five-rung ladder is exactly the
 * thing this must not become.
 */

const DISCLOSURE_EN =
  'Nothing here is sent anywhere. No ticket exists outside this computer, no network request is made, no data is collected, and nobody is reading it. This is the application talking to itself, and no reply is coming.';

const DISCLOSURE_YUE =
  '呢度嘅嘢一律唔會寄去任何地方。除咗呢部電腦，其他地方都冇呢張單；唔會發任何網絡請求，唔會收集任何資料，亦都冇人喺度睇。呢個係程式自己同自己講嘢，唔會有人覆你。';

/**
 * Builds the disclosure block.
 *
 * `role="note"` rather than `alert`: it is permanent context, not an event, and
 * an assertive announcement on every render would be read over whatever the user
 * was actually doing.
 */
export function buildDisclosure(ctx: AppContext): HTMLElement {
  const mode = ctx.i18n.snapshot().mode;
  const root = el('div', {
    className: 'md-card md-card--outlined',
    attrs: {
      role: 'note',
      'data-appearance-id': 'supportTickets:disclosure',
      'data-support-tickets-disclosure': 'true'
    }
  });
  root.style.borderWidth = '2px';

  const lines: Array<{ text: string; lang: string }> = [];
  if (mode === 'en' || mode === 'both') lines.push({ text: DISCLOSURE_EN, lang: 'en' });
  if (mode === 'yue' || mode === 'both') lines.push({ text: DISCLOSURE_YUE, lang: 'zh-HK' });

  for (const line of lines) {
    const paragraph = el('p', {
      className: 'md-typescale-body-medium',
      text: line.text,
      attrs: { lang: line.lang }
    });
    paragraph.style.fontWeight = '600';
    paragraph.style.margin = '0 0 var(--md-sys-spacing-2, 8px)';
    root.append(paragraph);
  }
  const last = root.lastElementChild as HTMLElement | null;
  if (last) last.style.marginBottom = '0';

  return root;
}

/** The plain text, for an export header or a copied summary. */
export function disclosureText(ctx: AppContext): string {
  const mode = ctx.i18n.snapshot().mode;
  if (mode === 'yue') return DISCLOSURE_YUE;
  if (mode === 'both') return `${DISCLOSURE_EN}\n${DISCLOSURE_YUE}`;
  return DISCLOSURE_EN;
}
