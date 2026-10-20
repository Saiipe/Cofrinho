import { describe, expect, it } from 'vitest';
import {
  convertMinor,
  currencyExponent,
  decimalStringToMinor,
  formatMoney,
  minorToDecimalString,
  parseLocaleNumber,
  toMinor,
  type MoneyFormat,
} from './money';

describe('currency exponents and conversion', () => {
  it('reads ISO minor units from Intl', () => {
    expect(currencyExponent('BRL')).toBe(2);
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('BHD')).toBe(3);
  });

  it('rounds half away from zero without float artifacts', () => {
    expect(toMinor(1.005, 'USD')).toBe(101);
    expect(toMinor(-1.005, 'USD')).toBe(-101);
    expect(toMinor(0.1 + 0.2, 'USD')).toBe(30);
    expect(toMinor(1234.5, 'JPY')).toBe(1235);
  });

  it('converts between currencies with different exponents', () => {
    expect(convertMinor(10_000, 'USD', 'BRL', 5.25)).toBe(52_500);
    expect(convertMinor(1_000, 'JPY', 'USD', 0.0067)).toBe(670);
    expect(convertMinor(1234, 'BRL', 'BRL', 99)).toBe(1234);
  });
});

describe('decimal strings', () => {
  it('formats minor units exactly', () => {
    expect(minorToDecimalString(123456, 'BRL')).toBe('1234.56');
    expect(minorToDecimalString(5, 'BRL')).toBe('0.05');
    expect(minorToDecimalString(-70, 'USD')).toBe('-0.70');
    expect(minorToDecimalString(1500, 'JPY')).toBe('1500');
    expect(minorToDecimalString(9_007_199_254_740, 'BRL')).toBe('90071992547.40');
  });

  it('parses plain decimals with rounding', () => {
    expect(decimalStringToMinor('12.5', 'BRL')).toBe(1250);
    expect(decimalStringToMinor('0.005', 'BRL')).toBe(1);
    expect(decimalStringToMinor('-3', 'BRL')).toBe(-300);
    expect(decimalStringToMinor('.5', 'BRL')).toBe(50);
    expect(decimalStringToMinor('abc', 'BRL')).toBeNull();
    expect(decimalStringToMinor('', 'BRL')).toBeNull();
  });
});

describe('parseLocaleNumber', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['R$ 12,9', 12.9],
    ['(15.00)', -15],
    ['-3', -3],
    ['1.234.567', 1234567],
    ['1,234', 1234],
    ['12,34', 12.34],
    ['0.5', 0.5],
    ['15-', -15],
  ])('%s → %d', (input, expected) => {
    expect(parseLocaleNumber(input)).toBeCloseTo(expected, 10);
  });

  it('honors a forced decimal separator', () => {
    expect(parseLocaleNumber('1.234', ',')).toBe(1234);
    expect(parseLocaleNumber('1.234', '.')).toBeCloseTo(1.234, 10);
  });

  it('rejects garbage', () => {
    expect(parseLocaleNumber('')).toBeNull();
    expect(parseLocaleNumber('abc')).toBeNull();
    expect(parseLocaleNumber('1.2.3,4,5')).toBeNull();
  });
});

describe('formatMoney', () => {
  const ptBR: MoneyFormat = { locale: 'pt-BR', style: 'locale', grouping: true };

  it('uses the locale pattern by default', () => {
    expect(formatMoney(123456, 'BRL', ptBR)).toBe('R$ 1.234,56');
    expect(formatMoney(-500, 'BRL', ptBR)).toBe('-R$ 5,00');
    expect(formatMoney(500, 'BRL', ptBR, { sign: 'always' })).toBe('+R$ 5,00');
  });

  it('applies explicit separator styles exactly', () => {
    const style: MoneyFormat = { locale: 'pt-BR', style: 'comma_dot', grouping: true };
    expect(formatMoney(123456789, 'USD', style)).toBe('US$ 1,234,567.89');
    expect(formatMoney(123456789, 'BRL', { ...style, style: 'dot_comma' }, { symbol: false })).toBe('1.234.567,89');
    expect(formatMoney(123456789, 'BRL', { ...style, style: 'dot_comma', grouping: false }, { symbol: false })).toBe('1234567,89');
  });
});
