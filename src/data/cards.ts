import { resolveAmounts } from '@/domain/amounts';
import { addMonthsClamped } from '@/domain/dates';
import { NOTE_MAX } from '@/domain/defaults';
import type { Account, Book, DayKey, ID, Minor, Transaction } from '@/domain/types';
import { db, newId } from './db';
import { loadRateTable, lookupRate } from './rates';

/**
 * Something already on a credit card when it is added to the app.
 * - `purchase`: an expense; with `count > 1` only the installments still to come are recorded
 *   (from `current` to `count`), one per month, the first one on `day`.
 * - `balance`: an amount owed without details; it goes into the invoice and the used limit but is
 *   not an expense of the month (recorded as a balance adjustment).
 */
export interface CardBacklogItem {
  kind: 'purchase' | 'balance';
  description: string;
  categoryId: ID | null;
  /** Purchase: each installment (or the whole purchase when `count` is 1). Balance: the amount owed. Card currency. */
  amount: Minor;
  count: number;
  current: number;
  /** A day inside the invoice the item (or its current installment) belongs to. */
  day: DayKey;
}

/** Installments a backlog purchase still records. */
export function remainingInstallments(item: Pick<CardBacklogItem, 'count' | 'current'>): number {
  return Math.max(1, item.count - Math.min(Math.max(1, item.current), item.count) + 1);
}

/**
 * Records the backlog of a card. Returns how many records were created and how many items were
 * skipped because no exchange rate converts the card currency to the book currency.
 */
export async function addCardBacklog(book: Book, card: Account, items: CardBacklogItem[], balanceNote: string, now = Date.now()): Promise<{ created: number; skipped: number }> {
  const table = await loadRateTable();
  const rate = (from: string, to: string) => lookupRate(table, from, to);
  const rows: Transaction[] = [];
  let skipped = 0;
  for (const item of items) {
    if (item.amount <= 0) continue;
    const note = (item.description.trim() || (item.kind === 'balance' ? balanceNote : '')).slice(0, NOTE_MAX);
    if (item.kind === 'balance') {
      const resolved = resolveAmounts({ kind: 'adjustment', currency: card.currency, originalAmount: -item.amount, bookCurrency: book.currency, accountCurrency: card.currency }, rate);
      if (!resolved.ok) {
        skipped++;
        continue;
      }
      rows.push(record(book, card, { kind: 'adjustment', day: item.day, now, note, categoryId: null, originalAmount: -item.amount, ...resolved.value }));
      continue;
    }
    const resolved = resolveAmounts({ kind: 'expense', currency: card.currency, originalAmount: item.amount, bookCurrency: book.currency, accountCurrency: card.currency }, rate);
    if (!resolved.ok) {
      skipped++;
      continue;
    }
    const remaining = remainingInstallments(item);
    const first = item.count - remaining + 1;
    const groupId = newId();
    for (let i = 0; i < remaining; i++) {
      rows.push(
        record(book, card, {
          kind: 'expense',
          day: addMonthsClamped(item.day, i),
          now,
          note,
          categoryId: item.categoryId,
          originalAmount: item.amount,
          ...resolved.value,
          ...(item.count > 1 ? { installment: { groupId, index: first + i, count: item.count } } : {}),
        }),
      );
    }
  }
  if (rows.length) await db.transactions.bulkAdd(rows);
  return { created: rows.length, skipped };
}

function record(
  book: Book,
  card: Account,
  fields: Pick<Transaction, 'kind' | 'note' | 'categoryId' | 'originalAmount' | 'amount' | 'accountAmount' | 'toAccountAmount' | 'installment'> & { day: DayKey; now: number },
): Transaction {
  const { day, now, ...rest } = fields;
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const time = new Date(now);
  return {
    id: newId(),
    bookId: book.id,
    date: new Date(y, m - 1, d, time.getHours(), time.getMinutes()).getTime(),
    currency: card.currency,
    accountId: card.id,
    toAccountId: null,
    photoIds: [],
    createdAt: now,
    updatedAt: now,
    ...rest,
  };
}
