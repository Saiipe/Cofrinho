import { dayKey, daysInMonth } from '@/domain/dates';
import { parseLocaleNumber, toMinor } from '@/domain/money';
import { normalizeText } from '@/domain/quickEntry';
import type { Minor, Transaction } from '@/domain/types';
import { parseCsv } from './csv';
import { EXPORT_JSON_FORMAT } from './exporters';
import { readXlsx } from './xlsx';

export const IMPORT_MAX_MB = 10;

export type ImportField = 'date' | 'amount' | 'kind' | 'category' | 'subcategory' | 'account' | 'note' | 'currency';
export const IMPORT_FIELDS: ImportField[] = ['date', 'amount', 'kind', 'category', 'subcategory', 'account', 'note', 'currency'];

export type ImportMapping = Partial<Record<ImportField, number>>;

export interface ImportTable {
  header: string[];
  rows: string[][];
  /** Set when the file is a known format whose columns need no guessing. */
  mapping?: ImportMapping;
}

export class ImportError extends Error {
  constructor(public readonly reason: 'empty' | 'invalid' | 'backup') {
    super(reason);
  }
}

/** Bank exports in Brazil are often Windows-1252; fall back to it when the bytes are not valid UTF-8. */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function tableFromRows(rows: string[][]): ImportTable {
  if (rows.length < 2) throw new ImportError('empty');
  const width = Math.max(...rows.map((r) => r.length));
  const padRow = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim());
  const header = padRow(rows[0]!).map((h, i) => h || `#${i + 1}`);
  return { header, rows: rows.slice(1).map(padRow) };
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function tableFromJson(data: unknown): ImportTable {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    if (record.format === 'cofrinho-backup') throw new ImportError('backup');
    if (record.format === EXPORT_JSON_FORMAT && Array.isArray(record.transactions)) {
      const keys = ['date', 'type', 'category', 'subcategory', 'account', 'note', 'originalAmount', 'originalCurrency'];
      const rows = (record.transactions as Record<string, unknown>[]).map((t) => keys.map((k) => stringify(t?.[k])));
      if (!rows.length) throw new ImportError('empty');
      return { header: keys, rows, mapping: { date: 0, kind: 1, category: 2, subcategory: 3, account: 4, note: 5, amount: 6, currency: 7 } };
    }
  }
  const list = Array.isArray(data)
    ? data
    : Object.values((data ?? {}) as Record<string, unknown>).find((v): v is unknown[] => Array.isArray(v) && v.some((x) => x && typeof x === 'object'));
  if (!list?.length) throw new ImportError('empty');
  const objects = list.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x));
  const header = [...new Set(objects.slice(0, 500).flatMap((o) => Object.keys(o)))];
  if (!header.length) throw new ImportError('invalid');
  return { header, rows: objects.map((o) => header.map((k) => stringify(o[k]).trim())) };
}

export function readImportTable(fileName: string, bytes: Uint8Array): ImportTable {
  const lower = fileName.toLowerCase();
  try {
    if (lower.endsWith('.xlsx') || (bytes[0] === 0x50 && bytes[1] === 0x4b)) return tableFromRows(readXlsx(bytes));
    const text = decodeText(bytes);
    if (lower.endsWith('.json') || /^\s*[[{]/.test(text)) return tableFromJson(JSON.parse(text));
    return tableFromRows(parseCsv(text));
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError('invalid');
  }
}

const ALIASES: Record<ImportField, string[]> = {
  date: ['data', 'date', 'fecha', 'dia', 'data lancamento', 'data do lancamento', 'data da compra', 'data da transacao', 'transaction date', 'posted date', 'datetime', 'data/hora', 'data e hora', 'quando'],
  amount: ['valor', 'amount', 'montante', 'importe', 'quantia', 'value', 'valor r$', 'valor (r$)', 'valor brl', 'preco', 'price', 'total', 'monto'],
  kind: ['tipo', 'type', 'kind', 'natureza', 'entrada/saida', 'credito/debito', 'c/d', 'd/c', 'movimento', 'operacao'],
  category: ['categoria', 'category', 'grupo', 'categoria principal', 'categoria pai'],
  subcategory: ['subcategoria', 'subcategory', 'sub category', 'sub-categoria', 'sub categoria'],
  account: ['conta', 'account', 'cuenta', 'carteira', 'banco', 'cartao', 'wallet', 'conta/cartao'],
  note: ['observacao', 'observacoes', 'descricao', 'description', 'note', 'notes', 'memo', 'historico', 'nota', 'detalhes', 'descripcion', 'titulo', 'title', 'estabelecimento', 'payee', 'lancamento'],
  currency: ['moeda', 'currency', 'divisa', 'moneda'],
};

function normalizeHeader(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9/$ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Maps file columns to fields by header name: exact aliases first, then partial matches. */
export function guessMapping(header: string[]): ImportMapping {
  const names = header.map(normalizeHeader);
  const mapping: ImportMapping = {};
  const used = new Set<number>();
  const assign = (field: ImportField, index: number) => {
    mapping[field] = index;
    used.add(index);
  };
  for (const field of IMPORT_FIELDS) {
    const index = names.findIndex((n, i) => !used.has(i) && ALIASES[field].includes(n));
    if (index >= 0) assign(field, index);
  }
  // Subcategory first so "subcategoria" is not taken by the category field.
  const partialOrder: ImportField[] = ['subcategory', 'date', 'amount', 'kind', 'category', 'account', 'note', 'currency'];
  for (const field of partialOrder) {
    if (mapping[field] !== undefined) continue;
    const index = names.findIndex((n, i) => !used.has(i) && ALIASES[field].some((a) => a.length >= 4 && n.includes(a)));
    if (index >= 0) assign(field, index);
  }
  return mapping;
}

export type DateOrder = 'dmy' | 'mdy' | 'ymd';

const DATE_RE = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;

/** Infers day/month order from values that can only be read one way (e.g. 25/03). */
export function detectDateOrder(values: string[], fallback: DateOrder): DateOrder {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const value of values) {
    const m = DATE_RE.exec(value.trim());
    if (!m) continue;
    if (m[1]!.length === 4) return 'ymd';
    if (Number(m[1]) > 12) firstOver12 = true;
    if (Number(m[2]) > 12) secondOver12 = true;
  }
  if (firstOver12 && !secondOver12) return 'dmy';
  if (secondOver12 && !firstOver12) return 'mdy';
  return fallback;
}

/** Local timestamp for a date cell; dates without time land at noon. */
export function parseImportDate(value: string, order: DateOrder): number | null {
  const text = value.trim();
  if (!text) return null;
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20_000 && serial < 80_000) {
      const d = new Date(Math.round((serial - 25_569) * 86_400_000));
      const hasTime = serial % 1 !== 0;
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hasTime ? d.getUTCHours() : 12, hasTime ? d.getUTCMinutes() : 0).getTime();
    }
  }
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const [year, month, day] = m[1]!.length === 4 || order === 'ymd' ? [m[1], m[2], m[3]] : order === 'dmy' ? [m[3], m[2], m[1]] : [m[3], m[1], m[2]];
  let y = Number(year);
  if (y < 100) y += 2000;
  const mo = Number(month) - 1;
  const d = Number(day);
  if (mo < 0 || mo > 11 || d < 1 || d > daysInMonth(y, mo)) return null;
  const hours = m[4] ? Number(m[4]) : 12;
  const minutes = m[5] ? Number(m[5]) : 0;
  const seconds = m[6] ? Number(m[6]) : 0;
  return new Date(y, mo, d, hours, minutes, seconds).getTime();
}

/** Decimal separator used by an amount column, judged by values ending in 1–2 decimals. */
export function detectDecimalSeparator(values: string[]): ',' | '.' | undefined {
  let comma = 0;
  let dot = 0;
  for (const value of values) {
    const digits = value.replace(/[^\d.,]/g, '');
    if (/,\d{1,2}$/.test(digits)) comma++;
    else if (/\.\d{1,2}$/.test(digits)) dot++;
  }
  if (comma > dot) return ',';
  if (dot > comma) return '.';
  return undefined;
}

const EXPENSE_WORDS = ['despesa', 'despesas', 'expense', 'expenses', 'gasto', 'gastos', 'saida', 'debito', 'debit', 'compra', 'egreso', 'split_expense'];
const INCOME_WORDS = ['receita', 'receitas', 'income', 'entrada', 'credito', 'credit', 'deposito', 'recebimento', 'ingreso'];
const SKIPPED_WORDS = ['transfer', 'transferencia', 'adjustment', 'ajuste', 'split_payment'];

export function parseKind(value: string): 'expense' | 'income' | 'skip' | null {
  const n = normalizeText(value).trim();
  if (!n) return null;
  if (n === 'd' || n === '-') return 'expense';
  if (n === 'c' || n === '+') return 'income';
  if (SKIPPED_WORDS.some((w) => n.startsWith(w))) return 'skip';
  if (EXPENSE_WORDS.some((w) => n.startsWith(w))) return 'expense';
  if (INCOME_WORDS.some((w) => n.startsWith(w))) return 'income';
  return null;
}

export interface ImportDraft {
  row: number;
  date: number;
  kind: 'expense' | 'income';
  /** Minor units in `currency`. */
  amount: Minor;
  currency: string;
  categoryName: string;
  subcategoryName: string;
  accountName: string;
  note: string;
  duplicate: boolean;
}

export interface DraftOptions {
  bookCurrency: string;
  dateOrder: DateOrder;
  /** Without a type column: negative → expense, positive → income. Off: everything is an expense. */
  negativeIsExpense: boolean;
  existing: Pick<Transaction, 'date' | 'kind' | 'currency' | 'originalAmount'>[];
}

function duplicateKey(date: number, kind: string, currency: string, amount: Minor): string {
  return `${dayKey(date)}|${kind}|${currency}|${amount}`;
}

export function hasNegativeAmounts(table: ImportTable, mapping: ImportMapping): boolean {
  const col = mapping.amount;
  if (col === undefined) return false;
  return table.rows.some((r) => {
    const value = parseLocaleNumber(r[col] ?? '');
    return value !== null && value < 0;
  });
}

export function buildDrafts(table: ImportTable, mapping: ImportMapping, options: DraftOptions): { drafts: ImportDraft[]; skipped: number } {
  const existing = new Set(options.existing.map((tx) => duplicateKey(tx.date, tx.kind, tx.currency, tx.originalAmount)));
  const amountCol = mapping.amount;
  const decimal = amountCol === undefined ? undefined : detectDecimalSeparator(table.rows.map((r) => r[amountCol] ?? ''));
  const cell = (row: string[], field: ImportField) => (mapping[field] === undefined ? '' : (row[mapping[field]!] ?? '').trim());
  const drafts: ImportDraft[] = [];
  let skipped = 0;

  table.rows.forEach((row, index) => {
    const date = parseImportDate(cell(row, 'date'), options.dateOrder);
    const value = parseLocaleNumber(cell(row, 'amount'), decimal);
    if (date === null || value === null || value === 0) {
      skipped++;
      return;
    }
    let kind: 'expense' | 'income';
    const declared = mapping.kind === undefined ? null : parseKind(cell(row, 'kind'));
    if (declared === 'skip') {
      skipped++;
      return;
    }
    if (declared) kind = declared;
    else if (options.negativeIsExpense) kind = value < 0 ? 'expense' : 'income';
    else kind = 'expense';

    const code = cell(row, 'currency').toUpperCase();
    const currency = /^[A-Z]{3}$/.test(code) ? code : options.bookCurrency;
    const amount = toMinor(Math.abs(value), currency);
    drafts.push({
      row: index + 2,
      date,
      kind,
      amount,
      currency,
      categoryName: cell(row, 'category'),
      subcategoryName: cell(row, 'subcategory'),
      accountName: cell(row, 'account'),
      note: cell(row, 'note').replace(/\s+/g, ' '),
      duplicate: existing.has(duplicateKey(date, kind, currency, amount)),
    });
  });
  return { drafts, skipped };
}
