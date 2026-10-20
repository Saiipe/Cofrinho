import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonthsClamped,
  calendarWeeks,
  dayKey,
  daysBetween,
  daysLeftInPeriod,
  elapsedDaysInPeriod,
  monthPeriod,
  monthPeriodOf,
  periodDays,
  shiftMonthPeriod,
  weekday,
  yearPeriod,
} from './dates';

describe('day arithmetic', () => {
  it('adds days across months and leap years', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-12-31', 1)).toBe('2024-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
  });

  it('clamps month additions to short months', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonthsClamped('2026-03-15', -3)).toBe('2025-12-15');
  });

  it('knows weekdays', () => {
    expect(weekday('2026-10-20')).toBe(2); // Tuesday
    expect(dayKey(new Date(2026, 9, 20, 23, 59))).toBe('2026-10-20');
  });
});

describe('periods', () => {
  it('builds calendar months by default', () => {
    const p = monthPeriod(2026, 1);
    expect([p.startKey, p.endKey]).toEqual(['2026-02-01', '2026-03-01']);
    expect(periodDays(p)).toBe(28);
  });

  it('supports a custom month start day', () => {
    const p = monthPeriodOf('2026-04-10', 26);
    expect([p.year, p.month, p.startKey, p.endKey]).toEqual([2026, 2, '2026-03-26', '2026-04-26']);
    expect(monthPeriodOf('2026-04-26', 26).startKey).toBe('2026-04-26');
    expect(monthPeriodOf('2026-01-05', 10).startKey).toBe('2025-12-10');
  });

  it('shifts across year boundaries', () => {
    const jan = monthPeriod(2026, 0, 5);
    expect(shiftMonthPeriod(jan, -1, 5).startKey).toBe('2025-12-05');
    expect(shiftMonthPeriod(jan, 13, 5).startKey).toBe('2027-02-05');
  });

  it('builds years honoring the start day', () => {
    const y = yearPeriod(2026, 26);
    expect([y.startKey, y.endKey]).toEqual(['2026-01-26', '2027-01-26']);
  });

  it('counts elapsed days', () => {
    const october = monthPeriod(2026, 9);
    expect(elapsedDaysInPeriod(october, '2026-10-20')).toBe(20);
    expect(elapsedDaysInPeriod(october, '2026-12-01')).toBe(31);
    expect(elapsedDaysInPeriod(october, '2026-09-01')).toBe(1);
  });

  it('counts days left including today', () => {
    const p = monthPeriod(2026, 9);
    expect(daysLeftInPeriod(p, '2026-10-20')).toBe(12);
    expect(daysLeftInPeriod(p, '2026-11-01')).toBe(0);
    expect(daysLeftInPeriod(p, '2026-09-30')).toBe(31);
  });
});

describe('calendarWeeks', () => {
  it('pads the month to whole weeks for the chosen week start', () => {
    const mondayFirst = calendarWeeks(2026, 9, 1);
    expect(mondayFirst[0]![0]).toBe('2026-09-28');
    expect(mondayFirst.at(-1)!.at(-1)).toBe('2026-11-01');
    const sundayFirst = calendarWeeks(2026, 9, 0);
    expect(sundayFirst[0]![0]).toBe('2026-09-27');
    expect(sundayFirst.every((w) => w.length === 7)).toBe(true);
  });
});
