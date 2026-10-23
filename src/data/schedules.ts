import { resolveAmounts } from '@/domain/amounts';
import { addDays, todayKey, withDay } from '@/domain/dates';
import { dueOccurrences, forecastHorizon, forecastOccurrences, initialLastRun, recomputeLastRun, statusFor } from '@/domain/schedule';
import type { Book, DayKey, Frequency, ID, Schedule, Transaction } from '@/domain/types';
import { db, newId } from './db';
import { loadRateTable, lookupRate } from './rates';

export type ScheduleInput = Omit<Schedule, 'id' | 'runCount' | 'lastRunDate' | 'status' | 'createdAt' | 'updatedAt'> & {
  id?: ID;
  paused: boolean;
  /** New plans only: also record the dates between the start date and today. */
  backfill?: boolean;
};

export async function saveSchedule(input: ScheduleInput, today: DayKey = todayKey()): Promise<ID> {
  const now = Date.now();
  return db.transaction('rw', db.schedules, async () => {
    const previous = input.id ? await db.schedules.get(input.id) : undefined;
    const rule = { frequency: input.frequency, startDate: input.startDate };
    let lastRunDate: DayKey | null;
    if (!previous) {
      lastRunDate = input.backfill ? null : initialLastRun(rule, today);
    } else if (previous.frequency !== input.frequency || previous.startDate !== input.startDate || previous.totalCount !== input.totalCount) {
      lastRunDate = recomputeLastRun(rule, previous.lastRunDate, today);
    } else {
      lastRunDate = previous.lastRunDate;
    }
    const runCount = previous?.runCount ?? 0;
    const requested = input.paused ? 'paused' : previous?.status === 'completed' ? 'completed' : 'active';
    const { paused: _paused, id: _id, backfill: _backfill, ...fields } = input;
    const schedule: Schedule = {
      ...fields,
      name: input.name.trim(),
      note: input.note.trim(),
      id: previous?.id ?? newId(),
      runCount,
      lastRunDate,
      status: statusFor(requested, { ...rule, lastRunDate, totalCount: input.totalCount, runCount, endDate: input.endDate }),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    await db.schedules.put(schedule);
    return schedule.id;
  });
}

/** The plan as form input, so edits go through `saveSchedule` and keep its last-run rules. */
function asInput(schedule: Schedule): ScheduleInput {
  const { runCount: _r, lastRunDate: _l, status, createdAt: _c, updatedAt: _u, ...fields } = schedule;
  return { ...fields, paused: status === 'paused' };
}

/** Changes how often a plan repeats and when it ends (from the record form's "Repetir"). */
export async function updateScheduleRule(id: ID, rule: { frequency: Frequency; totalCount: number; endDate?: DayKey }, today: DayKey = todayKey()): Promise<void> {
  const schedule = await db.schedules.get(id);
  if (!schedule) return;
  const { endDate: _old, ...input } = asInput(schedule);
  await saveSchedule({ ...input, frequency: rule.frequency, totalCount: rule.endDate ? 0 : rule.totalCount, ...(rule.endDate ? { endDate: rule.endDate } : {}) }, today);
}

/** Stops a plan after its last run; the records it created stay. */
export async function endSchedule(id: ID, today: DayKey = todayKey()): Promise<void> {
  const schedule = await db.schedules.get(id);
  if (!schedule) return;
  // Before the start date when it never ran, so nothing else is recorded.
  const endDate = schedule.lastRunDate ?? addDays(schedule.startDate, -1);
  await saveSchedule({ ...asInput(schedule), totalCount: 0, endDate }, today);
}

/** Copies what was edited in one of its records to the plan, so the next runs follow it. */
export async function applyToSchedule(id: ID, tx: Pick<Transaction, 'kind' | 'originalAmount' | 'currency' | 'categoryId' | 'accountId' | 'toAccountId' | 'toAccountAmount' | 'note' | 'tagIds'>): Promise<void> {
  if (tx.kind !== 'expense' && tx.kind !== 'income' && tx.kind !== 'transfer') return;
  await db.schedules.update(id, {
    kind: tx.kind,
    amount: tx.originalAmount,
    currency: tx.currency,
    categoryId: tx.kind === 'transfer' ? null : tx.categoryId,
    accountId: tx.accountId,
    toAccountId: tx.kind === 'transfer' ? tx.toAccountId : null,
    toAmount: tx.kind === 'transfer' && tx.toAccountId ? tx.toAccountAmount : null,
    note: tx.note,
    tagIds: tx.tagIds ?? [],
    updatedAt: Date.now(),
  });
}

export async function deleteSchedule(id: ID): Promise<void> {
  await db.schedules.delete(id);
}

export async function setSchedulePaused(id: ID, paused: boolean): Promise<void> {
  const schedule = await db.schedules.get(id);
  if (!schedule || schedule.status === 'completed') return;
  await db.schedules.update(id, { status: paused ? 'paused' : 'active', updatedAt: Date.now() });
}

type Recorder = (day: DayKey, stamp: number) => Transaction;

/**
 * Builds the records a plan creates, with amounts converted to the book and account currencies.
 * Null when the plan cannot record now (group book, deleted transfer accounts, missing exchange rate).
 */
async function scheduleRecorder(schedule: Schedule, book: Book, rate: (from: string, to: string) => number | null): Promise<Recorder | null> {
  if (book.type === 'split') return null;
  const account = schedule.accountId ? await db.accounts.get(schedule.accountId) : undefined;
  const toAccount = schedule.toAccountId ? await db.accounts.get(schedule.toAccountId) : undefined;
  if (schedule.kind === 'transfer' && (!account || !toAccount)) return null;

  const resolved = resolveAmounts(
    {
      kind: schedule.kind,
      currency: schedule.currency,
      originalAmount: schedule.amount,
      bookCurrency: book.currency,
      accountCurrency: account?.currency ?? null,
      toAccountCurrency: toAccount?.currency ?? null,
      toAmountOverride: schedule.toAmount,
    },
    rate,
  );
  if (!resolved.ok) return null;

  return (day, stamp) => ({
    id: newId(),
    bookId: book.id,
    kind: schedule.kind,
    date: withDay(day, schedule.createdAt),
    ...resolved.value,
    currency: schedule.currency,
    originalAmount: schedule.amount,
    categoryId: schedule.kind === 'transfer' ? null : schedule.categoryId,
    accountId: account?.id ?? null,
    toAccountId: toAccount?.id ?? null,
    note: schedule.note || schedule.name,
    photoIds: [],
    ...(schedule.tagIds?.length ? { tagIds: schedule.tagIds } : {}),
    scheduleId: schedule.id,
    createdAt: stamp,
    updatedAt: stamp,
  });
}

/**
 * Records the active plans of a book will still create after today, up to the forecast horizon
 * (see `forecastHorizon`). Nothing is stored: forecasts are recomputed from the plans on each call.
 */
export async function forecastTransactions(bookId: ID, today: DayKey = todayKey()): Promise<Transaction[]> {
  const book = await db.books.get(bookId);
  if (!book) return [];
  const plans = await db.schedules.where('bookId').equals(bookId).filter((s) => s.status === 'active').toArray();
  if (!plans.length) return [];
  const table = await loadRateTable();
  const rate = (from: string, to: string) => lookupRate(table, from, to);
  const horizon = forecastHorizon(today);
  const forecast: Transaction[] = [];
  for (const schedule of plans) {
    const days = forecastOccurrences(schedule, today, horizon);
    if (!days.length) continue;
    const build = await scheduleRecorder(schedule, book, rate);
    if (!build) continue;
    // Stable ids keep list keys steady across live-query refreshes.
    for (const day of days) forecast.push({ ...build(day, schedule.updatedAt), id: `forecast:${schedule.id}:${day}` });
  }
  return forecast.sort((a, b) => a.date - b.date);
}

export interface ScheduleRun {
  schedule: Schedule;
  created: Transaction[];
}

/**
 * Records every due occurrence of every active plan (all books), oldest first, each dated on its
 * own occurrence. Plans whose accounts or exchange rate are missing are skipped and retried later.
 */
export async function runDueSchedules(now: number = Date.now()): Promise<ScheduleRun[]> {
  const today = todayKey(now);
  const execute = async (): Promise<ScheduleRun[]> => {
    const table = await loadRateTable();
    const rate = (from: string, to: string) => lookupRate(table, from, to);
    return db.transaction('rw', [db.schedules, db.transactions, db.accounts, db.books], async () => {
      const runs: ScheduleRun[] = [];
      const active = await db.schedules.filter((s) => s.status === 'active').toArray();
      for (const schedule of active) {
        const due = dueOccurrences(schedule, today);
        if (!due.length) continue;
        const book = await db.books.get(schedule.bookId);
        if (!book) continue;
        const build = await scheduleRecorder(schedule, book, rate);
        if (!build) continue;
        const stamp = Date.now();
        const created = due.map((day) => build(day, stamp));
        await db.transactions.bulkAdd(created);
        const runCount = schedule.runCount + due.length;
        const updated: Schedule = {
          ...schedule,
          runCount,
          lastRunDate: due[due.length - 1]!,
          status: statusFor(schedule.status, { ...schedule, runCount, lastRunDate: due[due.length - 1]! }),
          updatedAt: stamp,
        };
        await db.schedules.put(updated);
        runs.push({ schedule: updated, created });
      }
      return runs;
    });
  };
  // Two open tabs must not record the same occurrence twice.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('cofrinho-schedules', execute);
  }
  return execute();
}
