/**
 * Every interface the feature modules are written against.
 *
 * This file contains types only — no implementation, no imports from any
 * implementation module — so nothing here can create an import cycle. The
 * registry re-exports all of it, which is why feature code only ever needs
 * `import type { ... } from '../../core/registry'`.
 */

import type {
  DimSumDraw,
  EditorCandidate,
  HistoryEntry,
  HistoryQuery,
  HistoryStatus,
  SettingsProvenance,
  StudioApi
} from '../../shared/api';

export type { SettingsProvenance };

/* ================================================================== */
/* Language and humour                                                 */
/* ================================================================== */

/** `both` renders the English primary with a compact Cantonese secondary. */
export type LanguageMode = 'en' | 'yue' | 'both';

/** 1 is fully professional, 5 is maximum playfulness. */
export type FunnyLevel = 1 | 2 | 3 | 4 | 5;

/** One key's copy at all five levels, for one language. */
export type FunnyLadder = [string, string, string, string, string];

export interface TranslationEntry {
  en: FunnyLadder;
  yue: FunnyLadder;
}

export type Catalogue = Record<string, TranslationEntry>;

export interface TranslateOptions {
  /** Values substituted into `{name}` placeholders. Never styled by humour. */
  values?: Record<string, string | number>;
  /** Forces one language regardless of the active mode (for a voice track). */
  language?: 'en' | 'yue';
  /**
   * Set for copy that appears inside a dialog or message box, where the emoji
   * switch is allowed to add one decorative emoji. Never set it for a button,
   * a control label or an accessible name.
   */
  dialog?: boolean;
}

export interface I18nSnapshot {
  mode: LanguageMode;
  funnyEn: FunnyLevel;
  funnyYue: FunnyLevel;
  emojiInDialogs: boolean;
  schoolMode: boolean;
  /** The user's chosen name for School mode, or the shipped name. */
  schoolModeName: string;
  /** True when a validated personal vocabulary file is loaded. */
  vocabularyLoaded: boolean;
}

export interface VocabularyLoadResult {
  ok: boolean;
  /** Number of accepted replacement entries. Never the entries themselves. */
  entryCount: number;
  /** Exact reason the file was refused, with no fragment of its content. */
  error?: string;
}

export interface I18n {
  /**
   * Resolves one key.
   *
   * `fallbackEn` is used when the key is absent from the catalogue, so a feature
   * can ship copy before its catalogue entry lands without rendering the key.
   * In bilingual mode the return value is the primary and secondary joined by
   * ` ` (an em space); use `pair()` when the two halves must be styled
   * separately.
   */
  t(key: string, fallbackEn?: string, options?: TranslateOptions): string;
  /** The two halves of bilingual copy. `secondary` is empty in a single mode. */
  pair(key: string, fallbackEn?: string, options?: TranslateOptions): { primary: string; secondary: string };
  /** Merges a feature catalogue. Later registrations never overwrite core keys. */
  register(catalogue: Catalogue): void;
  snapshot(): I18nSnapshot;
  setMode(mode: LanguageMode): void;
  setFunny(language: 'en' | 'yue', level: FunnyLevel): void;
  setEmojiInDialogs(on: boolean): void;
  /** Fires whenever mode, funny level, emoji switch or School mode changes. */
  onChange(listener: (snapshot: I18nSnapshot) => void): () => void;
  /**
   * Applies the user's personal vocabulary to one piece of user-facing text.
   * With no file loaded this is the identity function; the app ships no
   * built-in mappings, no samples and no templates.
   */
  applyVocabulary(text: string): string;
  /** Validates and caches a user-selected local JSON file. Local only. */
  loadVocabularyFile(json: string): Promise<VocabularyLoadResult>;
  /** Purges the cache and restores the original shipped wording immediately. */
  clearVocabulary(): Promise<void>;
  /**
   * True when the mode named by the user (School mode by default) is on. While
   * it is on, Cantonese, bilingual, funny levels, personal vocabulary and the
   * dim sum surprise behave as if they are not installed: their controls are
   * omitted from every surface rather than merely disabled.
   */
  schoolModeActive(): boolean;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

export type SettingKind =
  | 'switch'
  | 'text'
  | 'number'
  | 'slider'
  | 'select'
  | 'color'
  | 'font'
  | 'path'
  | 'file'
  | 'folder'
  | 'action'
  | 'custom';

export interface SettingOption {
  value: string;
  /** An i18n key. Resolved with the option's own value as the fallback. */
  label: string;
}

export interface SettingControl {
  /** Stable, unique and dotted, e.g. `downloader.port`. Never renamed. */
  id: string;
  /** i18n key for the visible label. */
  label: string;
  /**
   * i18n key for the progressive-disclosure explanation. It says what the
   * setting does, not what its label already says.
   */
  description: string;
  kind: SettingKind;
  defaultValue: unknown;
  options?: SettingOption[];
  min?: number;
  max?: number;
  step?: number;
  /** Placeholder or unit suffix, as an i18n key. */
  hint?: string;
  /** Renders the control body. Required when `kind` is `custom`. */
  render?(host: HTMLElement, ctx: SettingContext): void;
  /** Runs the action. Required when `kind` is `action`. */
  run?(ctx: SettingContext): void | Promise<void>;
  /** Defaults to true. A setting may only opt out with a stated reason. */
  lockable?: boolean;
  /** Stated reason when `lockable` is false. */
  lockableReason?: string;
  /** Validates a candidate value. Return null to accept. */
  validate?(value: unknown): string | null;
  /** Keywords that should match this setting in a search. */
  keywords?: string[];
}

export interface SettingsSection {
  id: string;
  /** i18n key. */
  title: string;
  /** A short identifier the icon set understands, e.g. `tune`. */
  icon: string;
  controls: SettingControl[];
  /** Lower sorts first. Core sections use 0..99; features use 100+. */
  order?: number;
}

export interface SettingsStore {
  get<T = unknown>(id: string, fallback?: T): T;
  set(id: string, value: unknown, provenance?: SettingsProvenance): void;
  has(id: string): boolean;
  /** Where the current value came from. `default` means no file ever wrote it. */
  provenanceOf(id: string): SettingsProvenance;
  /** The compiled-in default, as declared by whichever control owns the id. */
  defaultOf(id: string): unknown;
  /** Restores one key to its compiled-in default. */
  reset(id: string): void;
  /** Restores every key. Recorded in local history like any other change. */
  resetAll(): void;
  /** Registers a control's default so `defaultOf` and `reset` can work. */
  declareDefault(id: string, value: unknown): void;
  onChange(listener: (change: { id: string; value: unknown; previous: unknown }) => void): () => void;
  /** Every id that currently has a value or a declared default. */
  keys(): string[];
  /** Absolute path of the settings file, for the provenance explanation. */
  filePath(): string;
  /** Flushes pending writes. Resolves once the file is on disk. */
  flush(): Promise<void>;
}

/* ================================================================== */
/* Tabs                                                                */
/* ================================================================== */

export type DockEdge = 'left' | 'right' | 'top' | 'bottom';

export interface TabDefinition {
  id: string;
  /** i18n key. */
  title: string;
  icon: string;
  /** Optional group id; the group is created on demand. */
  group?: string;
  /** Lower sorts first. */
  order?: number;
  /** True to make this tab non-closable (core destinations). */
  permanent?: boolean;
  /**
   * Builds the tab's content into `host`. Return a dispose function to release
   * listeners and timers when the tab is closed.
   */
  mount(host: HTMLElement, ctx: TabContext): void | (() => void);
}

export interface TabGroup {
  id: string;
  name: string;
  /** A CSS colour string. Chosen through the infinite colour picker. */
  color: string;
  collapsed: boolean;
  order: number;
}

export interface TabRecord {
  id: string;
  title: string;
  icon: string;
  group: string | null;
  pinned: boolean;
  order: number;
  permanent: boolean;
}

export interface TabService {
  /** Opens (or focuses) a registered tab. */
  open(tabId: string): void;
  close(tabId: string): void;
  activeId(): string | null;
  list(): TabRecord[];
  groups(): TabGroup[];
  createGroup(name: string, color?: string): TabGroup;
  renameGroup(groupId: string, name: string): void;
  setGroupColor(groupId: string, color: string): void;
  setGroupCollapsed(groupId: string, collapsed: boolean): void;
  moveToGroup(tabId: string, groupId: string | null): void;
  setPinned(tabId: string, pinned: boolean): void;
  dock(): DockEdge;
  setDock(edge: DockEdge): void;
  /**
   * Reveals an element inside a tab: opens the tab, scrolls the element into
   * view, focuses it and briefly highlights it, without disturbing anything else.
   */
  teleport(tabId: string, elementId?: string): void;
  onChange(listener: () => void): () => void;
}

/* ================================================================== */
/* Command palette                                                     */
/* ================================================================== */

export interface PaletteEntry {
  id: string;
  /** i18n key or literal title. */
  title: string;
  subtitle?: string;
  icon?: string;
  keywords?: string[];
  kind: 'command' | 'destination' | 'setting';
  /** For `setting`: the palette renders that setting's live control inline. */
  settingId?: string;
  run?(): void | Promise<void>;
  teleport?: { tabId: string; elementId?: string };
}

export interface PaletteService {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  /** Registers extra entries outside a feature module's static list. */
  add(entries: PaletteEntry[]): () => void;
}

/* ================================================================== */
/* Documentation                                                       */
/* ================================================================== */

export interface DocArticle {
  id: string;
  /** Plain title, already in English; the browser translates the chrome only. */
  title: string;
  category: string;
  /** Markdown. Rendered by the shared renderer; no remote asset may appear. */
  body: string;
  /** Ids of related articles, shown as suggested reading at the end. */
  related: string[];
}

export interface DocsService {
  all(): DocArticle[];
  byId(id: string): DocArticle | null;
  categories(): string[];
  /** Opens the documentation tab at one article. */
  open(articleId: string): void;
}

/* ================================================================== */
/* Notifications                                                       */
/* ================================================================== */

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface NotificationAction {
  /** i18n key or literal label. Never carries an emoji. */
  label: string;
  run(): void | Promise<void>;
}

export interface NotificationInput {
  title: string;
  body?: string;
  severity?: NotificationSeverity;
  /**
   * Milliseconds before it dismisses itself. Warnings and errors ignore this
   * and persist until dismissed.
   */
  timeoutMs?: number;
  actions?: NotificationAction[];
  /** An http(s) link opened in the user's browser. */
  link?: { label: string; url: string };
  /** Which feature raised it, for the centre's filter. */
  source?: string;
  /** 0..1 for a `progress` notification. */
  progress?: number;
}

export interface NotificationRecord extends Required<Pick<NotificationInput, 'title'>> {
  id: string;
  body: string;
  severity: NotificationSeverity;
  source: string;
  createdAt: string;
  dismissedAt: string | null;
  progress: number | null;
}

export interface NotificationHandle {
  id: string;
  update(patch: Partial<NotificationInput>): void;
  dismiss(): void;
}

export interface NotificationService {
  show(input: NotificationInput): NotificationHandle;
  info(title: string, body?: string): NotificationHandle;
  success(title: string, body?: string): NotificationHandle;
  warn(title: string, body?: string): NotificationHandle;
  error(title: string, body?: string): NotificationHandle;
  /** Everything raised this session, newest first, dismissed included. */
  history(): NotificationRecord[];
  dismiss(id: string): void;
  dismissAll(): void;
  remove(ids: string[]): void;
  onChange(listener: () => void): () => void;
  /** Builds the notification centre into a host element. */
  mountCentre(host: HTMLElement, ctx: AppContext): () => void;
}

/* ================================================================== */
/* Destructive-action gate                                             */
/* ================================================================== */

export interface ConfirmRequest {
  /** The exact action, e.g. "Delete 3 download profiles". Never vague. */
  action: string;
  /** The exact data affected, listed item by item where that is finite. */
  affected: string[];
  /** What cannot be undone afterwards, in unambiguous words. */
  irreversible: string;
  /** The element the gate anchors beside and returns focus to. */
  anchor: HTMLElement;
  /** Label for the confirming action. Defaults to the localized "Confirm". */
  confirmLabel?: string;
}

export interface ConfirmService {
  /**
   * The two-key gate. Resolves true only after both keys were turned and the
   * confirmation slider was driven to its end. Escape, the back gesture and the
   * always-available emergency exit all resolve false.
   */
  request(request: ConfirmRequest): Promise<boolean>;
}

/* ================================================================== */
/* Regex builder and search bars                                       */
/* ================================================================== */

export interface RegexState {
  pattern: string;
  flags: string;
  valid: boolean;
  error: string | null;
}

export interface RegexBuilderOptions {
  /** The element the popover anchors to. */
  anchor: HTMLElement;
  initialPattern?: string;
  initialFlags?: string;
  /** Sample text the builder starts with. */
  sample?: string;
  onApply(state: RegexState): void;
  onClose?(): void;
}

export interface RegexBuilderHandle {
  open(): void;
  close(): void;
  isOpen(): boolean;
  state(): RegexState;
}

export interface SearchQuery {
  /** Raw text the user typed. */
  text: string;
  /** True when the user deliberately switched to regular expressions. */
  regex: boolean;
  pattern: string;
  flags: string;
  /** A ready-made predicate honouring the current mode. Never throws. */
  matches(value: string): boolean;
  /** Null when the mode is plain text or the pattern does not compile. */
  compiled: RegExp | null;
  error: string | null;
}

export interface SearchBarOptions {
  /** i18n key for the visible label and accessible name. */
  label: string;
  placeholder?: string;
  /** Compact bars sit at the head of a menu or dropdown. */
  compact?: boolean;
  /** Sample text offered inside the regex builder. */
  sample?: string;
  initialText?: string;
  onChange(query: SearchQuery): void;
  /** Called when the field is cleared with Escape. */
  onEscape?(): void;
}

export interface SearchBarHandle {
  root: HTMLElement;
  input: HTMLInputElement;
  query(): SearchQuery;
  setText(text: string): void;
  clear(): void;
  focus(): void;
  destroy(): void;
}

/* ================================================================== */
/* Export                                                              */
/* ================================================================== */

export type ExportFormat =
  | 'json'
  | 'jsonl'
  | 'yaml'
  | 'toml'
  | 'xml'
  | 'csv'
  | 'tsv'
  | 'markdown'
  | 'html'
  | 'sql';

export interface ExportOptions {
  /** Used as the XML root, the SQL table and the HTML caption. */
  name?: string;
  /** Schema version stated in the file's own header. */
  schemaVersion?: string;
  /** Emitted into the header so the file is readable elsewhere. */
  encoding?: 'utf-8';
}

export interface ExportPreflight {
  /** Fields the chosen format cannot carry faithfully, with the reason. */
  losses: Array<{ field: string; reason: string }>;
}

export interface ExportResult {
  format: ExportFormat;
  /** Suggested file extension without the dot. */
  extension: string;
  mimeType: string;
  text: string;
  preflight: ExportPreflight;
}

export interface ExportService {
  formats(): ExportFormat[];
  /** What would be lost, computed before anything is written. */
  preflight(records: Array<Record<string, unknown>>, format: ExportFormat): ExportPreflight;
  serialize(
    records: Array<Record<string, unknown>>,
    format: ExportFormat,
    options?: ExportOptions
  ): ExportResult;
  /** Serializes, asks for a destination and writes it. Returns the path. */
  save(
    records: Array<Record<string, unknown>>,
    format: ExportFormat,
    options?: ExportOptions & { defaultFileName?: string }
  ): Promise<string | null>;
}

/* ================================================================== */
/* Theme and appearance                                                */
/* ================================================================== */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ContrastLevel = 'standard' | 'medium' | 'high';

export interface ThemeState {
  mode: ThemeMode;
  /** True for the scheme actually rendering right now. */
  dark: boolean;
  seed: string;
  contrast: ContrastLevel;
  /** -3..0, the Material density scale. */
  density: number;
  fontFamily: string;
  /** Multiplier applied to the whole type scale. */
  fontScale: number;
  fontWeight: number;
  reducedMotion: boolean;
}

export interface ThemeService {
  state(): ThemeState;
  setMode(mode: ThemeMode): void;
  setSeed(hex: string): void;
  setContrast(level: ContrastLevel): void;
  setDensity(value: number): void;
  setFontFamily(family: string): void;
  setFontScale(scale: number): void;
  setFontWeight(weight: number): void;
  /** Recomputes and reapplies every token. */
  apply(): void;
  onChange(listener: (state: ThemeState) => void): () => void;
  /** Fonts installed on this machine plus the bundled stack. */
  availableFonts(): Promise<string[]>;
}

export interface AppearanceOverride {
  /** CSS property name, e.g. `--md-sys-color-primary` or `font-weight`. */
  property: string;
  value: string;
}

export interface AppearanceService {
  /**
   * Opens the per-element appearance editor anchored beside `element`. Every
   * rendered element supports it, through its context menu and a keyboard path.
   */
  edit(element: HTMLElement, selector?: string): void;
  /** Applies stored overrides to a newly created element. */
  applyTo(element: HTMLElement, selector: string): void;
  overridesFor(selector: string): AppearanceOverride[];
  setOverride(selector: string, override: AppearanceOverride): void;
  resetProperty(selector: string, property: string): void;
  resetSelector(selector: string): void;
  resetAll(): void;
  /** Named presets plus anything the user saved. */
  presets(): Array<{ id: string; name: string }>;
  applyPreset(id: string): void;
  exportThemeJson(): string;
  importThemeJson(json: string): { ok: boolean; error?: string };
}

/* ================================================================== */
/* Toy locks                                                           */
/* ================================================================== */

export type LockMethod = 'password' | 'totp';

export interface LockRecord {
  /** Stable id of the locked thing, e.g. `tab:core.settings` or a selector. */
  target: string;
  /** Human-readable description of what is locked. */
  label: string;
  method: LockMethod;
  createdAt: string;
  /** Minutes; 0 means "this surface only", -1 means "until the app closes". */
  unlockMinutes: number;
}

export interface LockService {
  /** Opens the per-element lock wizard anchored beside the element. */
  wizard(element: HTMLElement, target: string, label: string): void;
  isLocked(target: string): boolean;
  isUnlocked(target: string): boolean;
  list(): LockRecord[];
  remove(target: string): Promise<void>;
  /** Opens the anchored unlock prompt. Resolves true once it is unlocked. */
  unlock(target: string, anchor: HTMLElement): Promise<boolean>;
  /** Relocks everything immediately. */
  lockAll(): void;
  /** The exact folder a locked-out user deletes to reset. */
  recoveryPath(): string;
}

/* ================================================================== */
/* Overlays                                                            */
/* ================================================================== */

export type OverlayPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right' | 'left';

export interface OverlayOptions {
  anchor: HTMLElement;
  placement?: OverlayPlacement;
  /** Accessible role. Menus use `menu`; editors use `dialog`. */
  role?: 'menu' | 'dialog' | 'listbox' | 'tooltip';
  /** i18n key or literal accessible name. */
  label?: string;
  /** True when clicking outside should close it. Defaults to true. */
  lightDismiss?: boolean;
  /** Persisted size key; when set the overlay is resizable and remembered. */
  resizeKey?: string;
  /** Persisted position key; when set the overlay drags by its header. */
  dragKey?: string;
  onClose?(): void;
}

export interface OverlayHandle {
  root: HTMLElement;
  /** The scrollable body. Content goes here, not into `root`. */
  body: HTMLElement;
  /** The draggable header, present only when `dragKey` was given. */
  header: HTMLElement | null;
  close(): void;
  reposition(): void;
  isOpen(): boolean;
}

export interface OverlayService {
  open(options: OverlayOptions): OverlayHandle;
  closeAll(): void;
  /** Resets a remembered overlay size and position. */
  resetGeometry(key: string): void;
}

/* ================================================================== */
/* Accessibility                                                       */
/* ================================================================== */

export interface A11yService {
  /** Announces a message on the shared polite live region. */
  announce(message: string, assertive?: boolean): void;
  /** Wires roving tabindex over a list of elements along one axis. */
  roving(container: HTMLElement, items: () => HTMLElement[], axis: 'horizontal' | 'vertical'): () => void;
  /** Traps focus inside an element until the returned function is called. */
  trapFocus(container: HTMLElement): () => void;
  /** True when the user asked for reduced motion. */
  reducedMotion(): boolean;
  /** Throws in development when an interactive target is below 44 CSS pixels. */
  assertTouchTarget(element: HTMLElement, name: string): void;
  /** Moves focus to an element and shows the focus ring even for a mouse move. */
  focusVisible(element: HTMLElement): void;
}

/* ================================================================== */
/* Component kit                                                       */
/* ================================================================== */

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated';

export interface ButtonOptions {
  /** i18n key or literal. Emoji never appears here. */
  label: string;
  variant?: ButtonVariant;
  icon?: string;
  trailingIcon?: string;
  disabled?: boolean;
  /** Why it is disabled. Required whenever `disabled` is true. */
  disabledReason?: string;
  danger?: boolean;
  onClick?(event: MouseEvent): void;
  id?: string;
}

export interface IconButtonOptions {
  icon: string;
  /** Accessible name. Required: an icon alone is not a name. */
  label: string;
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  toggled?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?(event: MouseEvent): void;
  id?: string;
}

export interface FabOptions {
  icon: string;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  onClick?(event: MouseEvent): void;
}

export interface CardOptions {
  variant?: 'elevated' | 'filled' | 'outlined';
  title?: string;
  subtitle?: string;
  /** Set only for a card that genuinely performs an action when activated. */
  onClick?(event: MouseEvent): void;
}

export interface ChipOptions {
  label: string;
  icon?: string;
  selected?: boolean;
  removable?: boolean;
  onToggle?(selected: boolean): void;
  onRemove?(): void;
}

export interface ControlHandle<T> {
  root: HTMLElement;
  get(): T;
  set(value: T): void;
  setDisabled(disabled: boolean, reason?: string): void;
  focus(): void;
}

export interface SwitchOptions {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange?(checked: boolean): void;
  id?: string;
}

export interface CheckboxOptions extends SwitchOptions {
  indeterminate?: boolean;
}

export interface RadioGroupOptions {
  label: string;
  options: SettingOption[];
  value?: string;
  onChange?(value: string): void;
  id?: string;
}

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step?: number;
  value?: number;
  /** Rendered beside the value, e.g. "ms". */
  unit?: string;
  showTicks?: boolean;
  onChange?(value: number): void;
  id?: string;
}

export interface TextFieldOptions {
  label: string;
  value?: string;
  variant?: 'filled' | 'outlined';
  type?: 'text' | 'number' | 'password' | 'search' | 'url';
  placeholder?: string;
  supportingText?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  /** Adds a native browse control beside the field. */
  browse?: 'file' | 'folder' | 'both';
  onChange?(value: string): void;
  onCommit?(value: string): void;
  id?: string;
}

export interface SelectOptions {
  label: string;
  options: SettingOption[];
  value?: string;
  /** Defaults to true: every dropdown opens with a filter field and a builder. */
  filterable?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange?(value: string): void;
  id?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  /** Shown right-aligned. Must be the chord that genuinely works here. */
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  run?(): void | Promise<void>;
  /** Nested items open their own filtered submenu. */
  children?: MenuItem[];
}

export interface MenuOptions {
  anchor: HTMLElement;
  items: MenuItem[];
  label?: string;
  placement?: OverlayPlacement;
  onClose?(): void;
}

export interface DialogOptions {
  /** The decision being asked for. A dialog is only for a real decision. */
  title: string;
  body?: string | HTMLElement;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Extra buttons rendered between cancel and confirm. */
  extraActions?: ButtonOptions[];
}

export interface ListItemOptions {
  headline: string;
  supporting?: string;
  trailing?: string | HTMLElement;
  leadingIcon?: string;
  selected?: boolean;
  /** Enables multi-select, which every list in this application supports. */
  selectable?: boolean;
  onActivate?(): void;
  onSelectChange?(selected: boolean): void;
  id?: string;
}

export interface TabBarOptions {
  tabs: Array<{ id: string; label: string; icon?: string }>;
  active?: string;
  variant?: 'primary' | 'secondary';
  onChange?(id: string): void;
}

export interface ProgressOptions {
  /** Absent means indeterminate. */
  value?: number;
  label: string;
  size?: number;
}

export interface DatePickerOptions {
  label: string;
  /** ISO `YYYY-MM-DD`, or `null` for empty. */
  value?: string | null;
  /** Selects a start and an end date. */
  range?: boolean;
  rangeEnd?: string | null;
  min?: string;
  max?: string;
  onChange?(value: { start: string | null; end: string | null }): void;
  id?: string;
}

export interface DataTableColumn<Row> {
  id: string;
  label: string;
  align?: 'start' | 'end';
  sortable?: boolean;
  render?(row: Row): string | HTMLElement;
  value?(row: Row): string | number;
}

export interface DataTableOptions<Row> {
  label: string;
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  rowId(row: Row): string;
  selectable?: boolean;
  onSelectionChange?(ids: string[]): void;
  onActivate?(row: Row): void;
  emptyMessage?: string;
}

export interface DataTableHandle<Row> {
  root: HTMLElement;
  setRows(rows: Row[]): void;
  selection(): string[];
  setSelection(ids: string[]): void;
  clearSelection(): void;
}

export interface SegmentedOption extends SettingOption {
  icon?: string;
}

export interface ComponentKit {
  button(options: ButtonOptions): HTMLButtonElement;
  iconButton(options: IconButtonOptions): HTMLButtonElement;
  fab(options: FabOptions): HTMLButtonElement;
  card(options?: CardOptions): HTMLElement;
  chip(options: ChipOptions): HTMLElement;
  switchControl(options: SwitchOptions): ControlHandle<boolean>;
  checkbox(options: CheckboxOptions): ControlHandle<boolean>;
  radioGroup(options: RadioGroupOptions): ControlHandle<string>;
  slider(options: SliderOptions): ControlHandle<number>;
  textField(options: TextFieldOptions): ControlHandle<string>;
  select(options: SelectOptions): ControlHandle<string>;
  /** Opens a filtered menu. Every menu carries its own filter and builder. */
  menu(options: MenuOptions): OverlayHandle;
  list(options?: { label?: string }): HTMLElement;
  listItem(options: ListItemOptions): HTMLElement;
  /** Reserved for a decision the user must make before continuing. */
  dialog(options: DialogOptions): Promise<boolean>;
  tabBar(options: TabBarOptions): HTMLElement;
  navigationRail(options: TabBarOptions): HTMLElement;
  topAppBar(options: { title: string; subtitle?: string; actions?: HTMLElement[] }): HTMLElement;
  tooltip(element: HTMLElement, text: string): () => void;
  linearProgress(options: ProgressOptions): ControlHandle<number>;
  circularProgress(options: ProgressOptions): ControlHandle<number>;
  badge(options: { label: string; severity?: NotificationSeverity }): HTMLElement;
  divider(vertical?: boolean): HTMLElement;
  segmentedButton(options: {
    label: string;
    options: SegmentedOption[];
    value?: string;
    onChange?(value: string): void;
    id?: string;
  }): ControlHandle<string>;
  datePicker(options: DatePickerOptions): ControlHandle<{ start: string | null; end: string | null }>;
  dataTable<Row>(options: DataTableOptions<Row>): DataTableHandle<Row>;
  /** An icon element from the bundled set. Never a remote font. */
  icon(name: string, options?: { size?: number; label?: string }): HTMLElement;
  /** The standard empty state: honest copy plus an optional action. */
  emptyState(options: { title: string; body?: string; action?: ButtonOptions }): HTMLElement;
  /** A section heading with the progressive-disclosure explanation affordance. */
  sectionHeading(options: { title: string; description?: string }): HTMLElement;
}

/* ================================================================== */
/* Feature module and contexts                                         */
/* ================================================================== */

export interface FeatureModule {
  /** Stable dotted id, matching the directory name, e.g. `downloader`. */
  id: string;
  /** Human-readable name for the About and documentation surfaces. */
  name: string;
  description: string;
  tabs?: TabDefinition[];
  settings?: SettingsSection[];
  palette?: PaletteEntry[];
  docs?: DocArticle[];
  /** Extra catalogue entries for this feature's own copy. */
  strings?: Catalogue;
  /** Runs once at boot, after the registry has everything registered. */
  init?(ctx: AppContext): void;
}

export interface Registry {
  register(module: FeatureModule): void;
  modules(): FeatureModule[];
  tabs(): TabDefinition[];
  tab(id: string): TabDefinition | null;
  settingsSections(): SettingsSection[];
  settingControl(id: string): SettingControl | null;
  paletteEntries(): PaletteEntry[];
  docs(): DocArticle[];
  /** True once `init` has run for every module. */
  ready(): boolean;
}

export interface AppContext {
  registry: Registry;
  settings: SettingsStore;
  i18n: I18n;
  /** Shorthand for `i18n.t`. */
  t(key: string, fallbackEn?: string, options?: TranslateOptions): string;
  notify: NotificationService;
  history: HistoryRecorder;
  confirm: ConfirmService;
  tabs: TabService;
  palette: PaletteService;
  docsService: DocsService;
  theme: ThemeService;
  appearance: AppearanceService;
  locks: LockService;
  overlay: OverlayService;
  a11y: A11yService;
  components: ComponentKit;
  exporter: ExportService;
  createSearchBar(options: SearchBarOptions): SearchBarHandle;
  createRegexBuilder(options: RegexBuilderOptions): RegexBuilderHandle;
  /** The privileged bridge. Everything the operating system does goes here. */
  studio: StudioApi;
  /** Draw for this launch. `won` is false on nine launches out of ten. */
  dimSum: { subscribe(listener: (draw: DimSumDraw) => void): () => void };
}

export interface TabContext extends AppContext {
  tabId: string;
  /** Registers a cleanup callback run when the tab closes. */
  onDispose(fn: () => void): void;
}

export interface SettingContext extends AppContext {
  setting: SettingControl;
  value: unknown;
  setValue(value: unknown): void;
  /** Where the current value came from, for the provenance line. */
  provenance: SettingsProvenance;
}

export interface HistoryRecorder {
  /** Appends one entry. Never throws into the caller's operation. */
  record(action: string, source: string, payload: unknown): Promise<void>;
  list(query?: HistoryQuery): Promise<HistoryEntry[]>;
  status(): Promise<HistoryStatus>;
  actions(): Promise<Array<{ action: string; count: number }>>;
  prune(olderThanIso: string): Promise<{ removed: number }>;
}

export type { EditorCandidate, HistoryEntry, HistoryQuery, HistoryStatus, DimSumDraw, StudioApi };
