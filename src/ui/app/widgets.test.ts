import { describe, expect, it } from 'vitest';
import { monthPeriodOf } from '@/domain/dates';
import type { Account, Category, Transaction } from '@/domain/types';
import { createTranslator } from '@/i18n';
import type { Formatters } from '../hooks/useFormat';
import { widgetCategories, widgetExtras } from './widgets';

function category(id: string, parentId: string | null = null, kind: Category['kind'] = 'expense'): Category {
  return { id, bookId: 'b', kind, parentId, name: id, icon: 'tag', color: '#000', order: 0, createdAt: 0, updatedAt: 0 };
}

const food = category('food');
const groceries = category('groceries', 'food');
const transport = category('transport');
const leisure = category('leisure');
const health = category('health');
const salary = category('salary', null, 'income');
const map = new Map([food, groceries, transport, leisure, health, salary].map((c) => [c.id, c]));
const tops = [food, transport, leisure, health];

describe('widget category shortcuts', () => {
  it('puts the most used categories first, counting subcategories in their parent', () => {
    const txs = [
      { kind: 'expense' as const, categoryId: 'transport' },
      { kind: 'expense' as const, categoryId: 'groceries' },
      { kind: 'expense' as const, categoryId: 'groceries' },
      { kind: 'income' as const, categoryId: 'salary' },
    ];
    expect(widgetCategories(txs, map, tops).map((c) => c.id)).toEqual(['food', 'transport', 'leisure']);
  });

  it('fills empty slots with the book order and ranks income separately', () => {
    expect(widgetCategories([], map, tops).map((c) => c.id)).toEqual(['food', 'transport', 'leisure']);
    expect(widgetCategories([{ kind: 'income', categoryId: 'salary' }], map, [salary], 3, 'income').map((c) => c.id)).toEqual(['salary']);
  });
});

describe('widget extras', () => {
  const format = {
    money: (v: number, _c?: string, o?: { sign?: string }) => `${o?.sign === 'always' && v > 0 ? '+' : ''}${(v / 100).toFixed(2)}`,
    periodLabel: () => 'Outubro',
    monthShort: (m: number) => ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'][m]!,
  } as unknown as Formatters;
  const t = createTranslator('pt-BR');
  const period = monthPeriodOf('2026-10-22');
  const tx = (partial: Partial<Transaction>): Transaction =>
    ({ id: 'x', bookId: 'b', kind: 'expense', date: new Date(2026, 9, 5, 12).getTime(), amount: 0, currency: 'BRL', originalAmount: 0, categoryId: null, accountId: null, accountAmount: 0, toAccountId: null, toAccountAmount: 0, note: '', photoIds: [], createdAt: 0, updatedAt: 0, ...partial }) as Transaction;
  const account = (partial: Partial<Account>): Account =>
    ({ id: 'a', bookId: 'b', name: 'A', type: 'debit', icon: 'bank', color: '#000', currency: 'BRL', initialBalance: 0, excludeFromTotals: false, isDefault: false, note: '', order: 0, createdAt: 0, updatedAt: 0, ...partial }) as Account;
  const base = { today: '2026-10-22', period, transactions: [], budget: 0, goals: [], forecast: [], accounts: [], balances: new Map(), toBook: (v: number) => v, cdi: 13.65, hidden: false };
  const parse = (json: string) => JSON.parse(json);

  it('shows what is left of the budget and per day', () => {
    const out = widgetExtras({ ...base, budget: 200_000, transactions: [tx({ amount: 50_000 })] }, format, t);
    // 22 → 31 October: 10 days left, today included.
    expect(parse(out.budgetJson)).toMatchObject({ hasBudget: true, over: false, available: '1500.00', percent: 25, perDay: '150.00 por dia · 10 dias restantes' });
    expect(parse(widgetExtras({ ...base, budget: 10_000, transactions: [tx({ amount: 15_000 })] }, format, t).budgetJson)).toMatchObject({ over: true, label: 'Passou do orçamento em', available: '50.00', percent: 100, perDay: '' });
  });

  it('lists upcoming runs with day, month and distance', () => {
    const forecast = [tx({ date: new Date(2026, 9, 23, 9).getTime(), amount: 150_000, note: 'Aluguel' }), tx({ kind: 'income', date: new Date(2026, 10, 5, 9).getTime(), amount: 500_000, note: 'Salário' })];
    expect(parse(widgetExtras({ ...base, forecast }, format, t).upcomingJson).items).toEqual([
      { day: '23', month: 'OUT', name: 'Aluguel', when: 'amanhã', amount: '-1500.00', income: false },
      { day: '5', month: 'NOV', name: 'Salário', when: 'em 14 dias', amount: '+5000.00', income: true },
    ]);
  });

  it('sums wealth, leaves debts out of the top list and estimates the yield', () => {
    const accounts = [
      account({ id: 'c', name: 'Conta', type: 'debit' }),
      account({ id: 'i', name: 'Caixinha', type: 'investment', yieldRule: { kind: 'cdi', rate: 115, taxed: true } }),
      account({ id: 'k', name: 'Cartão', type: 'credit' }),
    ];
    const balances = new Map([['c', 100_000], ['i', 500_000], ['k', -30_000]]);
    const wealth = parse(widgetExtras({ ...base, accounts, balances }, format, t).wealthJson);
    expect(wealth).toMatchObject({ total: '5700.00', yieldLine: 'Investimentos rendem ≈ 61.69 por mês' });
    expect(wealth.items).toEqual([{ name: 'Caixinha', value: '5000.00' }, { name: 'Conta', value: '1000.00' }]);
  });

  it('hides every amount when values are hidden', () => {
    const out = widgetExtras({ ...base, hidden: true, budget: 200_000, goals: [{ id: 'g', bookId: 'b', name: 'Viagem', icon: 'plane', color: '#000', target: 100_000, targetDate: null, entries: [{ id: 'e', date: 0, amount: 25_000, note: '' }], archived: false, order: 0, createdAt: 0, updatedAt: 0 }] }, format, t);
    expect(out.budgetJson).not.toMatch(/\d+\.\d{2}/);
    expect(parse(out.goalsJson).items).toEqual([{ name: 'Viagem', percent: 25, line: '•••• de ••••' }]);
  });
});
