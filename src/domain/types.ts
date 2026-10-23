import type { YieldRule } from './investment';

export type ID = string;

/** Calendar day in local time, formatted `YYYY-MM-DD`. Sorts lexicographically. */
export type DayKey = string;

export type TxKind =
  | 'expense'
  | 'income'
  | 'transfer'
  /** Manual balance correction of one account; `accountAmount` is the signed delta. */
  | 'adjustment'
  /** Shared expense inside a split (group) book. */
  | 'split_expense'
  /** Member-to-member repayment inside a split book. */
  | 'split_payment';

export type CategoryKind = 'expense' | 'income';

export type AccountType = 'cash' | 'debit' | 'credit' | 'virtual' | 'investment' | 'receivable' | 'payable';

export type BookType = 'personal' | 'business' | 'project' | 'split';

export type Frequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'every4months'
  | 'semiannual'
  | 'yearly';

export type ScheduleStatus = 'active' | 'paused' | 'completed';

export type SplitMethod = 'equal' | 'amount' | 'shares' | 'percent';

/**
 * Amounts are always integers in the minor unit of their currency
 * (cents for BRL/USD, yen for JPY, fils for BHD…). See `domain/money.ts`.
 */
export type Minor = number;

export interface Book {
  id: ID;
  name: string;
  type: BookType;
  /** Reporting currency of the book; every transaction stores `amount` in it. */
  currency: string;
  color: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** Participant of a split book. Exactly one member per split book has `isMe`. */
export interface Member {
  id: ID;
  bookId: ID;
  name: string;
  isMe: boolean;
  order: number;
  createdAt: number;
}

export interface Account {
  id: ID;
  bookId: ID;
  name: string;
  type: AccountType;
  icon: string;
  color: string;
  currency: string;
  /** Signed opening balance in the account currency (debts are negative). */
  initialBalance: Minor;
  excludeFromTotals: boolean;
  isDefault: boolean;
  note: string;
  /** COMPE code of the bank/institution (see `data/banks`), when the account belongs to one. */
  bankId?: string;
  /** Credit cards: total limit in the account currency. */
  creditLimit?: Minor;
  /** Credit cards: day of the month the invoice closes (1–31, clamped to short months). */
  closingDay?: number;
  /** Credit cards: day of the month the invoice is due (1–31). */
  dueDay?: number;
  /** Investments: how the money yields ("115% do CDI"), used by the projections. */
  yieldRule?: YieldRule;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: ID;
  bookId: ID;
  kind: CategoryKind;
  parentId: ID | null;
  /** User-given name. Empty for untouched built-in categories, which are shown via `builtinKey`. */
  name: string;
  builtinKey?: string;
  icon: string;
  color: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface SplitPart {
  memberId: ID;
  /** What the user typed for this member: minor units, share count or basis points, per method. */
  input: number;
  /** Resolved portion of the total, in book minor units. */
  share: Minor;
}

export interface SplitData {
  method: SplitMethod;
  /** `split_expense`: who paid. `split_payment`: who sent the money. */
  payerId: ID;
  /** `split_payment` only: who received the money. */
  toMemberId?: ID;
  parts: SplitPart[];
}

export interface Transaction {
  id: ID;
  bookId: ID;
  kind: TxKind;
  /** Local date-time as epoch milliseconds. */
  date: number;
  /** Positive amount in the book currency (adjustments: signed delta converted to the book currency). */
  amount: Minor;
  /** Currency the user typed the amount in. */
  currency: string;
  originalAmount: Minor;
  categoryId: ID | null;
  accountId: ID | null;
  /** Amount in the currency of `accountId` (transfers: amount leaving the source account). */
  accountAmount: Minor;
  toAccountId: ID | null;
  /** Transfers: amount arriving in the destination account, in its currency. */
  toAccountAmount: Minor;
  note: string;
  /** Longer free text ("Observações"), shown on the detail screen. */
  details?: string;
  photoIds: ID[];
  tagIds?: ID[];
  split?: SplitData;
  scheduleId?: ID;
  /** One installment of a credit card purchase split over several months. */
  installment?: Installment;
  createdAt: number;
  updatedAt: number;
}

export interface Installment {
  /** Shared by every installment of the same purchase. */
  groupId: ID;
  /** 1-based position. */
  index: number;
  count: number;
}

/** Free label attached to records, across categories ("viagem", "trabalho"…). */
export interface Tag {
  id: ID;
  bookId: ID;
  name: string;
  color: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** Savings goal ("meta"): money put aside step by step until the target is reached. */
export interface Goal {
  id: ID;
  bookId: ID;
  name: string;
  icon: string;
  color: string;
  /** Target in the book currency. */
  target: Minor;
  targetDate: DayKey | null;
  /** Deposits (positive) and withdrawals (negative), oldest first. */
  entries: GoalEntry[];
  archived: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface GoalEntry {
  id: ID;
  date: number;
  amount: Minor;
  note: string;
}

/** Monthly budget. `categoryId: null` is the book's total budget. */
export interface Budget {
  id: ID;
  bookId: ID;
  categoryId: ID | null;
  amount: Minor;
  updatedAt: number;
}

export interface Schedule {
  id: ID;
  bookId: ID;
  name: string;
  kind: 'expense' | 'income' | 'transfer';
  categoryId: ID | null;
  accountId: ID | null;
  toAccountId: ID | null;
  frequency: Frequency;
  startDate: DayKey;
  /** Amount per run, in `currency`. */
  amount: Minor;
  currency: string;
  /** Transfers between accounts of different currencies: amount credited to the destination. */
  toAmount: Minor | null;
  /** Total runs allowed; 0 means unlimited. */
  totalCount: number;
  runCount: number;
  lastRunDate: DayKey | null;
  status: ScheduleStatus;
  note: string;
  tagIds?: ID[];
  createdAt: number;
  updatedAt: number;
}

export interface Reminder {
  id: ID;
  name: string;
  /** `HH:mm`, local time. */
  time: string;
  /** 0 = Sunday … 6 = Saturday. Empty = every day. */
  weekdays: number[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Remembered note text, suggested again for the same category. */
export interface NoteSuggestion {
  id: ID;
  bookId: ID;
  categoryId: ID | null;
  text: string;
  uses: number;
  lastUsedAt: number;
}

export interface Photo {
  id: ID;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

/** Market rate: how many units of `code` one US dollar buys. */
export interface RateRow {
  code: string;
  perUsd: number;
  updatedAt: number;
}

/** User override: 1 `from` = `rate` `to`. */
export interface CustomRate {
  id: string;
  from: string;
  to: string;
  rate: number;
  updatedAt: number;
}
