import { isNative } from './platform';

/**
 * Browser dictation (Chrome/Edge/Safari). The Android WebView has no Web Speech API; there the
 * keyboard's own microphone key dictates into the quick-entry field instead.
 */

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (isNative || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return recognitionClass() !== null;
}

/** Listens for one phrase; resolves with the transcript (empty when nothing was heard). */
export function listenOnce(lang: string): { result: Promise<string>; stop: () => void } {
  const Ctor = recognitionClass();
  if (!Ctor) return { result: Promise.reject(new Error('unsupported')), stop: () => {} };
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  const result = new Promise<string>((resolve, reject) => {
    let transcript = '';
    recognition.onresult = (event) => {
      transcript = event.results[0]?.[0]?.transcript ?? '';
    };
    recognition.onerror = (event) => (event.error === 'no-speech' ? resolve('') : reject(new Error(event.error)));
    recognition.onend = () => resolve(transcript);
    recognition.start();
  });
  return { result, stop: () => recognition.stop() };
}
