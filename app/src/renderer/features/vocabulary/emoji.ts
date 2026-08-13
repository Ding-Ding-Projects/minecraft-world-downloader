import type { AppContext } from '../../core/registry';

/**
 * One decorative emoji for dialog and message-box copy, and nowhere else.
 *
 * The rule this exists to keep: emoji decorate a dialog or a message box when
 * the user has that switch on, and never appear in a button, an action label, a
 * field label or an accessible name. Routing every decorated string through one
 * function makes the rule checkable — the call sites are the complete list of
 * places this feature decorates.
 *
 * The named study mode suppresses it along with the rest of the playful
 * capabilities, exactly as the shared language layer does for its own copy.
 */
export function dialogDecoration(ctx: AppContext, text: string, emoji: string): string {
  const snapshot = ctx.i18n.snapshot();
  if (snapshot.schoolMode) return text;
  if (!snapshot.emojiInDialogs) return text;
  return `${emoji} ${text}`;
}
