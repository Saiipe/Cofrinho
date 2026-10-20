import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownRight, ArrowUpRight, ChartColumn, ChevronLeft, ChevronRight, Landmark, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { bookTransactions, transactionsInPeriod } from '@/data/transactions';
import { accountBalances, balanceSheet, isLiability } from '@/domain/balances';
import { convertMinor } from '@/domain/money';
import { elapsedDaysInPeriod, shiftMonthPeriod, todayKey, yearPeriod, type Period } from '@/domain/dates';
import { categoryBreakdown, dailySeries, groupByDay, monthlySummaries, relativeChange, totals } from '@/domain/stats';
import type { CategoryKind, ID, Transaction } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { ColumnChart, ShareBar, type ColumnPoint } from '../components/charts';
import { CategoryIcon, EntityIcon } from '../components/EntityIcon';
import { Page } from '../components/Page';
import { Card, Divider, EmptyState, IconButton, Row, Segmented } from '../components/primitives';
import { Sheet } from '../components/Sheet';
import { TransactionDayList } from '../components/TransactionList';
import { useFormat } from '../hooks/useFormat';
import { usePeriod } from '../hooks/usePeriod';

type Tab = 'expense' | 'income' | 'accounts';

/** Split books chart their group expenses as expenses. */
function asStatKind(tx: Transaction): Transaction {
  return tx.kind === 'split_expense' ? { ...tx, kind: 'expense' } : tx;
}

export default function ChartsScreen() {
  const { t } = useApp();
  const { isSplit } = useBook();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'expense';
  const mode = params.get('mode') === 'year' ? 'year' : 'month';
  const setParam = (key: string, value: string | null) => {
    const copy = new URLSearchParams(params);
    if (value === null) copy.delete(key);
    else copy.set(key, value);
    if (key === 'mode') {
      copy.delete('m');
      copy.delete('y');
    }
    setParams(copy, { replace: true });
  };
  const tabs: { value: Tab; label: string }[] = isSplit
    ? [{ value: 'expense', label: t('common.expenses') }]
    : [
        { value: 'expense', label: t('common.expenses') },
        { value: 'income', label: t('common.income') },
        { value: 'accounts', label: t('charts.accounts') },
      ];

  return (
    <Page title={t('charts.title')} withTabs>
      <div className="space-y-4 px-4 pt-1">
        {tabs.length > 1 && <Segmented label={t('charts.title')} value={tab} onChange={(v) => setParam('tab', v === 'expense' ? null : v)} options={tabs} />}
        {tab === 'accounts' ? <AccountsView /> : <KindView kind={tab} mode={mode} onMode={(m) => setParam('mode', m === 'month' ? null : m)} />}
      </div>
    </Page>
  );
}

function KindView({ kind, mode, onMode }: { kind: CategoryKind; mode: 'month' | 'year'; onMode: (mode: 'month' | 'year') => void }) {
  const { t } = useApp();
  const { book, categoryMap, categoryName } = useBook();
  const format = useFormat();
  const { period, shift, startDay } = usePeriod(mode);
  const previous = mode === 'year' ? yearPeriod(period.year - 1, startDay) : shiftMonthPeriod(period, -1, startDay);
  const current = useLiveQuery(() => transactionsInPeriod(book.id, period), [book.id, period.start, period.end]);
  const before = useLiveQuery(() => transactionsInPeriod(book.id, previous), [book.id, previous.start, previous.end]);
  const [selectedCategory, setSelectedCategory] = useState<ID | null | undefined>(undefined);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const txs = useMemo(() => (current ?? []).map(asStatKind), [current]);
  const refs = useMemo(() => new Map([...categoryMap].map(([id, c]) => [id, { id, parentId: c.parentId }])), [categoryMap]);
  const slices = useMemo(() => categoryBreakdown(txs, kind, refs), [txs, kind, refs]);
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  const previousTotal = useMemo(() => {
    const sums = totals((before ?? []).map(asStatKind));
    return kind === 'expense' ? sums.expense : sums.income;
  }, [before, kind]);
  const change = relativeChange(total, previousTotal);

  const points: ColumnPoint[] = useMemo(() => {
    if (mode === 'year') {
      return monthlySummaries(txs, period.year, startDay).map((m) => ({ key: String(m.month), label: format.monthShort(m.month).slice(0, 3), value: kind === 'expense' ? m.expense : m.income }));
    }
    // Every fifth day plus the last one, unless it would crowd the previous label.
    return dailySeries(txs, period, kind).map((p, i, all) => {
      const last = all.length - 1;
      const showLabel = i % 5 === 0 || (i === last && last % 5 >= 3);
      return { key: p.day, label: showLabel ? String(Number(p.day.slice(8))) : '', value: p.amount };
    });
  }, [txs, mode, period, startDay, kind, format]);

  const today = todayKey();
  const activeMonths = Math.max(1, points.filter((p) => p.value > 0).length);
  const average = mode === 'year' ? total / activeMonths : total / elapsedDaysInPeriod(period, today);
  const peak = points.reduce<ColumnPoint | null>((best, p) => (!best || p.value > best.value ? p : best), null);
  const selected = points.find((p) => p.key === selectedPoint);
  const pointTitle = (p: ColumnPoint) => (mode === 'year' ? format.monthYear(period.year, Number(p.key)) : format.dayMonth(p.key));

  const topSlices = slices.slice(0, 5);
  const rest = slices.slice(5).reduce((sum, s) => sum + s.amount, 0);
  const segments = [
    ...topSlices.map((s) => {
      const category = s.categoryId ? categoryMap.get(s.categoryId) : undefined;
      return { key: s.categoryId ?? 'none', value: s.amount, color: category?.color ?? '#8b93a1', label: `${categoryName(category)} ${format.percent(s.ratio)}` };
    }),
    ...(rest > 0 ? [{ key: 'rest', value: rest, color: 'var(--faint)', label: `${t('common.other')} ${format.percent(rest / total)}` }] : []),
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center">
          <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => shift(-1)} />
          <span className="min-w-0 flex-1 truncate text-center text-[0.95rem] font-semibold">{mode === 'year' ? String(period.year) : format.monthYearShort(period.year, period.month)}</span>
          <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => shift(1)} />
        </div>
        <Segmented
          className="w-36 shrink-0"
          label={t('charts.month')}
          value={mode}
          onChange={onMode}
          options={[
            { value: 'month', label: t('charts.month') },
            { value: 'year', label: t('charts.year') },
          ]}
        />
      </div>

      {current && total === 0 ? (
        <Card>
          <EmptyState icon={ChartColumn} title={t('charts.noData')} />
        </Card>
      ) : (
        <>
          <Card className="px-4 pt-4 pb-4">
            <p className="text-sm text-muted">{kind === 'expense' ? t('common.expenses') : t('common.income')}</p>
            <p className="mt-0.5 text-[2rem] leading-tight font-semibold">{format.money(total)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-muted">
              <span>
                {mode === 'year' ? t('charts.monthlyAverage') : t('charts.dailyAverage')}: <span className="font-medium text-fg">{format.money(Math.round(average))}</span>
              </span>
              {change !== null && (
                <span className="inline-flex items-center gap-1">
                  {change >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                  {t('charts.vsPrevious', { value: format.percent(Math.abs(change), 0) })}
                </span>
              )}
            </div>
            <div className="mt-4">
              <ShareBar segments={segments} ariaLabel={segments.map((s) => s.label).join(', ')} onSelect={(key) => key !== 'rest' && setSelectedCategory(key === 'none' ? null : key)} />
            </div>
          </Card>

          <section>
            <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('charts.ranking')}</h2>
            <Card className="overflow-hidden">
              {slices.map((slice, index) => {
                const category = slice.categoryId ? categoryMap.get(slice.categoryId) : undefined;
                return (
                  <div key={slice.categoryId ?? 'none'}>
                    {index > 0 && <Divider inset />}
                    <button type="button" onClick={() => setSelectedCategory(slice.categoryId)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                      <CategoryIcon category={category} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[0.95rem] font-medium">{categoryName(category)}</span>
                          <span className="shrink-0 text-[0.95rem] font-semibold tabular">{format.money(slice.amount)}</span>
                        </span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, slice.ratio * 100)}%`, backgroundColor: category?.color ?? 'var(--faint)' }} />
                          </span>
                          <span className="w-12 shrink-0 text-right text-xs text-muted tabular">{format.percent(slice.ratio)}</span>
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </Card>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('charts.trend')}</h2>
              <IconButton icon={showTable ? ChartColumn : Table2} label={showTable ? t('charts.trend') : t('reports.byMonth')} onClick={() => setShowTable((v) => !v)} className="size-8" />
            </div>
            <Card className="px-3 pt-3 pb-2">
              <p className="mb-2 min-h-5 px-1 text-[0.8rem] text-muted">
                {selected ? (
                  <>
                    {pointTitle(selected)}: <span className="font-semibold text-fg">{format.money(selected.value)}</span>
                  </>
                ) : peak && peak.value > 0 ? (
                  t('charts.peak', { amount: format.money(peak.value), label: pointTitle(peak) })
                ) : null}
              </p>
              {showTable ? (
                <table className="w-full text-[0.85rem]">
                  <tbody>
                    {points
                      .filter((p) => p.value > 0)
                      .map((p) => (
                        <tr key={p.key} className="border-t border-line first:border-0">
                          <td className="py-2 pl-1">{pointTitle(p)}</td>
                          <td className="py-2 pr-1 text-right tabular">{format.money(p.value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <ColumnChart
                  points={points}
                  color={kind === 'expense' ? 'var(--chart-expense)' : 'var(--chart-income)'}
                  selected={selectedPoint}
                  onSelect={setSelectedPoint}
                  formatTick={(v) => format.compact(v)}
                  average={mode === 'year' ? average : undefined}
                  averageLabel={t('charts.average')}
                  ariaLabel={`${t('charts.trend')}: ${format.periodLabel(period)}`}
                />
              )}
            </Card>
          </section>
        </>
      )}

      <CategorySheet categoryId={selectedCategory} onClose={() => setSelectedCategory(undefined)} transactions={txs} kind={kind} period={period} />
    </>
  );
}

function CategorySheet({ categoryId, onClose, transactions, kind, period }: { categoryId: ID | null | undefined; onClose: () => void; transactions: Transaction[]; kind: CategoryKind; period: Period }) {
  const { categoryMap, categoryName } = useBook();
  const format = useFormat();
  const open = categoryId !== undefined;
  const category = categoryId ? categoryMap.get(categoryId) : undefined;
  const matching = transactions.filter((tx) => {
    if (tx.kind !== kind) return false;
    if (categoryId === null) return tx.categoryId === null;
    const c = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
    return c?.id === categoryId || c?.parentId === categoryId;
  });
  const refs = new Map([...categoryMap].map(([id, c]) => [id, { id, parentId: c.parentId }]));
  const subs = categoryId ? categoryBreakdown(matching, kind, refs, { level: 'children', parentId: categoryId }) : [];
  const total = matching.reduce((sum, tx) => sum + tx.amount, 0);
  return (
    <Sheet open={open} onClose={onClose} title={categoryName(category)} tall>
      <div className="px-4 pb-1">
        <p className="text-sm text-muted">{format.periodLabel(period)}</p>
        <p className="text-2xl font-semibold">{format.money(total)}</p>
      </div>
      {subs.length > 1 && (
        <div className="mx-4 mt-3 overflow-hidden rounded-2xl border border-line">
          {subs.map((s, i) => (
            <div key={s.categoryId ?? i}>
              {i > 0 && <Divider />}
              <Row leading={<CategoryIcon category={s.categoryId ? categoryMap.get(s.categoryId) : undefined} size="sm" />} title={categoryName(s.categoryId)} trailing={`${format.money(s.amount)} · ${format.percent(s.ratio, 0)}`} />
            </div>
          ))}
        </div>
      )}
      <TransactionDayList groups={groupByDay(matching)} className="pb-6" />
    </Sheet>
  );
}

function AccountsView() {
  const { t } = useApp();
  const { book, accounts, rate } = useBook();
  const format = useFormat();
  const all = useLiveQuery(() => bookTransactions(book.id), [book.id]);
  if (!all) return null;
  if (!accounts.length) {
    return (
      <Card>
        <EmptyState icon={Landmark} title={t('accounts.empty')} hint={t('charts.noAccounts')} action={<Link to="/accounts/new" className="font-semibold text-primary">{t('accounts.new')}</Link>} />
      </Card>
    );
  }
  const balances = accountBalances(accounts, all);
  const toBook = (amount: number, currency: string) => {
    const r = rate(currency, book.currency);
    return r === null ? 0 : convertMinor(amount, currency, book.currency, r);
  };
  const sheet = balanceSheet(accounts, balances, toBook);
  const tiles = [
    { label: t('charts.assets'), value: sheet.assets },
    { label: t('charts.liabilities'), value: sheet.liabilities },
  ];
  return (
    <>
      <Card className="px-4 py-4">
        <p className="text-sm text-muted">{t('charts.netWorth')}</p>
        <p className="mt-0.5 text-[2rem] leading-tight font-semibold">{format.money(sheet.net)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <p className="text-xs text-muted">{tile.label}</p>
              <p className="truncate text-base font-semibold">{format.money(tile.value)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        {accounts.map((account, index) => (
          <div key={account.id}>
            {index > 0 && <Divider inset />}
            <Row
              to={`/accounts/${account.id}`}
              leading={<EntityIcon icon={account.icon} color={account.color} />}
              title={account.name}
              subtitle={[isLiability(account.type) ? t('charts.liabilities') : t('charts.assets'), account.excludeFromTotals ? t('charts.excluded') : null].filter(Boolean).join(' · ')}
              trailing={<span className="font-semibold text-fg tabular">{format.money(balances.get(account.id) ?? 0, account.currency)}</span>}
              chevron={false}
            />
          </div>
        ))}
      </Card>
    </>
  );
}

