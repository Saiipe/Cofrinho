import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/**
 * Minimal Office Open XML spreadsheet support: enough to export reports and to read the
 * first sheet of statements exported by banks and other apps.
 */

export type XlsxCell = string | number | Date | { money: number } | null | undefined;

export interface XlsxSheet {
  name: string;
  rows: XlsxCell[][];
  /** Column widths in characters. */
  widths?: number[];
  /** Bold, frozen first row. */
  header?: boolean;
}

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

export function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Excel 1900-system serial for a local date-time. */
export function toExcelSerial(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
  return utc / 86_400_000 + 25_569;
}

const STYLE = { default: 0, date: 1, money: 2, header: 3 } as const;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${MAIN_NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function cellXml(cell: XlsxCell, ref: string, header: boolean): string {
  if (cell === null || cell === undefined || cell === '') return '';
  if (typeof cell === 'string') {
    const style = header ? ` s="${STYLE.header}"` : '';
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
  }
  if (cell instanceof Date) return `<c r="${ref}" s="${STYLE.date}"><v>${toExcelSerial(cell)}</v></c>`;
  if (typeof cell === 'number') return Number.isFinite(cell) ? `<c r="${ref}"><v>${cell}</v></c>` : '';
  return Number.isFinite(cell.money) ? `<c r="${ref}" s="${STYLE.money}"><v>${cell.money}</v></c>` : '';
}

function sheetXml(sheet: XlsxSheet): string {
  const rows = sheet.rows
    .map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => cellXml(cell, `${columnName(c)}${r + 1}`, !!sheet.header && r === 0)).join('')}</row>`)
    .join('');
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const pane = sheet.header ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${MAIN_NS}">${pane}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

function safeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const sheetEntries = sheets.map((sheet, i) => ({ path: `xl/worksheets/sheet${i + 1}.xml`, xml: sheetXml(sheet), name: safeSheetName(sheet.name, i) }));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetEntries
        .map((s) => `<Override PartName="/${s.path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${sheetEntries
        .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetEntries
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${sheetEntries.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES_XML),
  };
  for (const entry of sheetEntries) files[entry.path] = strToU8(entry.xml);
  return zipSync(files, { level: 6 });
}

// ---------- Reading ----------

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

function isDateFormatCode(code: string): boolean {
  const stripped = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
  return /[dmyhs]/i.test(stripped) && !/^general$/i.test(stripped.trim());
}

function texts(element: Element, tag: string): string {
  return Array.from(element.getElementsByTagName(tag))
    .filter((t) => t.parentElement?.tagName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('');
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Excel serial → "YYYY-MM-DD HH:mm" (serials carry no time zone). */
export function excelSerialToText(serial: number): string {
  const d = new Date(Math.round((serial - 25_569) * 86_400_000));
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = d.getUTCHours() || d.getUTCMinutes() ? ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : '';
  return date + time;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? 'A';
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

/** Reads the first worksheet as text rows; date cells become ISO-like strings. */
export function readXlsx(data: Uint8Array): string[][] {
  const files = unzipSync(data, { filter: (file) => file.name.startsWith('xl/') });
  const parser = new DOMParser();
  const xml = (path: string): Document | null => {
    const bytes = files[path];
    return bytes ? parser.parseFromString(strFromU8(bytes), 'application/xml') : null;
  };

  const workbook = xml('xl/workbook.xml');
  const rels = xml('xl/_rels/workbook.xml.rels');
  const firstSheet = workbook?.getElementsByTagName('sheet')[0];
  const relId = firstSheet?.getAttribute('r:id') ?? firstSheet?.getAttributeNS(REL_NS, 'id');
  let target = 'worksheets/sheet1.xml';
  if (rels && relId) {
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === relId);
    if (rel?.getAttribute('Target')) target = rel.getAttribute('Target')!;
  }
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  const sheet = xml(sheetPath);
  if (!sheet) throw new Error('Worksheet not found');

  const shared = Array.from(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? []).map((si) => texts(si, 't'));

  const styles = xml('xl/styles.xml');
  const customFormats = new Map<number, string>();
  for (const fmt of Array.from(styles?.getElementsByTagName('numFmt') ?? [])) {
    customFormats.set(Number(fmt.getAttribute('numFmtId')), fmt.getAttribute('formatCode') ?? '');
  }
  const cellXfs = styles?.getElementsByTagName('cellXfs')[0];
  const dateStyles = Array.from(cellXfs?.getElementsByTagName('xf') ?? []).map((xf) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    return BUILTIN_DATE_FORMATS.has(id) || (customFormats.has(id) && isDateFormatCode(customFormats.get(id)!));
  });

  const rows: string[][] = [];
  for (const rowEl of Array.from(sheet.getElementsByTagName('row'))) {
    const row: string[] = [];
    let nextColumn = 0;
    for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      const col = ref ? columnIndex(ref) : nextColumn;
      nextColumn = col + 1;
      const type = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let value: string;
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = texts(c, 't');
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'str') value = v;
      else if (type === 'e' || v === '') value = '';
      else value = dateStyles[Number(c.getAttribute('s') ?? 0)] ? excelSerialToText(Number(v)) : String(Number(v));
      while (row.length < col) row.push('');
      row[col] = value;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}
