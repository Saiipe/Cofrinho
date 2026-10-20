import { convertMinor } from './money';
import type { Minor, TxKind } from './types';

export type RateLookup = (from: string, to: string) => number | null;

export interface AmountInput {
  kind: TxKind;
  /** Currency the user typed in. */
  currency: string;
  originalAmount: Minor;
  bookCurrency: string;
  /** Currency of `accountId` (source account for transfers), when an account is set. */
  accountCurrency: string | null;
  /** Transfers: destination account currency. */
  toAccountCurrency?: string | null;
  /** Transfers: amount credited at the destination, when the user typed it explicitly. */
  toAmountOverride?: Minor | null;
}

export interface ResolvedAmounts {
  amount: Minor;
  accountAmount: Minor;
  toAccountAmount: Minor;
}

export type AmountResolution = { ok: true; value: ResolvedAmounts } | { ok: false; missing: { from: string; to: string } };

/**
 * Derives the three stored amounts of a transaction: book currency (statistics),
 * account currency (balances) and, for transfers, the destination currency.
 */
export function resolveAmounts(input: AmountInput, rate: RateLookup): AmountResolution {
  const convert = (to: string): Minor | { from: string; to: string } => {
    if (to === input.currency) return input.originalAmount;
    const r = rate(input.currency, to);
    return r === null ? { from: input.currency, to } : convertMinor(input.originalAmount, input.currency, to, r);
  };

  const amount = convert(input.bookCurrency);
  if (typeof amount !== 'number') return { ok: false, missing: amount };

  let accountAmount: Minor = 0;
  if (input.accountCurrency) {
    const value = convert(input.accountCurrency);
    if (typeof value !== 'number') return { ok: false, missing: value };
    accountAmount = value;
  }

  let toAccountAmount: Minor = 0;
  if (input.kind === 'transfer' && input.toAccountCurrency) {
    if (input.toAmountOverride !== undefined && input.toAmountOverride !== null) {
      toAccountAmount = input.toAmountOverride;
    } else {
      const value = convert(input.toAccountCurrency);
      if (typeof value !== 'number') return { ok: false, missing: value };
      toAccountAmount = value;
    }
  }
  return { ok: true, value: { amount, accountAmount, toAccountAmount } };
}
