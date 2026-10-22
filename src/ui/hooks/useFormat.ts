import { useMemo } from 'react';
import { addDays, parseDayKey, todayKey, type Period } from '@/domain/dates';
import { decimalSeparatorFor, formatCompact, formatMoney, type FormatOptions, type MoneyFormat } from '@/domain/money';
import type { DayKey, Minor } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function keyToDate(key: DayKey): Date {
  const { year, month, day } = parseDayKey(key);
  return new Date(year, month, day, 12);
}

export interface Formatters {
  moneyFormat: MoneyFormat;
  decimalSeparator: string;
  /** Book currency by default. */
  money: (minor: Minor, currency?: string, options?: FormatOptions) => string;
  compact: (minor: Minor, currency?: string) => string;
  percent: (ratio: number, digits?: number) => string;
  /** "Hoje", "Ontem" or "seg., 19 out." (with year when not the current one). */
  dayHeading: (key: DayKey) => string;
  date: (value: number | DayKey) => string;
  dateTime: (value: number) => string;
  time: (value: number) => string;
  monthYear: (year: number, month: number) => string;
  monthShort: (month: number) => string;
  /** "Out 2026" — compact month label for tight headers. */
  monthYearShort: (year: number, month: number) => string;
  /** "20 de out." / "Oct 20". */
  dayMonth: (key: DayKey) => string;
  /** Month label of a period; shows the day range when months start on a custom day. */
  periodLabel: (period: Period) => string;
  periodRange: (period: Period) => string;
  weekdayNarrow: (weekday: number) => string;
  weekdayShort: (weekday: number) => string;
}

export function useFormat(): Formatters {
  const { settings, locale, t } = useApp();
  const { book } = useBook();

  return useMemo(() => {
    const moneyFormat: MoneyFormat = { locale, style: settings.numberStyle, grouping: settings.grouping };
    const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    const weekdayDayMonth = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const weekdayDayMonthYear = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const fullDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const dateTime = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
    const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' });
    const weekdayNarrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const percent = (digits: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: 0 });
    // 2026-10-18 is a Sunday: weekday index → sample date.
    const weekdayDate = (weekday: number) => new Date(2026, 9, 18 + weekday, 12);

    const formatters: Formatters = {
      moneyFormat,
      decimalSeparator: decimalSeparatorFor(moneyFormat),
      money: (minor, currency = book.currency, options) => formatMoney(minor, currency, moneyFormat, options),
      compact: (minor, currency = book.currency) => formatCompact(minor, currency, locale),
      percent: (ratio, digits = 1) => percent(digits).format(ratio),
      dayHeading: (key) => {
        const today = todayKey();
        if (key === today) return t('common.today');
        if (key === addDays(today, -1)) return t('common.yesterday');
        if (key === addDays(today, 1)) return t('common.tomorrow');
        const sameYear = parseDayKey(key).year === parseDayKey(today).year;
        return capitalize((sameYear ? weekdayDayMonth : weekdayDayMonthYear).format(keyToDate(key)));
      },
      date: (value) => fullDate.format(typeof value === 'string' ? keyToDate(value) : new Date(value)),
      dateTime: (value) => dateTime.format(new Date(value)),
      time: (value) => time.format(new Date(value)),
      monthYear: (year, month) => capitalize(monthYear.format(new Date(year, month, 15))),
      monthShort: (month) => capitalize(monthShort.format(new Date(2026, month, 15)).replace('.', '')),
      monthYearShort: (year, month) => `${capitalize(monthShort.format(new Date(year, month, 15)).replace('.', ''))} ${year}`,
      dayMonth: (key) => dayMonth.format(keyToDate(key)),
      periodLabel: (period) => {
        if (period.kind === 'year') return String(period.year);
        if (period.kind === 'week' || period.kind === 'custom') return `${dayMonth.format(keyToDate(period.startKey))} – ${dayMonth.format(keyToDate(addDays(period.endKey, -1)))}`;
        return capitalize(monthYear.format(new Date(period.year, period.month, 15)));
      },
      periodRange: (period) => `${dayMonth.format(keyToDate(period.startKey))} – ${dayMonth.format(keyToDate(addDays(period.endKey, -1)))}`,
      weekdayNarrow: (weekday) => weekdayNarrow.format(weekdayDate(weekday)).toLocaleUpperCase(),
      weekdayShort: (weekday) => capitalize(weekdayShort.format(weekdayDate(weekday)).replace('.', '')),
    };
    return formatters;
  }, [locale, settings.numberStyle, settings.grouping, book.currency, t]);
}

