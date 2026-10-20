import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { db } from '@/data/db';
import { transactionsInPeriod } from '@/data/transactions';
import { budgetProgress } from '@/domain/budget';
import { monthPeriodOf, todayKey } from '@/domain/dates';
import { categoryBreakdown, monthlySummaries, totals } from '@/domain/stats';
import type { Transaction } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { ChartLegend, Meter, PairedColumnChart } from '../components/charts';
import { CategoryIcon } from '../components/EntityIcon';
import { Page } from '../components/Page';
import { Card, cx, Divider, IconButton, Row } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';
import { usePeriod } from '../hooks/usePeriod';

const asStatKind = (tx: Transaction): Transaction => (tx.kind === 'split_expense' ? { ...tx, kind: 'expense' } : tx);

export default function ReportsScreen() {
  const { t } = useApp();
  const { book, isSplit, categoryMap, categoryName } = useBook();
  const format = useFormat();
  const navigate = useNavigate();
  const { period, shift, startDay } = usePeriod('year');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const raw = useLiveQuery(() => transactionsInPeriod(book.id, period), [book.id, period.start, period.end]);
  const thisMonth = monthPeriodOf(todayKey(), startDay);
  const monthTx = useLiveQuery(() => transactionsInPeriod(book.id, thisMonth), [book.id, thisMonth.start, thisMonth.end]);
  const budgets = useLiveQuery(() => db.budgets.where('bookId').equals(book.id).toArray(), [book.id]);

  const txs = useMemo(() => (raw ?? []).map(asStatKind), [raw]);
  const year = totals(txs);
  const months = useMemo(() => monthlySummaries(txs, period.year, startDay), [txs, period.year, startDay]);
  const refs = useMemo(() => new Map([...categoryMap].map(([id, c]) => [id, { id, parentId: c.parentId }])), [categoryMap]);
  const top = useMemo(() => categoryBreakdown(txs, 'expense', refs).slice(0, 5), [txs, refs]);
  const monthsCounted = Math.max(1, months.filter((m) => m.count > 0).length);
  const savingsRate = year.income > 0 ? year.balance / year.income : null;
  const totalBudget = budgets?.find((b) => b.categoryId === null)?.amount ?? 0;
  const monthSpent = totals(monthTx ?? []).expense;
  const selected = months.find((m) => String(m.month) === selectedMonth);

  const health =
    savingsRate === null
      ? { icon: Info, tone: 'text-muted', text: t('reports.healthNone') }
      : savingsRate >= 0.2
        ? { icon: CircleCheck, tone: 'text-[var(--status-good)]', text: t('reports.healthGreat', { value: format.percent(savingsRate, 0) }) }
        : savingsRate >= 0
          ? { icon: Info, tone: 'text-primary', text: t('reports.healthOk', { value: format.percent(savingsRate, 0) }) }
          : { icon: CircleAlert, tone: 'text-[var(--status-critical)]', text: t('reports.healthBad', { amount: format.money(-year.balance) }) };
  const HealthIcon = health.icon;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Page title={t('reports.title')} withTabs>
      <div className="space-y-4 px-4 pt-1">
        <div className="flex items-center justify-between">
          <IconButton icon={ChevronLeft} label={String(period.year - 1)} onClick={() => shift(-1)} />
          <span className="text-lg font-semibold tabular">{t('reports.yearSummary', { year: String(period.year) })}</span>
          <IconButton icon={ChevronRight} label={String(period.year + 1)} onClick={() => shift(1)} />
        </div>

        <Card className="grid grid-cols-3 divide-x divide-line px-1 py-4 text-center">
          {[
            { label: t('common.income'), value: year.income, hidden: isSplit },
            { label: t('common.expenses'), value: year.expense, hidden: false },
            { label: t('common.balance'), value: year.balance, hidden: isSplit },
          ]
            .filter((item) => !item.hidden)
            .map((item) => (
              <div key={item.label} className="min-w-0 px-2">
                <p className="text-xs text-muted">{item.label}</p>
                <p className="mt-0.5 truncate text-[1.05rem] font-semibold">{format.money(item.value)}</p>
              </div>
            ))}
        </Card>

        {!isSplit && (
          <Card className="flex items-start gap-3 px-4 py-3.5">
            <HealthIcon className={cx('mt-0.5 size-5 shrink-0', health.tone)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('reports.health')}</p>
              <p className="mt-0.5 text-sm text-muted">{health.text}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                <span>
                  {t('reports.avgIncome')}: <b className="text-fg">{format.money(Math.round(year.income / monthsCounted))}</b>
                </span>
                <span>
                  {t('reports.avgExpense')}: <b className="text-fg">{format.money(Math.round(year.expense / monthsCounted))}</b>
                </span>
              </div>
            </div>
          </Card>
        )}

        <section>
          <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('reports.byMonth')}</h2>
          <Card className="px-3 pt-3 pb-2">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <ChartLegend
                items={[
                  ...(isSplit ? [] : [{ color: 'var(--chart-income)', label: t('common.income') }]),
                  { color: 'var(--chart-expense)', label: t('common.expenses') },
                ]}
              />
            </div>
            <p className="mb-1 min-h-5 px-1 text-[0.8rem] text-muted">
              {selected && (
                <>
                  {format.monthYear(period.year, selected.month)}: {!isSplit && <b className="text-fg">+{format.money(selected.income)}</b>} <b className="text-fg">−{format.money(selected.expense)}</b>
                </>
              )}
            </p>
            <PairedColumnChart
              points={months.map((m) => ({ key: String(m.month), label: format.monthShort(m.month).slice(0, 1), a: isSplit ? 0 : m.income, b: m.expense }))}
              colors={['var(--chart-income)', 'var(--chart-expense)']}
              selected={selectedMonth}
              onSelect={setSelectedMonth}
              formatTick={(v) => format.compact(v)}
              ariaLabel={t('reports.byMonth')}
            />
          </Card>
          <Card className="mt-3 overflow-hidden">
            <table className="w-full text-[0.85rem]">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 font-medium">{t('reports.month')}</th>
                  {!isSplit && <th className="py-2.5 text-right font-medium">{t('common.income')}</th>}
                  <th className="py-2.5 text-right font-medium">{t('common.expenses')}</th>
                  {!isSplit && <th className="py-2.5 pr-4 text-right font-medium">{t('common.balance')}</th>}
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr
                    key={m.month}
                    onClick={() => navigate(`/?m=${m.period.year}-${pad(m.period.month + 1)}`)}
                    className={cx('cursor-pointer border-t border-line active:bg-surface-2', m.count === 0 && 'text-faint')}
                  >
                    <td className="py-2.5 pl-4">{format.monthShort(m.month)}</td>
                    {!isSplit && <td className="py-2.5 text-right tabular">{format.money(m.income, undefined, { symbol: false })}</td>}
                    <td className="py-2.5 text-right tabular">{format.money(m.expense, undefined, { symbol: false })}</td>
                    {!isSplit && <td className={cx('py-2.5 pr-4 text-right font-medium tabular', m.balance < 0 && 'text-danger')}>{format.money(m.balance, undefined, { symbol: false })}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        {top.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('reports.topCategories')}</h2>
            <Card className="overflow-hidden">
              {top.map((slice, index) => {
                const category = slice.categoryId ? categoryMap.get(slice.categoryId) : undefined;
                return (
                  <div key={slice.categoryId ?? 'none'}>
                    {index > 0 && <Divider inset />}
                    <Row leading={<CategoryIcon category={category} />} title={categoryName(category)} subtitle={format.percent(slice.ratio)} trailing={<span className="font-semibold text-fg tabular">{format.money(slice.amount)}</span>} />
                  </div>
                );
              })}
            </Card>
          </section>
        )}

        {!isSplit && (
          <section>
            <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('reports.budget')}</h2>
            <Card className="px-4 py-3.5">
              {totalBudget > 0 ? (
                <>
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span>
                      {format.money(monthSpent)} / {format.money(totalBudget)}
                    </span>
                    <span className="text-muted tabular">{format.percent(budgetProgress(totalBudget, monthSpent).ratio, 0)}</span>
                  </div>
                  <Meter ratio={budgetProgress(totalBudget, monthSpent).ratio} label={t('budget.total')} />
                </>
              ) : (
                <p className="text-sm text-muted">
                  {t('reports.noBudget')}{' '}
                  <Link to="/budget" className="font-semibold text-primary">
                    {t('reports.setBudget')}
                  </Link>
                </p>
              )}
            </Card>
          </section>
        )}
      </div>
    </Page>
  );
}
