/**
 * Stored state, and the one place the chosen mark reaches the application
 * chrome.
 *
 * The hard boundary this file exists to hold: a logo is PRESENTATION. Nothing
 * here writes the package name, the application id, the executable filename,
 * the installer identity, the update feed or the data directory. Those come
 * from `studio.info` and stay exactly as the build set them, whatever the user
 * chooses to look at. A mark that could move the data directory would orphan
 * every stored profile the first time somebody changed their mind about an
 * icon.
 *
 * The generated variants live in the application's own settings file. They are
 * never uploaded, never exported, never written into a history payload, never
 * put in a log and never sent anywhere: the whole pipeline runs inside this
 * window and the bytes stop at the settings file the application already owns.
 */

import type { SettingsStore } from '../../core/registry';
import { DEFAULT_CHOICES, FULL_CROP, normalizeCrop } from './conversion';
import type { CropRect, FitMode, LogoVariant, LossNotice, RenderChoices } from './conversion';
import type { HeaderFacts } from './imageBytes';
import { DEFAULT_PRESET_ID, presetById } from './presets';

/* ------------------------------------------------------------------ */
/* Setting ids                                                         */
/* ------------------------------------------------------------------ */

export const SOURCE_ID = 'appLogo.source';
export const SHOW_IN_TITLE_BAR_ID = 'appLogo.showInTitleBar';
export const FIT_ID = 'appLogo.fit';
export const FOCAL_X_ID = 'appLogo.focalX';
export const FOCAL_Y_ID = 'appLogo.focalY';
export const BACKGROUND_TRANSPARENT_ID = 'appLogo.backgroundTransparent';
export const BACKGROUND_COLOUR_ID = 'appLogo.backgroundColour';
export const CORNER_RADIUS_ID = 'appLogo.cornerRadius';
export const SAFE_AREA_ID = 'appLogo.safeAreaGuide';

/** Not a visible control: the crop is edited in the logo tab's own editor. */
export const CROP_ID = 'appLogo.crop';
/** Not a visible control: the generated variants and their provenance. */
export const CUSTOM_RECORD_ID = 'appLogo.customRecord';

/** `custom` is a reserved source value; every other value is a preset id. */
export const CUSTOM_SOURCE = 'custom';

/* ------------------------------------------------------------------ */
/* Stored record                                                       */
/* ------------------------------------------------------------------ */

export interface CustomLogoRecord {
  schemaVersion: 1;
  createdAt: string;
  sourceFormat: string;
  sourceWidth: number;
  sourceHeight: number;
  sourceBytes: number;
  sourceHadAlpha: boolean;
  crop: CropRect;
  fit: FitMode;
  focalX: number;
  focalY: number;
  background: string | null;
  cornerRadiusPercent: number;
  hasTransparency: boolean;
  totalBytes: number;
  variants: LogoVariant[];
  losses: LossNotice[];
}

/**
 * Reads the stored record back, refusing anything that is not the shape this
 * version writes.
 *
 * A settings file is editable by hand, so a record that does not validate is
 * treated as absent rather than half-trusted — the shipped mark is a safe place
 * to fall back to, and a partially-applied custom logo is not.
 */
export function readCustomRecord(settings: SettingsStore): CustomLogoRecord | null {
  const raw = settings.get<unknown>(CUSTOM_RECORD_ID, null);
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<CustomLogoRecord>;
  if (record.schemaVersion !== 1) return null;
  if (!Array.isArray(record.variants) || record.variants.length === 0) return null;
  for (const variant of record.variants) {
    if (typeof variant?.size !== 'number' || typeof variant?.dataUrl !== 'string') return null;
    if (!variant.dataUrl.startsWith('data:image/png;base64,')) return null;
  }
  return record as CustomLogoRecord;
}

/* ------------------------------------------------------------------ */
/* Choices                                                             */
/* ------------------------------------------------------------------ */

export function readCrop(settings: SettingsStore): CropRect {
  const raw = settings.get<unknown>(CROP_ID, FULL_CROP);
  if (!raw || typeof raw !== 'object') return FULL_CROP;
  const candidate = raw as Partial<CropRect>;
  if (
    typeof candidate.x !== 'number' ||
    typeof candidate.y !== 'number' ||
    typeof candidate.width !== 'number' ||
    typeof candidate.height !== 'number'
  ) {
    return FULL_CROP;
  }
  return normalizeCrop(candidate as CropRect);
}

export function readChoices(settings: SettingsStore): RenderChoices {
  const transparent = settings.get<boolean>(BACKGROUND_TRANSPARENT_ID, true);
  const fit = settings.get<string>(FIT_ID, DEFAULT_CHOICES.fit);
  return {
    crop: readCrop(settings),
    fit: fit === 'cover' || fit === 'fill' ? fit : 'contain',
    focalX: clampUnit(settings.get<number>(FOCAL_X_ID, 50) / 100),
    focalY: clampUnit(settings.get<number>(FOCAL_Y_ID, 50) / 100),
    background: transparent ? null : settings.get<string>(BACKGROUND_COLOUR_ID, '#ffffff'),
    cornerRadiusPercent: Math.min(Math.max(settings.get<number>(CORNER_RADIUS_ID, 0), 0), 50)
  };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 0), 1);
}

/* ------------------------------------------------------------------ */
/* The session source                                                  */
/* ------------------------------------------------------------------ */

/**
 * The decoded image the user most recently chose, held for this session only.
 *
 * The original file is deliberately NOT persisted. Keeping it would mean the
 * settings file carrying a copy of a picture the user selected from their own
 * disk, along with enough detail to identify it, for the sake of re-cropping
 * later. The generated variants are all the application needs to render, so
 * they are what is kept; re-cropping after a restart means choosing the file
 * again, and the editor says so plainly rather than pretending otherwise.
 */
export interface SessionSource {
  bitmap: ImageBitmap;
  facts: HeaderFacts;
}

let sessionSource: SessionSource | null = null;
const sessionListeners = new Set<() => void>();

export function getSessionSource(): SessionSource | null {
  return sessionSource;
}

export function setSessionSource(next: SessionSource | null): void {
  if (sessionSource && sessionSource !== next) sessionSource.bitmap.close();
  sessionSource = next;
  for (const listener of sessionListeners) listener();
}

export function onSessionSourceChange(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/* ------------------------------------------------------------------ */
/* The active mark                                                     */
/* ------------------------------------------------------------------ */

export type ActiveMark =
  | { kind: 'preset'; presetId: string }
  | { kind: 'custom'; record: CustomLogoRecord }
  | { kind: 'missing'; requested: string };

/**
 * What is actually being rendered right now.
 *
 * `missing` is a real answer and is never silently turned into the default: a
 * user whose custom mark could not be read needs to be told, not quietly given
 * a preset and left wondering where their image went.
 */
export function activeMark(settings: SettingsStore): ActiveMark {
  const requested = settings.get<string>(SOURCE_ID, DEFAULT_PRESET_ID);
  if (requested === CUSTOM_SOURCE) {
    const record = readCustomRecord(settings);
    return record ? { kind: 'custom', record } : { kind: 'missing', requested };
  }
  return presetById(requested) ? { kind: 'preset', presetId: requested } : { kind: 'missing', requested };
}

/** Picks the stored variant closest to (and not smaller than) the wanted size. */
export function variantFor(record: CustomLogoRecord, size: number): LogoVariant | null {
  const sorted = [...record.variants].sort((left, right) => left.size - right.size);
  return sorted.find((variant) => variant.size >= size) ?? sorted[sorted.length - 1] ?? null;
}

/**
 * Builds the mark as a real element at the requested size.
 *
 * A preset returns inline SVG so it follows the theme; a custom mark returns an
 * image element pointing at a local data URL. Both are decorative here — the
 * application's name is written beside them in text — so both are hidden from
 * assistive technology rather than announcing a second, redundant name.
 */
export function buildMarkElement(settings: SettingsStore, size: number): HTMLElement | null {
  const mark = activeMark(settings);

  if (mark.kind === 'preset') {
    const preset = presetById(mark.presetId);
    if (!preset) return null;
    const svg = preset.draw(size);
    svg.setAttribute('aria-hidden', 'true');
    return svg as unknown as HTMLElement;
  }

  if (mark.kind === 'custom') {
    const variant = variantFor(mark.record, size);
    if (!variant) return null;
    const image = document.createElement('img');
    image.src = variant.dataUrl;
    image.width = size;
    image.height = size;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    image.draggable = false;
    if (mark.record.cornerRadiusPercent > 0) {
      image.style.borderRadius = `${mark.record.cornerRadiusPercent}%`;
    }
    return image;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Applying the mark to the application chrome                         */
/* ------------------------------------------------------------------ */

const MARK_CLASS = 'app-logo-mark';
const BRAND_ACTIVE_CLASS = 'app-logo-brand-active';

function brandElement(): HTMLElement | null {
  // The shell's own title bar first, with the pre-shell chrome's class kept as
  // a fallback so an older surface still resolves.
  return document.querySelector<HTMLElement>('.wds-titlebar__brand, .md-titlebar__brand');
}

/**
 * Puts the chosen mark in the title bar, or takes it back out.
 *
 * Returns what actually happened rather than assuming it worked, because the
 * settings surface reports the real state and "the title bar could not be
 * found" is a state a user is entitled to see instead of a control that appears
 * to do nothing.
 */
export function applyToChrome(settings: SettingsStore): { applied: boolean; reason: string } {
  const brand = brandElement();
  if (!brand) {
    return { applied: false, reason: 'The title bar brand area was not found in this window, so the mark was not placed.' };
  }

  for (const existing of [...brand.querySelectorAll(`.${MARK_CLASS}`)]) existing.remove();

  if (!settings.get<boolean>(SHOW_IN_TITLE_BAR_ID, true)) {
    brand.classList.remove(BRAND_ACTIVE_CLASS);
    return { applied: false, reason: 'The title bar mark is switched off, so the shipped icon is shown instead.' };
  }

  const mark = buildMarkElement(settings, 20);
  if (!mark) {
    brand.classList.remove(BRAND_ACTIVE_CLASS);
    const chosen = settings.get<string>(SOURCE_ID, DEFAULT_PRESET_ID);
    return {
      applied: false,
      reason: `No mark could be built for "${chosen}", so the shipped icon is shown instead.`
    };
  }

  const holder = document.createElement('span');
  holder.className = MARK_CLASS;
  holder.dataset.appearanceId = 'app-logo:title-bar-mark';
  holder.append(mark);
  brand.prepend(holder);
  brand.classList.add(BRAND_ACTIVE_CLASS);

  return { applied: true, reason: 'The mark is drawn in the title bar beside the application name.' };
}

/**
 * Keeps the mark in place when the chrome is rebuilt.
 *
 * The title bar is built once at boot, but a language change repaints parts of
 * the shell, and a mark that quietly disappears on the first language switch is
 * a defect nobody would connect back to this feature. The observer is cheap:
 * it only reacts when the brand's own children change and our holder is gone.
 */
export function watchChrome(settings: SettingsStore, onApplied?: (result: { applied: boolean; reason: string }) => void): () => void {
  let brandObserver: MutationObserver | null = null;
  let waitObserver: MutationObserver | null = null;

  const watchBrand = (brand: HTMLElement): void => {
    brandObserver = new MutationObserver(() => {
      const wanted = settings.get<boolean>(SHOW_IN_TITLE_BAR_ID, true);
      const present = brand.querySelector(`.${MARK_CLASS}`) !== null;
      if (wanted !== present) applyToChrome(settings);
    });
    brandObserver.observe(brand, { childList: true });
  };

  const existing = brandElement();
  if (existing) {
    watchBrand(existing);
  } else {
    // The title bar does not exist yet, and that is the ordinary case rather
    // than an error: features are initialized before the shell mounts its
    // chrome, so at this point there is genuinely nothing to put a mark into.
    // Giving up here -- which is what this did originally -- meant the feature
    // was inert for the whole session and every launch reported that the title
    // bar could not be found. Waiting for the brand to appear applies the mark
    // as soon as there is somewhere to apply it to.
    waitObserver = new MutationObserver(() => {
      const brand = brandElement();
      if (!brand) return;
      waitObserver?.disconnect();
      waitObserver = null;
      onApplied?.(applyToChrome(settings));
      watchBrand(brand);
    });
    waitObserver.observe(document.body, { childList: true, subtree: true });
  }

  return () => {
    brandObserver?.disconnect();
    waitObserver?.disconnect();
  };
}

/* ------------------------------------------------------------------ */
/* Identity, stated rather than assumed                                */
/* ------------------------------------------------------------------ */

/**
 * The identity values a logo change must never move.
 *
 * Surfaced in the tab so the promise is checkable rather than merely asserted:
 * the user can read the package name, data directory and product name beside
 * the picker and see them stay put across a change.
 */
export interface IdentityFacts {
  packageName: string;
  productName: string;
  version: string;
  userDataDir: string;
}

export function identityFacts(): IdentityFacts {
  const info = window.studio.info;
  return {
    packageName: info.packageName,
    productName: info.productName,
    version: info.version,
    userDataDir: info.userDataDir
  };
}
