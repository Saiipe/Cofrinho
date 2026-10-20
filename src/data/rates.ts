import type { CustomRate, RateRow } from '@/domain/types';
import { db } from './db';
import { updateSettings } from './settings';

/** Synchronous lookup built from the current rate tables, used for live conversion in forms. */
export interface RateTable {
  market: Map<string, number>;
  custom: Map<string, number>;
}

export function customRateId(from: string, to: string): string {
  return `${from}>${to}`;
}

export function buildRateTable(market: RateRow[], custom: CustomRate[]): RateTable {
  return {
    market: new Map(market.map((r) => [r.code, r.perUsd])),
    custom: new Map(custom.map((r) => [r.id, r.rate])),
  };
}

/** 1 `from` = result `to`. Custom pairs win (in either direction), then market cross rates via USD. */
export function lookupRate(table: RateTable, from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = table.custom.get(customRateId(from, to));
  if (direct) return direct;
  const inverse = table.custom.get(customRateId(to, from));
  if (inverse) return 1 / inverse;
  const fromPerUsd = from === 'USD' ? 1 : table.market.get(from);
  const toPerUsd = to === 'USD' ? 1 : table.market.get(to);
  if (!fromPerUsd || !toPerUsd) return null;
  return toPerUsd / fromPerUsd;
}

export async function loadRateTable(): Promise<RateTable> {
  const [market, custom] = await Promise.all([db.rates.toArray(), db.customRates.toArray()]);
  return buildRateTable(market, custom);
}

export async function getRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  return lookupRate(await loadRateTable(), from, to);
}

export async function setCustomRate(from: string, to: string, rate: number | null): Promise<void> {
  await db.transaction('rw', db.customRates, async () => {
    await db.customRates.bulkDelete([customRateId(from, to), customRateId(to, from)]);
    if (rate !== null && rate > 0) {
      await db.customRates.put({ id: customRateId(from, to), from, to, rate, updatedAt: Date.now() });
    }
  });
}

const RATE_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
];

function supportedCurrencies(): Set<string> {
  try {
    return new Set(Intl.supportedValuesOf('currency'));
  } catch {
    return new Set();
  }
}

/** Parses the currency-api payload `{ date, usd: { brl: 5.4, … } }` into rows for ISO currencies. */
export function parseRatePayload(payload: unknown, now: number, supported = supportedCurrencies()): RateRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const usd = (payload as { usd?: unknown }).usd;
  if (!usd || typeof usd !== 'object') return [];
  const rows: RateRow[] = [];
  for (const [code, value] of Object.entries(usd as Record<string, unknown>)) {
    const upper = code.toUpperCase();
    if (typeof value !== 'number' || !(value > 0) || !/^[A-Z]{3}$/.test(upper)) continue;
    if (supported.size && !supported.has(upper)) continue;
    rows.push({ code: upper, perUsd: value, updatedAt: now });
  }
  return rows;
}

/** Downloads fresh market rates; resolves to the number of currencies updated. */
export async function refreshMarketRates(fetcher: typeof fetch = fetch): Promise<number> {
  let lastError: unknown = null;
  for (const url of RATE_SOURCES) {
    try {
      const response = await fetcher(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const now = Date.now();
      const rows = parseRatePayload(await response.json(), now);
      if (rows.length < 10) throw new Error('Incomplete rate payload');
      await db.rates.bulkPut(rows);
      await updateSettings({ ratesUpdatedAt: now });
      return rows.length;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Rate refresh failed');
}

const DAY_MS = 86_400_000;

/** Refreshes in the background at most once a day; failures are silent (offline is normal). */
export async function refreshRatesIfStale(updatedAt: number | null): Promise<void> {
  if (updatedAt && Date.now() - updatedAt < DAY_MS) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    await refreshMarketRates();
  } catch {
    // Keep using cached or custom rates.
  }
}
