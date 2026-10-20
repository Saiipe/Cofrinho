// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, toCsv } from './csv';
import { buildDrafts, detectDateOrder, guessMapping, parseImportDate, readImportTable } from './importers';
import { buildXlsx, excelSerialToText, readXlsx, toExcelSerial } from './xlsx';

describe('csv', () => {
  it('round-trips quotes, delimiters and newlines', () => {
    const rows = [
      ['Data', 'Observação', 'Valor'],
      ['2026-10-20', 'Almoço "executivo"; com suco', '-12,50'],
      ['2026-10-21', 'linha\nquebrada', '3'],
    ];
    const text = toCsv(rows, ';');
    expect(detectDelimiter(text)).toBe(';');
    expect(parseCsv(text)).toEqual(rows);
  });

  it('neutralizes formulas but not signed numbers', () => {
    const text = toCsv([['=HYPERLINK("x")', '-12.5', '+3', '@cmd']]);
    expect(parseCsv(text)[0]).toEqual(["'=HYPERLINK(\"x\")", '-12.5', '+3', "'@cmd"]);
  });
});

describe('xlsx', () => {
  it('writes a workbook that it can read back', () => {
    const date = new Date(2026, 9, 20, 14, 30);
    const bytes = buildXlsx([{ name: 'Lançamentos', header: true, rows: [['Data', 'Nome', 'Valor'], [date, 'Café & pão <ok>', { money: 12.5 }], [null, 'Sem data', 3]] }]);
    expect(readXlsx(bytes)).toEqual([
      ['Data', 'Nome', 'Valor'],
      ['2026-10-20 14:30', 'Café & pão <ok>', '12.5'],
      ['', 'Sem data', '3'],
    ]);
  });

  it('converts serial dates', () => {
    expect(excelSerialToText(toExcelSerial(new Date(2024, 1, 29)))).toBe('2024-02-29');
  });
});

describe('importers', () => {
  it('guesses column mapping from Portuguese headers', () => {
    expect(guessMapping(['Data', 'Descrição', 'Categoria', 'Subcategoria', 'Valor (R$)', 'Conta'])).toEqual({ date: 0, note: 1, category: 2, subcategory: 3, amount: 4, account: 5 });
  });

  it('reads dates in several formats', () => {
    expect(detectDateOrder(['03/04/2026', '25/04/2026'], 'mdy')).toBe('dmy');
    expect(detectDateOrder(['04/25/2026'], 'dmy')).toBe('mdy');
    expect(parseImportDate('25/04/2026', 'dmy')).toBe(new Date(2026, 3, 25, 12).getTime());
    expect(parseImportDate('2026-04-25 08:15', 'dmy')).toBe(new Date(2026, 3, 25, 8, 15).getTime());
    expect(parseImportDate('31/02/2026', 'dmy')).toBeNull();
    expect(parseImportDate('46135', 'dmy')).toBe(new Date(2026, 3, 23, 12).getTime());
  });

  it('builds drafts from a bank statement with signed amounts and flags duplicates', () => {
    const csv = 'Data;Histórico;Valor\n20/10/2026;Padaria;-12,50\n21/10/2026;Salário;5.000,00\n22/10/2026;;\n';
    const table = readImportTable('extrato.csv', new TextEncoder().encode(csv));
    const mapping = guessMapping(table.header);
    const existing = [{ date: new Date(2026, 9, 20, 9).getTime(), kind: 'expense' as const, currency: 'BRL', originalAmount: 1250 }];
    const { drafts, skipped } = buildDrafts(table, mapping, { bookCurrency: 'BRL', dateOrder: 'dmy', negativeIsExpense: true, existing });
    expect(skipped).toBe(1);
    expect(drafts.map((d) => [d.kind, d.amount, d.note, d.duplicate])).toEqual([
      ['expense', 1250, 'Padaria', true],
      ['income', 500000, 'Salário', false],
    ]);
  });

  it('decodes Windows-1252 files', () => {
    const bytes = Uint8Array.from([0x44, 0x61, 0x74, 0x61, 0x3b, 0x56, 0x61, 0x6c, 0x6f, 0x72, 0x0a, 0x30, 0x31, 0x2f, 0x30, 0x31, 0x2f, 0x32, 0x30, 0x32, 0x36, 0x3b, 0x31, 0x0a, 0x50, 0xe3, 0x6f, 0x3b, 0x32]);
    expect(readImportTable('a.csv', bytes).rows[1]![0]).toBe('Pão');
  });

  it('recognizes the JSON exported by the app', () => {
    const json = JSON.stringify({ format: 'cofrinho-export', version: 1, transactions: [{ date: '2026-10-20T12:00:00', type: 'income', category: 'Salário', subcategory: '', account: '', note: 'Outubro', originalAmount: 100, originalCurrency: 'USD' }] });
    const table = readImportTable('x.json', new TextEncoder().encode(json));
    const { drafts } = buildDrafts(table, table.mapping!, { bookCurrency: 'BRL', dateOrder: 'ymd', negativeIsExpense: false, existing: [] });
    expect(drafts[0]).toMatchObject({ kind: 'income', amount: 10_000, currency: 'USD', categoryName: 'Salário', note: 'Outubro' });
  });
});
