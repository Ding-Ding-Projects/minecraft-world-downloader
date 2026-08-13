import { el } from './a11y';

/**
 * The one shared Markdown renderer.
 *
 * Text authored elsewhere — a documentation article, release notes, a commit
 * message — is rendered as the markup it actually is. Printing Markdown into a
 * paragraph shows the source: headings as literal hashes, links as brackets,
 * lists as dashes. Every character is there and none of it is readable.
 *
 * It builds DOM nodes directly and never assigns to `innerHTML`, so nothing in
 * the source text can inject markup or script. Links are rendered as buttons
 * that hand an http(s) URL to the operating system's browser; a link to any
 * other scheme renders as plain text with its target visible.
 */

interface RenderOptions {
  /** Resolves a relative `[text](id)` link to an in-application action. */
  onInternalLink?(target: string): void;
}

export function renderMarkdown(source: string, options: RenderOptions = {}): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    // Fenced code
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      const pre = el('pre');
      const code = el('code', { text: body.join('\n') });
      if (language) code.setAttribute('data-language', language);
      pre.append(code);
      fragment.append(pre);
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const node = el(`h${Math.min(6, level + 1)}` as keyof HTMLElementTagNameMap);
      node.className = level === 1 ? 'md-typescale-headline-medium' : 'md-typescale-title-large';
      appendInline(node, heading[2], options);
      fragment.append(node);
      index += 1;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      fragment.append(el('hr', { className: 'md-divider' }));
      index += 1;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const body: string[] = [];
      while (index < lines.length && lines[index].startsWith('> ')) {
        body.push(lines[index].slice(2));
        index += 1;
      }
      const quote = el('blockquote');
      appendInline(quote, body.join(' '), options);
      fragment.append(quote);
      continue;
    }

    // Lists
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const listNode = el(ordered ? 'ol' : 'ul');
      while (index < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[index])) {
        const item = el('li');
        appendInline(item, lines[index].replace(/^\s*([-*+]|\d+\.)\s+/, ''), options);
        listNode.append(item);
        index += 1;
      }
      fragment.append(listNode);
      continue;
    }

    // Table
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[index + 1])) {
      const table = el('table', { className: 'md-table' });
      const head = el('thead');
      const headRow = el('tr');
      for (const cell of splitRow(line)) {
        const th = el('th');
        appendInline(th, cell, options);
        headRow.append(th);
      }
      head.append(headRow);
      table.append(head);
      index += 2;
      const body = el('tbody');
      while (index < lines.length && lines[index].includes('|')) {
        const bodyRow = el('tr');
        for (const cell of splitRow(lines[index])) {
          const td = el('td');
          appendInline(td, cell, options);
          bodyRow.append(td);
        }
        body.append(bodyRow);
        index += 1;
      }
      table.append(body);
      const wrap = el('div', { className: 'md-table-wrap' });
      wrap.append(table);
      fragment.append(wrap);
      continue;
    }

    // Paragraph
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() !== '' && !/^(#{1,6}\s|```|>\s|\s*([-*+]|\d+\.)\s)/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    const node = el('p', { className: 'md-typescale-body-large' });
    appendInline(node, paragraph.join(' '), options);
    fragment.append(node);
  }

  return fragment;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/g;

function appendInline(host: HTMLElement, text: string, options: RenderOptions): void {
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) host.append(document.createTextNode(text.slice(lastIndex, start)));
    const token = match[0];
    if (token.startsWith('`')) {
      host.append(el('code', { text: token.slice(1, -1) }));
    } else if (token.startsWith('**')) {
      host.append(el('strong', { text: token.slice(2, -2) }));
    } else if (token.startsWith('~~')) {
      host.append(el('del', { text: token.slice(2, -2) }));
    } else if (token.startsWith('*') || token.startsWith('_')) {
      host.append(el('em', { text: token.slice(1, -1) }));
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) host.append(buildLink(link[1], link[2], options));
      else host.append(document.createTextNode(token));
    }
    lastIndex = start + token.length;
  }
  if (lastIndex < text.length) host.append(document.createTextNode(text.slice(lastIndex)));
}

function buildLink(text: string, target: string, options: RenderOptions): HTMLElement {
  if (/^https?:\/\//i.test(target)) {
    const node = el('button', { className: 'md-btn md-btn--text', text, attrs: { type: 'button' } });
    node.addEventListener('click', () => void window.studio.shell.openExternal(target));
    node.title = target;
    return node;
  }
  if (options.onInternalLink) {
    const node = el('button', { className: 'md-btn md-btn--text', text, attrs: { type: 'button' } });
    node.addEventListener('click', () => options.onInternalLink?.(target));
    return node;
  }
  // Any other scheme is shown as text with its target visible, rather than made
  // clickable and silently doing nothing.
  return el('span', { text: `${text} (${target})` });
}
