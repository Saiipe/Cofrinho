import type { Minor } from './types';

/**
 * Investment yield rules ("regra de rendimento").
 *
 * - `cdi`: a percentage of the CDI (caixinhas, CDBs, Tesouro Selic), e.g. 115 = 115% do CDI.
 *   The percentage applies to the daily CDI (252 business days), as Brazilian banks do.
 * - `yearly` / `monthly`: a fixed rate per year or per month (prefixados).
 * - `savings`: poupança with Selic above 8.5% — 0.5% a month (TR left out), tax-free.
 *
 * Projections assume today's CDI stays constant. Income tax follows the regressive table
 * (22.5% → 15% by holding time) on each deposit's own yield; IOF (redemptions under 30 days)
 * is left out.
 */

export type YieldKind = 'cdi' | 'yearly' | 'monthly' | 'savings';

export interface YieldRule {
  kind: YieldKind;
  /** `cdi`: percent of the CDI (115); `yearly`/`monthly`: percent per period (12.5); unused for `savings`. */
  rate: number;
  /** Income tax withheld on the yield (CDB, caixinhas, Tesouro). Savings, LCI and LCA are exempt. */
  taxed: boolean;
}

export const YIELD_KINDS: YieldKind[] = ['cdi', 'yearly', 'monthly', 'savings'];

/** CDI fallback (% a year) until the Banco Central is reached: series 4389 on 2026-10-21. */
export const DEFAULT_CDI = 13.65;

const SAVINGS_MONTHLY = 0.005;
const BUSINESS_DAYS = 252;

export function defaultRule(kind: YieldKind): YieldRule {
  if (kind === 'cdi') return { kind, rate: 100, taxed: true };
  if (kind === 'yearly') return { kind, rate: 12, taxed: true };
  if (kind === 'monthly') return { kind, rate: 1, taxed: true };
  return { kind, rate: 0, taxed: false };
}

/** Effective rate per year as a fraction (0.157 = 15.7% a.a.), with the CDI given in % a year. */
export function annualRate(rule: YieldRule, cdi: number): number {
  switch (rule.kind) {
    case 'cdi': {
      const dailyCdi = Math.pow(1 + cdi / 100, 1 / BUSINESS_DAYS) - 1;
      return Math.pow(1 + dailyCdi * (rule.rate / 100), BUSINESS_DAYS) - 1;
    }
    case 'yearly':
      return rule.rate / 100;
    case 'monthly':
      return Math.pow(1 + rule.rate / 100, 12) - 1;
    case 'savings':
      return Math.pow(1 + SAVINGS_MONTHLY, 12) - 1;
  }
}

/** Effective rate per month as a fraction. */
export function monthlyRate(rule: YieldRule, cdi: number): number {
  return Math.pow(1 + annualRate(rule, cdi), 1 / 12) - 1;
}

/** Regressive income tax on fixed income, by days the money stayed invested. */
export function incomeTaxRate(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

export interface Projection {
  months: number;
  /** Money put in: the starting amount plus every monthly deposit. */
  invested: Minor;
  /** Yield before tax. */
  grossYield: Minor;
  tax: Minor;
  /** Yield after tax. */
  netYield: Minor;
  /** What would be redeemed at the end, after tax. */
  netTotal: Minor;
}

/**
 * Projects `start` plus `deposit` at the end of every month for `months` months.
 * Each deposit is taxed by its own holding time, as the bank does when redeeming everything.
 */
export function project(start: Minor, deposit: Minor, months: number, rule: YieldRule, cdi: number): Projection {
  const rate = monthlyRate(rule, cdi);
  const tranches = [{ amount: Math.max(0, start), held: months }];
  for (let k = 1; k <= months; k++) if (deposit > 0) tranches.push({ amount: deposit, held: months - k });
  let invested = 0;
  let gross = 0;
  let tax = 0;
  for (const { amount, held } of tranches) {
    const earned = amount * (Math.pow(1 + rate, held) - 1);
    invested += amount;
    gross += earned;
    // Calendar days held (12 months = 365 days, so a full year already pays 17.5%).
    if (rule.taxed) tax += earned * incomeTaxRate(Math.round((held * 365) / 12));
  }
  const grossYield = Math.round(gross);
  const taxMinor = Math.round(tax);
  return { months, invested, grossYield, tax: taxMinor, netYield: grossYield - taxMinor, netTotal: invested + grossYield - taxMinor };
}

/** Parses the Banco Central SGS payload `[{ data: "21/10/2026", valor: "13.65" }]`. */
export function parseCdiPayload(payload: unknown): { rate: number; date: string } | null {
  if (!Array.isArray(payload) || !payload.length) return null;
  const last = payload[payload.length - 1] as { data?: unknown; valor?: unknown };
  const rate = Number(last.valor);
  const match = typeof last.data === 'string' ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(last.data) : null;
  if (!match || !(rate > 0 && rate < 100)) return null;
  return { rate, date: `${match[3]}-${match[2]}-${match[1]}` };
}
