import { daysLeftInPeriod, type Period } from './dates';
import type { DayKey, Minor } from './types';

export interface BudgetProgress {
  budget: Minor;
  spent: Minor;
  /** Negative when over budget. */
  remaining: Minor;
  /** spent / budget, 0 when no budget. */
  ratio: number;
  exceeded: boolean;
}

export function budgetProgress(budget: Minor, spent: Minor): BudgetProgress {
  const remaining = budget - spent;
  return {
    budget,
    spent,
    remaining,
    ratio: budget > 0 ? spent / budget : 0,
    exceeded: budget > 0 && spent > budget,
  };
}

/** How much can still be spent per day until the period ends (today included). */
export function dailyAllowance(remaining: Minor, period: Period, today: DayKey): { daysLeft: number; perDay: Minor } {
  const daysLeft = daysLeftInPeriod(period, today);
  if (daysLeft === 0 || remaining <= 0) return { daysLeft, perDay: 0 };
  return { daysLeft, perDay: Math.floor(remaining / daysLeft) };
}

/**
 * Category budgets may never add up to more than the total: when they do, the total grows to match
 * (and the UI tells the user it was updated automatically).
 */
export function reconcileTotalBudget(total: Minor | null, categoryBudgets: Minor[]): { total: Minor | null; autoUpdated: boolean } {
  const sum = categoryBudgets.reduce((a, b) => a + b, 0);
  if (sum > 0 && (total === null || total < sum)) return { total: sum, autoUpdated: true };
  return { total, autoUpdated: false };
}

/** A total smaller than the sum of category budgets is rejected. */
export function isValidTotalBudget(total: Minor, categoryBudgets: Minor[]): boolean {
  return total >= categoryBudgets.reduce((a, b) => a + b, 0);
}
