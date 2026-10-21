import type { Period } from '@/domain/dates';
import { totals } from '@/domain/stats';
import type { Category, CategoryKind, ID, Transaction } from '@/domain/types';
import type { Translate } from '@/i18n';
import type { WidgetData } from '@/services/native';
import type { Formatters } from '../hooks/useFormat';

export const WIDGET_CATEGORY_SLOTS = 3;

/**
 * Top-level categories of one kind, most used first, completed with the book's other categories
 * (`topOfKind`, in display order) so the slots are never empty.
 */
export function widgetCategories(
  transactions: Pick<Transaction, 'kind' | 'categoryId'>[],
  categories: Map<ID, Category>,
  topOfKind: Category[],
  slots = WIDGET_CATEGORY_SLOTS,
  kind: CategoryKind = 'expense',
): Category[] {
  const uses = new Map<ID, number>();
  for (const tx of transactions) {
    if (tx.kind !== kind || !tx.categoryId) continue;
    const category = categories.get(tx.categoryId);
    if (!category) continue;
    const top = category.parentId ?? category.id;
    uses.set(top, (uses.get(top) ?? 0) + 1);
  }
  const used = [...uses]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => categories.get(id))
    .filter((c): c is Category => Boolean(c));
  const rest = topOfKind.filter((c) => !uses.has(c.id));
  return [...used, ...rest].slice(0, slots);
}

export interface WidgetInputs {
  transactions: Transaction[];
  period: Period;
  /** Amounts on the home screen are visible to anyone holding the phone. */
  hidden: boolean;
  shortcuts: { id: ID; name: string }[];
}

export function widgetPayload({ transactions, period, hidden, shortcuts }: WidgetInputs, format: Formatters, t: Translate): WidgetData {
  const sums = totals(transactions);
  const money = (value: number, sign?: 'always') => (hidden ? '••••' : format.money(value, undefined, sign ? { sign } : undefined));
  return {
    month: format.periodLabel(period),
    spentLabel: t('widgets.spent'),
    spent: money(sums.expense),
    incomeLabel: t('widgets.received'),
    income: money(sums.income),
    balanceLabel: t('widgets.balance'),
    balance: money(sums.balance, 'always'),
    expenseButton: t('kind.expense'),
    incomeButton: t('kind.income'),
    categoriesJson: JSON.stringify(shortcuts),
  };
}
