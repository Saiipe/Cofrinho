import { en } from './en';
import { ptBR, type MessageKey } from './pt-BR';

export type { MessageKey };

export type Language = 'pt-BR' | 'en';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'en', label: 'English' },
];

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { 'pt-BR': ptBR, en };

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

export function isLanguage(value: unknown): value is Language {
  return value === 'pt-BR' || value === 'en';
}

export function createTranslator(language: Language): Translate {
  const dictionary = DICTIONARIES[language];
  const numbers = new Intl.NumberFormat(language);
  return (key, params) => {
    let message: string = dictionary[key] ?? ptBR[key] ?? key;
    if (message.includes('|')) {
      const [one, other] = message.split('|') as [string, string];
      message = typeof params?.count === 'number' && Math.abs(params.count) === 1 ? one : other;
    }
    if (!params) return message;
    return message.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name];
      if (value === undefined) return match;
      return typeof value === 'number' ? numbers.format(value) : value;
    });
  };
}

export function detectLanguage(): Language {
  const preferred = typeof navigator === 'undefined' ? 'pt-BR' : navigator.language;
  return preferred.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}
