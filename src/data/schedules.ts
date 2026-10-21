import { resolveAmounts } from '@/domain/amounts';
import { todayKey, withDay } from '@/domain/dates';
import { dueOccurrences, initialLastRun, recomputeLastRun, statusForCount } from '@/domain/schedule';
import type { DayKey, ID, Schedule, Transaction } from '@/domain/types';
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
      status: statusForCount(requested, input.totalCount, runCount),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    await db.schedules.put(schedule);
    return schedule.id;
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
        if (!book || book.type === 'split') continue;
        const account = schedule.accountId ? await db.accounts.get(schedule.accountId) : undefined;
        const toAccount = schedule.toAccountId ? await db.accounts.get(schedule.toAccountId) : undefined;
        if (schedule.kind === 'transfer' && (!account || !toAccount)) continue;

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
        if (!resolved.ok) continue;

        const stamp = Date.now();
        const created: Transaction[] = due.map((day) => ({
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
        }));
        await db.transactions.bulkAdd(created);
        const runCount = schedule.runCount + due.length;
        const updated: Schedule = {
          ...schedule,
          runCount,
          lastRunDate: due[due.length - 1]!,
          status: statusForCount(schedule.status, schedule.totalCount, runCount),
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
