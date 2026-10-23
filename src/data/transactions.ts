import { installmentDates, splitInstallments } from '@/domain/card';
import { dayKey, type Period } from '@/domain/dates';
import { DETAILS_MAX, NOTE_MAX } from '@/domain/defaults';
import { SCHEDULE_NAME_MAX, statusFor } from '@/domain/schedule';
import type { DayKey, Frequency, ID, Schedule, Transaction } from '@/domain/types';
import { db, newId } from './db';

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: ID };

function clean(input: TransactionInput): TransactionInput {
  const details = input.details?.trim().slice(0, DETAILS_MAX);
  const tagIds = input.tagIds?.length ? [...new Set(input.tagIds)] : undefined;
  return { ...input, note: input.note.trim().slice(0, NOTE_MAX), details: details || undefined, tagIds };
}

export async function saveTransaction(input: TransactionInput): Promise<Transaction> {
  const now = Date.now();
  const cleaned = clean(input);
  return db.transaction('rw', [db.transactions, db.photos, db.notes], async () => {
    const previous = input.id ? await db.transactions.get(input.id) : undefined;
    const tx: Transaction = { ...cleaned, id: previous?.id ?? newId(), createdAt: previous?.createdAt ?? now, updatedAt: now };
    await db.transactions.put(tx);
    if (previous) {
      const removed = previous.photoIds.filter((id) => !tx.photoIds.includes(id));
      if (removed.length) await db.photos.bulkDelete(removed);
    }
    if (tx.note && (tx.kind === 'expense' || tx.kind === 'income' || tx.kind === 'split_expense')) {
      await rememberNote(tx.bookId, tx.categoryId, tx.note);
    }
    return tx;
  });
}

/**
 * Records a purchase split into `count` monthly installments, each dated a month after the
 * previous one. Photos stay on the first installment. Returns the first installment.
 */
export async function saveInstallments(input: TransactionInput, count: number): Promise<Transaction> {
  if (count <= 1) return saveTransaction(input);
  const now = Date.now();
  const cleaned = clean(input);
  const groupId = newId();
  const dates = installmentDates(cleaned.date, count);
  const amounts = splitInstallments(cleaned.amount, count);
  const originals = splitInstallments(cleaned.originalAmount, count);
  const accountAmounts = splitInstallments(cleaned.accountAmount, count);
  const rows: Transaction[] = dates.map((date, i) => ({
    ...cleaned,
    id: newId(),
    date,
    amount: amounts[i]!,
    originalAmount: originals[i]!,
    accountAmount: accountAmounts[i]!,
    photoIds: i === 0 ? cleaned.photoIds : [],
    installment: { groupId, index: i + 1, count },
    createdAt: now,
    updatedAt: now,
  }));
  await db.transaction('rw', [db.transactions, db.notes], async () => {
    await db.transactions.bulkAdd(rows);
    if (cleaned.note && cleaned.kind === 'expense') await rememberNote(cleaned.bookId, cleaned.categoryId, cleaned.note);
  });
  return rows[0]!;
}

export interface RepeatRule {
  frequency: Frequency;
  /** Total runs including this first one; 0 = unlimited. */
  totalCount: number;
  /** Last day a run may fall on (inclusive); replaces `totalCount` when set. */
  endDate?: DayKey;
}

/**
 * Saves a record and makes it the first run of a recurring plan, so it shows up right away
 * and the next ones follow automatically on their dates.
 */
export async function saveRecurringTransaction(input: TransactionInput, repeat: RepeatRule, name: string): Promise<Transaction> {
  if (input.kind !== 'expense' && input.kind !== 'income' && input.kind !== 'transfer') return saveTransaction(input);
  const tx = await saveTransaction(input);
  const now = Date.now();
  const startDate = dayKey(tx.date);
  const schedule: Schedule = {
    id: newId(),
    bookId: tx.bookId,
    name: name.trim().slice(0, SCHEDULE_NAME_MAX),
    kind: input.kind,
    categoryId: input.kind === 'transfer' ? null : tx.categoryId,
    accountId: tx.accountId,
    toAccountId: input.kind === 'transfer' ? tx.toAccountId : null,
    frequency: repeat.frequency,
    startDate,
    amount: tx.originalAmount,
    currency: tx.currency,
    toAmount: input.kind === 'transfer' && tx.toAccountId ? tx.toAccountAmount : null,
    totalCount: repeat.endDate ? 0 : repeat.totalCount,
    ...(repeat.endDate ? { endDate: repeat.endDate } : {}),
    runCount: 1,
    lastRunDate: startDate,
    status: statusFor('active', { frequency: repeat.frequency, startDate, lastRunDate: startDate, totalCount: repeat.endDate ? 0 : repeat.totalCount, runCount: 1, endDate: repeat.endDate }),
    note: tx.note,
    tagIds: tx.tagIds,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', [db.transactions, db.schedules], async () => {
    await db.schedules.add(schedule);
    await db.transactions.update(tx.id, { scheduleId: schedule.id });
  });
  return { ...tx, scheduleId: schedule.id };
}

export async function deleteTransaction(id: ID): Promise<void> {
  await db.transaction('rw', [db.transactions, db.photos], async () => {
    const tx = await db.transactions.get(id);
    if (!tx) return;
    if (tx.photoIds.length) await db.photos.bulkDelete(tx.photoIds);
    await db.transactions.delete(id);
  });
}

/** Deletes the installments of a purchase from `fromIndex` on (1 = all of them). */
export async function deleteInstallmentGroup(bookId: ID, groupId: ID, fromIndex = 1): Promise<number> {
  return db.transaction('rw', [db.transactions, db.photos], async () => {
    const rows = await db.transactions
      .where('bookId')
      .equals(bookId)
      .filter((tx) => tx.installment?.groupId === groupId && tx.installment.index >= fromIndex)
      .toArray();
    const photos = rows.flatMap((tx) => tx.photoIds);
    if (photos.length) await db.photos.bulkDelete(photos);
    await db.transactions.bulkDelete(rows.map((tx) => tx.id));
    return rows.length;
  });
}

/** Copies a record to now (keeping amounts and links); photos are not duplicated. */
export async function duplicateTransaction(id: ID): Promise<Transaction | null> {
  const tx = await db.transactions.get(id);
  if (!tx) return null;
  const { id: _omit, createdAt: _c, updatedAt: _u, installment: _i, ...rest } = tx;
  return saveTransaction({ ...rest, date: Date.now(), photoIds: [], scheduleId: undefined });
}

export function transactionsInPeriod(bookId: ID, period: Pick<Period, 'start' | 'end'>): Promise<Transaction[]> {
  return db.transactions.where('[bookId+date]').between([bookId, period.start], [bookId, period.end], true, false).toArray();
}

export function bookTransactions(bookId: ID): Promise<Transaction[]> {
  return db.transactions.where('bookId').equals(bookId).toArray();
}

async function rememberNote(bookId: ID, categoryId: ID | null, text: string): Promise<void> {
  const existing = await db.notes
    .where('bookId')
    .equals(bookId)
    .filter((n) => n.categoryId === categoryId && n.text.toLowerCase() === text.toLowerCase())
    .first();
  if (existing) {
    await db.notes.update(existing.id, { uses: existing.uses + 1, lastUsedAt: Date.now(), text });
  } else {
    await db.notes.add({ id: newId(), bookId, categoryId, text, uses: 1, lastUsedAt: Date.now() });
  }
}

/** Most used notes for a category, filtered by what has been typed so far. */
export async function suggestNotes(bookId: ID, categoryId: ID | null, typed: string, limit = 6): Promise<string[]> {
  const query = typed.trim().toLowerCase();
  const notes = await db.notes.where('bookId').equals(bookId).filter((n) => n.categoryId === categoryId).toArray();
  return notes
    .filter((n) => !query || (n.text.toLowerCase().includes(query) && n.text.toLowerCase() !== query))
    .sort((a, b) => b.uses - a.uses || b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit)
    .map((n) => n.text);
}
