/**
 * The narrator's own layout, injected once.
 *
 * Everything here is expressed in Material system tokens rather than literal
 * colours or radii, so the whole surface follows the seed colour, the density
 * scale and the per-element appearance overrides like the rest of the
 * application. Wide content scrolls inside its own container: the page itself
 * must never scroll sideways, at any width or display scale.
 */

const CSS = `
.narrator-page {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-5);
  padding-block-end: var(--md-space-8);
  max-inline-size: 100%;
}

.narrator-status {
  margin: 0;
  color: var(--md-sys-color-on-surface);
}

.narrator-status__error:empty {
  display: none;
}

.narrator-status__error {
  margin: var(--md-space-2) 0 0;
  color: var(--md-sys-color-error);
}

.narrator-note {
  margin: 0;
  padding: var(--md-space-3) var(--md-space-4);
  border-radius: var(--md-sys-shape-corner-medium);
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
}

.narrator-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--md-space-4);
  margin-block-start: var(--md-space-4);
}

/* Two pickers side by side where there is room, stacked where there is not.
   The minimum stops a picker's status sentence from being squeezed into a
   column too narrow to read. */
.narrator-voices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
  gap: var(--md-space-4);
  align-items: start;
}

.narrator-voice {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  padding: var(--md-space-4);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-surface-container-low);
  min-inline-size: 0;
}

.narrator-voice__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--md-space-2);
}

.narrator-voice__head h3 {
  margin: 0;
}

.narrator-voice__status {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
  /* The status sentence is the honest part of this control, so it wraps rather
     than truncating: a clipped "not installed on this computer" is a clipped
     fact. */
  overflow-wrap: anywhere;
}

.narrator-voice__controls {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
}

.narrator-voice__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-2);
}

.narrator-bulk {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
}

.narrator-bulk__toolbar,
.narrator-bulk__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-2);
}

.narrator-bulk__status {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
}

.narrator-bulk__list {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  max-block-size: 60vh;
  overflow-y: auto;
  overflow-x: auto;
}

.narrator-bulk__row {
  display: flex;
  align-items: flex-start;
  gap: var(--md-space-3);
  padding: var(--md-space-3);
  border-radius: var(--md-sys-shape-corner-medium);
  background: var(--md-sys-color-surface-container-low);
  min-inline-size: 0;
}

.narrator-bulk__row[aria-selected='true'] {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.narrator-bulk__body {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.narrator-bulk__preview {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  max-block-size: 50vh;
  overflow-y: auto;
}

.narrator-bulk__preview-list {
  margin: 0;
  padding-inline-start: var(--md-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--md-space-1);
}

.narrator-category {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  min-inline-size: 0;
}

.narrator-category__title {
  display: flex;
  align-items: center;
  gap: var(--md-space-2);
}

.narrator-category__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--md-space-4);
}

.narrator-category p,
.narrator-line p {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
}

.narrator-line {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-1);
  min-inline-size: 0;
}

.narrator-line__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--md-space-2);
}

.narrator-line__text,
.narrator-line__reason {
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .narrator-category__controls,
  .narrator-controls {
    flex-direction: column;
    align-items: stretch;
  }
}
`;

let injected = false;

/**
 * Adds the stylesheet once.
 *
 * It is written from TypeScript rather than imported as a file so the feature
 * carries its own presentation without depending on how the build treats a CSS
 * import inside a dynamically discovered module.
 */
export function installNarratorStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.dataset.feature = 'narrator';
  style.textContent = CSS;
  document.head.append(style);
}
