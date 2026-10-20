import type { Minor } from './types';

const exponentCache = new Map<string, number>();

/** ISO 4217 minor-unit exponent (BRL → 2, JPY → 0, BHD → 3), as reported by Intl. */
export function currencyExponent(code: string): number {
  let exponent = exponentCache.get(code);
  if (exponent === undefined) {
    try {
      exponent = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      exponent = 2;
    }
    exponentCache.set(code, exponent);
  }
  return exponent;
}

/** Rounds half away from zero, absorbing binary noise such as 1.005 * 100 = 100.49999999999999. */
function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value) * (1 + 1e-12));
}

export function toMinor(major: number, code: string): Minor {
  return roundHalfAway(major * 10 ** currencyExponent(code));
}

export function toMajor(minor: Minor, code: string): number {
  return minor / 10 ** currencyExponent(code);
}

/** Converts using `rate` = how many `to` units one `from` unit buys. */
export function convertMinor(minor: Minor, from: string, to: string, rate: number): Minor {
  if (from === to) return minor;
  return toMinor(toMajor(minor, from) * rate, to);
}

/**
 * Exact decimal string for a minor amount, without grouping: 123456 BRL → "1234.56".
 * Uses string arithmetic so large values never pick up float artifacts.
 */
export function minorToDecimalString(minor: Minor, code: string): string {
  const exponent = currencyExponent(code);
  const digits = Math.abs(minor).toString().padStart(exponent + 1, '0');
  const sign = minor < 0 ? '-' : '';
  if (exponent === 0) return sign + digits;
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

/** Parses a plain decimal ("1234.5", "-0.07") into minor units; returns null when malformed. */
export function decimalStringToMinor(text: string, code: string): Minor | null {
  const match = /^\s*(-)?(\d*)(?:\.(\d*))?\s*$/.exec(text);
  if (!match || (!match[2] && !match[3])) return null;
  const exponent = currencyExponent(code);
  const fraction = (match[3] ?? '').padEnd(exponent + 1, '0');
  let value = Number((match[2] || '0') + fraction.slice(0, exponent));
  // Round on the first dropped digit.
  if (Number(fraction[exponent]) >= 5) value += 1;
  return match[1] && value !== 0 ? -value : value;
}

/**
 * Parses numbers as they appear in bank exports and free text: "1.234,56", "1,234.56",
 * "R$ 12,9", "(15.00)", "-3". `decimalSeparator` forces the interpretation when known.
 */
export function parseLocaleNumber(raw: string, decimalSeparator?: ',' | '.'): number | null {
  let text = raw.trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/[^\d.,\-+]/g, '');
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const separator = decimalSeparator ?? guessDecimalSeparator(text);
  const group = separator === ',' ? '.' : ',';
  const normalized = text.split(group).join('').replace(separator, '.');
  if ((normalized.match(/\./g) ?? []).length > 1) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function guessDecimalSeparator(text: string): ',' | '.' {
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) return lastComma > lastDot ? ',' : '.';
  const sep = lastComma >= 0 ? ',' : '.';
  const index = Math.max(lastComma, lastDot);
  if (index < 0) return '.';
  const occurrences = text.split(sep).length - 1;
  const decimals = text.length - index - 1;
  // "1.234.567" or "1,234" with exactly three trailing digits reads as grouping.
  if (occurrences > 1 || decimals === 3) return sep === ',' ? '.' : ',';
  return sep;
}

/** Display conventions for amounts; `locale` follows the app language. */
export type NumberStyle = 'locale' | 'comma_dot' | 'dot_comma' | 'space_comma' | 'space_dot' | 'apos_dot';

export interface MoneyFormat {
  locale: string;
  style: NumberStyle;
  grouping: boolean;
}

const STYLE_SEPARATORS: Record<Exclude<NumberStyle, 'locale'>, { group: string; decimal: string }> = {
  comma_dot: { group: ',', decimal: '.' },
  dot_comma: { group: '.', decimal: ',' },
  space_comma: { group: ' ', decimal: ',' },
  space_dot: { group: ' ', decimal: '.' },
  apos_dot: { group: '’', decimal: '.' },
};

export function decimalSeparatorFor(format: MoneyFormat): string {
  if (format.style !== 'locale') return STYLE_SEPARATORS[format.style].decimal;
  return new Intl.NumberFormat(format.locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
}

const symbolCache = new Map<string, string>();

export function currencySymbol(code: string, locale: string): string {
  const key = `${locale}|${code}`;
  let symbol = symbolCache.get(key);
  if (symbol === undefined) {
    try {
      symbol =
        new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'symbol' })
          .formatToParts(0)
          .find((p) => p.type === 'currency')?.value ?? code;
    } catch {
      symbol = code;
    }
    symbolCache.set(key, symbol);
  }
  return symbol;
}

export interface FormatOptions {
  /** `always` prefixes "+" on positives (income rows). */
  sign?: 'auto' | 'always' | 'never';
  symbol?: boolean;
}

function groupDigits(integer: string, separator: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** Formats the number part only, honoring the chosen separator style. */
export function formatNumber(minor: Minor, code: string, format: MoneyFormat): string {
  const exponent = currencyExponent(code);
  if (format.style === 'locale') {
    return new Intl.NumberFormat(format.locale, {
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
      useGrouping: format.grouping,
    }).format(Math.abs(minor) / 10 ** exponent);
  }
  const { group, decimal } = STYLE_SEPARATORS[format.style];
  const [integer, fraction] = minorToDecimalString(Math.abs(minor), code).split('.');
  const grouped = format.grouping ? groupDigits(integer!, group) : integer!;
  return fraction ? `${grouped}${decimal}${fraction}` : grouped;
}

export function formatMoney(minor: Minor, code: string, format: MoneyFormat, options: FormatOptions = {}): string {
  const { sign = 'auto', symbol = true } = options;
  const prefix = sign === 'never' ? '' : minor < 0 ? '-' : sign === 'always' && minor > 0 ? '+' : '';
  const number = formatNumber(minor, code, format);
  if (!symbol) return prefix + number;
  if (format.style === 'locale') {
    // Let Intl place the symbol for the locale (R$ 10,00 · $10.00 · 10,00 €).
    const exponent = currencyExponent(code);
    let text: string;
    try {
      text = new Intl.NumberFormat(format.locale, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'symbol',
        minimumFractionDigits: exponent,
        maximumFractionDigits: exponent,
        useGrouping: format.grouping,
      }).format(Math.abs(minor) / 10 ** exponent);
    } catch {
      text = `${code} ${number}`;
    }
    return prefix + text;
  }
  return `${prefix}${currencySymbol(code, format.locale)} ${number}`;
}

/** Short axis labels such as "1,2 mil" / "3.4K". */
export function formatCompact(minor: Minor, code: string, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(toMajor(minor, code));
}

export function sumMinor(values: Iterable<Minor>): Minor {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
