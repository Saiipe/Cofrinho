import type { Account, AccountType, ID, Minor, Transaction } from './types';

export const ACCOUNT_TYPES: AccountType[] = ['cash', 'debit', 'credit', 'virtual', 'investment', 'receivable', 'payable'];

/** Credit cards and "I owe" accounts count as liabilities; everything else is an asset. */
export function isLiability(type: AccountType): boolean {
  return type === 'credit' || type === 'payable';
}

type BalanceTx = Pick<Transaction, 'kind' | 'accountId' | 'accountAmount' | 'toAccountId' | 'toAccountAmount'>;

/** Current balance of every account, in each account's own currency. */
export function accountBalances(accounts: Pick<Account, 'id' | 'initialBalance'>[], transactions: BalanceTx[]): Map<ID, Minor> {
  const balances = new Map<ID, Minor>(accounts.map((a) => [a.id, a.initialBalance]));
  const add = (id: ID | null, delta: Minor) => {
    if (id !== null && balances.has(id)) balances.set(id, balances.get(id)! + delta);
  };
  for (const tx of transactions) {
    switch (tx.kind) {
      case 'expense':
        add(tx.accountId, -tx.accountAmount);
        break;
      case 'income':
      case 'adjustment':
        add(tx.accountId, tx.accountAmount);
        break;
      case 'transfer':
        add(tx.accountId, -tx.accountAmount);
        add(tx.toAccountId, tx.toAccountAmount);
        break;
      default:
        break;
    }
  }
  return balances;
}

export interface BalanceSheet {
  assets: Minor;
  /** Sum of liability balances (normally negative). */
  liabilities: Minor;
  net: Minor;
}

/**
 * Totals in the book currency. Accounts flagged `excludeFromTotals` keep their own balance
 * but are left out of these sums.
 */
export function balanceSheet(
  accounts: Pick<Account, 'id' | 'type' | 'currency' | 'excludeFromTotals'>[],
  balances: Map<ID, Minor>,
  toBookCurrency: (amount: Minor, currency: string) => Minor,
): BalanceSheet {
  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    if (account.excludeFromTotals) continue;
    const value = toBookCurrency(balances.get(account.id) ?? 0, account.currency);
    if (isLiability(account.type)) liabilities += value;
    else assets += value;
  }
  return { assets, liabilities, net: assets + liabilities };
}
