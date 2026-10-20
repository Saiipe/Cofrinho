import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { monthPeriod, monthPeriodOf, shiftMonthPeriod, todayKey, yearPeriod, yearPeriodOf, type Period } from '@/domain/dates';
import { useApp } from '../app/AppContext';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The month (or year) a screen is looking at, kept in the URL (`?m=2026-10`, `?y=2026`)
 * so it survives opening a record and coming back.
 */
export function usePeriod(mode: 'month' | 'year' = 'month') {
  const { settings } = useApp();
  const [params, setParams] = useSearchParams();
  const startDay = settings.monthStartDay;

  const period = useMemo<Period>(() => {
    if (mode === 'year') {
      const y = Number(params.get('y'));
      return y > 1900 && y < 3000 ? yearPeriod(y, startDay) : yearPeriodOf(todayKey(), startDay);
    }
    const m = params.get('m');
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      const [y, mo] = m.split('-').map(Number) as [number, number];
      return monthPeriod(y, mo - 1, startDay);
    }
    return monthPeriodOf(todayKey(), startDay);
  }, [params, startDay, mode]);

  const current = mode === 'year' ? yearPeriodOf(todayKey(), startDay) : monthPeriodOf(todayKey(), startDay);
  const isCurrent = period.startKey === current.startKey;

  const setPeriod = (next: Period) => {
    const copy = new URLSearchParams(params);
    copy.delete('m');
    copy.delete('y');
    const nextIsCurrent = next.startKey === current.startKey;
    if (!nextIsCurrent) {
      if (next.kind === 'year') copy.set('y', String(next.year));
      else copy.set('m', `${next.year}-${pad(next.month + 1)}`);
    }
    setParams(copy, { replace: true });
  };

  const shift = (delta: number) => {
    setPeriod(mode === 'year' ? yearPeriod(period.year + delta, startDay) : shiftMonthPeriod(period, delta, startDay));
  };

  return { period, setPeriod, shift, isCurrent, startDay };
}
