import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

/**
 * Short UI sounds synthesized with Web Audio (no audio assets) and haptic taps.
 * Preferences are pushed in by the settings provider.
 */

export type SoundVolume = 'low' | 'medium' | 'high';

export interface FeedbackPreferences {
  sound: boolean;
  /** Groups switched off are `false`; missing groups (added in later versions) play. */
  sounds: Partial<Record<SoundGroup, boolean>>;
  soundVolume: SoundVolume;
  haptics: boolean;
}

let prefs: FeedbackPreferences = { sound: true, sounds: {}, soundVolume: 'medium', haptics: true };
let audio: AudioContext | null = null;
let lastResultAt = -Infinity;

export function setFeedbackPreferences(next: FeedbackPreferences) {
  prefs = next;
}

/** `to` sweeps the pitch over the tone's duration. */
type Tone = { frequency: number; to?: number; duration: number; type: OscillatorType; gain: number; delay?: number };

const SOUNDS = {
  tap: [{ frequency: 520, duration: 0.035, type: 'triangle', gain: 0.05 }],
  key: [{ frequency: 520, duration: 0.035, type: 'triangle', gain: 0.05 }],
  select: [{ frequency: 660, duration: 0.045, type: 'sine', gain: 0.06 }],
  toggleOn: [
    { frequency: 587, duration: 0.05, type: 'sine', gain: 0.055 },
    { frequency: 880, duration: 0.07, type: 'sine', gain: 0.055, delay: 0.05 },
  ],
  toggleOff: [
    { frequency: 880, duration: 0.05, type: 'sine', gain: 0.05 },
    { frequency: 587, duration: 0.07, type: 'sine', gain: 0.05, delay: 0.05 },
  ],
  nav: [{ frequency: 440, to: 620, duration: 0.07, type: 'sine', gain: 0.06 }],
  open: [{ frequency: 300, to: 640, duration: 0.11, type: 'sine', gain: 0.05 }],
  close: [{ frequency: 600, to: 280, duration: 0.1, type: 'sine', gain: 0.045 }],
  pop: [{ frequency: 900, to: 1400, duration: 0.05, type: 'sine', gain: 0.05 }],
  save: [
    { frequency: 660, duration: 0.08, type: 'sine', gain: 0.08 },
    { frequency: 990, duration: 0.12, type: 'sine', gain: 0.07, delay: 0.07 },
  ],
  success: [
    { frequency: 784, duration: 0.08, type: 'sine', gain: 0.07 },
    { frequency: 1175, duration: 0.14, type: 'sine', gain: 0.06, delay: 0.08 },
  ],
  coin: [
    { frequency: 988, duration: 0.07, type: 'square', gain: 0.035 },
    { frequency: 1319, duration: 0.18, type: 'square', gain: 0.03, delay: 0.07 },
  ],
  celebrate: [
    { frequency: 523, duration: 0.1, type: 'triangle', gain: 0.07 },
    { frequency: 659, duration: 0.1, type: 'triangle', gain: 0.07, delay: 0.09 },
    { frequency: 784, duration: 0.1, type: 'triangle', gain: 0.07, delay: 0.18 },
    { frequency: 1047, duration: 0.32, type: 'triangle', gain: 0.07, delay: 0.27 },
  ],
  delete: [{ frequency: 380, to: 90, duration: 0.2, type: 'triangle', gain: 0.1 }],
  error: [
    { frequency: 247, duration: 0.09, type: 'square', gain: 0.025 },
    { frequency: 196, duration: 0.16, type: 'square', gain: 0.025, delay: 0.1 },
  ],
} satisfies Record<string, Tone[]>;

export type Sound = keyof typeof SOUNDS;

/** Sounds the person switches on and off together (Configurações › Sons), in screen order. */
export const SOUND_GROUPS = {
  buttons: ['tap'],
  keypad: ['key'],
  choices: ['select', 'toggleOn', 'toggleOff'],
  screens: ['nav', 'open', 'close'],
  hints: ['pop'],
  saved: ['save', 'success'],
  money: ['coin', 'celebrate'],
  delete: ['delete'],
  errors: ['error'],
} satisfies Record<string, Sound[]>;

export type SoundGroup = keyof typeof SOUND_GROUPS;

const GROUP_OF = Object.fromEntries(Object.entries(SOUND_GROUPS).flatMap(([group, sounds]) => sounds.map((sound) => [sound, group]))) as Record<Sound, SoundGroup>;
/** Sounds of an outcome (not of a touch); one per moment, so "saved" followed by its success toast plays once. */
const RESULT_SOUNDS = new Set<Sound>(['save', 'success', 'coin', 'celebrate', 'delete', 'error']);
const RESULT_GAP_MS = 400;
const VOLUME: Record<SoundVolume, number> = { low: 0.45, medium: 1, high: 1.8 };

export function isSound(name: string): name is Sound {
  return Object.hasOwn(SOUNDS, name);
}

export function playSound(name: Sound) {
  if (!prefs.sound || prefs.sounds[GROUP_OF[name]] === false || typeof window === 'undefined') return;
  if (RESULT_SOUNDS.has(name)) {
    const now = performance.now();
    if (now - lastResultAt < RESULT_GAP_MS) return;
    lastResultAt = now;
  }
  synthesize(name, VOLUME[prefs.soundVolume]);
}

/** Plays a sound for the settings screen, even when its group is off. */
export function previewSound(name: Sound, volume: SoundVolume) {
  synthesize(name, VOLUME[volume]);
}

function synthesize(name: Sound, volume: number) {
  try {
    audio ??= new AudioContext();
    if (audio.state !== 'running') {
      // Audio only starts from a touch; tones queued without one would burst out on the next tap.
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      void audio.resume();
    }
    const now = audio.currentTime;
    for (const tone of SOUNDS[name] as Tone[]) {
      const start = now + (tone.delay ?? 0);
      const end = start + tone.duration;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      if (tone.to) oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
      gain.gain.setValueAtTime(tone.gain * volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  } catch {
    // Audio is a nicety; never break the flow over it.
  }
}

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (!prefs.haptics) return;
  if (isNative) {
    if (kind === 'success') void Haptics.notification({ type: NotificationType.Success });
    else if (kind === 'warning') void Haptics.notification({ type: NotificationType.Warning });
    else void Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
    return;
  }
  navigator.vibrate?.(kind === 'light' ? 8 : kind === 'medium' ? 15 : [10, 40, 10]);
}
