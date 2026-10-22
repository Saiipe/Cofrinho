import { beforeEach, describe, expect, it } from 'vitest';
import { createTranslator } from '@/i18n';
import { adjustAccountBalance, saveAccount } from './accounts';
import { createBackup, parseBackup, restoreBackup } from './backup';
import { createBook, deleteBook } from './books';
import { setCategoryBudget, setTotalBudget } from './budgets';
import { deleteCategory } from './categories';
import { db } from './db';
import { applyImport, previewImport } from './imports';
import { setCustomRate } from './rates';
import { runDueSchedules, saveSchedule } from './schedules';
import { saveTransaction, suggestNotes, type TransactionInput } from './transactions';

const t = createTranslator('pt-BR');

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function expense(bookId: string, partial: Partial<TransactionInput> = {}): TransactionInput {
  return {
    bookId,
    kind: 'expense',
    date: new Date(2026, 9, 20, 12).getTime(),
    amount: 1000,
    currency: 'BRL',
    originalAmount: 1000,
    categoryId: null,
    accountId: null,
    accountAmount: 0,
    toAccountId: null,
    toAccountAmount: 0,
    note: '',
    photoIds: [],
    ...partial,
  };
}

describe('books', () => {
  it('seeds default categories with subcategories and split members', async () => {
    const book = await createBook({ name: 'Viagem', type: 'split', currency: 'BRL', color: '#000', members: [{ name: 'Eu', isMe: true }, { name: 'Ana', isMe: false }] });
    const categories = await db.categories.where('bookId').equals(book.id).toArray();
    const food = categories.find((c) => c.builtinKey === 'food')!;
    expect(categories.filter((c) => c.parentId === food.id).sort((a, b) => a.order - b.order).map((c) => c.builtinKey)).toEqual(['groceries', 'restaurant', 'delivery', 'snacks', 'bakery', 'fair', 'drinks', 'supplements']);
    expect(categories.some((c) => c.kind === 'income' && c.builtinKey === 'salary')).toBe(true);
    expect(await db.members.where('bookId').equals(book.id).count()).toBe(2);
  });

  it('deletes everything inside a book', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    const keep = await createBook({ name: 'B', type: 'personal', currency: 'BRL', color: '#000' });
    await saveTransaction(expense(book.id));
    await saveTransaction(expense(keep.id));
    await deleteBook(book.id);
    expect(await db.transactions.count()).toBe(1);
    expect(await db.categories.where('bookId').equals(book.id).count()).toBe(0);
  });
});

describe('transactions and categories', () => {
  it('remembers notes per category, most used first', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    await saveTransaction(expense(book.id, { categoryId: 'c1', note: 'Padaria' }));
    await saveTransaction(expense(book.id, { categoryId: 'c1', note: 'Mercado' }));
    await saveTransaction(expense(book.id, { categoryId: 'c1', note: 'mercado' }));
    expect(await suggestNotes(book.id, 'c1', '')).toEqual(['mercado', 'Padaria']);
    expect(await suggestNotes(book.id, 'c1', 'pad')).toEqual(['Padaria']);
    expect(await suggestNotes(book.id, 'other', '')).toEqual([]);
  });

  it('keeps records when their category is deleted', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    const food = (await db.categories.where('bookId').equals(book.id).toArray()).find((c) => c.builtinKey === 'food')!;
    const child = (await db.categories.where('parentId').equals(food.id).toArray())[0]!;
    const tx = await saveTransaction(expense(book.id, { categoryId: child.id }));
    await deleteCategory(food.id);
    expect((await db.transactions.get(tx.id))!.categoryId).toBeNull();
    expect(await db.categories.get(child.id)).toBeUndefined();
  });
});

describe('budgets', () => {
  it('auto-raises the total and rejects totals below the categories', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    await setTotalBudget(book.id, 100_000);
    expect(await setCategoryBudget(book.id, 'food', 80_000)).toEqual({ autoUpdated: false, total: 100_000 });
    expect(await setCategoryBudget(book.id, 'fun', 50_000)).toEqual({ autoUpdated: true, total: 130_000 });
    expect(await setTotalBudget(book.id, 120_000)).toEqual({ ok: false, minimum: 130_000 });
    expect(await setTotalBudget(book.id, 150_000)).toEqual({ ok: true });
  });
});

describe('accounts', () => {
  it('records the difference as an adjustment', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    const id = await saveAccount({ bookId: book.id, name: 'Banco', type: 'debit', icon: 'landmark', color: '#000', currency: 'BRL', initialBalance: 10_000, excludeFromTotals: false, isDefault: true, note: '' });
    await saveTransaction(expense(book.id, { accountId: id, accountAmount: 2_500 }));
    const account = (await db.accounts.get(id))!;
    const tx = await adjustAccountBalance(book, account, 9_000, { note: 'conferido', photoIds: [] });
    expect(tx).toMatchObject({ kind: 'adjustment', accountAmount: 1_500, amount: 1_500 });
    expect(await adjustAccountBalance(book, account, 9_000, { note: '', photoIds: [] })).toBe('no_change');
  });
});

describe('recurring runner', () => {
  it('catches up missed runs once, converting currencies and finishing at the limit', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    await setCustomRate('USD', 'BRL', 5);
    const id = await saveSchedule(
      { bookId: book.id, name: 'Assinatura', kind: 'expense', categoryId: null, accountId: null, toAccountId: null, frequency: 'monthly', startDate: '2026-01-10', amount: 1_000, currency: 'USD', toAmount: null, totalCount: 3, note: '', paused: false },
      '2026-01-10',
    );
    const runs = await runDueSchedules(new Date(2026, 4, 1, 9).getTime());
    expect(runs[0]!.created.map((tx) => [new Date(tx.date).getMonth(), tx.amount, tx.originalAmount])).toEqual([
      [0, 5_000, 1_000],
      [1, 5_000, 1_000],
      [2, 5_000, 1_000],
    ]);
    expect(await db.schedules.get(id)).toMatchObject({ runCount: 3, status: 'completed', lastRunDate: '2026-03-10' });
    expect(await runDueSchedules(new Date(2026, 4, 1, 10).getTime())).toEqual([]);
  });

  it('skips transfers whose accounts were deleted and retries later', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    await saveSchedule(
      { bookId: book.id, name: 'Poupança', kind: 'transfer', categoryId: null, accountId: 'gone', toAccountId: 'gone2', frequency: 'daily', startDate: '2026-10-19', amount: 100, currency: 'BRL', toAmount: null, totalCount: 0, note: '', paused: false },
      '2026-10-19',
    );
    expect(await runDueSchedules(new Date(2026, 9, 20, 9).getTime())).toEqual([]);
    expect((await db.schedules.toArray())[0]).toMatchObject({ runCount: 0 });
  });
});

describe('backup', () => {
  it('round-trips all data through JSON', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    await saveTransaction(expense(book.id, { note: 'x' }));
    const json = JSON.stringify(await createBackup({ includePhotos: true }));
    await db.delete();
    await db.open();
    await restoreBackup(parseBackup(json));
    expect(await db.transactions.count()).toBe(1);
    expect(await db.books.count()).toBe(1);
    expect(() => parseBackup('{"format":"other"}')).toThrow();
  });
});

describe('import', () => {
  it('creates missing categories and accounts once and links records', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    const base = { kind: 'expense' as const, currency: 'BRL', subcategoryName: '', note: '', duplicate: false };
    const drafts = [
      { ...base, row: 2, date: Date.now(), amount: 1_000, categoryName: 'Alimentação', subcategoryName: 'Mercado', accountName: 'Nubank' },
      { ...base, row: 3, date: Date.now(), amount: 2_000, categoryName: 'Pet Shop', accountName: 'nubank' },
    ];
    expect(await previewImport(book, drafts, t)).toEqual({ newCategories: 1, newAccounts: 1 });
    expect(await applyImport(book, drafts, t)).toEqual({ created: 2, missingRate: 0 });
    const txs = await db.transactions.toArray();
    const market = (await db.categories.toArray()).find((c) => c.builtinKey === 'groceries')!;
    expect(txs.find((x) => x.amount === 1_000)!.categoryId).toBe(market.id);
    expect(new Set(txs.map((x) => x.accountId)).size).toBe(1);
  });
});

