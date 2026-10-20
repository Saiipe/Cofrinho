import { describe, expect, it } from 'vitest';
import { allocateProportionally, computeSplit, isSettled, memberBalances, memberShareTotal, pairwiseDebts, smartSettlement, type SplitRecord } from './split';

describe('computeSplit', () => {
  it('splits equally and hands leftover cents to the first members', () => {
    const result = computeSplit(1000, 'equal', [{ memberId: 'a', input: 0 }, { memberId: 'b', input: 0 }, { memberId: 'c', input: 0 }]);
    expect(result.ok && result.parts.map((p) => p.share)).toEqual([334, 333, 333]);
  });

  it('requires exact amounts to add up', () => {
    const bad = computeSplit(1000, 'amount', [{ memberId: 'a', input: 600 }, { memberId: 'b', input: 300 }]);
    expect(bad).toEqual({ ok: false, error: 'amount_mismatch', difference: 100 });
    const good = computeSplit(1000, 'amount', [{ memberId: 'a', input: 700 }, { memberId: 'b', input: 300 }]);
    expect(good.ok).toBe(true);
  });

  it('splits by shares and by percentage', () => {
    const shares = computeSplit(900, 'shares', [{ memberId: 'a', input: 2 }, { memberId: 'b', input: 1 }]);
    expect(shares.ok && shares.parts.map((p) => p.share)).toEqual([600, 300]);
    const percent = computeSplit(1000, 'percent', [{ memberId: 'a', input: 3333 }, { memberId: 'b', input: 3333 }, { memberId: 'c', input: 3334 }]);
    expect(percent.ok && percent.parts.map((p) => p.share)).toEqual([333, 333, 334]);
    expect(computeSplit(1000, 'percent', [{ memberId: 'a', input: 5000 }])).toMatchObject({ ok: false, error: 'percent_mismatch' });
  });

  it('allocates proportionally summing exactly to the total', () => {
    const parts = allocateProportionally(10_001, [1, 1, 1, 1, 1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10_001);
  });
});

describe('balances and settlement', () => {
  // Dinner 600 paid by Ana, split by 3; taxi 90 paid by Bia, split Ana/Bia.
  const records: SplitRecord[] = [
    {
      kind: 'split_expense',
      amount: 600,
      split: { method: 'equal', payerId: 'ana', parts: ['ana', 'bia', 'caio'].map((m) => ({ memberId: m, input: 0, share: 200 })) },
    },
    {
      kind: 'split_expense',
      amount: 90,
      split: { method: 'equal', payerId: 'bia', parts: ['ana', 'bia'].map((m) => ({ memberId: m, input: 0, share: 45 })) },
    },
  ];

  it('computes net positions', () => {
    const balances = memberBalances(records, ['ana', 'bia', 'caio']);
    expect(Object.fromEntries(balances)).toEqual({ ana: 355, bia: -155, caio: -200 });
    expect(memberShareTotal(records, 'ana')).toBe(245);
  });

  it('nets debts per pair', () => {
    expect(pairwiseDebts(records)).toEqual([
      { from: 'caio', to: 'ana', amount: 200 },
      { from: 'bia', to: 'ana', amount: 155 },
    ]);
  });

  it('settles with at most n−1 transfers and payments reduce debts', () => {
    const plan = smartSettlement(memberBalances(records));
    expect(plan).toEqual([
      { from: 'caio', to: 'ana', amount: 200 },
      { from: 'bia', to: 'ana', amount: 155 },
    ]);
    const afterPayments: SplitRecord[] = [
      ...records,
      ...plan.map((d) => ({ kind: 'split_payment' as const, amount: d.amount, split: { method: 'equal' as const, payerId: d.from, toMemberId: d.to, parts: [] } })),
    ];
    expect(isSettled(memberBalances(afterPayments))).toBe(true);
    expect(pairwiseDebts(afterPayments)).toEqual([]);
  });

  it('simplifies chains of debts', () => {
    const chain = new Map([
      ['a', -100],
      ['b', 0],
      ['c', 100],
    ]);
    expect(smartSettlement(chain)).toEqual([{ from: 'a', to: 'c', amount: 100 }]);
  });
});
