import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { db } from '@/data/db';
import { transactionsInPeriod } from '@/data/transactions';
import { budgetProgress, dailyAllowance } from '@/domain/budget';
import { addDays, calendarWeeks, dayStart, monthPeriodOf, parseDayKey, todayKey, weekdayOrder } from '@/domain/dates';
import { groupByDay, totals } from '@/domain/stats';
import type { DayKey } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { Page } from '../components/Page';
import { Card, cx, IconButton, LinkButton } from '../components/primitives';
import { TransactionRow } from '../components/TransactionList';
import { useFormat } from '../hooks/useFormat';

export default function CalendarScreen() {
  const { settings, t } = useApp();
  const { book, isSplit } = useBook();
  const format = useFormat();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const { year, month } = parseDayKey(today);
    return { year, month };
  });
  const [selected, setSelected] = useState<DayKey>(today);
  const weeks = calendarWeeks(cursor.year, cursor.month, settings.weekStart);
  const range = { start: dayStart(weeks[0]![0]!), end: dayStart(addDays(weeks.at(-1)!.at(-1)!, 1)) };
  const txs = useLiveQuery(() => transactionsInPeriod(book.id, range), [book.id, range.start, range.end]);
  const budgets = useLiveQuery(() => db.budgets.where('bookId').equals(book.id).toArray(), [book.id]);
  const financialMonth = monthPeriodOf(selected, settings.monthStartDay);
  const monthTx = useLiveQuery(() => transactionsInPeriod(book.id, financialMonth), [book.id, financialMonth.start, financialMonth.end]);

  const byDay = useMemo(() => new Map(groupByDay(txs ?? []).map((g) => [g.day, g])), [txs]);
  const inMonth = (txs ?? []).filter((tx) => {
    const d = new Date(tx.date);
    return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
  });
  const monthTotals = totals(inMonth);
  const monthExpense = inMonth.reduce((sum, tx) => sum + (tx.kind === 'expense' || tx.kind === 'split_expense' ? tx.amount : 0), 0);
  const maxExpense = Math.max(1, ...[...byDay.values()].map((g) => g.expense));
  const totalBudget = budgets?.find((b) => b.categoryId === null)?.amount ?? 0;
  const progress = budgetProgress(totalBudget, totals(monthTx ?? []).expense);
  const allowance = dailyAllowance(progress.remaining, financialMonth, today);
  const day = byDay.get(selected);

  const shift = (delta: number) => {
    const total = cursor.year * 12 + cursor.month + delta;
    setCursor({ year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 });
  };

  return (
    <Page title={t('calendar.title')} back>
      <div className="space-y-3 px-4">
        <div className="flex items-center justify-between">
          <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => shift(-1)} />
          <span className="text-[1.05rem] font-semibold">{format.monthYear(cursor.year, cursor.month)}</span>
          <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => shift(1)} />
        </div>

        <Card className="grid grid-cols-2 gap-2 px-4 py-3">
          <div>
            <p className="text-xs text-muted">{t('common.expenses')}</p>
            <p className="text-lg font-semibold">{format.money(monthExpense)}</p>
          </div>
          {!isSplit && (
            <div>
              <p className="text-xs text-muted">{t('common.income')}</p>
              <p className="text-lg font-semibold">{format.money(monthTotals.income)}</p>
            </div>
          )}
          {!isSplit && totalBudget > 0 && (
            <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 text-[0.8rem] text-muted">
              <span className="inline-flex items-center gap-1 font-medium text-fg">
                {progress.exceeded ? <AlertTriangle className="size-4 text-[var(--status-critical)]" aria-hidden /> : <CheckCircle2 className="size-4 text-[var(--status-good)]" aria-hidden />}
                {progress.exceeded ? t('calendar.overBudget') : t('calendar.withinBudget')}
              </span>
              <span>
                {t('calendar.budgetLeft')}: <b className="text-fg">{format.money(progress.remaining)}</b>
              </span>
              {allowance.perDay > 0 && (
                <span>
                  {t('calendar.perDay')}: <b className="text-fg">{format.money(allowance.perDay)}</b>
                </span>
              )}
            </div>
          )}
        </Card>

        <Card className="px-2 pt-2 pb-3">
          <div className="grid grid-cols-7 text-center text-[0.7rem] font-semibold text-faint">
            {weekdayOrder(settings.weekStart).map((d) => (
              <span key={d} className="py-1.5">
                {format.weekdayShort(d)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((key) => {
              const group = byDay.get(key);
              const outside = parseDayKey(key).month !== cursor.month;
              const isSelected = key === selected;
              const intensity = group?.expense ? 6 + Math.round((group.expense / maxExpense) * 22) : 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-pressed={isSelected}
                  aria-label={format.date(key)}
                  className={cx('flex min-h-14 flex-col items-center rounded-xl px-0.5 pt-1 pb-1', isSelected ? 'ring-2 ring-primary' : '', outside && 'opacity-40')}
                  style={intensity ? { backgroundColor: `color-mix(in srgb, var(--chart-expense) ${intensity}%, transparent)` } : undefined}
                >
                  <span className={cx('flex size-6 items-center justify-center rounded-full text-[0.85rem]', key === today && 'bg-primary font-semibold text-primary-fg')}>{parseDayKey(key).day}</span>
                  {settings.calendarAmounts && group && (
                    <span className="mt-0.5 w-full truncate text-center text-[0.6rem] leading-tight tabular">
                      {group.expense > 0 && <span className="block text-fg">-{format.compact(group.expense)}</span>}
                      {group.income > 0 && <span className="block text-income">+{format.compact(group.income)}</span>}
                    </span>
                  )}
                  {!settings.calendarAmounts && group && <span className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden />}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex items-center justify-between px-1 pt-1">
          <h2 className="text-sm font-semibold">{format.dayHeading(selected)}</h2>
          {day && (
            <span className="text-xs text-muted tabular">
              {[day.expense ? format.money(-day.expense) : null, day.income ? format.money(day.income, undefined, { sign: 'always' }) : null].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <Card className="overflow-hidden">
          {day ? (
            day.items.map((tx, i) => (
              <div key={tx.id} className={cx(i > 0 && 'border-t border-line')}>
                <TransactionRow tx={tx} />
              </div>
            ))
          ) : (
            <p className="px-4 py-5 text-center text-sm text-muted">{t('calendar.noRecords')}</p>
          )}
        </Card>
        <LinkButton to={`/tx/new?date=${selected}`} variant="secondary" block icon={Plus}>
          {t('calendar.addOnDay', { date: format.date(selected) })}
        </LinkButton>
      </div>
    </Page>
  );
}

