import { addMonthsClamped, dayKey, daysInMonth, makeDayKey, parseDayKey, withDay } from './dates';
import type { Account, DayKey, ID, Minor, Transaction } from './types';

/**
 * Credit cards ("cartões de crédito").
 *
 * Rules:
 * - Each invoice ("fatura") closes on the closing day; purchases made on or after the closing day
 *   go to the next invoice (the closing day is the "best day to buy").
 * - The due date is in the same month as the closing date when the due day is after the closing
 *   day, otherwise in the following month. Invoices are named after their due month.
 * - Days past the end of a short month are clamped (closing day 31 closes on Feb 28/29).
 * - Payments (transfers into the card, positive adjustments) pay off the oldest debt first:
 *   the opening debt, then invoices from the oldest to the newest.
 * - Installment purchases ("compras parceladas") become one record per month; the first
 *   installment absorbs the rounding remainder.
 */

export const MAX_INSTALLMENTS = 48;

export interface CardRule {
  closingDay: number;
  dueDay: number;
}

export interface InvoiceCycle {
  /** Due month, `YYYY-MM`: identifies and names the invoice. */
  key: string;
  /** First day included (the previous closing date). */
  start: DayKey;
  /** Closing date (exclusive): purchases from this day on belong to the next invoice. */
  close: DayKey;
  due: DayKey;
}

function clampedDay(year: number, month0: number, day: number): DayKey {
  const total = year * 12 + month0;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return makeDayKey(y, m, Math.min(Math.max(1, day), daysInMonth(y, m)));
}

/** Invoice that closes in `month0` of `year`. */
export function cycleClosingIn(year: number, month0: number, rule: CardRule): InvoiceCycle {
  const close = clampedDay(year, month0, rule.closingDay);
  const start = clampedDay(year, month0 - 1, rule.closingDay);
  const due = clampedDay(year, rule.dueDay > rule.closingDay ? month0 : month0 + 1, rule.dueDay);
  return { key: due.slice(0, 7), start, close, due };
}

/** Invoice that a purchase made on `day` belongs to. */
export function cycleOf(day: DayKey, rule: CardRule): InvoiceCycle {
  const { year, month } = parseDayKey(day);
  const closeThisMonth = clampedDay(year, month, rule.closingDay);
  return day < closeThisMonth ? cycleClosingIn(year, month, rule) : cycleClosingIn(year, month + 1, rule);
}

/** Moves to the previous/next invoice. */
export function shiftCycle(cycle: InvoiceCycle, delta: number, rule: CardRule): InvoiceCycle {
  const { year, month } = parseDayKey(cycle.close);
  return cycleClosingIn(year, month + delta, rule);
}

export function cardRule(account: Pick<Account, 'closingDay' | 'dueDay'>): CardRule | null {
  if (!account.closingDay || !account.dueDay) return null;
  return { closingDay: account.closingDay, dueDay: account.dueDay };
}

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue' | 'empty';

export interface CardInvoice extends InvoiceCycle {
  /** Purchases minus refunds of the cycle, in the card currency. */
  charges: Minor;
  /** Part of `charges` already covered by payments. */
  paid: Minor;
  status: InvoiceStatus;
  transactionIds: ID[];
}

type CardTx = Pick<Transaction, 'id' | 'kind' | 'date' | 'accountId' | 'accountAmount' | 'toAccountId' | 'toAccountAmount'>;

/** How a record affects the card: `charge` adds to the invoice of its date, `payment` pays debt off. */
export function cardEffect(tx: CardTx, cardId: ID): { charge: Minor; payment: Minor } {
  if (tx.accountId === cardId) {
    switch (tx.kind) {
      case 'expense':
      case 'transfer':
        return { charge: tx.accountAmount, payment: 0 };
      case 'income':
        return { charge: -tx.accountAmount, payment: 0 };
      case 'adjustment':
        return tx.accountAmount >= 0 ? { charge: 0, payment: tx.accountAmount } : { charge: -tx.accountAmount, payment: 0 };
      default:
        return { charge: 0, payment: 0 };
    }
  }
  if (tx.kind === 'transfer' && tx.toAccountId === cardId) return { charge: 0, payment: tx.toAccountAmount };
  return { charge: 0, payment: 0 };
}

export function invoiceStatus(cycle: InvoiceCycle, charges: Minor, paid: Minor, today: DayKey): InvoiceStatus {
  if (charges <= 0) return today < cycle.close ? 'open' : 'empty';
  if (today < cycle.close) return 'open';
  if (paid >= charges) return 'paid';
  return today > cycle.due ? 'overdue' : 'closed';
}

/**
 * Every invoice with activity, oldest first, with payments allocated to the oldest debt first.
 * `initialBalance` is the card's opening balance (negative = debt).
 */
export function buildInvoices(card: { id: ID; initialBalance: Minor } & CardRule, transactions: CardTx[], today: DayKey): CardInvoice[] {
  const byKey = new Map<string, { cycle: InvoiceCycle; charges: Minor; ids: ID[] }>();
  let payments = 0;
  for (const tx of transactions) {
    const { charge, payment } = cardEffect(tx, card.id);
    payments += payment;
    if (charge === 0) continue;
    const cycle = cycleOf(dayKey(tx.date), card);
    const entry = byKey.get(cycle.key) ?? { cycle, charges: 0, ids: [] };
    entry.charges += charge;
    entry.ids.push(tx.id);
    byKey.set(cycle.key, entry);
  }
  let available = payments - Math.max(0, -card.initialBalance);
  return [...byKey.values()]
    .sort((a, b) => (a.cycle.close < b.cycle.close ? -1 : 1))
    .map(({ cycle, charges, ids }) => {
      const paid = charges > 0 ? Math.max(0, Math.min(charges, available)) : 0;
      available -= paid;
      return { ...cycle, charges, paid, status: invoiceStatus(cycle, charges, paid, today), transactionIds: ids };
    });
}

/** Splits a total into `count` installments; the first one carries the remainder. */
export function splitInstallments(total: Minor, count: number): Minor[] {
  const n = Math.max(1, Math.floor(count));
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / n);
  return Array.from({ length: n }, (_, i) => sign * (i === 0 ? abs - base * (n - 1) : base));
}

/** One date per installment, a month apart, keeping the time of day of the purchase. */
export function installmentDates(first: number, count: number): number[] {
  const day = dayKey(first);
  return Array.from({ length: Math.max(1, count) }, (_, i) => withDay(addMonthsClamped(day, i), first));
}
