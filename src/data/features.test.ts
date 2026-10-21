import { beforeEach, describe, expect, it } from 'vitest';
import { dayKey } from '@/domain/dates';
import { createBackup, parseBackup, restoreBackup } from './backup';
import { bankById, searchBanks } from './banks';
import { createBook, deleteBook } from './books';
import { db } from './db';
import { addGoalEntry, saveGoal } from './goals';
import { runDueSchedules, saveSchedule } from './schedules';
import { createTag, deleteTag } from './tags';
import { deleteInstallmentGroup, saveInstallments, saveRecurringTransaction, saveTransaction, type TransactionInput } from './transactions';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function expense(bookId: string, partial: Partial<TransactionInput> = {}): TransactionInput {
  return {
    bookId,
    kind: 'expense',
    date: new Date(2026, 8, 20, 12).getTime(),
    amount: 10_000,
    currency: 'BRL',
    originalAmount: 10_000,
    categoryId: null,
    accountId: 'card',
    accountAmount: 10_000,
    toAccountId: null,
    toAccountAmount: 0,
    note: 'Netflix',
    photoIds: [],
    ...partial,
  };
}

const personalBook = () => createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });

describe('repeat from the record form', () => {
  it('saves the record as the first run and lets the plan continue on its dates', async () => {
    const book = await personalBook();
    const tx = await saveRecurringTransaction(expense(book.id), { frequency: 'monthly', totalCount: 3 }, 'Netflix');
    const schedule = (await db.schedules.toArray())[0]!;
    expect(schedule).toMatchObject({ name: 'Netflix', runCount: 1, lastRunDate: '2026-09-20', startDate: '2026-09-20', status: 'active', amount: 10_000 });
    expect((await db.transactions.get(tx.id))?.scheduleId).toBe(schedule.id);

    const runs = await runDueSchedules(new Date(2026, 11, 1, 9).getTime());
    expect(runs[0]!.created.map((t) => dayKey(t.date))).toEqual(['2026-10-20', '2026-11-20']);
    expect(await db.schedules.get(schedule.id)).toMatchObject({ runCount: 3, status: 'completed' });
  });

  it('records a new plan from its start date when asked to', async () => {
    const book = await personalBook();
    await saveSchedule(
      { bookId: book.id, name: 'Aluguel', kind: 'expense', categoryId: null, accountId: null, toAccountId: null, frequency: 'monthly', startDate: '2026-09-05', amount: 100, currency: 'BRL', toAmount: null, totalCount: 0, note: '', paused: false, backfill: true },
      '2026-10-20',
    );
    const runs = await runDueSchedules(new Date(2026, 9, 20, 9).getTime());
    expect(runs[0]!.created.map((t) => dayKey(t.date))).toEqual(['2026-09-05', '2026-10-05']);
  });
});

describe('installments', () => {
  it('splits a purchase month by month and deletes the remaining installments', async () => {
    const book = await personalBook();
    const first = await saveInstallments(expense(book.id, { photoIds: [] }), 3);
    const rows = (await db.transactions.toArray()).sort((a, b) => a.date - b.date);
    expect(rows.map((r) => [dayKey(r.date), r.amount, r.accountAmount, r.installment?.index])).toEqual([
      ['2026-09-20', 3_334, 3_334, 1],
      ['2026-10-20', 3_333, 3_333, 2],
      ['2026-11-20', 3_333, 3_333, 3],
    ]);
    expect(new Set(rows.map((r) => r.installment?.groupId)).size).toBe(1);
    expect(await deleteInstallmentGroup(book.id, first.installment!.groupId, 2)).toBe(2);
    expect(await db.transactions.count()).toBe(1);
  });
});

describe('tags', () => {
  it('reuses names case-insensitively and detaches deleted tags from records', async () => {
    const book = await personalBook();
    const trip = await createTag(book.id, '#Viagem');
    expect(trip.name).toBe('Viagem');
    expect((await createTag(book.id, 'viagem')).id).toBe(trip.id);
    const work = await createTag(book.id, 'Trabalho');
    const tx = await saveTransaction(expense(book.id, { tagIds: [trip.id, work.id, trip.id] }));
    expect(tx.tagIds).toEqual([trip.id, work.id]);
    expect(await db.transactions.where('tagIds').equals(trip.id).count()).toBe(1);
    await deleteTag(trip.id);
    expect((await db.transactions.get(tx.id))?.tagIds).toEqual([work.id]);
  });

  it('is removed with its book', async () => {
    const book = await personalBook();
    await createTag(book.id, 'x');
    await saveGoal({ bookId: book.id, name: 'Meta', icon: 'goal', color: '#000', target: 100, targetDate: null });
    await deleteBook(book.id);
    expect(await db.tags.count()).toBe(0);
    expect(await db.goals.count()).toBe(0);
  });
});

describe('goals and backup', () => {
  it('keeps goals, entries, tags and details in a backup', async () => {
    const book = await personalBook();
    const goalId = await saveGoal({ bookId: book.id, name: 'Viagem', icon: 'plane', color: '#000', target: 500_000, targetDate: '2027-07-01' }, 10_000);
    await addGoalEntry(goalId, 5_000);
    await addGoalEntry(goalId, -2_000);
    const tag = await createTag(book.id, 'Casa');
    await saveTransaction(expense(book.id, { tagIds: [tag.id], details: '  pedido 123  ' }));
    const json = JSON.stringify(await createBackup({ includePhotos: false }));
    await db.delete();
    await db.open();
    await restoreBackup(parseBackup(json));
    expect((await db.goals.get(goalId))?.entries.map((e) => e.amount)).toEqual([10_000, 5_000, -2_000]);
    expect((await db.transactions.toArray())[0]).toMatchObject({ tagIds: [tag.id], details: 'pedido 123' });
  });

  it('restores backups made before tags and goals existed', async () => {
    const book = await personalBook();
    const backup = await createBackup({ includePhotos: false });
    const legacy = { ...backup, version: 1, tables: { ...backup.tables } as Record<string, unknown[]> };
    delete legacy.tables.tags;
    delete legacy.tables.goals;
    await restoreBackup(parseBackup(JSON.stringify(legacy)));
    expect(await db.books.get(book.id)).toBeDefined();
    expect(await db.goals.count()).toBe(0);
  });
});

describe('banks', () => {
  it('finds banks by name, brand and COMPE code', () => {
    expect(bankById('260')?.name).toBe('Nubank');
    expect(searchBanks('nubank')[0]?.id).toBe('260');
    expect(searchBanks('ourocard')[0]?.id).toBe('001');
    expect(searchBanks('itau')[0]?.id).toBe('341');
    expect(searchBanks('341')[0]?.id).toBe('341');
  });
});
