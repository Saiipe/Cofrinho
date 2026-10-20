import type { DayKey } from './types';

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day of a timestamp or Date. */
export function dayKey(value: number | Date): DayKey {
  const d = typeof value === 'number' ? new Date(value) : value;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: number = Date.now()): DayKey {
  return dayKey(now);
}

export function parseDayKey(key: DayKey): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year: year!, month: month! - 1, day: day! };
}

export function makeDayKey(year: number, month0: number, day: number): DayKey {
  const d = new Date(Date.UTC(year, month0, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Local midnight of the day, as epoch milliseconds. */
export function dayStart(key: DayKey): number {
  const { year, month, day } = parseDayKey(key);
  return new Date(year, month, day).getTime();
}

/** Keeps the time of day of `time` while moving it to `key`'s date. */
export function withDay(key: DayKey, time: number): number {
  const { year, month, day } = parseDayKey(key);
  const t = new Date(time);
  return new Date(year, month, day, t.getHours(), t.getMinutes(), t.getSeconds()).getTime();
}

function utc(key: DayKey): number {
  const { year, month, day } = parseDayKey(key);
  return Date.UTC(year, month, day);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = new Date(utc(key) + days * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Adds months keeping the day of month, clamped to the target month's length (Jan 31 + 1 → Feb 28/29). */
export function addMonthsClamped(key: DayKey, months: number): DayKey {
  const { year, month, day } = parseDayKey(key);
  const total = year * 12 + month + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total - targetYear * 12;
  return makeDayKey(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

export function monthsBetween(a: DayKey, b: DayKey): number {
  const pa = parseDayKey(a);
  const pb = parseDayKey(b);
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: DayKey): number {
  return new Date(utc(key)).getUTCDay();
}

/**
 * A reporting period. Months may start on any day (1–28) to match pay or card cycles:
 * with start day 26, "March" runs from Mar 26 to Apr 25.
 */
export interface Period {
  kind: 'month' | 'year' | 'all';
  /** Label year/month: the month in which the period starts. */
  year: number;
  month: number;
  startKey: DayKey;
  /** Exclusive end. */
  endKey: DayKey;
  start: number;
  end: number;
}

function buildPeriod(kind: Period['kind'], year: number, month: number, startKey: DayKey, endKey: DayKey): Period {
  return { kind, year, month, startKey, endKey, start: dayStart(startKey), end: dayStart(endKey) };
}

export function clampStartDay(startDay: number): number {
  return Math.min(28, Math.max(1, Math.round(startDay) || 1));
}

export function monthPeriod(year: number, month0: number, startDay = 1): Period {
  const sd = clampStartDay(startDay);
  const startKey = makeDayKey(year, month0, sd);
  return buildPeriod('month', year, month0, startKey, addMonthsClamped(startKey, 1));
}

/** The month period that contains the given day. */
export function monthPeriodOf(key: DayKey, startDay = 1): Period {
  const { year, month, day } = parseDayKey(key);
  const sd = clampStartDay(startDay);
  return day >= sd ? monthPeriod(year, month, sd) : monthPeriod(month === 0 ? year - 1 : year, (month + 11) % 12, sd);
}

export function shiftMonthPeriod(period: Period, delta: number, startDay = 1): Period {
  const total = period.year * 12 + period.month + delta;
  return monthPeriod(Math.floor(total / 12), ((total % 12) + 12) % 12, startDay);
}

export function yearPeriod(year: number, startDay = 1): Period {
  const sd = clampStartDay(startDay);
  const startKey = makeDayKey(year, 0, sd);
  return buildPeriod('year', year, 0, startKey, makeDayKey(year + 1, 0, sd));
}

export function yearPeriodOf(key: DayKey, startDay = 1): Period {
  return yearPeriod(monthPeriodOf(key, startDay).year, startDay);
}

/** Everything ever recorded; bounds wide enough for any realistic timestamp. */
export const ALL_TIME: Period = buildPeriod('all', 1970, 0, '1970-01-01', '2200-01-01');

export function periodDays(period: Period): number {
  return daysBetween(period.startKey, period.endKey);
}

export function inPeriod(timestamp: number, period: Period): boolean {
  return timestamp >= period.start && timestamp < period.end;
}

/** Days remaining in the period counting today; 0 when the period is over, full length when in the future. */
export function daysLeftInPeriod(period: Period, today: DayKey): number {
  if (today >= period.endKey) return 0;
  if (today < period.startKey) return periodDays(period);
  return daysBetween(today, period.endKey);
}

/** Days of the period already lived, today included (whole period when over, 1 when in the future). */
export function elapsedDaysInPeriod(period: Period, today: DayKey): number {
  if (today >= period.endKey) return periodDays(period);
  if (today < period.startKey) return 1;
  return daysBetween(period.startKey, today) + 1;
}

/**
 * Month grid for a calendar view: whole weeks covering the month, starting on `weekStart`
 * (0 = Sunday, 1 = Monday, 6 = Saturday).
 */
export function calendarWeeks(year: number, month0: number, weekStart: number): DayKey[][] {
  const first = makeDayKey(year, month0, 1);
  const offset = (weekday(first) - weekStart + 7) % 7;
  let cursor = addDays(first, -offset);
  const last = makeDayKey(year, month0, daysInMonth(year, month0));
  const weeks: DayKey[][] = [];
  while (cursor <= last) {
    const week: DayKey[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Weekday indices in display order for a given week start. */
export function weekdayOrder(weekStart: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}
