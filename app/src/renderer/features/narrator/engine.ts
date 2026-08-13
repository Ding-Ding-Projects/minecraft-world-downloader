import type { AppContext } from '../../core/registry';
import {
  CATEGORIES,
  NARRATOR_DEBOUNCE_ID,
  NARRATOR_DUCK_VOLUME_ID,
  NARRATOR_DUCK_WINDOW_ID,
  NARRATOR_ENABLED_ID,
  NARRATOR_LOG_LIMIT_ID,
  NARRATOR_MODE_ID,
  NARRATOR_QUIET_ENABLED_ID,
  NARRATOR_QUIET_FROM_ID,
  NARRATOR_QUIET_TO_ID,
  NARRATOR_SCREEN_READER_ID,
  NARRATOR_VOLUME_ID,
  SPEECH_RANGES,
  categoryById,
  categoryCooldownId,
  categoryEnabledId,
  localIso,
  pitchSettingId,
  rateSettingId,
  voiceSettingId
} from './model';
import type { CategoryId, NarratedLanguage, NarrationMode, SpokenLine } from './model';
import { voiceRegistry } from './voices';
import type { VoiceInfo } from './voices';

/**
 * The narrator itself: one utterance at a time, held back on purpose.
 *
 * The whole point of this file is restraint. A narrator that speaks every time
 * anything happens is a narrator the listener turns off within a minute, so
 * three separate mechanisms keep it quiet:
 *
 *  - a DEBOUNCE, which collapses a burst of the same category into the one line
 *    that was current when the burst stopped;
 *  - a PER-CATEGORY COOLDOWN, which refuses a second line of the same kind
 *    inside its own window;
 *  - a SERIALIZED QUEUE, so two lines never overlap and a superseded line
 *    REPLACES the one waiting rather than stacking behind it.
 *
 * The exception is written into the model rather than into a condition here:
 * the error category declares `neverSuppressed`, so a spoken failure jumps the
 * queue, ignores both the debounce and the cooldown, and still names the actual
 * failure and what to do about it. A rate limit that swallows an error report
 * is worse than no narrator at all.
 */

/* ------------------------------------------------------------------ */
/* Requests, segments and jobs                                         */
/* ------------------------------------------------------------------ */

export interface NarrationRequest {
  category: CategoryId;
  /**
   * The facts. They are substituted into the category's own sentence frame and
   * are never restyled: the frame carries the humour, the values carry the
   * truth.
   */
  values: { title: string; body?: string };
  /**
   * Overrides the category's frame with an explicit i18n key. Used by the
   * preview buttons, which say what they are rather than pretending to be a
   * real event.
   */
  frameKey?: string;
  frameFallback?: string;
  /** Skips the enabled check for this one line. Only the previews set it. */
  force?: boolean;
}

interface Segment {
  language: NarratedLanguage;
  text: string;
  voice: VoiceInfo | null;
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
}

interface Job {
  id: string;
  category: CategoryId;
  priority: boolean;
  segments: Segment[];
  queuedAt: number;
}

export interface EngineState {
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  queued: number;
  /** Milliseconds remaining on the current screen-reader duck, or zero. */
  duckingFor: number;
  /** The exact reason the narrator is currently silent, or null when it is not. */
  silentReason: string | null;
  lastError: string | null;
}

/* ------------------------------------------------------------------ */
/* Text preparation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Emoji never reach the speech engine.
 *
 * A screen-reading voice pronounces an emoji as its full CLDR name, so a
 * cheerful "✅ Saved" becomes "white heavy check mark Saved" out loud. The
 * emoji switch is about decorating a dialog, not about narration, so decoration
 * is removed here and the words survive untouched.
 */
export function stripForSpeech(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, ' ')
    .replace(/[\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Keeps one utterance short enough that the platform will finish it. */
const MAX_SPOKEN_CHARACTERS = 400;

function clamp(value: number, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

/** `HH:MM` to minutes past local midnight, or null when it is not a time. */
function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Whether a local time falls inside a quiet window.
 *
 * The window is allowed to cross midnight, which is the case somebody actually
 * configures — 22:00 to 07:00 is the obvious one — and a naive `from <= now &&
 * now < to` comparison silently never matches for it.
 */
export function insideQuietHours(from: string, to: string, now = new Date()): boolean {
  const start = parseClock(from);
  const end = parseClock(to);
  if (start === null || end === null) return false;
  if (start === end) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/* ------------------------------------------------------------------ */
/* The engine                                                          */
/* ------------------------------------------------------------------ */

type LogListener = (log: SpokenLine[]) => void;
type StateListener = (state: EngineState) => void;

class NarratorEngine {
  private ctx: AppContext | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private watchdog: number | null = null;
  private readonly pending = new Map<CategoryId, { timer: number; request: NarrationRequest }>();
  private readonly lastSpokenAt = new Map<CategoryId, number>();
  private log: SpokenLine[] = [];
  private readonly logListeners = new Set<LogListener>();
  private readonly stateListeners = new Set<StateListener>();
  private duckUntil = 0;
  private lastError: string | null = null;
  private counter = 0;
  private liveRegionObserver: MutationObserver | null = null;
  private readonly observedRegions = new WeakSet<Element>();
  private liveRegionScan: number | null = null;

  /* ---------------- lifecycle ---------------- */

  attach(ctx: AppContext): void {
    this.ctx = ctx;
    voiceRegistry.start();
    this.watchLiveRegions();
  }

  detach(): void {
    this.cancelAll('The window is closing.');
    this.liveRegionObserver?.disconnect();
    this.liveRegionObserver = null;
    if (this.liveRegionScan !== null) {
      window.clearInterval(this.liveRegionScan);
      this.liveRegionScan = null;
    }
    for (const entry of this.pending.values()) window.clearTimeout(entry.timer);
    this.pending.clear();
    this.logListeners.clear();
    this.stateListeners.clear();
    this.ctx = null;
  }

  /* ---------------- settings readers ---------------- */

  private setting<T>(id: string, fallback: T): T {
    return this.ctx ? this.ctx.settings.get<T>(id, fallback) : fallback;
  }

  enabled(): boolean {
    return this.setting<boolean>(NARRATOR_ENABLED_ID, false) === true;
  }

  /**
   * The tracks that will speak.
   *
   * While the study mode is on, Cantonese and bilingual narration behave as
   * though they were not installed, so this returns the English track alone
   * regardless of what was stored. The stored choice is untouched and returns
   * the moment the mode is turned off.
   */
  languages(): NarratedLanguage[] {
    if (this.ctx?.i18n.schoolModeActive()) return ['en'];
    const raw = this.setting<string>(NARRATOR_MODE_ID, 'en') as NarrationMode;
    if (raw === 'yue') return ['yue'];
    if (raw === 'both') return ['en', 'yue'];
    return ['en'];
  }

  private masterVolume(): number {
    return clamp(
      this.setting<number>(NARRATOR_VOLUME_ID, SPEECH_RANGES.volume.default),
      SPEECH_RANGES.volume.min,
      SPEECH_RANGES.volume.max,
      SPEECH_RANGES.volume.default
    );
  }

  private debounceMs(): number {
    return clamp(this.setting<number>(NARRATOR_DEBOUNCE_ID, 400), 0, 5000, 400);
  }

  private cooldownFor(category: CategoryId): number {
    const definition = categoryById(category);
    if (!definition) return 0;
    if (definition.neverSuppressed) return 0;
    return clamp(this.setting<number>(categoryCooldownId(category), definition.cooldownMs), 0, 600000, definition.cooldownMs);
  }

  private categoryEnabled(category: CategoryId): boolean {
    const definition = categoryById(category);
    if (!definition) return false;
    return this.setting<boolean>(categoryEnabledId(category), definition.enabledByDefault) === true;
  }

  /* ---------------- screen reader ---------------- */

  /**
   * Watches the application's own live regions.
   *
   * A renderer is given no way to ask whether a screen reader is running — the
   * platform simply does not expose it, and claiming otherwise would be a
   * confident guess dressed as a fact. What IS observable is the moment the
   * application announces something on a live region, because that is exactly
   * when a screen reader, if one is running, starts talking. So the narrator
   * ducks around those announcements instead of pretending to detect the reader
   * itself, and the setting says so in those words.
   */
  private watchLiveRegions(): void {
    if (typeof MutationObserver === 'undefined') return;
    this.liveRegionObserver = new MutationObserver(() => {
      const holdFor = clamp(this.setting<number>(NARRATOR_DUCK_WINDOW_ID, 1600), 0, 10000, 1600);
      this.duckUntil = Date.now() + holdFor;
      this.emitState();
    });
    const scan = (): void => {
      for (const region of document.querySelectorAll('[aria-live]')) {
        if (this.observedRegions.has(region)) continue;
        this.observedRegions.add(region);
        this.liveRegionObserver?.observe(region, { childList: true, characterData: true, subtree: true });
      }
    };
    scan();
    this.liveRegionScan = window.setInterval(scan, 4000);
  }

  private screenReaderMode(): 'auto' | 'duck' | 'silent' | 'off' {
    const raw = this.setting<string>(NARRATOR_SCREEN_READER_ID, 'auto');
    return raw === 'duck' || raw === 'silent' || raw === 'off' ? raw : 'auto';
  }

  private duckFactor(): number {
    return clamp(this.setting<number>(NARRATOR_DUCK_VOLUME_ID, 0.45), 0.05, 1, 0.45);
  }

  private ducking(): boolean {
    const mode = this.screenReaderMode();
    if (mode === 'off') return false;
    if (mode === 'duck') return true;
    if (mode === 'silent') return true;
    return Date.now() < this.duckUntil;
  }

  /* ---------------- the honest silence check ---------------- */

  /** The exact reason nothing will be spoken, or null when it will be. */
  silentReason(category?: CategoryId): string | null {
    if (!voiceRegistry.supported()) {
      return 'This build has no speech synthesis, so nothing can be spoken.';
    }
    if (!this.enabled()) {
      return 'The narrator is switched off.';
    }
    if (this.screenReaderMode() === 'silent') {
      return 'You told the narrator a screen reader is running, so it yields completely.';
    }
    if (
      this.setting<boolean>(NARRATOR_QUIET_ENABLED_ID, false) === true &&
      insideQuietHours(this.setting<string>(NARRATOR_QUIET_FROM_ID, '22:00'), this.setting<string>(NARRATOR_QUIET_TO_ID, '07:00'))
    ) {
      return `Quiet hours are in effect (${this.setting<string>(NARRATOR_QUIET_FROM_ID, '22:00')} to ${this.setting<string>(
        NARRATOR_QUIET_TO_ID,
        '07:00'
      )}, local time).`;
    }
    if (category && !this.categoryEnabled(category)) {
      const definition = categoryById(category);
      const name = definition ? this.ctx?.i18n.t(definition.label, definition.label) ?? category : category;
      return `The "${name}" category is switched off.`;
    }
    if (this.languages().length === 0) {
      return 'No narrated language is selected.';
    }
    return null;
  }

  /* ---------------- speaking ---------------- */

  speak(request: NarrationRequest): void {
    if (!this.ctx) return;
    const definition = categoryById(request.category);
    if (!definition) return;

    // A forced line is a deliberate audition from a button the user just
    // pressed, so it speaks even while the narrator is switched off — pressing
    // "speak this" and hearing nothing would read as a broken control. Every
    // line the application itself raises goes through the full check below.
    const blocked = request.force ? null : this.silentReason(request.category);
    if (blocked) {
      this.appendLog({
        id: this.nextId(),
        at: localIso(),
        category: request.category,
        segments: [],
        outcome: 'suppressed',
        reason: blocked
      });
      return;
    }

    if (definition.neverSuppressed || request.force) {
      this.enqueue(this.buildJob(request), true);
      return;
    }

    // A burst collapses into the line that was current when the burst stopped.
    const existing = this.pending.get(request.category);
    if (existing) {
      window.clearTimeout(existing.timer);
      this.appendLog({
        id: this.nextId(),
        at: localIso(),
        category: request.category,
        segments: [],
        outcome: 'replaced',
        reason: 'A newer line of the same category arrived before this one was spoken.'
      });
    }

    const timer = window.setTimeout(() => {
      this.pending.delete(request.category);
      const since = Date.now() - (this.lastSpokenAt.get(request.category) ?? 0);
      const cooldown = this.cooldownFor(request.category);
      if (cooldown > 0 && since < cooldown) {
        this.appendLog({
          id: this.nextId(),
          at: localIso(),
          category: request.category,
          segments: [],
          outcome: 'suppressed',
          reason: `Within this category's ${Math.round(cooldown / 1000)} second cooldown; ${Math.round(
            (cooldown - since) / 1000
          )} seconds were left.`
        });
        return;
      }
      this.enqueue(this.buildJob(request), false);
    }, this.debounceMs());

    this.pending.set(request.category, { timer, request });
  }

  /** Speaks one line on one track immediately. The preview buttons use this. */
  preview(language: NarratedLanguage, text: string): void {
    if (!this.ctx) return;
    if (!voiceRegistry.supported()) return;
    const segment = this.buildSegment(language, text);
    this.enqueue(
      { id: this.nextId(), category: 'notice', priority: true, segments: [segment], queuedAt: Date.now() },
      true
    );
  }

  private buildJob(request: NarrationRequest): Job {
    const definition = categoryById(request.category);
    const frame = request.frameKey ?? definition?.frame ?? 'narrator.frame.notice';
    const fallback = request.frameFallback ?? definition?.frameFallback ?? '{title}. {body}';
    const segments: Segment[] = [];
    for (const language of this.languages()) {
      const spoken = this.ctx?.i18n.t(frame, fallback, {
        language,
        values: { title: request.values.title, body: request.values.body ?? '' }
      });
      segments.push(this.buildSegment(language, spoken ?? request.values.title));
    }
    return {
      id: this.nextId(),
      category: request.category,
      priority: definition?.neverSuppressed === true || request.force === true,
      segments,
      queuedAt: Date.now()
    };
  }

  private buildSegment(language: NarratedLanguage, rawText: string): Segment {
    const stored = this.setting<string>(voiceSettingId(language), '');
    const resolution = voiceRegistry.resolve(language, stored);
    const text = stripForSpeech(rawText).slice(0, MAX_SPOKEN_CHARACTERS);
    return {
      language,
      text,
      voice: resolution.voice,
      voiceName: resolution.voice?.name ?? '',
      rate: clamp(
        this.setting<number>(rateSettingId(language), SPEECH_RANGES.rate.default),
        SPEECH_RANGES.rate.min,
        SPEECH_RANGES.rate.max,
        SPEECH_RANGES.rate.default
      ),
      pitch: clamp(
        this.setting<number>(pitchSettingId(language), SPEECH_RANGES.pitch.default),
        SPEECH_RANGES.pitch.min,
        SPEECH_RANGES.pitch.max,
        SPEECH_RANGES.pitch.default
      ),
      volume: this.masterVolume()
    };
  }

  /** How many jobs may wait. Beyond it the oldest ordinary job is dropped. */
  private static readonly QUEUE_LIMIT = 6;

  private enqueue(job: Job, priority: boolean): void {
    // A line whose track has no voice at all is not queued as though it will be
    // spoken: it is logged with the reason so the log matches what was heard.
    const speakable = job.segments.filter((segment) => segment.voice !== null && segment.text !== '');
    if (speakable.length === 0) {
      this.appendLog({
        id: job.id,
        at: localIso(),
        category: job.category,
        segments: job.segments.map((segment) => ({
          language: segment.language,
          text: segment.text,
          voiceName: segment.voiceName
        })),
        outcome: 'suppressed',
        reason: 'No installed voice can read the selected language, so nothing was spoken.'
      });
      return;
    }
    job.segments = speakable;

    if (priority) {
      // An error interrupts an ordinary line rather than waiting behind it.
      if (this.current && !this.current.priority) {
        this.cancelCurrent('An error arrived and took the queue.');
      }
      this.queue.unshift(job);
    } else {
      const supersededIndex = this.queue.findIndex((queued) => queued.category === job.category && !queued.priority);
      if (supersededIndex !== -1) {
        const [superseded] = this.queue.splice(supersededIndex, 1);
        this.appendLog({
          id: superseded.id,
          at: localIso(),
          category: superseded.category,
          segments: superseded.segments.map((segment) => ({
            language: segment.language,
            text: segment.text,
            voiceName: segment.voiceName
          })),
          outcome: 'replaced',
          reason: 'A newer line of the same category replaced it while it was still waiting.'
        });
      }
      this.queue.push(job);
      while (this.queue.length > NarratorEngine.QUEUE_LIMIT) {
        const dropIndex = this.queue.findIndex((queued) => !queued.priority);
        if (dropIndex === -1) break;
        const [dropped] = this.queue.splice(dropIndex, 1);
        this.appendLog({
          id: dropped.id,
          at: localIso(),
          category: dropped.category,
          segments: dropped.segments.map((segment) => ({
            language: segment.language,
            text: segment.text,
            voiceName: segment.voiceName
          })),
          outcome: 'dropped',
          reason: `The queue was full at ${NarratorEngine.QUEUE_LIMIT} lines, so the oldest ordinary line was dropped rather than delayed indefinitely.`
        });
      }
    }
    this.emitState();
    this.pump();
  }

  private pump(): void {
    if (this.current) return;
    const next = this.queue.shift();
    if (!next) {
      this.emitState();
      return;
    }
    this.current = next;
    this.emitState();
    void this.runJob(next);
  }

  private async runJob(job: Job): Promise<void> {
    // Ducking is a delay AND a volume reduction: waiting alone lets the two
    // voices collide when the reader is slow, and reducing alone talks over it.
    if (this.ducking()) {
      const wait = Math.max(0, this.duckUntil - Date.now());
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, Math.min(wait, 4000)));
    }

    const spokenSegments: SpokenLine['segments'] = [];
    let outcome: SpokenLine['outcome'] = 'spoken';
    let reason = '';

    for (const segment of job.segments) {
      spokenSegments.push({ language: segment.language, text: segment.text, voiceName: segment.voiceName });
      const result = await this.speakSegment(segment);
      if (result === 'interrupted') {
        outcome = 'interrupted';
        reason = this.lastError ?? 'The line was interrupted.';
        break;
      }
      if (result === 'failed') {
        outcome = 'failed';
        reason = this.lastError ?? 'The platform reported a speech error.';
        break;
      }
    }

    this.appendLog({
      id: job.id,
      at: localIso(),
      category: job.category,
      segments: spokenSegments,
      outcome,
      reason
    });
    if (outcome === 'spoken') this.lastSpokenAt.set(job.category, Date.now());

    this.current = null;
    this.emitState();
    this.pump();
  }

  /**
   * Speaks one segment and resolves when the platform says it is finished.
   *
   * The watchdog is not defensive decoration. Chromium's speech synthesis is
   * known to stop firing `end` on long utterances and to leave `speaking` stuck
   * true, which would wedge a strictly serialized queue forever — so a segment
   * that outstays a generous estimate of its own length is cancelled, logged,
   * and the queue moves on.
   */
  private speakSegment(segment: Segment): Promise<'spoken' | 'interrupted' | 'failed'> {
    return new Promise((resolve) => {
      if (!segment.voice || segment.text === '') {
        resolve('spoken');
        return;
      }
      let settled = false;
      const finish = (result: 'spoken' | 'interrupted' | 'failed'): void => {
        if (settled) return;
        settled = true;
        if (this.watchdog !== null) {
          window.clearTimeout(this.watchdog);
          this.watchdog = null;
        }
        resolve(result);
      };

      let utterance: SpeechSynthesisUtterance;
      try {
        utterance = new SpeechSynthesisUtterance(segment.text);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        finish('failed');
        return;
      }

      utterance.voice = segment.voice.voice;
      utterance.lang = segment.voice.lang;
      utterance.rate = segment.rate;
      utterance.pitch = segment.pitch;
      utterance.volume = this.ducking() ? segment.volume * this.duckFactor() : segment.volume;
      utterance.onend = () => finish('spoken');
      utterance.onerror = (event) => {
        const kind = (event as SpeechSynthesisErrorEvent).error ?? 'unknown';
        if (kind === 'interrupted' || kind === 'canceled') {
          finish('interrupted');
          return;
        }
        this.lastError = `The platform reported a speech error: ${kind}.`;
        finish('failed');
      };

      // Roughly 90 ms per character at rate 1, which is comfortably slower than
      // any real voice, plus three seconds for the platform to start at all.
      const estimated = 3000 + Math.max(3000, (segment.text.length * 90) / Math.max(0.25, segment.rate));
      this.watchdog = window.setTimeout(() => {
        this.lastError = 'The platform never reported the end of that line, so it was cancelled and the queue moved on.';
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Cancelling a synthesiser that has already gone away is not a failure.
        }
        finish('failed');
      }, estimated);

      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        finish('failed');
      }
    });
  }

  private cancelCurrent(reason: string): void {
    this.lastError = reason;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Nothing to cancel is the same outcome as a successful cancel.
    }
  }

  /** Stops everything now, including anything already waiting. */
  cancelAll(reason: string): void {
    for (const entry of this.pending.values()) window.clearTimeout(entry.timer);
    this.pending.clear();
    for (const job of this.queue) {
      this.appendLog({
        id: job.id,
        at: localIso(),
        category: job.category,
        segments: job.segments.map((segment) => ({
          language: segment.language,
          text: segment.text,
          voiceName: segment.voiceName
        })),
        outcome: 'dropped',
        reason
      });
    }
    this.queue = [];
    this.cancelCurrent(reason);
    this.current = null;
    this.emitState();
  }

  /* ---------------- the log ---------------- */

  private appendLog(line: SpokenLine): void {
    const limit = clamp(this.setting<number>(NARRATOR_LOG_LIMIT_ID, 200), 20, 2000, 200);
    this.log = [line, ...this.log].slice(0, limit);
    for (const listener of [...this.logListeners]) {
      try {
        listener(this.log);
      } catch (error) {
        console.error('A narrator log listener threw:', error);
      }
    }
  }

  lines(): SpokenLine[] {
    return [...this.log];
  }

  clearLog(): void {
    this.log = [];
    for (const listener of [...this.logListeners]) listener(this.log);
  }

  removeLines(ids: string[]): number {
    const set = new Set(ids);
    const before = this.log.length;
    this.log = this.log.filter((line) => !set.has(line.id));
    for (const listener of [...this.logListeners]) listener(this.log);
    return before - this.log.length;
  }

  onLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  /* ---------------- state ---------------- */

  state(): EngineState {
    return {
      supported: voiceRegistry.supported(),
      enabled: this.enabled(),
      speaking: this.current !== null,
      queued: this.queue.length,
      duckingFor: Math.max(0, this.duckUntil - Date.now()),
      silentReason: this.silentReason(),
      lastError: this.lastError
    };
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private emitState(): void {
    const snapshot = this.state();
    for (const listener of [...this.stateListeners]) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('A narrator state listener threw:', error);
      }
    }
  }

  private nextId(): string {
    this.counter += 1;
    return `narration-${this.counter}`;
  }
}

export const narrator = new NarratorEngine();

export { CATEGORIES };
