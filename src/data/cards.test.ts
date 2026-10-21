import { beforeEach, describe, expect, it } from 'vitest';
import { backlogInvoices, buildInvoices, dayInCycle } from '@/domain/card';
import { dayKey } from '@/domain/dates';
import { totals } from '@/domain/stats';
import { saveAccount } from './accounts';
import { createBook } from './books';
import { addCardBacklog, remainingInstallments } from './cards';
import { db } from './db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const rule = { closingDay: 3, dueDay: 10 };

describe('card backlog', () => {
  it('offers the closed invoice until it is due, then only the open one', () => {
    const early = backlogInvoices('2026-10-05', rule);
    expect(early.closed?.due).toBe('2026-10-10');
    expect(early.open.due).toBe('2026-11-10');
    expect(dayInCycle(early.closed!, '2026-10-05')).toBe('2026-10-02');
    expect(dayInCycle(early.open, '2026-10-05')).toBe('2026-10-05');
    expect(backlogInvoices('2026-10-20', rule).closed).toBeNull();
  });

  it('counts the installments still to come', () => {
    expect(remainingInstallments({ count: 10, current: 3 })).toBe(8);
    expect(remainingInstallments({ count: 1, current: 1 })).toBe(1);
    expect(remainingInstallments({ count: 4, current: 9 })).toBe(1);
  });

  it('records the remaining installments as expenses and the unexplained balance in the invoice only', async () => {
    const book = await createBook({ name: 'A', type: 'personal', currency: 'BRL', color: '#000' });
    const cardId = await saveAccount({ bookId: book.id, name: 'Nubank', type: 'credit', icon: 'credit-card', color: '#000', currency: 'BRL', initialBalance: 0, excludeFromTotals: false, isDefault: false, note: '', creditLimit: 500_000, ...rule });
    const card = (await db.accounts.get(cardId))!;
    const today = '2026-10-05';
    const closedDay = dayInCycle(backlogInvoices(today, rule).closed!, today);
    const result = await addCardBacklog(
      book,
      card,
      [
        { kind: 'purchase', description: 'Geladeira', categoryId: null, amount: 20_000, count: 10, current: 3, day: closedDay },
        { kind: 'balance', description: '', categoryId: null, amount: 50_000, count: 1, current: 1, day: closedDay },
      ],
      'Saldo da fatura',
      new Date(2026, 9, 5, 9).getTime(),
    );
    expect(result).toEqual({ created: 9, skipped: 0 });

    const rows = (await db.transactions.toArray()).sort((a, b) => a.date - b.date || a.kind.localeCompare(b.kind));
    const purchases = rows.filter((tx) => tx.kind === 'expense');
    expect(purchases.map((tx) => [dayKey(tx.date), tx.installment?.index, tx.note])).toEqual(
      ['2026-10-02', '2026-11-02', '2026-12-02', '2027-01-02', '2027-02-02', '2027-03-02', '2027-04-02', '2027-05-02'].map((d, i) => [d, 3 + i, 'Geladeira']),
    );
    const balance = rows.find((tx) => tx.kind === 'adjustment')!;
    expect(balance).toMatchObject({ accountAmount: -50_000, note: 'Saldo da fatura' });
    // Only the purchases count as spending.
    expect(totals(rows).expense).toBe(8 * 20_000);

    const invoices = buildInvoices({ id: card.id, initialBalance: 0, ...rule }, rows, today);
    expect(invoices[0]).toMatchObject({ key: '2026-10', charges: 70_000, status: 'closed' });
    expect(invoices[1]).toMatchObject({ key: '2026-11', charges: 20_000 });
  });
});
