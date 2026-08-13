import { el } from '../../core/a11y';
import { components } from '../../core/components';
import { i18n } from '../../core/i18n';
import { renderMarkdown } from '../../core/markdown';

import { resolveShortcodes } from './emoji';

/**
 * The one place provider-authored text is turned into readable prose.
 *
 * "Provider-authored" means text this application did not write: a documentation
 * article, release notes, an issue body, a commit message, a README preview.
 * Printed into a paragraph, Markdown shows its own source — headings as literal
 * hashes, links as brackets, lists as dashes. Every character is there and none
 * of it is readable.
 *
 * The parsing and DOM construction belong to `core/markdown.ts`, which is the
 * single shared, isolated renderer: it builds nodes directly and never assigns
 * to `innerHTML`, so nothing in the source text can inject markup or run a
 * script, and remote-authored markup is never rendered with this application's
 * own privileges. This module wraps that renderer with the four things a display
 * surface needs around it and which the parser itself has no business knowing:
 *
 *   1. an emoji map, so `:warning:` resolves rather than reading as noise;
 *   2. a base reference, so a relative link points somewhere real instead of
 *      dead-ending;
 *   3. an accessible label naming the rendered region, so a screen reader
 *      announces what it has arrived in;
 *   4. an honest empty state — "no notes were provided" — rather than an empty
 *      renderer, which reads as a loading failure the reader waits out.
 *
 * Every surface that shows text from elsewhere should call this rather than
 * calling the renderer directly, so all four behave the same everywhere.
 */

export interface ProviderTextOptions {
  /**
   * Accessible name for the rendered region. An i18n key or a literal; defaults
   * to a generic name rather than leaving the region unlabelled.
   */
  label?: string;
  /**
   * Resolves a relative link the way this surface understands it. A
   * documentation browser opens the linked article; a release-notes panel might
   * open a file. Return true when the target was handled.
   */
  onRelativeLink?(target: string): boolean;
  /**
   * Absolute base for relative links this surface cannot handle itself, e.g.
   * `https://example.invalid/repository/blob/main/`. A relative link is joined
   * onto it and handed to the operating system's browser. Without a base, an
   * unhandled relative link is reported rather than quietly doing nothing.
   */
  baseUrl?: string;
  /** Copy shown when `source` is empty or whitespace. An i18n key or literal. */
  emptyLabel?: string;
  /** Called for a link that could not be resolved anywhere, with its target. */
  onUnresolvedLink?(target: string): void;
  /** Turns off shortcode resolution, for a surface showing text verbatim. */
  resolveEmoji?: boolean;
}

/**
 * Renders provider-authored Markdown into a labelled region element.
 *
 * The return value is always a real element with real content — an article, or
 * an honest empty state. It is never an empty container.
 */
export function renderProviderText(source: string, options: ProviderTextOptions = {}): HTMLElement {
  const region = el('div', {
    className: 'docs-browser-prose',
    attrs: {
      role: 'region',
      'aria-label': i18n.t(
        options.label ?? 'docs-browser.markdown.region',
        options.label ?? 'Rendered text'
      )
    }
  });

  const text = typeof source === 'string' ? source : '';
  if (text.trim() === '') {
    region.append(
      components.emptyState({
        title: options.emptyLabel ?? 'docs-browser.markdown.empty'
      })
    );
    return region;
  }

  const prepared = options.resolveEmoji === false ? text : resolveShortcodes(text);

  region.append(
    renderMarkdown(prepared, {
      onInternalLink: (target) => {
        if (options.onRelativeLink?.(target) === true) return;
        const absolute = joinBase(options.baseUrl, target);
        if (absolute) {
          void window.studio.shell.openExternal(absolute);
          return;
        }
        options.onUnresolvedLink?.(target);
      }
    })
  );

  return region;
}

/**
 * Joins a relative target onto an absolute base, or returns null.
 *
 * Only http(s) is produced, because that is the only thing the privileged shell
 * bridge will open. A base that is not http(s), a target that already names its
 * own scheme, or anything the URL parser refuses, all return null so the caller
 * reports the link honestly instead of opening something unexpected.
 */
export function joinBase(baseUrl: string | undefined, target: string): string | null {
  if (!baseUrl || typeof target !== 'string' || target === '') return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  try {
    const resolved = new URL(target, baseUrl);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : null;
  } catch {
    return null;
  }
}
