import type { Period } from '@/domain/dates';
import { NOTE_MAX } from '@/domain/defaults';
import type { ID, Transaction } from '@/domain/types';
import { db, newId } from './db';

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: ID };

export async function saveTransaction(input: TransactionInput): Promise<Transaction> {
  const now = Date.now();
  const note = input.note.trim().slice(0, NOTE_MAX);
  return db.transaction('rw', [db.transactions, db.photos, db.notes], async () => {
    const previous = input.id ? await db.transactions.get(input.id) : undefined;
    const tx: Transaction = { ...input, note, id: previous?.id ?? newId(), createdAt: previous?.createdAt ?? now, updatedAt: now };
    await db.transactions.put(tx);
    if (previous) {
      const removed = previous.photoIds.filter((id) => !tx.photoIds.includes(id));
      if (removed.length) await db.photos.bulkDelete(removed);
    }
    if (note && (tx.kind === 'expense' || tx.kind === 'income' || tx.kind === 'split_expense')) {
      await rememberNote(tx.bookId, tx.categoryId, note);
    }
    return tx;
  });
}

export async function deleteTransaction(id: ID): Promise<void> {
  await db.transaction('rw', [db.transactions, db.photos], async () => {
    const tx = await db.transactions.get(id);
    if (!tx) return;
    if (tx.photoIds.length) await db.photos.bulkDelete(tx.photoIds);
    await db.transactions.delete(id);
  });
}

/** Copies a record to now (keeping amounts and links); photos are not duplicated. */
export async function duplicateTransaction(id: ID): Promise<Transaction | null> {
  const tx = await db.transactions.get(id);
  if (!tx) return null;
  const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = tx;
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
