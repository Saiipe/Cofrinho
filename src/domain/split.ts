import type { ID, Minor, SplitData, SplitMethod, SplitPart, TxKind } from './types';

/**
 * Group expense splitting for split books.
 *
 * Inputs per method: `amount` → minor units per member; `shares` → share counts;
 * `percent` → basis points (100% = 10000); `equal` ignores inputs.
 */

export type SplitError = 'no_participants' | 'amount_mismatch' | 'percent_mismatch' | 'no_weight' | 'invalid_total';

export type SplitResult = { ok: true; parts: SplitPart[] } | { ok: false; error: SplitError; difference?: Minor };

export const FULL_PERCENT = 10_000;

/** Distributes `total` proportionally to `weights` with the largest-remainder method; result sums exactly to `total`. */
export function allocateProportionally(total: Minor, weights: number[]): Minor[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / weightSum);
  const floors = raw.map(Math.floor);
  let leftover = total - floors.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((value, index) => ({ index, remainder: value - floors[index]! })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (leftover <= 0) break;
    floors[index]! += 1;
    leftover--;
  }
  return floors;
}

export function computeSplit(total: Minor, method: SplitMethod, inputs: { memberId: ID; input: number }[]): SplitResult {
  if (!Number.isInteger(total) || total <= 0) return { ok: false, error: 'invalid_total' };
  if (inputs.length === 0) return { ok: false, error: 'no_participants' };

  let shares: Minor[];
  switch (method) {
    case 'equal':
      shares = allocateProportionally(total, inputs.map(() => 1));
      break;
    case 'amount': {
      shares = inputs.map((p) => Math.max(0, Math.round(p.input)));
      const sum = shares.reduce((a, b) => a + b, 0);
      if (sum !== total) return { ok: false, error: 'amount_mismatch', difference: total - sum };
      break;
    }
    case 'shares': {
      const weights = inputs.map((p) => Math.max(0, p.input));
      if (weights.every((w) => w === 0)) return { ok: false, error: 'no_weight' };
      shares = allocateProportionally(total, weights);
      break;
    }
    case 'percent': {
      const weights = inputs.map((p) => Math.max(0, Math.round(p.input)));
      const sum = weights.reduce((a, b) => a + b, 0);
      if (sum !== FULL_PERCENT) return { ok: false, error: 'percent_mismatch', difference: FULL_PERCENT - sum };
      shares = allocateProportionally(total, weights);
      break;
    }
  }
  return { ok: true, parts: inputs.map((p, i) => ({ memberId: p.memberId, input: p.input, share: shares[i]! })) };
}

/** Any record; only split kinds affect member positions. */
export interface SplitRecord {
  kind: TxKind;
  amount: Minor;
  split?: SplitData;
}

/**
 * Net position of each member: positive = the group owes them (lent), negative = they owe (borrowed).
 * Expenses credit the payer and debit each participant's share; payments credit the sender and debit the receiver.
 */
export function memberBalances(records: SplitRecord[], memberIds: ID[] = []): Map<ID, Minor> {
  const balances = new Map<ID, Minor>(memberIds.map((id) => [id, 0]));
  const add = (id: ID, delta: Minor) => balances.set(id, (balances.get(id) ?? 0) + delta);
  for (const record of records) {
    const split = record.split;
    if (!split) continue;
    if (record.kind === 'split_expense') {
      add(split.payerId, record.amount);
      for (const part of split.parts) add(part.memberId, -part.share);
    } else if (split.toMemberId) {
      add(split.payerId, record.amount);
      add(split.toMemberId, -record.amount);
    }
  }
  return balances;
}

export interface Debt {
  from: ID;
  to: ID;
  amount: Minor;
}

/** Direct debts between each pair of members, netted per pair (who owes whom without simplification). */
export function pairwiseDebts(records: SplitRecord[]): Debt[] {
  const owed = new Map<string, Minor>();
  const key = (from: ID, to: ID) => `${from}\u0000${to}`;
  const add = (from: ID, to: ID, amount: Minor) => {
    if (from === to || amount === 0) return;
    owed.set(key(from, to), (owed.get(key(from, to)) ?? 0) + amount);
  };
  for (const record of records) {
    const split = record.split;
    if (!split) continue;
    if (record.kind === 'split_expense') {
      for (const part of split.parts) add(part.memberId, split.payerId, part.share);
    } else if (split.toMemberId) {
      // Paying someone reduces what you owe them (or makes them owe you).
      add(split.toMemberId, split.payerId, record.amount);
    }
  }
  const debts: Debt[] = [];
  const seen = new Set<string>();
  for (const pair of owed.keys()) {
    const [a, b] = pair.split('\u0000') as [ID, ID];
    const canonical = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const net = (owed.get(key(a, b)) ?? 0) - (owed.get(key(b, a)) ?? 0);
    if (net > 0) debts.push({ from: a, to: b, amount: net });
    else if (net < 0) debts.push({ from: b, to: a, amount: -net });
  }
  return debts.sort((x, y) => y.amount - x.amount);
}

/**
 * Settlement plan with few transfers: repeatedly matches the largest debtor with the largest creditor.
 * Produces at most n − 1 transfers and settles every balance exactly.
 */
export function smartSettlement(balances: Map<ID, Minor>): Debt[] {
  const creditors = [...balances].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors = [...balances].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const plan: Debt[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
    debtors.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const amount = Math.min(creditor.v, debtor.v);
    plan.push({ from: debtor.id, to: creditor.id, amount });
    creditor.v -= amount;
    debtor.v -= amount;
    if (creditor.v === 0) creditors.shift();
    if (debtor.v === 0) debtors.shift();
  }
  return plan;
}

/** Sum of a member's shares across group expenses ("my share"). */
export function memberShareTotal(records: SplitRecord[], memberId: ID): Minor {
  let total = 0;
  for (const record of records) {
    if (record.kind !== 'split_expense' || !record.split) continue;
    for (const part of record.split.parts) if (part.memberId === memberId) total += part.share;
  }
  return total;
}

export function isSettled(balances: Map<ID, Minor>): boolean {
  for (const value of balances.values()) if (value !== 0) return false;
  return true;
}
