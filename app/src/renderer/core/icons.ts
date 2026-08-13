/**
 * The bundled icon set.
 *
 * Inline SVG path data, compiled into the build. There is no icon font, no CDN
 * and no remote request; an icon that is not in this map renders a labelled
 * placeholder rather than an empty box, so a missing icon is visible during
 * development instead of silently blank.
 *
 * A ligature icon font would put the icon's NAME into the element's text, which
 * then leaks into `textContent` assertions and, for a name the font does not
 * carry, renders the literal English word at the user. Inline paths avoid both.
 */

export const ICON_PATHS: Record<string, string> = {
  home: 'M12 3 2 12h3v9h6v-6h2v6h6v-9h3z',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8.9 4a7 7 0 0 1-.1 1.1l2 1.6-2 3.4-2.4-1a7 7 0 0 1-1.9 1.1l-.4 2.5h-4l-.4-2.5a7 7 0 0 1-1.9-1.1l-2.4 1-2-3.4 2-1.6a7 7 0 0 1 0-2.2l-2-1.6 2-3.4 2.4 1a7 7 0 0 1 1.9-1.1L10.1 3h4l.4 2.5a7 7 0 0 1 1.9 1.1l2.4-1 2 3.4-2 1.6q.1.5.1 1.1',
  tune: 'M4 6h9v2H4zm11 0h5v2h-5zM4 11h4v2H4zm6 0h10v2H10zM4 16h12v2H4zm14 0h2v2h-2z',
  search: 'M10 4a6 6 0 1 0 3.5 10.9l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4m0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8',
  close: 'm5.6 4.2 6.4 6.4 6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4L10.6 12 4.2 5.6z',
  add: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  remove: 'M5 11h14v2H5z',
  check: 'm9.5 16.2-3.7-3.7-1.4 1.4 5.1 5.1 10-10-1.4-1.4z',
  chevronDown: 'M7.4 9.4 12 14l4.6-4.6 1.4 1.4-6 6-6-6z',
  chevronRight: 'M9.4 6.6 14 11.2l-4.6 4.6 1.4 1.4 6-6-6-6z',
  chevronLeft: 'M14.6 6.6 10 11.2l4.6 4.6-1.4 1.4-6-6 6-6z',
  chevronUp: 'M7.4 14.6 12 10l4.6 4.6 1.4-1.4-6-6-6 6z',
  more: 'M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4m0 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4m0 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4',
  pin: 'M14 2v6l3 3v2h-4v7l-1 1-1-1v-7H7v-2l3-3V2z',
  folder: 'M3 5h6l2 2h10v12H3z',
  file: 'M6 2h8l4 4v16H6zm8 1.5V7h3.5z',
  download: 'M11 3h2v8h4l-5 5-5-5h4zm-6 15h14v2H5z',
  upload: 'M11 21h2v-8h4l-5-5-5 5h4zM5 4h14v2H5z',
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  pause: 'M7 5h4v14H7zm6 0h4v14h-4z',
  refresh: 'M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7',
  history: 'M13 3a9 9 0 1 0 8.9 10.5h-2A7 7 0 1 1 13 5v4l5-5-5-5zm-1 5v5l4 2 .8-1.3L13.5 12V8z',
  notifications: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2m6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1z',
  palette:
    'M12 3a9 9 0 0 0 0 18c1.7 0 3-1.3 3-3 0-.8-.3-1.5-.8-2-.5-.6-.7-1-.7-1.5 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-3.3-4-6-9-6m-5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m4 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3',
  book: 'M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zm16 0h-7v13h7z',
  lock: 'M12 2a4 4 0 0 0-4 4v3H6v13h12V9h-2V6a4 4 0 0 0-4-4m0 2a2 2 0 0 1 2 2v3h-4V6a2 2 0 0 1 2-2',
  lockOpen: 'M12 2a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0v3H6v13h12V9h-2V6a4 4 0 0 0-4-4',
  code: 'm9 7-6 5 6 5 1.3-1.5L5.9 12l4.4-3.5zm6 0-1.3 1.5L18.1 12l-4.4 3.5L15 17l6-5z',
  terminal: 'M3 4h18v16H3zm3 4 4 4-4 4 1.4 1.4L13 12 7.4 6.6zm7 8h6v2h-6z',
  map: 'M9 3 3 5v16l6-2 6 2 6-2V3l-6 2zm0 2.2 6 2v13.6l-6-2z',
  cloud: 'M18.5 10a6 6 0 0 0-11.6-1A4.5 4.5 0 0 0 7 19h11a4 4 0 0 0 .5-8',
  bolt: 'M11 21v-7H7l6-11v7h4z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 15h-2v-6h2zm0-8h-2V7h2z',
  warning: 'M12 3 2 20h20zm1 13h-2v2h2zm0-6h-2v4h2z',
  error: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 15h-2v-2h2zm0-4h-2V7h2z',
  success: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4z',
  calendar: 'M7 2v2H4v18h16V4h-3V2h-2v2H9V2zm-1 8h12v10H6z',
  filter: 'M4 5h16l-6 7v6l-4 2v-8z',
  sort: 'M8 4 4 9h8zm8 16 4-5h-8z',
  copy: 'M8 2h10v14H8zm-4 4h2v14h12v2H4z',
  edit: 'm3 17.2 11-11 3.8 3.8-11 11H3zM16.4 3.8l3.8 3.8-1.9 1.9-3.8-3.8z',
  trash: 'M9 2h6l1 2h4v2H4V4h4zm-3 6h12v14H6z',
  save: 'M4 4h13l3 3v13H4zm4 1v5h8V5zm-1 9h10v5H7z',
  visibility: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7m0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8',
  world: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M4.3 13h4c.2 2 .7 3.9 1.5 5.4A8 8 0 0 1 4.3 13m4-2h-4a8 8 0 0 1 5.5-5.4C9 7.1 8.5 9 8.3 11m3.7 8.6c-1-.9-1.8-3.1-2-6.6h4c-.2 3.5-1 5.7-2 6.6M10 11c.2-3.5 1-5.7 2-6.6 1 .9 1.8 3.1 2 6.6zm5.7 2h4a8 8 0 0 1-5.5 5.4c.8-1.5 1.3-3.4 1.5-5.4m0-2c-.2-2-.7-3.9-1.5-5.4A8 8 0 0 1 19.7 11z',
  dock: 'M3 4h18v16H3zm2 2v12h5V6z',
  key: 'M14 2a6 6 0 1 0-5.7 8l1.7 1.7L8 14l2 2-2 2 2 2 4-4V8.6A6 6 0 0 0 14 2m1 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3'
};

export const ICON_NAMES: string[] = Object.keys(ICON_PATHS).sort();

/** Builds an inline SVG element for a named icon. Never fetches anything. */
export function iconElement(name: string, size = 20): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.flex = '0 0 auto';

  const data = ICON_PATHS[name];
  if (data) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', data);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
    return svg;
  }

  // Unknown name: a bordered initial, so the gap is visible rather than blank.
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '3');
  rect.setAttribute('y', '3');
  rect.setAttribute('width', '18');
  rect.setAttribute('height', '18');
  rect.setAttribute('rx', '4');
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', 'currentColor');
  rect.setAttribute('stroke-width', '1.5');
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '12');
  text.setAttribute('y', '16');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '10');
  text.setAttribute('fill', 'currentColor');
  text.textContent = (name || '?').slice(0, 1).toUpperCase();
  svg.append(rect, text);
  return svg;
}
