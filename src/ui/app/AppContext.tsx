import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { getSettings, updateSettings, type Settings } from '@/data/settings';
import { createTranslator, type Language, type Translate } from '@/i18n';
import { setFeedbackPreferences } from '@/services/feedback';

interface AppContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  t: Translate;
  locale: Language;
  dark: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function AppProvider({ children, splash }: { children: ReactNode; splash: ReactNode }) {
  const settings = useLiveQuery(getSettings, []);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const dark = settings ? settings.darkMode === 'dark' || (settings.darkMode === 'system' && systemDark) : systemDark;

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.classList.toggle('dark', dark);
    root.style.setProperty('--font-scale', String(settings.fontScale));
    root.lang = settings.language;
    const surface = getComputedStyle(root).getPropertyValue('--surface').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface || '#ffffff');
    setFeedbackPreferences({ sound: settings.sound, sounds: settings.sounds, soundVolume: settings.soundVolume, haptics: settings.haptics });
  }, [settings, dark]);

  const value = useMemo<AppContextValue | null>(
    () => (settings ? { settings, updateSettings, t: createTranslator(settings.language), locale: settings.language, dark } : null),
    [settings, dark],
  );
  if (!value) return <>{splash}</>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp outside AppProvider');
  return value;
}

export function useT(): Translate {
  return useApp().t;
}
