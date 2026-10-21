import { useState } from 'react';
import { createBook } from '@/data/books';
import { guessCurrency } from '@/data/settings';
import { BOOK_COLORS } from '@/domain/defaults';
import { currencySymbol } from '@/domain/money';
import { createTranslator, LANGUAGES, type Language } from '@/i18n';
import { APP_VERSION } from '@/services/platform';
import { useApp } from '../app/AppContext';
import { currencyName } from '../currencies';
import { CurrencyPickerSheet } from '../components/pickers';
import { Button, Segmented } from '../components/primitives';
import { AppLogo } from '../components/AppLogo';

/** First run: language and main currency, then a personal book with default categories. */
export default function OnboardingScreen() {
  const { settings, updateSettings } = useApp();
  const [language, setLanguage] = useState<Language>(settings.language);
  const [currency, setCurrency] = useState(() => guessCurrency());
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = createTranslator(language);

  const start = async () => {
    setBusy(true);
    const book = await createBook({ name: t('books.defaultName'), type: 'personal', currency, color: BOOK_COLORS[0]! });
    // A fresh install has nothing "new" to announce.
    await updateSettings({ language, defaultCurrency: currency, currentBookId: book.id, onboarded: true, lastSeenVersion: APP_VERSION });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-6 pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-center py-10">
        <AppLogo className="mb-6 size-20 drop-shadow-lg" />
        <h1 className="text-[1.75rem] leading-tight font-bold">{t('onboarding.welcome')}</h1>
        <p className="mt-3 text-[0.95rem] text-muted">{t('onboarding.subtitle')}</p>

        <div className="mt-10 space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-muted">{t('onboarding.language')}</p>
            <Segmented label={t('onboarding.language')} value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted">{t('onboarding.currency')}</p>
            <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-card active:bg-surface-2">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">{currencySymbol(currency, language)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{currency}</span>
                <span className="block truncate text-sm text-muted">{currencyName(currency, language)}</span>
              </span>
            </button>
            <p className="mt-2 text-xs text-muted">{t('onboarding.currencyHint')}</p>
          </div>
        </div>
      </div>
      <Button size="lg" block onClick={() => void start()} disabled={busy} className="mb-4">
        {t('onboarding.start')}
      </Button>
      <CurrencyPickerSheet open={picking} onClose={() => setPicking(false)} value={currency} onSelect={setCurrency} title={t('onboarding.currency')} />
    </div>
  );
}
