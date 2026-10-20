import { resolveAmounts } from '@/domain/amounts';
import { accountBalances } from '@/domain/balances';
import type { Account, AccountType, Book, ID, Minor, Transaction } from '@/domain/types';
import { db, newId } from './db';
import { loadRateTable, lookupRate } from './rates';

export interface AccountInput {
  id?: ID;
  bookId: ID;
  name: string;
  type: AccountType;
  icon: string;
  color: string;
  currency: string;
  initialBalance: Minor;
  excludeFromTotals: boolean;
  isDefault: boolean;
  note: string;
}

export async function saveAccount(input: AccountInput): Promise<ID> {
  const now = Date.now();
  return db.transaction('rw', db.accounts, async () => {
    if (input.isDefault) {
      await db.accounts.where('bookId').equals(input.bookId).modify({ isDefault: false });
    }
    const fields = {
      name: input.name.trim(),
      type: input.type,
      icon: input.icon,
      color: input.color,
      currency: input.currency,
      initialBalance: input.initialBalance,
      excludeFromTotals: input.excludeFromTotals,
      isDefault: input.isDefault,
      note: input.note.trim(),
      updatedAt: now,
    };
    if (input.id) {
      await db.accounts.update(input.id, fields);
      return input.id;
    }
    const count = await db.accounts.where('bookId').equals(input.bookId).count();
    const account: Account = { id: newId(), bookId: input.bookId, order: count, createdAt: now, ...fields };
    await db.accounts.add(account);
    return account.id;
  });
}

export async function setDefaultAccount(bookId: ID, id: ID | null): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    await db.accounts.where('bookId').equals(bookId).modify((a) => {
      a.isDefault = a.id === id;
    });
  });
}

/** Records stay; references to the account are cleared. */
export async function deleteAccount(id: ID): Promise<void> {
  await db.transaction('rw', [db.accounts, db.transactions, db.schedules], async () => {
    await db.transactions.where('accountId').equals(id).modify({ accountId: null });
    await db.transactions.where('toAccountId').equals(id).modify({ toAccountId: null });
    await db.schedules.filter((s) => s.accountId === id).modify({ accountId: null });
    await db.schedules.filter((s) => s.toAccountId === id).modify({ toAccountId: null });
    await db.accounts.delete(id);
  });
}

export async function reorderAccounts(ids: ID[]): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    await Promise.all(ids.map((id, order) => db.accounts.update(id, { order })));
  });
}

export async function accountBalance(account: Account): Promise<Minor> {
  const txs = await db.transactions.where('bookId').equals(account.bookId).toArray();
  return accountBalances([account], txs).get(account.id) ?? account.initialBalance;
}

/**
 * Sets an account to a known real balance by recording the difference as an `adjustment`.
 * Returns null when nothing changes or when no rate exists to express the delta in the book currency.
 */
export async function adjustAccountBalance(
  book: Book,
  account: Account,
  targetBalance: Minor,
  extras: { note: string; photoIds: ID[] },
): Promise<Transaction | 'no_change' | 'missing_rate'> {
  const delta = targetBalance - (await accountBalance(account));
  if (delta === 0) return 'no_change';
  const table = await loadRateTable();
  const resolved = resolveAmounts(
    { kind: 'adjustment', currency: account.currency, originalAmount: delta, bookCurrency: book.currency, accountCurrency: account.currency },
    (from, to) => lookupRate(table, from, to),
  );
  if (!resolved.ok) return 'missing_rate';
  const now = Date.now();
  const tx: Transaction = {
    id: newId(),
    bookId: book.id,
    kind: 'adjustment',
    date: now,
    amount: resolved.value.amount,
    currency: account.currency,
    originalAmount: delta,
    categoryId: null,
    accountId: account.id,
    accountAmount: delta,
    toAccountId: null,
    toAccountAmount: 0,
    note: extras.note.trim(),
    photoIds: extras.photoIds,
    createdAt: now,
    updatedAt: now,
  };
  await db.transactions.add(tx);
  return tx;
}
