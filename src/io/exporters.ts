import { dayKey } from '@/domain/dates';
import { formatMoney, toMajor, type MoneyFormat } from '@/domain/money';
import { categoryBreakdown, totals } from '@/domain/stats';
import type { Account, Book, Category, ID, Member, Transaction } from '@/domain/types';
import type { Translate } from '@/i18n';
import { categoryLabel, kindLabel } from '@/i18n/labels';
import { toCsv, type CsvValue } from './csv';
import { buildXlsx, type XlsxCell } from './xlsx';

export type ExportFormat = 'xlsx' | 'csv' | 'json' | 'html';

export const EXPORT_FORMATS: ExportFormat[] = ['xlsx', 'csv', 'json', 'html'];

export interface ExportContext {
  book: Book;
  categories: Map<ID, Category>;
  accounts: Map<ID, Account>;
  members: Map<ID, Member>;
  t: Translate;
  locale: string;
  money: MoneyFormat;
  /** Inclusive day range, for titles. */
  range: { start: string; end: string };
}

export interface ExportRow {
  date: Date;
  tx: Transaction;
  kind: string;
  category: string;
  subcategory: string;
  member: string;
  note: string;
  /** Book currency, major units; adjustments keep their sign. */
  amount: number;
  originalAmount: number;
  account: string;
  toAccount: string;
  photos: number;
}

function memberColumn(tx: Transaction, members: Map<ID, Member>): string {
  if (!tx.split) return '';
  const name = (id: ID | undefined) => (id ? (members.get(id)?.name ?? '?') : '?');
  return tx.kind === 'split_payment' ? `${name(tx.split.payerId)} → ${name(tx.split.toMemberId)}` : name(tx.split.payerId);
}

export function buildExportRows(transactions: Transaction[], ctx: ExportContext): ExportRow[] {
  return [...transactions]
    .sort((a, b) => a.date - b.date)
    .map((tx) => {
      const category = tx.categoryId ? ctx.categories.get(tx.categoryId) : undefined;
      const parent = category?.parentId ? ctx.categories.get(category.parentId) : undefined;
      const accountName = (id: ID | null) => (id ? (ctx.accounts.get(id)?.name ?? ctx.t('common.unknownAccount')) : '');
      return {
        date: new Date(tx.date),
        tx,
        kind: kindLabel(tx.kind, ctx.t),
        category: category ? categoryLabel(parent ?? category, ctx.t) : '',
        subcategory: parent && category ? categoryLabel(category, ctx.t) : '',
        member: memberColumn(tx, ctx.members),
        note: tx.note,
        amount: toMajor(tx.amount, ctx.book.currency),
        originalAmount: toMajor(tx.originalAmount, tx.currency),
        account: accountName(tx.accountId),
        toAccount: accountName(tx.toAccountId),
        photos: tx.photoIds.length,
      };
    });
}

function headers(t: Translate): string[] {
  return [
    t('export.col.date'),
    t('export.col.kind'),
    t('export.col.category'),
    t('export.col.subcategory'),
    t('export.col.member'),
    t('export.col.note'),
    t('export.col.amount'),
    t('export.col.currency'),
    t('export.col.originalAmount'),
    t('export.col.originalCurrency'),
    t('export.col.account'),
    t('export.col.toAccount'),
    t('export.col.photos'),
  ];
}

export function exportXlsx(rows: ExportRow[], ctx: ExportContext): Uint8Array {
  const data: XlsxCell[][] = [
    headers(ctx.t),
    ...rows.map((r) => [
      r.date,
      r.kind,
      r.category,
      r.subcategory,
      r.member,
      r.note,
      { money: r.amount },
      ctx.book.currency,
      { money: r.originalAmount },
      r.tx.currency,
      r.account,
      r.toAccount,
      r.photos || null,
    ]),
  ];
  return buildXlsx([{ name: ctx.book.name, rows: data, header: true, widths: [17, 16, 20, 20, 14, 32, 13, 8, 13, 8, 18, 18, 7] }]);
}

function plainDate(date: Date): string {
  return `${dayKey(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Locale-friendly CSV: semicolons and decimal commas where the language uses a decimal comma. */
export function exportCsv(rows: ExportRow[], ctx: ExportContext, decimalSeparator: string): string {
  const delimiter = decimalSeparator === ',' ? ';' : ',';
  const number = (n: number) => (decimalSeparator === ',' ? String(n).replace('.', ',') : String(n));
  const data: CsvValue[][] = [
    headers(ctx.t),
    ...rows.map((r) => [
      plainDate(r.date),
      r.kind,
      r.category,
      r.subcategory,
      r.member,
      r.note,
      number(r.amount),
      ctx.book.currency,
      number(r.originalAmount),
      r.tx.currency,
      r.account,
      r.toAccount,
      r.photos || '',
    ]),
  ];
  return toCsv(data, delimiter);
}

export const EXPORT_JSON_FORMAT = 'cofrinho-export';

export function exportJson(rows: ExportRow[], ctx: ExportContext): string {
  const isoLocal = (d: Date) => `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  return JSON.stringify(
    {
      format: EXPORT_JSON_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      book: { name: ctx.book.name, type: ctx.book.type, currency: ctx.book.currency },
      range: ctx.range,
      transactions: rows.map((r) => ({
        date: isoLocal(r.date),
        type: r.tx.kind,
        category: r.category,
        subcategory: r.subcategory,
        member: r.member,
        note: r.note,
        amount: r.amount,
        currency: ctx.book.currency,
        originalAmount: r.originalAmount,
        originalCurrency: r.tx.currency,
        account: r.account,
        toAccount: r.toAccount,
      })),
    },
    null,
    2,
  );
}

function escapeHtml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Self-contained printable report (no scripts, no external resources). */
export function exportHtml(rows: ExportRow[], ctx: ExportContext): string {
  const { t } = ctx;
  const money = (minor: number) => escapeHtml(formatMoney(minor, ctx.book.currency, ctx.money));
  const txs = rows.map((r) => r.tx);
  const sum = totals(txs);
  const dateFormat = new Intl.DateTimeFormat(ctx.locale, { dateStyle: 'medium' });
  const dateTimeFormat = new Intl.DateTimeFormat(ctx.locale, { dateStyle: 'short', timeStyle: 'short' });
  const refs = new Map([...ctx.categories].map(([id, c]) => [id, { id, parentId: c.parentId }]));
  const breakdown = categoryBreakdown(txs, 'expense', refs).slice(0, 12);
  const title = t('export.reportTitle', {
    book: ctx.book.name,
    start: dateFormat.format(new Date(`${ctx.range.start}T12:00:00`)),
    end: dateFormat.format(new Date(`${ctx.range.end}T12:00:00`)),
  });
  const cell = (text: string, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${escapeHtml(text)}</td>`;
  const rowsHtml = rows
    .map((r) => {
      const sign = r.tx.kind === 'expense' || r.tx.kind === 'split_expense' ? 'exp' : r.tx.kind === 'income' ? 'inc' : '';
      return `<tr>${cell(dateTimeFormat.format(r.date))}${cell(r.kind)}${cell([r.category, r.subcategory].filter(Boolean).join(' › '))}${cell(r.note)}${cell(
        [r.account, r.toAccount].filter(Boolean).join(' → ') || r.member,
      )}<td class="num ${sign}">${money(r.tx.amount)}</td></tr>`;
    })
    .join('');
  const breakdownHtml = breakdown
    .map((s) => {
      const category = s.categoryId ? ctx.categories.get(s.categoryId) : undefined;
      return `<tr>${cell(categoryLabel(category, t))}<td class="num">${money(s.amount)}</td><td class="num">${(s.ratio * 100).toFixed(1)}%</td></tr>`;
    })
    .join('');
  return `<!doctype html>
<html lang="${escapeHtml(ctx.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--bg:#fff;--exp:#e11d48;--inc:#059669}
@media (prefers-color-scheme:dark){:root{--fg:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--bg:#0b1120;--exp:#fb7185;--inc:#34d399}}
body{font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--fg);background:var(--bg);margin:0;padding:24px 16px;max-width:960px;margin-inline:auto}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}.muted{color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:16px}
.card{border:1px solid var(--line);border-radius:12px;padding:12px}.card b{display:block;font-size:18px;margin-top:4px}
table{width:100%;border-collapse:collapse}td,th{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600}.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.exp{color:var(--exp)}.inc{color:var(--inc)}.wrap{overflow-x:auto}
</style></head><body>
<h1>${escapeHtml(title)}</h1><div class="muted">${escapeHtml(t('export.generated', { date: dateTimeFormat.format(new Date()) }))}</div>
<div class="cards"><div class="card">${escapeHtml(t('common.income'))}<b class="inc">${money(sum.income)}</b></div><div class="card">${escapeHtml(t('common.expenses'))}<b class="exp">${money(sum.expense)}</b></div><div class="card">${escapeHtml(t('common.balance'))}<b>${money(sum.balance)}</b></div></div>
${breakdown.length ? `<h2>${escapeHtml(t('charts.ranking'))}</h2><div class="wrap"><table><tbody>${breakdownHtml}</tbody></table></div>` : ''}
<h2>${escapeHtml(t('common.records', { count: rows.length }))}</h2>
<div class="wrap"><table><thead><tr><th>${escapeHtml(t('export.col.date'))}</th><th>${escapeHtml(t('export.col.kind'))}</th><th>${escapeHtml(t('export.col.category'))}</th><th>${escapeHtml(
    t('export.col.note'),
  )}</th><th>${escapeHtml(t('export.col.account'))}</th><th class="num">${escapeHtml(t('export.col.amount'))}</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
</body></html>`;
}
