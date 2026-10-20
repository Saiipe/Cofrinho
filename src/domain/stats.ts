import { addDays, dayKey, monthPeriod, type Period } from './dates';
import type { Category, CategoryKind, DayKey, ID, Minor, Transaction } from './types';

type AmountTx = Pick<Transaction, 'kind' | 'amount'>;

export interface Totals {
  income: Minor;
  expense: Minor;
  balance: Minor;
  count: number;
}

/** Income and expense totals; transfers and adjustments move money between accounts and are excluded. */
export function totals(transactions: AmountTx[]): Totals {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.kind === 'income') {
      income += tx.amount;
      count++;
    } else if (tx.kind === 'expense') {
      expense += tx.amount;
      count++;
    }
  }
  return { income, expense, balance: income - expense, count };
}

export interface DayGroup<T> {
  day: DayKey;
  items: T[];
  income: Minor;
  expense: Minor;
}

/** Newest day first; inside a day, newest entry first. */
export function groupByDay<T extends Pick<Transaction, 'date' | 'kind' | 'amount' | 'createdAt'>>(transactions: T[]): DayGroup<T>[] {
  const sorted = [...transactions].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
  const groups: DayGroup<T>[] = [];
  for (const tx of sorted) {
    const day = dayKey(tx.date);
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = { day, items: [], income: 0, expense: 0 };
      groups.push(group);
    }
    group.items.push(tx);
    if (tx.kind === 'income') group.income += tx.amount;
    else if (tx.kind === 'expense' || tx.kind === 'split_expense') group.expense += tx.amount;
  }
  return groups;
}

export interface CategorySlice {
  /** null groups transactions without a category. */
  categoryId: ID | null;
  amount: Minor;
  count: number;
  ratio: number;
}

type CategoryRef = Pick<Category, 'id' | 'parentId'>;

/**
 * Amount per category for one kind. `top` folds subcategories into their parent;
 * `children` breaks one parent down into itself and its subcategories.
 */
export function categoryBreakdown(
  transactions: Pick<Transaction, 'kind' | 'amount' | 'categoryId'>[],
  kind: CategoryKind,
  categories: Map<ID, CategoryRef>,
  scope: { level: 'top' } | { level: 'children'; parentId: ID } = { level: 'top' },
): CategorySlice[] {
  const sums = new Map<ID | null, { amount: Minor; count: number }>();
  let total = 0;
  for (const tx of transactions) {
    if (tx.kind !== kind) continue;
    const category = tx.categoryId ? categories.get(tx.categoryId) : undefined;
    let key: ID | null;
    if (scope.level === 'top') {
      key = category ? (category.parentId ?? category.id) : null;
    } else {
      if (!category || (category.id !== scope.parentId && category.parentId !== scope.parentId)) continue;
      key = category.id;
    }
    const entry = sums.get(key) ?? { amount: 0, count: 0 };
    entry.amount += tx.amount;
    entry.count++;
    sums.set(key, entry);
    total += tx.amount;
  }
  return [...sums]
    .map(([categoryId, { amount, count }]) => ({ categoryId, amount, count, ratio: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** One point per day of the period (zeros included) for a trend chart. */
export function dailySeries(
  transactions: Pick<Transaction, 'kind' | 'amount' | 'date'>[],
  period: Period,
  kind: CategoryKind,
): { day: DayKey; amount: Minor }[] {
  const byDay = new Map<DayKey, Minor>();
  for (const tx of transactions) {
    if (tx.kind !== kind) continue;
    const day = dayKey(tx.date);
    byDay.set(day, (byDay.get(day) ?? 0) + tx.amount);
  }
  const points: { day: DayKey; amount: Minor }[] = [];
  for (let day = period.startKey; day < period.endKey; day = addDays(day, 1)) {
    points.push({ day, amount: byDay.get(day) ?? 0 });
  }
  return points;
}

export interface MonthSummary extends Totals {
  month: number;
  period: Period;
}

/** Twelve month periods of `year` (respecting the custom month start day) with their totals. */
export function monthlySummaries(transactions: Pick<Transaction, 'kind' | 'amount' | 'date'>[], year: number, startDay = 1): MonthSummary[] {
  const months = Array.from({ length: 12 }, (_, month) => ({ month, period: monthPeriod(year, month, startDay), bucket: [] as AmountTx[] }));
  for (const tx of transactions) {
    const month = months.find((m) => tx.date >= m.period.start && tx.date < m.period.end);
    month?.bucket.push(tx);
  }
  return months.map(({ month, period, bucket }) => ({ month, period, ...totals(bucket) }));
}

export interface RecordingStats {
  /** Distinct days on which something was recorded. */
  activeDays: number;
  /** Consecutive days with records up to today (still alive if the last one was yesterday). */
  streak: number;
  totalRecords: number;
}

/** Activity stats from creation timestamps (when the user recorded, not the transaction date). */
export function recordingStats(createdAt: number[], today: DayKey): RecordingStats {
  const days = new Set(createdAt.map((t) => dayKey(t)));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return { activeDays: days.size, streak, totalRecords: createdAt.length };
}

/** Relative change between two values, null when there is no base to compare with. */
export function relativeChange(current: Minor, previous: Minor): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}
