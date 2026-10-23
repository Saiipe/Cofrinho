import { describe, expect, it } from 'vitest';
import {
  dueOccurrences,
  forecastHorizon,
  forecastOccurrences,
  initialLastRun,
  nextOccurrence,
  occurrence,
  recomputeLastRun,
  runsUntil,
  statusFor,
  statusForCount,
  type RunState,
} from './schedule';

const monthlyRent: RunState = { frequency: 'monthly', startDate: '2026-01-01', lastRunDate: '2026-01-01', totalCount: 0, runCount: 1 };

describe('occurrences', () => {
  it('anchors on the start date for every frequency', () => {
    expect(occurrence({ frequency: 'weekly', startDate: '2026-10-20' }, 2)).toBe('2026-11-03');
    expect(occurrence({ frequency: 'biweekly', startDate: '2026-10-20' }, 1)).toBe('2026-11-03');
    expect(occurrence({ frequency: 'quarterly', startDate: '2026-01-15' }, 3)).toBe('2026-10-15');
    expect(occurrence({ frequency: 'every4months', startDate: '2026-01-15' }, 2)).toBe('2026-09-15');
    expect(occurrence({ frequency: 'semiannual', startDate: '2026-01-15' }, 3)).toBe('2027-07-15');
    expect(occurrence({ frequency: 'yearly', startDate: '2024-02-29' }, 1)).toBe('2025-02-28');
  });

  it('does not drift after clamping a short month', () => {
    const rule = { frequency: 'monthly' as const, startDate: '2026-01-31' };
    expect([1, 2, 3].map((i) => occurrence(rule, i))).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });
});

describe('dueOccurrences', () => {
  it('catches up every missed run, each on its own date (rent example)', () => {
    expect(dueOccurrences(monthlyRent, '2026-03-05')).toEqual(['2026-02-01', '2026-03-01']);
  });

  it('never records future dates and never repeats a date', () => {
    expect(dueOccurrences({ ...monthlyRent, lastRunDate: '2026-03-01' }, '2026-03-05')).toEqual([]);
    expect(dueOccurrences({ ...monthlyRent, lastRunDate: null, runCount: 0 }, '2025-12-31')).toEqual([]);
  });

  it('stops at the run limit', () => {
    const limited: RunState = { frequency: 'monthly', startDate: '2026-01-01', lastRunDate: null, totalCount: 3, runCount: 0 };
    expect(dueOccurrences(limited, '2026-12-31')).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(dueOccurrences({ ...limited, runCount: 3, lastRunDate: '2026-03-01' }, '2026-12-31')).toEqual([]);
    expect(nextOccurrence({ ...limited, runCount: 3, lastRunDate: '2026-03-01' })).toBeNull();
  });

  it('handles long daily catch-ups', () => {
    const daily: RunState = { frequency: 'daily', startDate: '2026-01-01', lastRunDate: '2026-01-10', totalCount: 0, runCount: 10 };
    const due = dueOccurrences(daily, '2026-02-09');
    expect(due).toHaveLength(30);
    expect(due[0]).toBe('2026-01-11');
    expect(due.at(-1)).toBe('2026-02-09');
  });
});

describe('end date', () => {
  const rent: RunState = { frequency: 'monthly', startDate: '2026-01-10', lastRunDate: '2026-01-10', totalCount: 0, runCount: 1, endDate: '2026-04-10' };

  it('stops recording after the end date (inclusive)', () => {
    expect(dueOccurrences(rent, '2026-12-31')).toEqual(['2026-02-10', '2026-03-10', '2026-04-10']);
    expect(nextOccurrence({ ...rent, lastRunDate: '2026-04-10', runCount: 4 })).toBeNull();
    expect(forecastOccurrences(rent, '2026-02-15', '2026-12-31')).toEqual(['2026-03-10', '2026-04-10']);
  });

  it('completes the plan once the end date is past and reopens when it moves', () => {
    const done = { ...rent, lastRunDate: '2026-04-10', runCount: 4 };
    expect(statusFor('active', done)).toBe('completed');
    expect(statusFor('completed', { ...done, endDate: '2026-12-31' })).toBe('active');
    expect(statusFor('paused', rent)).toBe('paused');
  });

  it('counts the runs up to an end date', () => {
    expect(runsUntil(rent, '2026-04-10')).toBe(4);
    expect(runsUntil(rent, '2026-04-09')).toBe(3);
    expect(runsUntil(rent, '2025-12-31')).toBe(0);
  });
});

describe('forecast', () => {
  it('reaches the end of the next month only', () => {
    expect(forecastHorizon('2026-10-22')).toBe('2026-11-30');
    expect(forecastHorizon('2026-12-01')).toBe('2027-01-31');
    expect(forecastHorizon('2027-01-31')).toBe('2027-02-28');
  });

  it('lists runs after today up to the horizon', () => {
    const rent = { ...monthlyRent, lastRunDate: '2026-10-01', runCount: 10 };
    expect(forecastOccurrences(rent, '2026-10-22', forecastHorizon('2026-10-22'))).toEqual(['2026-11-01']);
    const weekly: RunState = { frequency: 'weekly', startDate: '2026-10-20', lastRunDate: '2026-10-20', totalCount: 0, runCount: 1 };
    expect(forecastOccurrences(weekly, '2026-10-22', '2026-11-30')).toEqual(['2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  });

  it('leaves runs due today to the real catch-up and respects the run limit', () => {
    const pending = { ...monthlyRent, lastRunDate: '2026-09-01', runCount: 9, totalCount: 11 };
    // October 1st is due (recorded on open) and uses the 10th run; November is the 11th and last.
    expect(forecastOccurrences(pending, '2026-10-22', '2026-12-31')).toEqual(['2026-11-01']);
    expect(forecastOccurrences({ ...pending, runCount: 11 }, '2026-10-22', '2026-12-31')).toEqual([]);
  });
});

describe('creating and editing plans', () => {
  it('does not backfill ended periods when created with a past start date', () => {
    const rule = { frequency: 'monthly' as const, startDate: '2025-01-01' };
    const last = initialLastRun(rule, '2026-03-05');
    expect(last).toBe('2026-03-01');
    expect(dueOccurrences({ ...rule, lastRunDate: last, totalCount: 0, runCount: 0 }, '2026-03-05')).toEqual([]);
    expect(nextOccurrence({ ...rule, lastRunDate: last, totalCount: 0, runCount: 0 })).toBe('2026-04-01');
  });

  it('runs today when the start date is today', () => {
    const rule = { frequency: 'monthly' as const, startDate: '2026-10-20' };
    const last = initialLastRun(rule, '2026-10-20');
    expect(last).toBeNull();
    expect(dueOccurrences({ ...rule, lastRunDate: last, totalCount: 0, runCount: 0 }, '2026-10-20')).toEqual(['2026-10-20']);
  });

  it('does not record twice when the rule changes after running today', () => {
    const weekly = { frequency: 'weekly' as const, startDate: '2026-10-20' };
    const last = recomputeLastRun(weekly, '2026-10-20', '2026-10-20');
    expect(last).toBe('2026-10-20');
    expect(dueOccurrences({ ...weekly, lastRunDate: last, totalCount: 0, runCount: 1 }, '2026-10-20')).toEqual([]);
  });

  it('updates status from the run counter', () => {
    expect(statusForCount('active', 3, 3)).toBe('completed');
    expect(statusForCount('completed', 6, 3)).toBe('active');
    expect(statusForCount('completed', 0, 12)).toBe('active');
    expect(statusForCount('paused', 6, 3)).toBe('paused');
  });
});
