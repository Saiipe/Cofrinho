import { addDays, addMonthsClamped, daysBetween, makeDayKey, monthsBetween, parseDayKey } from './dates';
import type { DayKey, Frequency, ScheduleStatus } from './types';

/**
 * Recurring transactions ("lançamentos recorrentes").
 *
 * Rules (mirroring the behavior documented by the original app):
 * - Occurrences are anchored on the start date: monthly plans run on the start day of month
 *   (clamped to short months), weekly plans on the start weekday, and so on.
 * - A run is due when: start ≤ date, date > last run, date ≤ today, and neither the run limit nor
 *   the end date (inclusive) is reached. A plan ends by count, by date, or never.
 * - Runs only happen while the app is open; missed dates are caught up on the next open,
 *   each dated on its own occurrence.
 * - Creating a plan never backfills periods that already ended; editing frequency, start date
 *   or run limit recomputes the last run so nothing is skipped or duplicated.
 */

export const FREQUENCIES: Frequency[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'every4months',
  'semiannual',
  'yearly',
];

export const RUN_COUNT_PRESETS = [0, 3, 6, 12, 18, 24];
export const MAX_RUN_COUNT = 60;
export const SCHEDULE_NAME_MAX = 25;

const DAY_STEP: Partial<Record<Frequency, number>> = { daily: 1, weekly: 7, biweekly: 14 };
const MONTH_STEP: Partial<Record<Frequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  every4months: 4,
  semiannual: 6,
  yearly: 12,
};

export interface Recurrence {
  frequency: Frequency;
  startDate: DayKey;
}

export interface RunState extends Recurrence {
  lastRunDate: DayKey | null;
  totalCount: number;
  runCount: number;
  /** Last day a run may fall on (inclusive); absent = no end date. */
  endDate?: DayKey | null;
}

const beforeEnd = (state: Pick<RunState, 'endDate'>, date: DayKey) => !state.endDate || date <= state.endDate;

/** The `index`-th occurrence (0 = start date). Computed from the start to avoid month-end drift. */
export function occurrence(rule: Recurrence, index: number): DayKey {
  const days = DAY_STEP[rule.frequency];
  if (days !== undefined) return addDays(rule.startDate, days * index);
  return addMonthsClamped(rule.startDate, MONTH_STEP[rule.frequency]! * index);
}

/** Index of the first occurrence strictly after `after` (0 when `after` precedes the start). */
export function firstIndexAfter(rule: Recurrence, after: DayKey | null): number {
  if (after === null || after < rule.startDate) return 0;
  const days = DAY_STEP[rule.frequency];
  if (days !== undefined) return Math.floor(daysBetween(rule.startDate, after) / days) + 1;
  const step = MONTH_STEP[rule.frequency]!;
  let index = Math.max(0, Math.floor(monthsBetween(rule.startDate, after) / step) - 1);
  while (occurrence(rule, index) <= after) index++;
  return index;
}

/** Latest occurrence on or before `bound`, or null when the plan starts later. */
export function latestOccurrenceOnOrBefore(rule: Recurrence, bound: DayKey): DayKey | null {
  if (bound < rule.startDate) return null;
  return occurrence(rule, firstIndexAfter(rule, bound) - 1);
}

function remainingRuns(state: RunState): number {
  return state.totalCount > 0 ? Math.max(0, state.totalCount - state.runCount) : Number.POSITIVE_INFINITY;
}

/** Dates that must be recorded now, oldest first. `limit` bounds a single catch-up pass. */
export function dueOccurrences(state: RunState, today: DayKey, limit = 1000): DayKey[] {
  const due: DayKey[] = [];
  let remaining = remainingRuns(state);
  for (let i = firstIndexAfter(state, state.lastRunDate); remaining > 0 && due.length < limit; i++) {
    const date = occurrence(state, i);
    if (date > today || !beforeEnd(state, date)) break;
    due.push(date);
    remaining--;
  }
  return due;
}

/** Next date the plan will record, or null when its run limit is exhausted. */
export function nextOccurrence(state: RunState): DayKey | null {
  if (remainingRuns(state) === 0) return null;
  const date = occurrence(state, firstIndexAfter(state, state.lastRunDate));
  return beforeEnd(state, date) ? date : null;
}

/** How many runs fall between the start date and `endDate` (inclusive). */
export function runsUntil(rule: Recurrence, endDate: DayKey): number {
  return endDate < rule.startDate ? 0 : firstIndexAfter(rule, endDate);
}

/**
 * Forecast rule ("previsão"): the calendar shows the runs a plan will still record, but only up to the
 * end of the month after the current one — far enough to plan the next month without inventing a
 * long future. Forecasts are never stored; they are recomputed from the plan on every view.
 */
export const FORECAST_MONTHS_AHEAD = 1;

/** Last day shown in forecasts: the end of the month `monthsAhead` months after today's month. */
export function forecastHorizon(today: DayKey, monthsAhead = FORECAST_MONTHS_AHEAD): DayKey {
  const { year, month } = parseDayKey(today);
  return addDays(addMonthsClamped(makeDayKey(year, month, 1), monthsAhead + 1), -1);
}

/**
 * Runs still to be recorded after today, up to `horizon` (inclusive), within the run limit.
 * Runs due today or earlier are left out: they are recorded for real when the app opens.
 */
export function forecastOccurrences(state: RunState, today: DayKey, horizon: DayKey): DayKey[] {
  const forecast: DayKey[] = [];
  let remaining = remainingRuns(state);
  for (let i = firstIndexAfter(state, state.lastRunDate); remaining > 0; i++) {
    const date = occurrence(state, i);
    if (date > horizon || !beforeEnd(state, date)) break;
    remaining--;
    if (date > today) forecast.push(date);
  }
  return forecast;
}

/** Last-run marker for a new plan: periods that already ended are not backfilled, today still runs. */
export function initialLastRun(rule: Recurrence, today: DayKey): DayKey | null {
  return latestOccurrenceOnOrBefore(rule, addDays(today, -1));
}

/**
 * Last-run marker after the recurrence changed. If the plan already ran today, today counts as done
 * so a new rule landing on today does not record twice.
 */
export function recomputeLastRun(rule: Recurrence, previousLastRun: DayKey | null, today: DayKey): DayKey | null {
  const bound = previousLastRun !== null && previousLastRun >= today ? today : addDays(today, -1);
  return latestOccurrenceOnOrBefore(rule, bound);
}

/** Status implied by the plan's state: completed once no run is left (count or end date), reopened when one is. */
export function statusFor(status: ScheduleStatus, state: RunState): ScheduleStatus {
  if (nextOccurrence(state) === null) return 'completed';
  if (status === 'completed') return 'active';
  return status;
}

/** Status implied by the run counter: plans become completed when they hit their limit and reopen when it grows. */
export function statusForCount(status: ScheduleStatus, totalCount: number, runCount: number): ScheduleStatus {
  if (totalCount > 0 && runCount >= totalCount) return 'completed';
  if (status === 'completed') return 'active';
  return status;
}
