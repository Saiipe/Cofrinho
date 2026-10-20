import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { updateBook } from '@/data/books';
import { db } from '@/data/db';
import { customRateId, lookupRate, refreshMarketRates, setCustomRate } from '@/data/rates';
import { currencySymbol, parseLocaleNumber } from '@/domain/money';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { allCurrencies, currencyName } from '../currencies';
import { useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { CurrencyPickerSheet } from '../components/pickers';
import { Badge, Button, Card, Divider, Row, Spinner } from '../components/primitives';
import { Sheet } from '../components/Sheet';
import { useFormat } from '../hooks/useFormat';

export default function CurrenciesScreen() {
  const { settings, updateSettings, t, locale } = useApp();
  const { book, accounts, rates } = useBook();
  const format = useFormat();
  const { confirm, toast } = useFeedback();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [picking, setPicking] = useState<'book' | 'default' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const customCount = useLiveQuery(() => db.customRates.count(), []);
  const rateFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }), [locale]);

  const used = useMemo(() => [...new Set(accounts.map((a) => a.currency))].filter((c) => c !== book.currency), [accounts, book.currency]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCurrencies()
      .filter((code) => code !== book.currency)
      .map((code) => ({ code, name: currencyName(code, locale) }))
      .filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .sort((a, b) => Number(used.includes(b.code)) - Number(used.includes(a.code)));
  }, [query, locale, book.currency, used]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshMarketRates();
      toast(t('currencies.refreshed'), { tone: 'success' });
    } catch {
      toast(t('currencies.refreshFailed'), { tone: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const changeBookCurrency = async (code: string) => {
    if (code === book.currency) return;
    if (await confirm({ title: t('currencies.bookCurrency', { name: book.name }), message: t('books.currencyChanged'), confirmLabel: t('common.confirm') })) {
      await updateBook(book.id, { currency: code });
    }
  };

  return (
    <Page title={t('currencies.title')} back="/me">
      <div className="space-y-4 px-4">
        <Card className="overflow-hidden">
          <Row title={t('currencies.bookCurrency', { name: book.name })} trailing={`${book.currency} · ${currencyName(book.currency, locale)}`} onClick={() => setPicking('book')} chevron />
          <Divider />
          <Row title={t('currencies.defaultCurrency')} trailing={settings.defaultCurrency} onClick={() => setPicking('default')} chevron />
        </Card>

        <Card className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t('currencies.rates')}</p>
            <p className="text-xs text-muted">{settings.ratesUpdatedAt ? t('currencies.updated', { date: format.dateTime(settings.ratesUpdatedAt) }) : t('currencies.never')}</p>
          </div>
          <Button size="sm" variant="secondary" icon={refreshing ? undefined : RefreshCw} onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <Spinner className="size-4" /> : t('currencies.refresh')}
          </Button>
        </Card>

        <label className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 shadow-card">
          <Search className="size-4 text-faint" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('currencies.search')} className="h-full min-w-0 flex-1 bg-transparent outline-none" />
        </label>

        <Card className="overflow-hidden">
          {list.map(({ code, name }, index) => {
            const rate = lookupRate(rates, code, book.currency);
            const custom = rates.custom.has(customRateId(code, book.currency)) || rates.custom.has(customRateId(book.currency, code));
            return (
              <div key={code}>
                {index > 0 && <Divider inset />}
                <Row
                  onClick={() => setEditing(code)}
                  leading={<span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">{currencySymbol(code, locale)}</span>}
                  title={
                    <span className="flex items-center gap-1.5">
                      {code}
                      {used.includes(code) && <Badge tone="primary">{t('currencies.used')}</Badge>}
                      {custom && <Badge>{t('currencies.customBadge')}</Badge>}
                    </span>
                  }
                  subtitle={name}
                  trailing={rate === null ? t('currencies.noRate') : t('tx.rateLine', { from: code, rate: rateFormat.format(rate), to: book.currency })}
                  chevron={false}
                />
              </div>
            );
          })}
        </Card>
        <p className="px-1 text-xs text-muted">
          {t('currencies.source')} {customCount ? `· ${customCount} ${t('currencies.customBadge')}` : ''}
        </p>
      </div>

      <CurrencyPickerSheet open={picking === 'book'} onClose={() => setPicking(null)} value={book.currency} onSelect={(code) => void changeBookCurrency(code)} />
      <CurrencyPickerSheet open={picking === 'default'} onClose={() => setPicking(null)} value={settings.defaultCurrency} onSelect={(code) => void updateSettings({ defaultCurrency: code })} />
      {editing && <RateSheet code={editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function RateSheet({ code, onClose }: { code: string; onClose: () => void }) {
  const { t, locale } = useApp();
  const { book, rates } = useBook();
  const current = lookupRate(rates, code, book.currency);
  const [text, setText] = useState(current ? String(Number(current.toPrecision(6))).replace('.', locale === 'pt-BR' ? ',' : '.') : '');
  const value = parseLocaleNumber(text, locale === 'pt-BR' ? ',' : '.');
  const hasCustom = rates.custom.has(customRateId(code, book.currency)) || rates.custom.has(customRateId(book.currency, code));
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('currencies.custom')}
      footer={
        <div className="flex gap-2">
          {hasCustom && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                await setCustomRate(code, book.currency, null);
                onClose();
              }}
            >
              {t('currencies.useMarket')}
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={!value || value <= 0}
            onClick={async () => {
              await setCustomRate(code, book.currency, value);
              onClose();
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="px-4 pb-4">
        <p className="mb-3 text-sm text-muted">{t('currencies.customHint', { from: code, to: book.currency })}</p>
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span className="shrink-0 font-semibold">1 {code} =</span>
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))} className="h-10 min-w-0 flex-1 bg-transparent text-right text-xl font-semibold tabular outline-none" data-autofocus aria-label={t('currencies.custom')} />
          <span className="shrink-0 font-semibold">{book.currency}</span>
        </div>
      </div>
    </Sheet>
  );
}
