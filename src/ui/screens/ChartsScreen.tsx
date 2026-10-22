import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Table2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { bookTransactions, transactionsInPeriod } from '@/data/transactions';
import { accountBalances, balanceSheet, isLiability } from '@/domain/balances';
import {
  addDays,
  calendarWeeks,
  customPeriod,
  elapsedDaysInPeriod,
  monthPeriod,
  monthPeriodOf,
  parseDayKey,
  periodDays,
  shiftCustomPeriod,
  shiftMonthPeriod,
  shiftWeekPeriod,
  todayKey,
  weekday,
  weekdayOrder,
  weekPeriodOf,
  yearPeriod,
  yearPeriodOf,
  type Period,
} from '@/domain/dates';
import { convertMinor } from '@/domain/money';
import { categoryBreakdown, dailySeries, groupByDay, monthlySummaries, relativeChange, totals } from '@/domain/stats';
import type { CategoryKind, DayKey, ID, Transaction } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AccountIcon } from '../components/banks';
import { ChartLegend, ColumnChart, DonutChart, PairedColumnChart, ShareBar, type ColumnPoint, type PairedPoint } from '../components/charts';
import { CategoryIcon } from '../components/EntityIcon';
import { Page } from '../components/Page';
import { Button, Card, Chip, cx, Divider, EmptyState, IconButton, Row, Segmented } from '../components/primitives';
import { Sheet } from '../components/Sheet';
import { TransactionDayList, TransactionRow } from '../components/TransactionList';
import { useFormat } from '../hooks/useFormat';

type Tab = 'summary' | 'expense' | 'income' | 'accounts';
type PeriodMode = 'week' | 'month' | 'year' | 'custom';
type TrendView = 'bars' | 'calendar' | 'table';

const pad = (n: number) => String(n).padStart(2, '0');

/** Split books chart their group expenses as expenses. */
function asStatKind(tx: Transaction): Transaction {
  return tx.kind === 'split_expense' ? { ...tx, kind: 'expense' } : tx;
}

function useChartPeriod() {
  const { settings } = useApp();
  const [params, setParams] = useSearchParams();
  const startDay = settings.monthStartDay;
  const weekStart = settings.weekStart;
  const today = todayKey();

  const modeParam = params.get('mode') as PeriodMode | null;
  const mode: PeriodMode = modeParam && ['week', 'month', 'year', 'custom'].includes(modeParam) ? modeParam : 'month';

  const period = useMemo<Period>(() => {
    if (mode === 'year') {
      const y = Number(params.get('y'));
      return y > 1900 && y < 3000 ? yearPeriod(y, startDay) : yearPeriodOf(today, startDay);
    }
    if (mode === 'week') {
      const w = params.get('w');
      return w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? weekPeriodOf(w, weekStart) : weekPeriodOf(today, weekStart);
    }
    if (mode === 'custom') {
      const from = params.get('from');
      const to = params.get('to');
      if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return customPeriod(from, to);
      }
      return customPeriod(addDays(today, -29), today);
    }
    const m = params.get('m');
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      const [y, mo] = m.split('-').map(Number) as [number, number];
      return monthPeriod(y, mo - 1, startDay);
    }
    return monthPeriodOf(today, startDay);
  }, [mode, params, startDay, weekStart, today]);

  const applyPeriod = (next: Period) => {
    const copy = new URLSearchParams(params);
    copy.delete('mode');
    copy.delete('m');
    copy.delete('y');
    copy.delete('w');
    copy.delete('from');
    copy.delete('to');

    if (next.kind === 'year') {
      copy.set('mode', 'year');
      copy.set('y', String(next.year));
    } else if (next.kind === 'week') {
      copy.set('mode', 'week');
      copy.set('w', next.startKey);
    } else if (next.kind === 'custom') {
      copy.set('mode', 'custom');
      copy.set('from', next.startKey);
      copy.set('to', addDays(next.endKey, -1));
    } else {
      const currentMonth = monthPeriodOf(today, startDay);
      if (next.startKey !== currentMonth.startKey) {
        copy.set('m', `${next.year}-${pad(next.month + 1)}`);
      }
    }
    setParams(copy, { replace: true });
  };

  const shift = (delta: number) => {
    if (period.kind === 'year') applyPeriod(yearPeriod(period.year + delta, startDay));
    else if (period.kind === 'week') applyPeriod(shiftWeekPeriod(period, delta));
    else if (period.kind === 'custom') applyPeriod(shiftCustomPeriod(period, delta));
    else applyPeriod(shiftMonthPeriod(period, delta, startDay));
  };

  const previous = useMemo<Period>(() => {
    if (period.kind === 'year') return yearPeriod(period.year - 1, startDay);
    if (period.kind === 'week') return shiftWeekPeriod(period, -1);
    if (period.kind === 'custom') return shiftCustomPeriod(period, -1);
    return shiftMonthPeriod(period, -1, startDay);
  }, [period, startDay]);

  return { mode, period, previous, applyPeriod, shift, startDay, weekStart };
}

export default function ChartsScreen() {
  const { t } = useApp();
  const { isSplit } = useBook();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab') as Tab | null;
  const tab: Tab = rawTab && ['summary', 'expense', 'income', 'accounts'].includes(rawTab) ? rawTab : isSplit ? 'expense' : 'summary';

  const setTab = (next: Tab) => {
    const copy = new URLSearchParams(params);
    const defaultTab: Tab = isSplit ? 'expense' : 'summary';
    if (next === defaultTab) copy.delete('tab');
    else copy.set('tab', next);
    setParams(copy, { replace: true });
  };

  const tabs: { value: Tab; label: string }[] = isSplit
    ? []
    : [
        { value: 'summary', label: t('charts.summary') },
        { value: 'expense', label: t('common.expenses') },
        { value: 'income', label: t('common.income') },
        { value: 'accounts', label: t('charts.accounts') },
      ];

  return (
    <Page title={t('charts.title')} withTabs>
      <div className="space-y-4 px-4 pt-1">
        {tabs.length > 1 && <Segmented label={t('charts.title')} value={tab} onChange={setTab} options={tabs} />}
        {tab === 'accounts' ? (
          <AccountsView />
        ) : tab === 'summary' ? (
          <SummaryView />
        ) : (
          <KindView kind={tab} />
        )}
      </div>
    </Page>
  );
}

function PeriodFilterBar({
  mode,
  period,
  onShift,
  onApply,
  startDay,
  weekStart,
}: {
  mode: PeriodMode;
  period: Period;
  onShift: (delta: number) => void;
  onApply: (next: Period) => void;
  startDay: number;
  weekStart: number;
}) {
  const { t } = useApp();
  const format = useFormat();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialMode, setModalInitialMode] = useState<PeriodMode>(mode);
  const today = todayKey();

  const openModal = (targetMode: PeriodMode = mode) => {
    setModalInitialMode(targetMode);
    setModalOpen(true);
  };

  const quickSelectMode = (nextMode: PeriodMode) => {
    if (nextMode === 'custom') {
      openModal('custom');
      return;
    }
    if (nextMode === mode) {
      openModal(nextMode);
      return;
    }
    if (nextMode === 'week') onApply(weekPeriodOf(today, weekStart));
    else if (nextMode === 'month') onApply(monthPeriodOf(today, startDay));
    else if (nextMode === 'year') onApply(yearPeriodOf(today, startDay));
  };

  const modeOptions: { value: PeriodMode; label: string }[] = [
    { value: 'week', label: t('charts.week') },
    { value: 'month', label: t('charts.month') },
    { value: 'year', label: t('charts.year') },
    { value: 'custom', label: t('charts.period') },
  ];

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {modeOptions.map((opt) => (
            <Chip key={opt.value} active={mode === opt.value} onClick={() => quickSelectMode(opt.value)} className="h-8 px-3 text-xs">
              {opt.value === 'custom' && <CalendarRange className="size-3.5" aria-hidden />}
              {opt.label}
            </Chip>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-surface px-1 py-1 shadow-card">
          <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => onShift(-1)} />
          <button
            type="button"
            onClick={() => openModal(mode)}
            className="flex min-w-0 flex-1 flex-col items-center rounded-xl px-2 py-1 active:bg-surface-2"
          >
            <span className="flex max-w-full items-center gap-1 truncate text-[0.95rem] font-semibold">
              <span className="truncate">{format.periodLabel(period)}</span>
              <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
            </span>
            {mode === 'month' && startDay !== 1 && <span className="text-[0.7rem] text-muted">{format.periodRange(period)}</span>}
            {mode === 'custom' && (
              <span className="text-[0.7rem] text-muted">{t('common.days', { count: periodDays(period) })}</span>
            )}
          </button>
          <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => onShift(1)} />
        </div>
      </div>

      <PeriodFilterSheet
        key={`${modalOpen}-${modalInitialMode}-${period.startKey}-${period.endKey}`}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialMode={modalInitialMode}
        period={period}
        startDay={startDay}
        weekStart={weekStart}
        onApply={(next) => {
          onApply(next);
          setModalOpen(false);
        }}
      />
    </>
  );
}

function PeriodFilterSheet({
  open,
  onClose,
  initialMode,
  period,
  startDay,
  weekStart,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  initialMode: PeriodMode;
  period: Period;
  startDay: number;
  weekStart: number;
  onApply: (next: Period) => void;
}) {
  const { t } = useApp();
  const format = useFormat();
  const today = todayKey();
  const [tab, setTab] = useState<PeriodMode>(initialMode);

  // Month & Year state
  const [viewYear, setViewYear] = useState(period.year);

  // Week & Custom calendar cursor
  const [calCursor, setCalCursor] = useState(() => parseDayKey(period.startKey));
  const [weekDay, setWeekDay] = useState<DayKey>(() => (period.kind === 'week' ? period.startKey : today));

  // Custom range state
  const [rangeStart, setRangeStart] = useState<DayKey>(() => (period.kind === 'custom' ? period.startKey : addDays(today, -29)));
  const [rangeEnd, setRangeEnd] = useState<DayKey>(() => (period.kind === 'custom' ? addDays(period.endKey, -1) : today));
  const [pickingStep, setPickingStep] = useState<'start' | 'end'>('start');

  const weeks = calendarWeeks(calCursor.year, calCursor.month, weekStart);
  const selectedWeek = weekPeriodOf(weekDay, weekStart);

  const shiftCalMonth = (delta: number) => {
    const total = calCursor.year * 12 + calCursor.month + delta;
    setCalCursor({ year: Math.floor(total / 12), month: ((total % 12) + 12) % 12, day: 1 });
  };

  const handleRangeDayTap = (key: DayKey) => {
    if (pickingStep === 'start') {
      setRangeStart(key);
      if (key > rangeEnd) setRangeEnd(key);
      setPickingStep('end');
    } else {
      if (key < rangeStart) {
        setRangeEnd(rangeStart);
        setRangeStart(key);
      } else {
        setRangeEnd(key);
      }
      setPickingStep('start');
    }
  };

  const applyPreset = (days: number) => {
    const from = addDays(today, -(days - 1));
    setRangeStart(from);
    setRangeEnd(today);
    onApply(customPeriod(from, today));
  };

  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('charts.filterPeriod')}
      footer={
        tab === 'custom' ? (
          <Button block onClick={() => onApply(customPeriod(rangeStart, rangeEnd))}>
            {t('charts.applyPeriod')}
          </Button>
        ) : tab === 'week' ? (
          <Button block onClick={() => onApply(selectedWeek)}>
            {t('charts.applyPeriod')}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4 px-4 pb-4">
        <Segmented
          label={t('charts.filterPeriod')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'week', label: t('charts.week') },
            { value: 'month', label: t('charts.month') },
            { value: 'year', label: t('charts.year') },
            { value: 'custom', label: t('charts.period') },
          ]}
        />

        {tab === 'month' && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <IconButton icon={ChevronLeft} label={String(viewYear - 1)} onClick={() => setViewYear((y) => y - 1)} />
              <span className="text-lg font-semibold tabular">{viewYear}</span>
              <IconButton icon={ChevronRight} label={String(viewYear + 1)} onClick={() => setViewYear((y) => y + 1)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, m) => {
                const active = period.kind === 'month' && viewYear === period.year && m === period.month;
                const current = viewYear === nowYear && m === nowMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onApply(monthPeriod(viewYear, m, startDay))}
                    className={cx(
                      'h-12 rounded-xl text-[0.95rem] font-medium',
                      active ? 'bg-primary text-primary-fg' : current ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-fg active:bg-line',
                    )}
                  >
                    {format.monthShort(m)}
                  </button>
                );
              })}
            </div>
            <Button variant="ghost" block className="mt-3" onClick={() => onApply(monthPeriodOf(today, startDay))}>
              {t('charts.thisMonth')}
            </Button>
          </div>
        )}

        {tab === 'year' && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <IconButton icon={ChevronLeft} label={String(viewYear - 12)} onClick={() => setViewYear((y) => y - 12)} />
              <span className="text-base font-semibold tabular">
                {viewYear - 5} – {viewYear + 6}
              </span>
              <IconButton icon={ChevronRight} label={String(viewYear + 12)} onClick={() => setViewYear((y) => y + 12)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => viewYear - 5 + i).map((y) => {
                const active = period.kind === 'year' && y === period.year;
                const current = y === nowYear;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onApply(yearPeriod(y, startDay))}
                    className={cx(
                      'h-12 rounded-xl text-[0.95rem] font-medium tabular',
                      active ? 'bg-primary text-primary-fg' : current ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-fg active:bg-line',
                    )}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
            <Button variant="ghost" block className="mt-3" onClick={() => onApply(yearPeriodOf(today, startDay))}>
              {t('charts.thisYear')}
            </Button>
          </div>
        )}

        {tab === 'week' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Chip
                active={selectedWeek.startKey === weekPeriodOf(today, weekStart).startKey}
                onClick={() => {
                  setWeekDay(today);
                  setCalCursor(parseDayKey(today));
                }}
              >
                {t('charts.thisWeek')}
              </Chip>
              <span className="text-sm font-semibold text-primary tabular">{format.periodLabel(selectedWeek)}</span>
            </div>
            <p className="text-xs text-muted">{t('charts.pickWeekHint')}</p>
            <div className="flex items-center justify-between">
              <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => shiftCalMonth(-1)} />
              <span className="text-base font-semibold">{format.monthYear(calCursor.year, calCursor.month)}</span>
              <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => shiftCalMonth(1)} />
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-medium text-faint">
              {weekdayOrder(weekStart).map((d) => (
                <span key={d} className="py-1">
                  {format.weekdayNarrow(d)}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {weeks.flat().map((key) => {
                const { month, day } = parseDayKey(key);
                const outside = month !== calCursor.month;
                const inWeek = key >= selectedWeek.startKey && key < selectedWeek.endKey;
                const isStart = key === selectedWeek.startKey;
                const isEnd = key === addDays(selectedWeek.endKey, -1);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWeekDay(key)}
                    className={cx(
                      'flex h-10 items-center justify-center text-[0.9rem] transition-colors',
                      inWeek ? 'bg-primary-soft font-semibold text-primary' : outside ? 'text-faint' : 'text-fg active:bg-surface-2',
                      isStart && 'rounded-l-full bg-primary text-primary-fg',
                      isEnd && 'rounded-r-full bg-primary text-primary-fg',
                      !inWeek && 'rounded-full',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'custom' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { days: 7, label: t('charts.last7Days') },
                { days: 15, label: t('charts.last15Days') },
                { days: 30, label: t('charts.last30Days') },
                { days: 90, label: t('charts.last90Days') },
              ].map((preset) => (
                <Chip key={preset.days} onClick={() => applyPreset(preset.days)} className="h-8 px-3 text-xs">
                  {preset.label}
                </Chip>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPickingStep('start');
                  setCalCursor(parseDayKey(rangeStart));
                }}
                className={cx(
                  'rounded-xl border px-3 py-2 text-left',
                  pickingStep === 'start' ? 'border-primary bg-primary-soft' : 'border-line bg-surface-2',
                )}
              >
                <span className="block text-[0.7rem] text-muted uppercase">{t('export.start')}</span>
                <span className="mt-0.5 block text-sm font-semibold tabular">{format.date(rangeStart)}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPickingStep('end');
                  setCalCursor(parseDayKey(rangeEnd));
                }}
                className={cx(
                  'rounded-xl border px-3 py-2 text-left',
                  pickingStep === 'end' ? 'border-primary bg-primary-soft' : 'border-line bg-surface-2',
                )}
              >
                <span className="block text-[0.7rem] text-muted uppercase">{t('export.end')}</span>
                <span className="mt-0.5 block text-sm font-semibold tabular">{format.date(rangeEnd)}</span>
              </button>
            </div>
            <p className="text-xs text-muted">{t('charts.pickRangeHint')}</p>

            <div className="flex items-center justify-between">
              <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => shiftCalMonth(-1)} />
              <span className="text-base font-semibold">{format.monthYear(calCursor.year, calCursor.month)}</span>
              <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => shiftCalMonth(1)} />
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-medium text-faint">
              {weekdayOrder(weekStart).map((d) => (
                <span key={d} className="py-1">
                  {format.weekdayNarrow(d)}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {weeks.flat().map((key) => {
                const { month, day } = parseDayKey(key);
                const outside = month !== calCursor.month;
                const inRange = key >= rangeStart && key <= rangeEnd;
                const isStart = key === rangeStart;
                const isEnd = key === rangeEnd;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleRangeDayTap(key)}
                    className={cx(
                      'flex h-10 items-center justify-center text-[0.9rem] transition-colors',
                      inRange ? 'bg-primary-soft font-semibold text-primary' : outside ? 'text-faint' : 'text-fg active:bg-surface-2',
                      isStart && 'rounded-l-full bg-primary text-primary-fg',
                      isEnd && 'rounded-r-full bg-primary text-primary-fg',
                      isStart && isEnd && 'rounded-full',
                      !inRange && 'rounded-full',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function SummaryView() {
  const { t } = useApp();
  const { book, categoryMap, categoryName } = useBook();
  const format = useFormat();
  const { mode, period, previous, applyPeriod, shift, startDay, weekStart } = useChartPeriod();
  const current = useLiveQuery(() => transactionsInPeriod(book.id, period), [book.id, period.start, period.end]);
  const before = useLiveQuery(() => transactionsInPeriod(book.id, previous), [book.id, previous.start, previous.end]);
  const [trendView, setTrendView] = useState<TrendView>('bars');
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ id: ID | null; kind: CategoryKind } | null>(null);

  const txs = useMemo(() => (current ?? []).map(asStatKind), [current]);
  const prevTxs = useMemo(() => (before ?? []).map(asStatKind), [before]);
  const sums = useMemo(() => totals(txs), [txs]);
  const prevSums = useMemo(() => totals(prevTxs), [prevTxs]);
  const refs = useMemo(() => new Map([...categoryMap].map(([id, c]) => [id, { id, parentId: c.parentId }])), [categoryMap]);
  const expenseSlices = useMemo(() => categoryBreakdown(txs, 'expense', refs), [txs, refs]);
  const incomeSlices = useMemo(() => categoryBreakdown(txs, 'income', refs), [txs, refs]);

  const savingsRate = sums.income > 0 ? sums.balance / sums.income : null;
  const expenseChange = relativeChange(sums.expense, prevSums.expense);

  const pairedPoints: PairedPoint[] = useMemo(() => {
    if (period.kind === 'year') {
      return monthlySummaries(txs, period.year, startDay).map((m) => ({
        key: String(m.month),
        label: format.monthShort(m.month).slice(0, 3),
        a: m.income,
        b: m.expense,
      }));
    }
    const inc = dailySeries(txs, period, 'income');
    const exp = dailySeries(txs, period, 'expense');
    const step = Math.max(1, Math.ceil(inc.length / 7));
    return inc.map((p, i, all) => {
      const last = all.length - 1;
      const showLabel = period.kind === 'week' || i % step === 0 || i === last;
      const label = period.kind === 'week' ? format.weekdayShort(weekday(p.day)).slice(0, 3) : showLabel ? String(Number(p.day.slice(8))) : '';
      return {
        key: p.day,
        label,
        a: p.amount,
        b: exp[i]?.amount ?? 0,
      };
    });
  }, [txs, period, startDay, format]);

  const selectedPaired = pairedPoints.find((p) => p.key === selectedPoint);
  const pointTitle = (p: PairedPoint) => (period.kind === 'year' ? format.monthYear(period.year, Number(p.key)) : format.dayMonth(p.key));

  return (
    <>
      <PeriodFilterBar mode={mode} period={period} onShift={shift} onApply={applyPeriod} startDay={startDay} weekStart={weekStart} />

      {current && sums.income === 0 && sums.expense === 0 ? (
        <Card>
          <EmptyState icon={ChartColumn} title={t('charts.noData')} />
        </Card>
      ) : (
        <>
          <Card className="px-4 py-4">
            <div className="grid grid-cols-3 divide-x divide-line text-center">
              <div className="min-w-0 px-1.5">
                <p className="text-xs text-muted">{t('common.income')}</p>
                <p className="mt-0.5 truncate text-[1.05rem] font-semibold text-income tabular">{format.money(sums.income)}</p>
              </div>
              <div className="min-w-0 px-1.5">
                <p className="text-xs text-muted">{t('common.expenses')}</p>
                <p className="mt-0.5 truncate text-[1.05rem] font-semibold tabular">{format.money(sums.expense)}</p>
              </div>
              <div className="min-w-0 px-1.5">
                <p className="text-xs text-muted">{t('common.balance')}</p>
                <p className={cx('mt-0.5 truncate text-[1.05rem] font-semibold tabular', sums.balance < 0 && 'text-danger')}>{format.money(sums.balance)}</p>
              </div>
            </div>

            {(sums.income > 0 || sums.expense > 0) && (
              <div className="mt-3.5 space-y-2">
                <ShareBar
                  ariaLabel={t('charts.incomeVsExpense')}
                  segments={[
                    { key: 'income', value: sums.income, color: 'var(--chart-income)', label: `${t('common.income')}: ${format.money(sums.income)}` },
                    { key: 'expense', value: sums.expense, color: 'var(--chart-expense)', label: `${t('common.expenses')}: ${format.money(sums.expense)}` },
                  ]}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  {savingsRate !== null && (
                    <span>
                      {t('reports.savingsRate')}: <b className="text-fg">{format.percent(savingsRate, 0)}</b>
                    </span>
                  )}
                  {expenseChange !== null && (
                    <span className="inline-flex items-center gap-1">
                      {expenseChange >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                      {t('charts.vsPrevious', { value: format.percent(Math.abs(expenseChange), 0) })}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>

          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('charts.incomeVsExpense')}</h2>
              <div className="flex items-center gap-0.5">
                <IconButton icon={ChartColumn} label={t('charts.viewBars')} tone={trendView === 'bars' ? 'primary' : 'default'} onClick={() => setTrendView('bars')} className="size-8" />
                <IconButton icon={CalendarDays} label={t('charts.viewCalendar')} tone={trendView === 'calendar' ? 'primary' : 'default'} onClick={() => setTrendView('calendar')} className="size-8" />
                <IconButton icon={Table2} label={t('charts.viewTable')} tone={trendView === 'table' ? 'primary' : 'default'} onClick={() => setTrendView('table')} className="size-8" />
              </div>
            </div>
            {trendView === 'calendar' ? (
              <InlinePeriodCalendar transactions={txs} initialDate={period.startKey} />
            ) : (
              <Card className="px-3 pt-3 pb-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <ChartLegend
                    items={[
                      { color: 'var(--chart-income)', label: t('common.income') },
                      { color: 'var(--chart-expense)', label: t('common.expenses') },
                    ]}
                  />
                </div>
                <p className="mb-1 min-h-5 px-1 text-[0.8rem] text-muted">
                  {selectedPaired && (
                    <>
                      {pointTitle(selectedPaired)}: <b className="text-income">+{format.money(selectedPaired.a)}</b> · <b className="text-fg">−{format.money(selectedPaired.b)}</b>
                    </>
                  )}
                </p>
                {trendView === 'table' ? (
                  <table className="w-full text-[0.85rem]">
                    <tbody>
                      {pairedPoints
                        .filter((p) => p.a > 0 || p.b > 0)
                        .map((p) => (
                          <tr key={p.key} className="border-t border-line first:border-0">
                            <td className="py-2 pl-1">{pointTitle(p)}</td>
                            <td className="py-2 text-right text-income tabular">+{format.money(p.a)}</td>
                            <td className="py-2 pr-1 text-right tabular">−{format.money(p.b)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <PairedColumnChart
                    points={pairedPoints}
                    colors={['var(--chart-income)', 'var(--chart-expense)']}
                    selected={selectedPoint}
                    onSelect={setSelectedPoint}
                    formatTick={(v) => format.compact(v)}
                    ariaLabel={t('charts.incomeVsExpense')}
                  />
                )}
              </Card>
            )}
          </section>

          {expenseSlices.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('charts.topExpenses')}</h2>
              <Card className="overflow-hidden">
                {expenseSlices.slice(0, 5).map((slice, index) => {
                  const category = slice.categoryId ? categoryMap.get(slice.categoryId) : undefined;
                  return (
                    <div key={slice.categoryId ?? 'none'}>
                      {index > 0 && <Divider inset />}
                      <button
                        type="button"
                        onClick={() => setSelectedCategory({ id: slice.categoryId, kind: 'expense' })}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                      >
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
          )}

          {incomeSlices.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('charts.topIncome')}</h2>
              <Card className="overflow-hidden">
                {incomeSlices.slice(0, 5).map((slice, index) => {
                  const category = slice.categoryId ? categoryMap.get(slice.categoryId) : undefined;
                  return (
                    <div key={slice.categoryId ?? 'none'}>
                      {index > 0 && <Divider inset />}
                      <button
                        type="button"
                        onClick={() => setSelectedCategory({ id: slice.categoryId, kind: 'income' })}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                      >
                        <CategoryIcon category={category} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[0.95rem] font-medium">{categoryName(category)}</span>
                            <span className="shrink-0 text-[0.95rem] font-semibold text-income tabular">{format.money(slice.amount)}</span>
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
          )}
        </>
      )}

      <CategorySheet
        categoryId={selectedCategory ? selectedCategory.id : undefined}
        onClose={() => setSelectedCategory(null)}
        transactions={txs}
        kind={selectedCategory?.kind ?? 'expense'}
        period={period}
      />
    </>
  );
}

function KindView({ kind }: { kind: CategoryKind }) {
  const { t } = useApp();
  const { book, categoryMap, categoryName } = useBook();
  const format = useFormat();
  const { mode, period, previous, applyPeriod, shift, startDay, weekStart } = useChartPeriod();
  const current = useLiveQuery(() => transactionsInPeriod(book.id, period), [book.id, period.start, period.end]);
  const before = useLiveQuery(() => transactionsInPeriod(book.id, previous), [book.id, previous.start, previous.end]);
  const [selectedCategory, setSelectedCategory] = useState<ID | null | undefined>(undefined);
  const [focused, setFocused] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [trendView, setTrendView] = useState<TrendView>('bars');

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
    if (period.kind === 'year') {
      return monthlySummaries(txs, period.year, startDay).map((m) => ({
        key: String(m.month),
        label: format.monthShort(m.month).slice(0, 3),
        value: kind === 'expense' ? m.expense : m.income,
      }));
    }
    const series = dailySeries(txs, period, kind);
    const step = Math.max(1, Math.ceil(series.length / 7));
    return series.map((p, i, all) => {
      const last = all.length - 1;
      const showLabel = period.kind === 'week' || i % step === 0 || (i === last && last % step >= 2);
      const label = period.kind === 'week' ? format.weekdayShort(weekday(p.day)).slice(0, 3) : showLabel ? String(Number(p.day.slice(8))) : '';
      return { key: p.day, label, value: p.amount };
    });
  }, [txs, period, startDay, kind, format]);

  const today = todayKey();
  const activeMonths = Math.max(1, points.filter((p) => p.value > 0).length);
  const average = period.kind === 'year' ? total / activeMonths : total / elapsedDaysInPeriod(period, today);
  const peak = points.reduce<ColumnPoint | null>((best, p) => (!best || p.value > best.value ? p : best), null);
  const selected = points.find((p) => p.key === selectedPoint);
  const pointTitle = (p: ColumnPoint) => (period.kind === 'year' ? format.monthYear(period.year, Number(p.key)) : format.dayMonth(p.key));

  const topSlices = slices.slice(0, 5);
  const rest = slices.slice(5).reduce((sum, s) => sum + s.amount, 0);
  const segments = [
    ...topSlices.map((s) => {
      const category = s.categoryId ? categoryMap.get(s.categoryId) : undefined;
      return { key: s.categoryId ?? 'none', value: s.amount, color: category?.color ?? '#8b93a1', name: categoryName(category), ratio: s.ratio, label: `${categoryName(category)} ${format.percent(s.ratio)}` };
    }),
    ...(rest > 0 ? [{ key: 'rest', value: rest, color: 'var(--faint)', name: t('common.other'), ratio: rest / total, label: `${t('common.other')} ${format.percent(rest / total)}` }] : []),
  ];
  const focusedSegment = segments.find((s) => s.key === focused);
  const focus = (key: string | null) => {
    if (key !== null && key === focused && key !== 'rest') setSelectedCategory(key === 'none' ? null : key);
    else setFocused(key);
  };

  return (
    <>
      <PeriodFilterBar mode={mode} period={period} onShift={shift} onApply={applyPeriod} startDay={startDay} weekStart={weekStart} />

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
                {period.kind === 'year' ? t('charts.monthlyAverage') : t('charts.dailyAverage')}: <span className="font-medium text-fg">{format.money(Math.round(average))}</span>
              </span>
              {change !== null && (
                <span className="inline-flex items-center gap-1">
                  {change >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                  {t('charts.vsPrevious', { value: format.percent(Math.abs(change), 0) })}
                </span>
              )}
            </div>
          </Card>

          <section>
            <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('charts.byCategory')}</h2>
            <Card className="px-4 py-4">
              <div className="flex items-center gap-4">
                <DonutChart
                  segments={segments}
                  selected={focusedSegment ? focused : null}
                  onSelect={focus}
                  ariaLabel={segments.map((s) => s.label).join(', ')}
                  center={
                    focusedSegment ? (
                      <>
                        <span className="w-full truncate px-1 text-[0.7rem] text-muted">{focusedSegment.name}</span>
                        <span className="text-[0.95rem] leading-tight font-semibold tabular">{format.compact(focusedSegment.value)}</span>
                        <span className="text-[0.7rem] text-muted tabular">{format.percent(focusedSegment.ratio)}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[0.7rem] text-muted">{t('common.total')}</span>
                        <span className="text-[0.95rem] leading-tight font-semibold tabular">{format.compact(total)}</span>
                      </>
                    )
                  }
                />
                <ul className="min-w-0 flex-1 space-y-0.5">
                  {segments.map((segment) => (
                    <li key={segment.key}>
                      <button
                        type="button"
                        onClick={() => focus(segment.key)}
                        aria-pressed={focusedSegment?.key === segment.key}
                        className={cx('flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[0.8rem]', focusedSegment?.key === segment.key && 'bg-surface-2', focusedSegment && focusedSegment.key !== segment.key && 'opacity-50')}
                      >
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: segment.color }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{segment.name}</span>
                        <span className="shrink-0 text-muted tabular">{format.percent(segment.ratio, 0)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {focusedSegment ? (
                <p className="mt-3 text-[0.8rem] text-muted">
                  <span className="font-semibold text-fg">{focusedSegment.name}</span>: {format.money(focusedSegment.value)} · {t('charts.ofTotal', { value: format.percent(focusedSegment.ratio) })}
                </p>
              ) : (
                <p className="mt-3 text-[0.75rem] text-faint">{t('charts.tapSlice')}</p>
              )}
            </Card>
          </section>

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
              <div className="flex items-center gap-0.5">
                <IconButton icon={ChartColumn} label={t('charts.viewBars')} tone={trendView === 'bars' ? 'primary' : 'default'} onClick={() => setTrendView('bars')} className="size-8" />
                <IconButton icon={CalendarDays} label={t('charts.viewCalendar')} tone={trendView === 'calendar' ? 'primary' : 'default'} onClick={() => setTrendView('calendar')} className="size-8" />
                <IconButton icon={Table2} label={t('charts.viewTable')} tone={trendView === 'table' ? 'primary' : 'default'} onClick={() => setTrendView('table')} className="size-8" />
              </div>
            </div>
            {trendView === 'calendar' ? (
              <InlinePeriodCalendar transactions={txs.filter((tx) => tx.kind === kind)} initialDate={period.startKey} />
            ) : (
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
                {trendView === 'table' ? (
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
                    average={period.kind === 'year' ? average : undefined}
                    averageLabel={t('charts.average')}
                    ariaLabel={`${t('charts.trend')}: ${format.periodLabel(period)}`}
                  />
                )}
              </Card>
            )}
          </section>
        </>
      )}

      <CategorySheet categoryId={selectedCategory} onClose={() => setSelectedCategory(undefined)} transactions={txs} kind={kind} period={period} />
    </>
  );
}

/** Interactive calendar embedded inside the chart trend section. */
function InlinePeriodCalendar({ transactions, initialDate }: { transactions: Transaction[]; initialDate: DayKey }) {
  const { settings, t } = useApp();
  const format = useFormat();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const { year, month } = parseDayKey(initialDate);
    return { year, month };
  });
  const [selected, setSelected] = useState<DayKey>(today >= initialDate ? today : initialDate);
  const weeks = calendarWeeks(cursor.year, cursor.month, settings.weekStart);
  const byDay = useMemo(() => new Map(groupByDay(transactions).map((g) => [g.day, g])), [transactions]);
  const maxExpense = Math.max(1, ...[...byDay.values()].map((g) => g.expense || g.income));
  const day = byDay.get(selected);

  const shift = (delta: number) => {
    const total = cursor.year * 12 + cursor.month + delta;
    setCursor({ year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 });
  };

  return (
    <div className="space-y-3">
      <Card className="px-2 pt-2 pb-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => shift(-1)} />
          <span className="text-[0.95rem] font-semibold">{format.monthYear(cursor.year, cursor.month)}</span>
          <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => shift(1)} />
        </div>
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
            const amount = group ? group.expense || group.income : 0;
            const intensity = amount ? 6 + Math.round((amount / maxExpense) * 22) : 0;
            const tone = group?.expense ? 'var(--chart-expense)' : 'var(--chart-income)';
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={format.date(key)}
                className={cx('flex min-h-13 flex-col items-center rounded-xl px-0.5 pt-1 pb-1', isSelected ? 'ring-2 ring-primary' : '', outside && 'opacity-40')}
                style={intensity ? { backgroundColor: `color-mix(in srgb, ${tone} ${intensity}%, transparent)` } : undefined}
              >
                <span className={cx('flex size-6 items-center justify-center rounded-full text-[0.8rem]', key === today && 'bg-primary font-semibold text-primary-fg')}>
                  {parseDayKey(key).day}
                </span>
                {group && (
                  <span className="mt-0.5 w-full truncate text-center text-[0.6rem] leading-tight tabular">
                    {group.expense > 0 && <span className="block text-fg">-{format.compact(group.expense)}</span>}
                    {group.income > 0 && <span className="block text-income">+{format.compact(group.income)}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{format.dayHeading(selected)}</h3>
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
          <p className="px-4 py-4 text-center text-sm text-muted">{t('calendar.noRecords')}</p>
        )}
      </Card>
    </div>
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
              leading={<AccountIcon account={account} />}
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

