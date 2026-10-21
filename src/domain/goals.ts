import { addDays, daysBetween, dayKey } from './dates';
import type { DayKey, Goal, Minor } from './types';

/**
 * Savings goals ("metas").
 *
 * - The saved amount is the sum of deposits minus withdrawals and never goes below zero.
 * - With a target date, the app suggests how much to put aside per month to get there on time
 *   (whole months, at least one; the last month absorbs the rounding).
 * - The projection extrapolates the average monthly saving since the first deposit.
 */

const AVG_MONTH_DAYS = 30.44;

export const GOAL_NAME_MAX = 40;

export interface GoalProgress {
  saved: Minor;
  remaining: Minor;
  /** 0…1+ of the target. */
  ratio: number;
  reached: boolean;
  /** Days until the target date (negative when it passed); null without a date. */
  daysLeft: number | null;
  /** Suggested saving per month to reach the target on time; null when not applicable. */
  perMonth: Minor | null;
  /** Estimated day the target is reached at the current pace; null without enough history. */
  projected: DayKey | null;
  /** The target date passed before the goal was reached. */
  late: boolean;
}

export function goalSaved(goal: Pick<Goal, 'entries'>): Minor {
  return Math.max(0, goal.entries.reduce((sum, entry) => sum + entry.amount, 0));
}

export function goalProgress(goal: Pick<Goal, 'entries' | 'target' | 'targetDate'>, today: DayKey): GoalProgress {
  const saved = goalSaved(goal);
  const remaining = Math.max(0, goal.target - saved);
  const reached = goal.target > 0 && remaining === 0;
  const ratio = goal.target > 0 ? saved / goal.target : 0;
  const daysLeft = goal.targetDate ? daysBetween(today, goal.targetDate) : null;

  let perMonth: Minor | null = null;
  if (!reached && daysLeft !== null && daysLeft >= 0) {
    const months = Math.max(1, Math.ceil(daysLeft / AVG_MONTH_DAYS));
    perMonth = Math.ceil(remaining / months);
  }

  let projected: DayKey | null = null;
  const deposits = goal.entries.filter((e) => e.amount > 0);
  if (!reached && saved > 0 && deposits.length) {
    const first = dayKey(Math.min(...deposits.map((e) => e.date)));
    const elapsedMonths = Math.max(1, daysBetween(first, today) / AVG_MONTH_DAYS);
    const perMonthPace = saved / elapsedMonths;
    if (perMonthPace > 0) projected = addDays(today, Math.ceil((remaining / perMonthPace) * AVG_MONTH_DAYS));
  }

  return { saved, remaining, ratio, reached, daysLeft, perMonth, projected, late: !reached && daysLeft !== null && daysLeft < 0 };
}
