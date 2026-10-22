import type { NumberStyle } from '@/domain/money';
import type { ID } from '@/domain/types';
import { detectLanguage, type Language } from '@/i18n';
import type { SoundGroup, SoundVolume } from '@/services/feedback';
import { db } from './db';

export type ThemeId = 'teal' | 'ocean' | 'sunset' | 'rose' | 'grape' | 'sunny' | 'graphite';

/** Primary color per theme (light mode); dark variants are derived in CSS. */
export const THEMES: { id: ThemeId; primary: string }[] = [
  { id: 'teal', primary: '#0f766e' },
  { id: 'ocean', primary: '#1d4ed8' },
  { id: 'sunset', primary: '#c2410c' },
  { id: 'rose', primary: '#be185d' },
  { id: 'grape', primary: '#6d28d9' },
  { id: 'sunny', primary: '#a16207' },
  { id: 'graphite', primary: '#334155' },
];

export type DarkMode = 'system' | 'light' | 'dark';

export const FONT_SCALES = [
  { value: 0.9, key: 'settings.font.small' },
  { value: 1, key: 'settings.font.normal' },
  { value: 1.12, key: 'settings.font.large' },
  { value: 1.25, key: 'settings.font.xlarge' },
] as const;

export interface Settings {
  language: Language;
  /** Currency proposed for new books. */
  defaultCurrency: string;
  currentBookId: ID | null;
  theme: ThemeId;
  darkMode: DarkMode;
  iconStyle: 'color' | 'mono';
  fontScale: number;
  showBalance: boolean;
  balanceMode: 'period' | 'total';
  hideAmounts: boolean;
  calendarEntry: boolean;
  calendarAmounts: boolean;
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  weekStart: number;
  /** First day (1–28) of each financial month. */
  monthStartDay: number;
  numberStyle: NumberStyle;
  grouping: boolean;
  calculator: 'basic' | 'full';
  showSubcategories: boolean;
  quickEntry: boolean;
  sound: boolean;
  /** Sound groups switched off (`false`); the rest play while `sound` is on. */
  sounds: Partial<Record<SoundGroup, boolean>>;
  soundVolume: SoundVolume;
  haptics: boolean;
  gardenEntry: boolean;
  onboarded: boolean;
  lastBackupAt: number | null;
  ratesUpdatedAt: number | null;
  /** Version whose release notes were already shown; null for installs made before 5.1. */
  lastSeenVersion: string | null;
}

const REGION_CURRENCY: Record<string, string> = {
  BR: 'BRL', PT: 'EUR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', AO: 'AOA', MZ: 'MZN', AR: 'ARS', CL: 'CLP',
  CO: 'COP', MX: 'MXN', PE: 'PEN', UY: 'UYU', PY: 'PYG', BO: 'BOB', ES: 'EUR', FR: 'EUR', DE: 'EUR', IT: 'EUR',
  IE: 'EUR', NL: 'EUR', BE: 'EUR', JP: 'JPY', CN: 'CNY', IN: 'INR', CH: 'CHF', ZA: 'ZAR', NZ: 'NZD',
};

export function guessCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return (region && REGION_CURRENCY[region]) ?? 'USD';
  } catch {
    return 'BRL';
  }
}

export const DEFAULT_SETTINGS: Settings = {
  language: detectLanguage(),
  defaultCurrency: 'BRL',
  currentBookId: null,
  theme: 'teal',
  darkMode: 'system',
  iconStyle: 'color',
  fontScale: 1,
  showBalance: true,
  balanceMode: 'period',
  hideAmounts: false,
  calendarEntry: true,
  calendarAmounts: true,
  weekStart: 0,
  monthStartDay: 1,
  numberStyle: 'locale',
  grouping: true,
  calculator: 'basic',
  showSubcategories: true,
  quickEntry: true,
  sound: true,
  sounds: {},
  soundVolume: 'medium',
  haptics: true,
  gardenEntry: true,
  onboarded: false,
  lastBackupAt: null,
  ratesUpdatedAt: null,
  lastSeenVersion: null,
};

const SETTINGS_KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const current = await getSettings();
    await db.kv.put({ key: SETTINGS_KEY, value: { ...current, ...patch } });
  });
}

export async function readKv<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? ({ ...fallback, ...(row.value as object) } as T) : fallback;
}

export async function writeKv<T>(key: string, value: T): Promise<void> {
  await db.kv.put({ key, value });
}
