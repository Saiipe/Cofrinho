import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { BellRing, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CloudUpload, Eye, EyeOff, HandCoins, ReceiptText, Search, Sprout } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { db } from '@/data/db';
import { transactionsInPeriod } from '@/data/transactions';
import { budgetProgress, dailyAllowance } from '@/domain/budget';
import { monthPeriod, todayKey, type Period } from '@/domain/dates';
import { memberBalances, memberShareTotal } from '@/domain/split';
import { groupByDay, totals } from '@/domain/stats';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { HIDDEN_AMOUNT } from '../components/Amount';
import { BookSwitcherSheet } from '../components/BookSwitcher';
import { Meter } from '../components/charts';
import { InlineNotice } from '../components/feedback';
import { MonthPickerSheet } from '../components/pickers';
import { Card, EmptyState, IconButton, LinkButton } from '../components/primitives';
import { TransactionDayList } from '../components/TransactionList';
import { useFormat } from '../hooks/useFormat';
import { usePeriod } from '../hooks/usePeriod';
import { useHorizontalSwipe } from '../hooks/useSwipe';

/** Survives tab switches within a session; reset from settings on the next launch. */
let sessionHidden: boolean | null = null;

const BACKUP_NAG_MS = 30 * 86_400_000;

export default function HomeScreen() {
  const { settings, t } = useApp();
  const { book, isSplit, me, members } = useBook();
  const format = useFormat();
  const { period, setPeriod, shift } = usePeriod('month');
  const [hidden, setHidden] = useState(() => sessionHidden ?? settings.hideAmounts);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const swipe = useHorizontalSwipe(shift);

  const transactions = useLiveQuery(() => transactionsInPeriod(book.id, period), [book.id, period.start, period.end]);
  const history = useLiveQuery(
    async () => (settings.balanceMode === 'total' || isSplit ? db.transactions.where('[bookId+date]').between([book.id, Dexie.minKey], [book.id, period.end], true, false).toArray() : null),
    [book.id, period.end, settings.balanceMode, isSplit],
  );
  const budgets = useLiveQuery(() => db.budgets.where('bookId').equals(book.id).toArray(), [book.id]);
  const reminders = useLiveQuery(() => db.reminders.toArray(), []);
  const recordedToday = useLiveQuery(() => db.transactions.where('createdAt').aboveOrEqual(new Date().setHours(0, 0, 0, 0)).count(), []);
  const totalCount = useLiveQuery(() => db.transactions.count(), []);

  const groups = useMemo(() => (transactions ? groupByDay(transactions) : []), [transactions]);
  const sums = useMemo(() => totals(transactions ?? []), [transactions]);
  const runningBalance = useMemo(() => (history ? totals(history).balance : null), [history]);
  const totalBudget = budgets?.find((b) => b.categoryId === null)?.amount ?? 0;

  const toggleHidden = () => {
    sessionHidden = !hidden;
    setHidden(!hidden);
  };
  const show = (value: number, options?: { sign?: 'auto' | 'always' | 'never' }) => (hidden ? HIDDEN_AMOUNT : format.money(value, undefined, options));

  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const reminderDue =
    recordedToday === 0 &&
    (reminders ?? []).some((r) => {
      if (!r.enabled || (r.weekdays.length && !r.weekdays.includes(now.getDay()))) return false;
      const [h, m] = r.time.split(':').map(Number) as [number, number];
      return minutesNow >= h * 60 + m;
    });
  const backupDue = (totalCount ?? 0) >= 20 && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > BACKUP_NAG_MS);

  return (
    <div className="min-h-dvh bg-bg pb-28">
      <header className="rounded-b-[28px] bg-hero pt-safe pb-5 text-hero-fg">
        <div className="flex h-14 items-center gap-1 px-2">
          <button type="button" onClick={() => setSwitcherOpen(true)} className="flex min-w-0 items-center gap-1 rounded-full px-3 py-1.5 font-semibold active:bg-white/15" aria-label={t('home.switchBook')}>
            <span className="truncate">{book.name}</span>
            <ChevronDown className="size-4 shrink-0 opacity-80" aria-hidden />
          </button>
          <div className="ml-auto flex">
            <Link to="/search" aria-label={t('common.search')} className="flex size-10 items-center justify-center rounded-full active:bg-white/15">
              <Search className="size-[1.35rem]" aria-hidden />
            </Link>
            {settings.calendarEntry && (
              <Link to="/calendar" aria-label={t('home.calendar')} className="flex size-10 items-center justify-center rounded-full active:bg-white/15">
                <CalendarDays className="size-[1.35rem]" aria-hidden />
              </Link>
            )}
            {settings.gardenEntry && (
              <Link to="/garden" aria-label={t('home.garden')} className="flex size-10 items-center justify-center rounded-full active:bg-white/15">
                <Sprout className="size-[1.35rem]" aria-hidden />
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1">
          <IconButton icon={ChevronLeft} label={t('home.previousMonth')} tone="hero" onClick={() => shift(-1)} />
          <button type="button" onClick={() => setMonthPickerOpen(true)} className="flex min-w-40 flex-col items-center rounded-xl px-3 py-1 active:bg-white/15">
            <span className="flex items-center gap-1 text-[1.05rem] font-semibold">
              {format.periodLabel(period)}
              <ChevronDown className="size-4 opacity-80" aria-hidden />
            </span>
            {settings.monthStartDay !== 1 && <span className="text-xs opacity-80">{format.periodRange(period)}</span>}
          </button>
          <IconButton icon={ChevronRight} label={t('home.nextMonth')} tone="hero" onClick={() => shift(1)} />
        </div>

        {settings.showBalance &&
          (isSplit ? (
            <SplitSummary hidden={hidden} toggleHidden={toggleHidden} history={history ?? []} periodTx={transactions ?? []} meId={me?.id} memberIds={members.map((m) => m.id)} />
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3 px-5">
                <div>
                  <p className="text-[0.8rem] opacity-80">{t('common.expenses')}</p>
                  <p className="truncate text-2xl font-semibold">{show(sums.expense)}</p>
                </div>
                <div>
                  <p className="text-[0.8rem] opacity-80">{t('common.income')}</p>
                  <p className="truncate text-2xl font-semibold">{show(sums.income)}</p>
                </div>
              </div>
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-black/12 py-2 pr-1 pl-4 dark:bg-white/5">
                <span className="text-[0.85rem] opacity-85">{settings.balanceMode === 'total' ? t('home.totalBalance') : t('home.monthBalance')}</span>
                <span className="ml-auto truncate text-[1.05rem] font-semibold">{show(settings.balanceMode === 'total' ? (runningBalance ?? 0) : sums.balance)}</span>
                <IconButton icon={hidden ? EyeOff : Eye} label={hidden ? t('home.showAmounts') : t('home.hideAmounts')} tone="hero" onClick={toggleHidden} />
              </div>
            </>
          ))}
      </header>

      <div {...swipe} className="touch-pan-y">
        <div className="space-y-3 px-4 pt-4">
          {!isSplit && totalBudget > 0 && <BudgetStrip budget={totalBudget} spent={sums.expense} period={period} hidden={hidden} />}
          {reminderDue && (
            <InlineNotice icon={BellRing}>
              <Link to="/tx/new" className="font-medium">
                {t('home.reminder')}
              </Link>
            </InlineNotice>
          )}
          {backupDue && (
            <InlineNotice icon={CloudUpload} tone="warning">
              <Link to="/backup" className="font-medium">
                {t('backup.reminder')}
              </Link>
            </InlineNotice>
          )}
          {isSplit && (
            <LinkButton to="/settle" variant="secondary" block icon={HandCoins}>
              {t('split.settleUp')}
            </LinkButton>
          )}
        </div>

        {transactions && groups.length === 0 && (
          <EmptyState
            icon={ReceiptText}
            title={t('home.empty')}
            hint={t('home.emptyHint')}
            action={<LinkButton to="/tx/new">{t('nav.add')}</LinkButton>}
          />
        )}
        <TransactionDayList groups={groups} className="pt-1" />
      </div>

      <BookSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <MonthPickerSheet
        key={`${period.year}-${period.month}`}
        open={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        year={period.year}
        month={period.month}
        onSelect={(year, month) => setPeriod(monthPeriod(year, month, settings.monthStartDay))}
      />
    </div>
  );
}

function BudgetStrip({ budget, spent, period, hidden }: { budget: number; spent: number; period: Period; hidden: boolean }) {
  const { t } = useApp();
  const format = useFormat();
  const progress = budgetProgress(budget, spent);
  const allowance = dailyAllowance(progress.remaining, period, todayKey());
  const money = (v: number) => (hidden ? HIDDEN_AMOUNT : format.money(v));
  return (
    <Link to="/budget" className="block">
      <Card className="px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-2 text-[0.85rem]">
          <span className="font-medium">{progress.exceeded ? t('home.budgetOver', { amount: money(-progress.remaining) }) : t('home.budgetLeft', { amount: money(progress.remaining) })}</span>
          <span className="tabular text-muted">{format.percent(progress.ratio, 0)}</span>
        </div>
        <Meter ratio={progress.ratio} label={t('budget.total')} />
        {allowance.perDay > 0 && <p className="mt-1.5 text-xs text-muted">{t('budget.perDay', { amount: money(allowance.perDay), days: allowance.daysLeft })}</p>}
      </Card>
    </Link>
  );
}

function SplitSummary({
  hidden,
  toggleHidden,
  history,
  periodTx,
  meId,
  memberIds,
}: {
  hidden: boolean;
  toggleHidden: () => void;
  history: Parameters<typeof memberBalances>[0];
  periodTx: Parameters<typeof memberShareTotal>[0];
  meId: string | undefined;
  memberIds: string[];
}) {
  const { t } = useApp();
  const format = useFormat();
  const groupSpend = periodTx.filter((tx) => tx.kind === 'split_expense').reduce((sum, tx) => sum + tx.amount, 0);
  const myShare = meId ? memberShareTotal(periodTx, meId) : 0;
  const myBalance = meId ? (memberBalances(history, memberIds).get(meId) ?? 0) : 0;
  const money = (v: number) => (hidden ? HIDDEN_AMOUNT : format.money(v));
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-3 px-5">
        <div>
          <p className="text-[0.8rem] opacity-80">{t('split.totalExpenses')}</p>
          <p className="truncate text-2xl font-semibold">{money(groupSpend)}</p>
        </div>
        <div>
          <p className="text-[0.8rem] opacity-80">{t('split.myShare')}</p>
          <p className="truncate text-2xl font-semibold">{money(myShare)}</p>
        </div>
      </div>
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-black/12 py-2 pr-1 pl-4 dark:bg-white/5">
        <span className="text-[0.85rem] opacity-85">{myBalance === 0 ? t('split.allSettled') : myBalance > 0 ? t('split.youAreOwed') : t('split.youOwe')}</span>
        {myBalance !== 0 && <span className="ml-auto truncate text-[1.05rem] font-semibold">{money(Math.abs(myBalance))}</span>}
        <IconButton icon={hidden ? EyeOff : Eye} label={hidden ? t('home.showAmounts') : t('home.hideAmounts')} tone="hero" onClick={toggleHidden} className={myBalance === 0 ? 'ml-auto' : ''} />
      </div>
    </>
  );
}
