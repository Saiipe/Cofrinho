import { describe, expect, it } from 'vitest';
import { accountBalances, balanceSheet } from './balances';
import { budgetProgress, dailyAllowance, isValidTotalBudget, reconcileTotalBudget } from './budget';
import { monthPeriod } from './dates';
import { categoryBreakdown, groupByDay, monthlySummaries, recordingStats, totals } from './stats';
import type { Transaction } from './types';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    bookId: 'b',
    kind: 'expense',
    date: new Date(2026, 9, 20, 12).getTime(),
    amount: 0,
    currency: 'BRL',
    originalAmount: 0,
    categoryId: null,
    accountId: null,
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

describe('account balances', () => {
  const accounts = [
    { id: 'wallet', type: 'cash' as const, currency: 'BRL', initialBalance: 10_000, excludeFromTotals: false },
    { id: 'card', type: 'credit' as const, currency: 'BRL', initialBalance: -50_000, excludeFromTotals: false },
    { id: 'usd', type: 'debit' as const, currency: 'USD', initialBalance: 1_000, excludeFromTotals: false },
    { id: 'hidden', type: 'investment' as const, currency: 'BRL', initialBalance: 999_999, excludeFromTotals: true },
  ];
  const transactions = [
    tx({ kind: 'expense', accountId: 'wallet', accountAmount: 2_500 }),
    tx({ kind: 'income', accountId: 'wallet', accountAmount: 1_000 }),
    tx({ kind: 'transfer', accountId: 'wallet', accountAmount: 5_000, toAccountId: 'card', toAccountAmount: 5_000 }),
    tx({ kind: 'adjustment', accountId: 'usd', accountAmount: -200 }),
    tx({ kind: 'expense', accountId: null, accountAmount: 7_000 }),
  ];

  it('applies every kind to the right account', () => {
    const balances = accountBalances(accounts, transactions);
    expect(Object.fromEntries(balances)).toEqual({ wallet: 3_500, card: -45_000, usd: 800, hidden: 999_999 });
  });

  it('sums assets and liabilities in the book currency, skipping excluded accounts', () => {
    const balances = accountBalances(accounts, transactions);
    const sheet = balanceSheet(accounts, balances, (amount, currency) => (currency === 'USD' ? amount * 5 : amount));
    expect(sheet).toEqual({ assets: 3_500 + 4_000, liabilities: -45_000, net: 7_500 - 45_000 });
  });
});

describe('budgets', () => {
  it('tracks progress and overspending', () => {
    expect(budgetProgress(100_000, 120_000)).toMatchObject({ remaining: -20_000, exceeded: true, ratio: 1.2 });
    expect(budgetProgress(0, 5_000)).toMatchObject({ exceeded: false, ratio: 0 });
  });

  it('raises the total when category budgets exceed it', () => {
    expect(reconcileTotalBudget(50_000, [30_000, 40_000])).toEqual({ total: 70_000, autoUpdated: true });
    expect(reconcileTotalBudget(null, [10_000])).toEqual({ total: 10_000, autoUpdated: true });
    expect(reconcileTotalBudget(100_000, [30_000])).toEqual({ total: 100_000, autoUpdated: false });
    expect(isValidTotalBudget(60_000, [30_000, 40_000])).toBe(false);
  });

  it('spreads the remaining budget over the days left', () => {
    const october = monthPeriod(2026, 9);
    expect(dailyAllowance(120_000, october, '2026-10-20')).toEqual({ daysLeft: 12, perDay: 10_000 });
    expect(dailyAllowance(-1, october, '2026-10-20').perDay).toBe(0);
  });
});

describe('stats', () => {
  const day = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
  const categories = new Map([
    ['food', { id: 'food', parentId: null }],
    ['restaurant', { id: 'restaurant', parentId: 'food' }],
    ['market', { id: 'market', parentId: 'food' }],
    ['bus', { id: 'bus', parentId: null }],
  ]);
  const transactions = [
    tx({ kind: 'expense', amount: 3_000, categoryId: 'restaurant', date: day(1) }),
    tx({ kind: 'expense', amount: 5_000, categoryId: 'market', date: day(2) }),
    tx({ kind: 'expense', amount: 2_000, categoryId: 'food', date: day(2, 18) }),
    tx({ kind: 'expense', amount: 10_000, categoryId: 'bus', date: day(3) }),
    tx({ kind: 'income', amount: 50_000, categoryId: null, date: day(5) }),
    tx({ kind: 'transfer', amount: 9_999, date: day(5) }),
  ];

  it('totals only income and expenses', () => {
    expect(totals(transactions)).toEqual({ income: 50_000, expense: 20_000, balance: 30_000, count: 5 });
  });

  it('groups by day, newest first', () => {
    const groups = groupByDay(transactions);
    expect(groups.map((g) => g.day)).toEqual(['2026-10-05', '2026-10-03', '2026-10-02', '2026-10-01']);
    expect(groups[2]).toMatchObject({ expense: 7_000 });
    expect(groups[2]!.items[0]!.amount).toBe(2_000);
  });

  it('folds subcategories into parents and drills down', () => {
    const top = categoryBreakdown(transactions, 'expense', categories);
    expect(top.map((s) => [s.categoryId, s.amount, s.ratio])).toEqual([
      ['food', 10_000, 0.5],
      ['bus', 10_000, 0.5],
    ]);
    const food = categoryBreakdown(transactions, 'expense', categories, { level: 'children', parentId: 'food' });
    expect(food.map((s) => [s.categoryId, s.amount])).toEqual([
      ['market', 5_000],
      ['restaurant', 3_000],
      ['food', 2_000],
    ]);
  });

  it('summarizes months with a custom start day', () => {
    const months = monthlySummaries(transactions, 2026, 3);
    expect(months[8]).toMatchObject({ expense: 10_000 }); // Sep 3 – Oct 2 includes Oct 1–2
    expect(months[9]).toMatchObject({ expense: 10_000, income: 50_000 });
  });

  it('measures recording streaks', () => {
    const at = (d: number) => new Date(2026, 9, d, 9).getTime();
    expect(recordingStats([at(18), at(19), at(19), at(15)], '2026-10-20')).toEqual({ activeDays: 3, streak: 2, totalRecords: 4 });
    expect(recordingStats([at(20)], '2026-10-20').streak).toBe(1);
    expect(recordingStats([at(10)], '2026-10-20').streak).toBe(0);
  });
});
