const FALLBACK = ['BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'ARS', 'CLP', 'COP', 'MXN', 'PEN', 'UYU', 'PYG', 'BOB', 'CAD', 'AUD', 'CHF', 'INR', 'AOA', 'MZN'];

let cache: string[] | null = null;

/** ISO 4217 codes known to this runtime, alphabetically. */
export function allCurrencies(): string[] {
  if (cache) return cache;
  try {
    cache = Intl.supportedValuesOf('currency').filter((code) => /^[A-Z]{3}$/.test(code));
  } catch {
    cache = [...FALLBACK].sort();
  }
  return cache;
}

const nameCache = new Map<string, Intl.DisplayNames>();

export function currencyName(code: string, locale: string): string {
  let names = nameCache.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: 'currency' });
    nameCache.set(locale, names);
  }
  try {
    const name = names.of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase() + name.slice(1);
  } catch {
    return code;
  }
}
