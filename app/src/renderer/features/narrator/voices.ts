import type { NarratedLanguage } from './model';

/**
 * The platform's voice list, and the honest description of what is in effect.
 *
 * Two things about platform speech synthesis decide the shape of this file.
 *
 * THE LIST ARRIVES LATE. `speechSynthesis.getVoices()` commonly returns an
 * empty array on the first call and fills in a moment later behind the
 * `voiceschanged` event. A picker that reads the list once reports "no voices
 * installed" on a machine with forty of them, and looks broken rather than
 * slow. So this registry starts in a `pending` state, subscribes to the event,
 * re-reads on a bounded schedule, and only reports `empty` after the machine
 * has genuinely had its chance to answer.
 *
 * A VOICE IS IDENTIFIED BY ITS URI, NEVER BY ITS NAME. Display names are not
 * unique — one machine can carry several voices called "Microsoft Zira" from
 * different engines — and platforms localize them, so a profile written on one
 * install silently stops matching on another. `voiceURI` is the stable identity
 * and it is the only thing this feature persists.
 */

export interface VoiceInfo {
  /** The stable identity. This is what gets persisted. */
  voiceURI: string;
  /** The display name. Shown, never stored. */
  name: string;
  /** The BCP 47 tag the platform reports, e.g. `en-GB`, `zh-HK`. */
  lang: string;
  /** False means the voice is synthesised over the network. */
  localService: boolean;
  /** True when the platform marks it the default for its language. */
  isDefault: boolean;
  voice: SpeechSynthesisVoice;
}

export type VoiceListState =
  /** This build has no speech synthesis at all. */
  | 'unsupported'
  /** The platform has not answered yet. */
  | 'pending'
  /** The platform answered with at least one voice. */
  | 'ready'
  /** The platform answered, and there are genuinely no voices installed. */
  | 'empty';

export type VoiceChoiceReason =
  /** The user's chosen voice is installed and will speak. */
  | 'chosen'
  /** No choice was made; the registry picked one and says which. */
  | 'automatic'
  /** A choice was made, that voice is not installed, and a fallback speaks. */
  | 'missing-fallback'
  /** A choice was made, that voice is not installed, and nothing can replace it. */
  | 'missing-silent'
  /** No voice on this machine can read the language at all. */
  | 'none';

export interface VoiceResolution {
  reason: VoiceChoiceReason;
  /** The voice that will actually speak, or null when nothing can. */
  voice: VoiceInfo | null;
  /** The stored identity, kept verbatim even when it is not installed. */
  storedUri: string;
  /** True when the resolved voice is synthesised over the network. */
  network: boolean;
}

/** How long the registry waits for a platform that never fires the event. */
const ENUMERATION_TIMEOUT_MS = 8000;
const ENUMERATION_POLL_MS = 250;

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/_/g, '-');
}

/**
 * Whether a voice can read one of the two narrated languages.
 *
 * Cantonese is the case worth writing down: platforms label it `yue`,
 * `zh-yue`, `zh-HK` or `zh-Hant-HK` depending on the engine, and a naive
 * `startsWith('zh')` would also capture Mandarin voices, which cannot read
 * Cantonese and would produce confidently wrong speech rather than silence.
 */
export function voiceSpeaks(lang: string, language: NarratedLanguage): boolean {
  const tag = normalizeTag(lang);
  if (language === 'en') return tag === 'en' || tag.startsWith('en-');
  return (
    tag === 'yue' ||
    tag.startsWith('yue-') ||
    tag.startsWith('zh-yue') ||
    tag === 'zh-hk' ||
    tag.startsWith('zh-hk-') ||
    tag.startsWith('zh-hant-hk') ||
    tag.startsWith('zh-hans-hk')
  );
}

type Listener = () => void;

class VoiceRegistry {
  private state: VoiceListState = 'pending';
  private voices: VoiceInfo[] = [];
  private readonly listeners = new Set<Listener>();
  private pollTimer: number | null = null;
  private deadlineTimer: number | null = null;
  private started = false;
  private onVoicesChanged: (() => void) | null = null;

  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  /** Begins enumeration. Safe to call more than once. */
  start(): void {
    if (this.started) return;
    this.started = true;
    if (!this.supported()) {
      this.state = 'unsupported';
      this.emit();
      return;
    }

    this.read();

    // The event is the reliable route on Chromium; the poll and the deadline
    // are the safety net for a platform that fills the list without firing it.
    this.onVoicesChanged = () => this.read();
    window.speechSynthesis.addEventListener('voiceschanged', this.onVoicesChanged);

    this.pollTimer = window.setInterval(() => this.read(), ENUMERATION_POLL_MS);
    this.deadlineTimer = window.setTimeout(() => {
      this.stopPolling();
      if (this.voices.length === 0) {
        this.state = 'empty';
        this.emit();
      }
    }, ENUMERATION_TIMEOUT_MS);
  }

  /** Re-reads the platform list immediately, e.g. when a panel is opened. */
  refresh(): void {
    if (!this.supported()) return;
    this.read();
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.deadlineTimer !== null) {
      window.clearTimeout(this.deadlineTimer);
      this.deadlineTimer = null;
    }
  }

  private read(): void {
    let raw: SpeechSynthesisVoice[] = [];
    try {
      raw = window.speechSynthesis.getVoices();
    } catch {
      // Some platforms throw before the speech service has started. That is not
      // an error state: it is the same "not answered yet" the poll is for.
      return;
    }
    if (raw.length === 0) return;

    const mapped: VoiceInfo[] = raw.map((voice) => ({
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      isDefault: voice.default,
      voice
    }));

    const changed =
      mapped.length !== this.voices.length ||
      mapped.some((entry, index) => entry.voiceURI !== this.voices[index]?.voiceURI);

    this.voices = mapped;
    if (this.state !== 'ready' || changed) {
      this.state = 'ready';
      this.stopPolling();
      this.emit();
    }
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('A narrator voice listener threw:', error);
      }
    }
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  listState(): VoiceListState {
    return this.state;
  }

  all(): VoiceInfo[] {
    return [...this.voices];
  }

  /** Every installed voice that can read one narrated language. */
  forLanguage(language: NarratedLanguage): VoiceInfo[] {
    return this.voices
      .filter((entry) => voiceSpeaks(entry.lang, language))
      .sort((left, right) => {
        // Local voices first: they work offline and start faster. The platform's
        // own default sorts ahead of its siblings inside each group.
        if (left.localService !== right.localService) return left.localService ? -1 : 1;
        if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
        return left.name.localeCompare(right.name);
      });
  }

  byUri(uri: string): VoiceInfo | null {
    return this.voices.find((entry) => entry.voiceURI === uri) ?? null;
  }

  /**
   * What will actually speak for one track, and why.
   *
   * A stored choice is never silently reset. When the chosen voice is not
   * installed on this computer the choice stays exactly where the user put it,
   * a fallback speaks in the meantime, and the interface says both of those
   * things rather than showing a picker that has quietly moved.
   */
  resolve(language: NarratedLanguage, storedUri: string): VoiceResolution {
    const candidates = this.forLanguage(language);
    const automatic = candidates[0] ?? null;

    if (storedUri === '') {
      return {
        reason: automatic ? 'automatic' : 'none',
        voice: automatic,
        storedUri,
        network: automatic ? !automatic.localService : false
      };
    }

    const chosen = this.byUri(storedUri);
    if (chosen) {
      return { reason: 'chosen', voice: chosen, storedUri, network: !chosen.localService };
    }
    if (automatic) {
      return { reason: 'missing-fallback', voice: automatic, storedUri, network: !automatic.localService };
    }
    // The choice is not installed AND nothing else here reads the language, so
    // there is genuinely nothing to fall back to. The stored identity still
    // travels back with the answer: it is the user's choice, not a stale value
    // to be discarded because this machine cannot honour it today.
    return { reason: 'missing-silent', voice: null, storedUri, network: false };
  }

  /** Releases the platform subscription. Called when the window tears down. */
  destroy(): void {
    this.stopPolling();
    if (this.onVoicesChanged && this.supported()) {
      window.speechSynthesis.removeEventListener('voiceschanged', this.onVoicesChanged);
    }
    this.onVoicesChanged = null;
    this.listeners.clear();
    this.started = false;
  }
}

export const voiceRegistry = new VoiceRegistry();
