import type { Minor, Transaction } from '@/domain/types';
import { useFormat } from '../hooks/useFormat';
import { cx } from './primitives';

export const HIDDEN_AMOUNT = '••••••';

/** Signed amount colored by meaning: income green with "+", expenses neutral with "−". */
export function TxAmount({ tx, className }: { tx: Pick<Transaction, 'kind' | 'amount'>; className?: string }) {
  const { money } = useFormat();
  if (tx.kind === 'income') return <span className={cx('tabular font-semibold text-income', className)}>{money(tx.amount, undefined, { sign: 'always' })}</span>;
  if (tx.kind === 'expense' || tx.kind === 'split_expense') return <span className={cx('tabular font-semibold text-fg', className)}>{money(-tx.amount)}</span>;
  if (tx.kind === 'adjustment') return <span className={cx('tabular font-semibold text-muted', className)}>{money(tx.amount, undefined, { sign: 'always' })}</span>;
  return <span className={cx('tabular font-semibold text-muted', className)}>{money(tx.amount)}</span>;
}

export function Money({ value, currency, hidden, className, sign }: { value: Minor; currency?: string; hidden?: boolean; className?: string; sign?: 'auto' | 'always' | 'never' }) {
  const { money } = useFormat();
  return <span className={className}>{hidden ? HIDDEN_AMOUNT : money(value, currency, { sign })}</span>;
}
