import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, Search, SearchX, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { bookTransactions } from '@/data/transactions';
import { minorToDecimalString, parseLocaleNumber, toMinor } from '@/domain/money';
import { normalizeText } from '@/domain/quickEntry';
import { groupByDay } from '@/domain/stats';
import type { ID, TxKind } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { CategoryIcon } from '../components/EntityIcon';
import { useGoBack } from '../components/Page';
import { AccountPickerSheet } from '../components/pickers';
import { Button, Chip, EmptyState, IconButton } from '../components/primitives';
import { Sheet } from '../components/Sheet';
import { TransactionDayList } from '../components/TransactionList';
import { useFormat } from '../hooks/useFormat';

type KindFilter = 'all' | 'expense' | 'income' | 'transfer';

const KIND_MATCH: Record<Exclude<KindFilter, 'all'>, TxKind[]> = {
  expense: ['expense', 'split_expense'],
  income: ['income'],
  transfer: ['transfer', 'split_payment', 'adjustment'],
};

export default function SearchScreen() {
  const { t } = useApp();
  const { book, isSplit, categoryMap, categoryName, accountMap, topCategories } = useBook();
  const format = useFormat();
  const goBack = useGoBack('/');
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [kind, setKind] = useState<KindFilter>('all');
  const [categories, setCategories] = useState<ID[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<ID | null>(null);
  const [sheet, setSheet] = useState<'categories' | 'year' | 'account' | null>(null);
  const all = useLiveQuery(() => bookTransactions(book.id), [book.id]);

  const years = useMemo(() => [...new Set((all ?? []).map((tx) => new Date(tx.date).getFullYear()))].sort((a, b) => b - a), [all]);

  const results = useMemo(() => {
    if (!all) return [];
    const q = normalizeText(deferred.trim());
    const number = parseLocaleNumber(deferred);
    const selected = new Set(categories);
    return all.filter((tx) => {
      if (kind !== 'all' && !KIND_MATCH[kind].includes(tx.kind)) return false;
      if (year !== null && new Date(tx.date).getFullYear() !== year) return false;
      if (accountId && tx.accountId !== accountId && tx.toAccountId !== accountId) return false;
      if (selected.size) {
        const category = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
        if (!category || !(selected.has(category.id) || (category.parentId && selected.has(category.parentId)))) return false;
      }
      if (!q) return true;
      const category = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
      const parent = category?.parentId ? categoryMap.get(category.parentId) : undefined;
      const haystack = normalizeText(
        [tx.note, categoryName(category), parent ? categoryName(parent) : '', tx.accountId ? accountMap.get(tx.accountId)?.name : '', minorToDecimalString(tx.originalAmount, tx.currency)].join(' '),
      );
      if (haystack.includes(q)) return true;
      return number !== null && Math.abs(tx.originalAmount) === toMinor(Math.abs(number), tx.currency);
    });
  }, [all, deferred, kind, year, accountId, categories, categoryMap, categoryName, accountMap]);

  const groups = useMemo(() => groupByDay(results.slice(0, 500)), [results]);
  const sum = results.reduce((total, tx) => total + (tx.kind === 'income' ? tx.amount : tx.kind === 'expense' || tx.kind === 'split_expense' ? -tx.amount : 0), 0);
  const filtersActive = kind !== 'all' || categories.length > 0 || year !== null || accountId !== null;

  const kinds: { value: KindFilter; label: string }[] = [
    { value: 'all', label: t('search.anyType') },
    { value: 'expense', label: t('common.expenses') },
    ...(isSplit ? [] : [{ value: 'income' as const, label: t('common.income') }]),
    { value: 'transfer', label: t('kind.transfer') },
  ];

  return (
    <div className="min-h-dvh bg-bg pb-10">
      <header className="sticky top-0 z-30 bg-surface/95 pt-safe backdrop-blur">
        <div className="flex h-14 items-center gap-1 px-2">
          <IconButton icon={ArrowLeft} label={t('common.back')} onClick={goBack} />
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3">
            <Search className="size-4 shrink-0 text-faint" aria-hidden />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search.placeholder')} enterKeyHint="search" className="h-full min-w-0 flex-1 bg-transparent outline-none" aria-label={t('common.search')} />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('common.clear')}>
                <X className="size-4 text-faint" aria-hidden />
              </button>
            )}
          </label>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {kinds.map((k) => (
            <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>
              {k.label}
            </Chip>
          ))}
          <Chip active={categories.length > 0} onClick={() => setSheet('categories')}>
            {categories.length ? t('search.selectedCount', { count: categories.length }) : t('search.categories')}
          </Chip>
          <Chip active={year !== null} onClick={() => setSheet('year')}>
            {year ?? t('search.year')}
          </Chip>
          {!isSplit && (
            <Chip active={accountId !== null} onClick={() => setSheet('account')}>
              {accountId ? accountMap.get(accountId)?.name : t('search.accounts')}
            </Chip>
          )}
          {filtersActive && (
            <Chip
              onClick={() => {
                setKind('all');
                setCategories([]);
                setYear(null);
                setAccountId(null);
              }}
            >
              <X className="size-4" aria-hidden />
              {t('common.clear')}
            </Chip>
          )}
        </div>
      </header>

      {(query || filtersActive) && (
        <div className="flex items-baseline justify-between px-5 pt-3 text-sm text-muted">
          <span>{t('search.results', { count: results.length })}</span>
          {results.length > 0 && (
            <span>
              {t('search.sum')}: <b className="text-fg tabular">{format.money(sum, undefined, { sign: 'always' })}</b>
            </span>
          )}
        </div>
      )}
      {all && results.length === 0 ? <EmptyState icon={SearchX} title={t('search.empty')} /> : <TransactionDayList groups={groups} className="pt-1" />}

      <Sheet open={sheet === 'categories'} onClose={() => setSheet(null)} title={t('search.categories')} tall footer={<Button block onClick={() => setSheet(null)}>{t('common.done')}</Button>}>
        <div className="pb-3">
          {(['expense', 'income'] as const).map((k) =>
            topCategories(k).map((c) => {
              const active = categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategories((list) => (active ? list.filter((id) => id !== c.id) : [...list, c.id]))}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2"
                >
                  <CategoryIcon category={c} />
                  <span className="min-w-0 flex-1 truncate font-medium">{categoryName(c)}</span>
                  {active && <Check className="size-5 text-primary" aria-hidden />}
                </button>
              );
            }),
          )}
        </div>
      </Sheet>
      <Sheet open={sheet === 'year'} onClose={() => setSheet(null)} title={t('search.year')}>
        <div className="flex flex-wrap gap-2 px-4 pb-5">
          <Chip active={year === null} onClick={() => { setYear(null); setSheet(null); }}>
            {t('search.anyYear')}
          </Chip>
          {years.map((y) => (
            <Chip key={y} active={year === y} onClick={() => { setYear(y); setSheet(null); }}>
              {y}
            </Chip>
          ))}
        </div>
      </Sheet>
      <AccountPickerSheet open={sheet === 'account'} onClose={() => setSheet(null)} value={accountId} onSelect={(a) => setAccountId(a?.id ?? null)} title={t('search.accounts')} />
    </div>
  );
}
