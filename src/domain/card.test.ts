import { describe, expect, it } from 'vitest';
import { buildInvoices, cycleOf, installmentDates, shiftCycle, splitInstallments } from './card';
import { dayKey } from './dates';
import { goalProgress } from './goals';
import type { Transaction } from './types';

const rule = { closingDay: 3, dueDay: 10 };

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'kind' | 'date'>): Transaction {
  return {
    bookId: 'b',
    amount: 0,
    currency: 'BRL',
    originalAmount: 0,
    categoryId: null,
    accountId: 'card',
    accountAmount: 0,
    toAccountId: null,
    toAccountAmount: 0,
    note: '',
    photoIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();

describe('credit card cycles', () => {
  it('sends purchases on or after the closing day to the next invoice', () => {
    expect(cycleOf('2026-10-02', rule)).toMatchObject({ key: '2026-10', start: '2026-09-03', close: '2026-10-03', due: '2026-10-10' });
    expect(cycleOf('2026-10-03', rule).key).toBe('2026-11');
    expect(cycleOf('2026-10-31', rule).key).toBe('2026-11');
  });

  it('puts the due date in the next month when it comes before the closing day', () => {
    const late = { closingDay: 28, dueDay: 5 };
    expect(cycleOf('2026-10-27', late)).toMatchObject({ close: '2026-10-28', due: '2026-11-05', key: '2026-11' });
    expect(cycleOf('2026-10-28', late)).toMatchObject({ close: '2026-11-28', due: '2026-12-05' });
  });

  it('clamps closing days to short months and walks between invoices', () => {
    const end = { closingDay: 31, dueDay: 8 };
    expect(cycleOf('2026-02-15', end)).toMatchObject({ start: '2026-01-31', close: '2026-02-28' });
    expect(shiftCycle(cycleOf('2026-02-15', end), 1, end)).toMatchObject({ start: '2026-02-28', close: '2026-03-31' });
  });

  it('builds invoices and pays the oldest debt first', () => {
    const card = { id: 'card', initialBalance: -5000, ...rule };
    const invoices = buildInvoices(
      card,
      [
        tx({ id: 'a', kind: 'expense', date: at(2026, 8, 20), accountAmount: 10000 }),
        tx({ id: 'b', kind: 'expense', date: at(2026, 9, 5), accountAmount: 3000 }),
        tx({ id: 'r', kind: 'income', date: at(2026, 9, 6), accountAmount: 1000 }),
        tx({ id: 'p', kind: 'transfer', date: at(2026, 9, 8), accountId: 'bank', toAccountId: 'card', toAccountAmount: 12000 }),
      ],
      '2026-10-20',
    );
    expect(invoices.map((i) => [i.key, i.charges, i.paid, i.status])).toEqual([
      ['2026-10', 10000, 7000, 'overdue'],
      ['2026-11', 2000, 0, 'open'],
    ]);
  });
});

describe('installments', () => {
  it('splits a total with the remainder on the first installment', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitInstallments(-100, 3)).toEqual([-34, -33, -33]);
    expect(splitInstallments(500, 1)).toEqual([500]);
  });

  it('dates installments a month apart, clamped to short months', () => {
    expect(installmentDates(new Date(2026, 0, 31, 15, 30).getTime(), 3).map((d) => dayKey(d))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(new Date(installmentDates(new Date(2026, 0, 31, 15, 30).getTime(), 2)[1]!).getHours()).toBe(15);
  });
});

describe('goals', () => {
  const entry = (date: number, amount: number) => ({ id: String(date), date, amount, note: '' });

  it('suggests a monthly saving to reach the target date', () => {
    const progress = goalProgress({ target: 120000, targetDate: '2027-04-20', entries: [entry(at(2026, 9, 1), 20000)] }, '2026-10-20');
    expect(progress.saved).toBe(20000);
    expect(progress.remaining).toBe(100000);
    expect(progress.perMonth).toBe(16667);
    expect(progress.reached).toBe(false);
    expect(progress.projected).not.toBeNull();
  });

  it('never counts below zero and flags late or reached goals', () => {
    expect(goalProgress({ target: 1000, targetDate: null, entries: [entry(1, 500), entry(2, -900)] }, '2026-10-20').saved).toBe(0);
    expect(goalProgress({ target: 1000, targetDate: '2026-10-01', entries: [entry(at(2026, 8, 1), 100)] }, '2026-10-20').late).toBe(true);
    expect(goalProgress({ target: 1000, targetDate: null, entries: [entry(1, 1200)] }, '2026-10-20')).toMatchObject({ reached: true, remaining: 0, perMonth: null });
  });
});
