import { describe, expect, it } from 'vitest';
import { displayExpression, evaluate, expressionFromDecimal, pressKey, type CalcKey } from './calculator';
import { parseQuickEntry, type QuickEntryCategory } from './quickEntry';

function type(keys: CalcKey[], decimals = 2): string {
  return keys.reduce((expr, key) => pressKey(expr, key, decimals), '');
}

describe('calculator keypad', () => {
  it('builds numbers with a decimal limit', () => {
    expect(type(['1', '2', '.', '3', '4', '5'])).toBe('12.34');
    expect(type(['.', '5'])).toBe('0.5');
    expect(type(['0', '0', '7'])).toBe('7');
    expect(type(['1', '.', '.', '2'])).toBe('1.2');
    expect(type(['5', '.'], 0)).toBe('5');
  });

  it('replaces repeated operators and ignores a leading one', () => {
    expect(type(['+', '5', '+', '-', '2'])).toBe('5-2');
    expect(type(['5', '.', '*', '2'])).toBe('5*2');
  });

  it('evaluates with operator precedence', () => {
    expect(evaluate('2+3*4')).toBe(14);
    expect(evaluate('10-4/2')).toBe(8);
    expect(evaluate('12.5+')).toBe(12.5);
    expect(evaluate('5/0')).toBeNull();
    expect(evaluate('')).toBeNull();
  });

  it('round-trips existing amounts and renders symbols', () => {
    expect(expressionFromDecimal('12.50')).toBe('12.5');
    expect(expressionFromDecimal('7.00')).toBe('7');
    expect(displayExpression('12.5*2-1', ',')).toBe('12,5 × 2 − 1');
  });
});

describe('quick entry', () => {
  const categories: QuickEntryCategory[] = [
    { id: 'food', kind: 'expense', parentId: null, name: 'Alimentação', builtinKey: 'food' },
    { id: 'restaurant', kind: 'expense', parentId: 'food', name: 'Restaurantes', builtinKey: 'restaurant' },
    { id: 'ride', kind: 'expense', parentId: 'transport', name: 'Táxi e apps', builtinKey: 'ride' },
    { id: 'gym', kind: 'expense', parentId: null, name: 'Crossfit do Zé' },
    { id: 'salary', kind: 'income', parentId: null, name: 'Salário', builtinKey: 'salary' },
  ];
  const accounts = [
    { id: 'nu', name: 'Nubank' },
    { id: 'wallet', name: 'Carteira' },
  ];
  const context = { categories, accounts, today: '2026-10-20' };

  it('understands a typical Portuguese sentence', () => {
    expect(parseQuickEntry('almoço 32,50 ontem nubank', context)).toEqual({
      kind: 'expense',
      amount: 32.5,
      date: '2026-10-19',
      categoryId: 'restaurant',
      accountId: 'nu',
      note: 'Almoço',
    });
  });

  it('detects income, thousands and day-of-month', () => {
    expect(parseQuickEntry('recebi salário 5.000 dia 5', context)).toMatchObject({ kind: 'income', amount: 5000, categoryId: 'salary', date: '2026-10-05', note: 'Salário' });
    expect(parseQuickEntry('salário 2 mil', context)).toMatchObject({ kind: 'income', amount: 2000 });
  });

  it('matches custom category names, weekdays and slashed dates', () => {
    expect(parseQuickEntry('Crossfit do Zé R$ 120 na segunda', context)).toMatchObject({ categoryId: 'gym', amount: 120, date: '2026-10-19' });
    expect(parseQuickEntry('uber 18.90 15/10', context)).toMatchObject({ categoryId: 'ride', amount: 18.9, date: '2026-10-15', note: 'Uber' });
    expect(parseQuickEntry('presente 50 25/12', context).date).toBe('2025-12-25');
  });

  it('leaves unknown parts in the note', () => {
    expect(parseQuickEntry('coisa aleatória', context)).toMatchObject({ amount: null, categoryId: null, kind: 'expense', note: 'Coisa aleatória' });
  });
});
