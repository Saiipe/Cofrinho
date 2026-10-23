import { budgetProgress, dailyAllowance } from '@/domain/budget';
import { isLiability } from '@/domain/balances';
import { daysBetween, dayKey, parseDayKey, type Period } from '@/domain/dates';
import { goalProgress } from '@/domain/goals';
import { monthlyRate } from '@/domain/investment';
import { totals } from '@/domain/stats';
import type { Account, Category, CategoryKind, DayKey, Goal, ID, Minor, Transaction } from '@/domain/types';
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

export function widgetPayload({ transactions, period, hidden, shortcuts }: WidgetInputs, format: Formatters, t: Translate): Omit<WidgetData, 'budgetJson' | 'goalsJson' | 'upcomingJson' | 'wealthJson'> {
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

export const WIDGET_ROWS = 3;

export interface WidgetExtrasInputs {
  today: DayKey;
  period: Period;
  /** Expenses and income of `period`. */
  transactions: Transaction[];
  /** Total monthly budget of the book; 0 without one. */
  budget: Minor;
  goals: Goal[];
  /** Upcoming recurring runs (see `forecastTransactions`), oldest first. */
  forecast: Transaction[];
  accounts: Account[];
  balances: Map<ID, Minor>;
  /** Converts an amount to the book currency; null without an exchange rate. */
  toBook: (amount: Minor, currency: string) => Minor | null;
  /** CDI in % a year, for the investments' yield. */
  cdi: number;
  hidden: boolean;
}

/** Data of the budget, goals, upcoming and wealth widgets, already formatted (JSON strings). */
export function widgetExtras(input: WidgetExtrasInputs, format: Formatters, t: Translate): Pick<WidgetData, 'budgetJson' | 'goalsJson' | 'upcomingJson' | 'wealthJson'> {
  const { today, period, hidden } = input;
  const money = (value: Minor, sign?: 'always') => (hidden ? '••••' : format.money(value, undefined, sign ? { sign } : undefined));
  const percent = (ratio: number) => Math.max(0, Math.min(100, Math.round(ratio * 100)));

  const progress = budgetProgress(input.budget, totals(input.transactions).expense);
  const allowance = dailyAllowance(progress.remaining, period, today);
  const budget = {
    title: format.periodLabel(period),
    hasBudget: input.budget > 0,
    over: progress.exceeded,
    label: progress.exceeded ? t('widgets.overBudget') : t('widgets.canSpend'),
    available: money(Math.abs(progress.remaining)),
    spentLine: t('widgets.spentOf', { spent: money(progress.spent), budget: money(progress.budget) }),
    percent: percent(progress.ratio),
    perDay: !progress.exceeded && allowance.perDay > 0 ? t('widgets.perDay', { amount: money(allowance.perDay), count: allowance.daysLeft }) : '',
    empty: t('widgets.noBudget'),
  };

  const goals = {
    items: input.goals
      .filter((g) => !g.archived)
      .map((goal) => ({ goal, p: goalProgress(goal, today) }))
      // Unfinished goals first, closest to the target on top.
      .sort((a, b) => Number(a.p.reached) - Number(b.p.reached) || b.p.ratio - a.p.ratio)
      .slice(0, WIDGET_ROWS)
      .map(({ goal, p }) => ({ name: goal.name, percent: percent(p.ratio), line: t('widgets.goalOf', { saved: money(p.saved), target: money(goal.target) }) })),
    empty: t('widgets.noGoals'),
  };

  const upcoming = {
    items: input.forecast.slice(0, WIDGET_ROWS).map((tx) => {
      const day = dayKey(tx.date);
      const { day: dayOfMonth, month } = parseDayKey(day);
      const days = daysBetween(today, day);
      const when = days <= 0 ? t('widgets.today') : days === 1 ? t('widgets.tomorrow') : t('widgets.inDays', { count: days });
      const sign = tx.kind === 'income' ? 1 : -1;
      return {
        day: String(dayOfMonth),
        month: format.monthShort(month).replace('.', '').toUpperCase(),
        name: tx.note,
        when,
        amount: tx.kind === 'transfer' ? money(tx.amount) : money(sign * tx.amount, 'always'),
        income: tx.kind === 'income',
      };
    }),
    empty: t('widgets.noUpcoming'),
  };

  let net = 0;
  let yieldPerMonth = 0;
  const valued: { name: string; value: Minor }[] = [];
  for (const account of input.accounts) {
    if (account.excludeFromTotals) continue;
    const balance = input.balances.get(account.id) ?? 0;
    const value = input.toBook(balance, account.currency);
    if (value === null) continue;
    net += value;
    if (!isLiability(account.type) && value > 0) valued.push({ name: account.name, value });
    if (account.type === 'investment' && account.yieldRule && value > 0) yieldPerMonth += value * monthlyRate(account.yieldRule, input.cdi);
  }
  const wealth = {
    hasAccounts: input.accounts.length > 0,
    total: money(net),
    label: t('widgets.wealthTotal'),
    items: valued
      .sort((a, b) => b.value - a.value)
      .slice(0, WIDGET_ROWS)
      .map((row) => ({ name: row.name, value: money(row.value) })),
    yieldLine: yieldPerMonth >= 1 ? t('widgets.yieldLine', { amount: money(Math.round(yieldPerMonth)) }) : '',
    empty: t('widgets.noAccounts'),
  };

  return {
    budgetJson: JSON.stringify(budget),
    goalsJson: JSON.stringify(goals),
    upcomingJson: JSON.stringify(upcoming),
    wealthJson: JSON.stringify(wealth),
  };
}
