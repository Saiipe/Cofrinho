import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

/**
 * Short UI sounds synthesized with Web Audio (no audio assets) and haptic taps.
 * Preferences are pushed in by the settings provider.
 */

let prefs = { sound: true, haptics: true };
let audio: AudioContext | null = null;

export function setFeedbackPreferences(next: { sound: boolean; haptics: boolean }) {
  prefs = next;
}

type Tone = { frequency: number; duration: number; type: OscillatorType; gain: number; delay?: number };

const SOUNDS: Record<'tap' | 'save' | 'coin', Tone[]> = {
  tap: [{ frequency: 520, duration: 0.035, type: 'triangle', gain: 0.05 }],
  save: [
    { frequency: 660, duration: 0.08, type: 'sine', gain: 0.08 },
    { frequency: 990, duration: 0.12, type: 'sine', gain: 0.07, delay: 0.07 },
  ],
  coin: [
    { frequency: 988, duration: 0.07, type: 'square', gain: 0.035 },
    { frequency: 1319, duration: 0.18, type: 'square', gain: 0.03, delay: 0.07 },
  ],
};

export function playSound(name: keyof typeof SOUNDS) {
  if (!prefs.sound || typeof window === 'undefined') return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const now = audio.currentTime;
    for (const tone of SOUNDS[name]) {
      const start = now + (tone.delay ?? 0);
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(tone.gain, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.02);
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
