import { addDays, daysInMonth, makeDayKey, parseDayKey, weekday } from './dates';
import { DEFAULT_CATEGORIES, INCOME_HINTS, NOTE_MAX } from './defaults';
import { parseLocaleNumber } from './money';
import type { CategoryKind, DayKey, ID } from './types';

/**
 * Offline natural-language entry: "almoço 32,50 ontem nubank" → expense of 32.50 yesterday,
 * category Restaurants, account Nubank, note "Almoço". Works on typed or dictated text.
 */

export interface QuickEntryCategory {
  id: ID;
  kind: CategoryKind;
  parentId: ID | null;
  /** Name as displayed to the user (custom or translated built-in). */
  name: string;
  builtinKey?: string;
}

export interface QuickEntryAccount {
  id: ID;
  name: string;
}

export interface QuickEntryDraft {
  kind: CategoryKind;
  /** Major units, or null when no number was found. */
  amount: number | null;
  date: DayKey;
  categoryId: ID | null;
  accountId: ID | null;
  note: string;
}

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const KEYWORDS = new Map<string, string[]>();
for (const category of DEFAULT_CATEGORIES) {
  KEYWORDS.set(category.key, category.keywords);
  for (const child of category.children ?? []) KEYWORDS.set(child.key, child.keywords);
}

const RELATIVE_DAYS: [string, number][] = [
  ['anteontem', -2],
  ['anteayer', -2],
  ['ontem', -1],
  ['yesterday', -1],
  ['ayer', -1],
  ['hoje', 0],
  ['today', 0],
  ['hoy', 0],
  ['amanha', 1],
  ['tomorrow', 1],
  ['manana', 1],
];

const WEEKDAY_NAMES: [string, number][] = [
  ['domingo', 0],
  ['sunday', 0],
  ['segunda', 1],
  ['segunda-feira', 1],
  ['monday', 1],
  ['lunes', 1],
  ['terca', 2],
  ['terca-feira', 2],
  ['tuesday', 2],
  ['martes', 2],
  ['quarta', 3],
  ['quarta-feira', 3],
  ['wednesday', 3],
  ['miercoles', 3],
  ['quinta', 4],
  ['quinta-feira', 4],
  ['thursday', 4],
  ['jueves', 4],
  ['sexta', 5],
  ['sexta-feira', 5],
  ['friday', 5],
  ['viernes', 5],
  ['sabado', 6],
  ['saturday', 6],
];

/** Short words that only glue a date/account to the sentence and are dropped with it. */
const GLUE_WORDS = new Set(['na', 'no', 'em', 'de', 'do', 'da', 'dia', 'on', 'last', 'el', 'la', 'com', 'pelo', 'pela', 'via', 'with', 'by', 'en', 'con']);
const CURRENCY_WORDS = new Set(['reais', 'real', 'r$', 'us$', '$', '€', '£', 'dolares', 'dolar', 'dollars', 'dollar', 'bucks', 'euros', 'euro', 'pesos', 'conto', 'contos', 'pila', 'pilas']);

interface Token {
  original: string;
  norm: string;
  used: boolean;
}

function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((original) => ({ original, norm: normalizeText(original).replace(/^[^\p{L}\p{N}$€£]+|[^\p{L}\p{N}%]+$/gu, ''), used: false }));
}

function markGlueBefore(tokens: Token[], index: number) {
  const previous = tokens[index - 1];
  if (previous && !previous.used && GLUE_WORDS.has(previous.norm)) previous.used = true;
}

function resolveDayOfMonth(day: number, today: DayKey): DayKey | null {
  const { year, month, day: todayDay } = parseDayKey(today);
  if (day < 1 || day > 31) return null;
  if (day <= todayDay) return makeDayKey(year, month, day);
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = (month + 11) % 12;
  return day <= daysInMonth(prevYear, prevMonth) ? makeDayKey(prevYear, prevMonth, day) : null;
}

function parseDate(tokens: Token[], today: DayKey): DayKey | null {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.used) continue;
    const relative = RELATIVE_DAYS.find(([word]) => word === token.norm);
    if (relative) {
      token.used = true;
      return addDays(today, relative[1]);
    }
    const named = WEEKDAY_NAMES.find(([word]) => word === token.norm);
    if (named) {
      token.used = true;
      markGlueBefore(tokens, i);
      const back = (weekday(today) - named[1] + 7) % 7;
      return addDays(today, -back);
    }
    const slash = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(token.norm);
    if (slash) {
      const day = Number(slash[1]);
      const month0 = Number(slash[2]) - 1;
      const { year: currentYear } = parseDayKey(today);
      let year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : currentYear;
      if (month0 < 0 || month0 > 11 || day < 1 || day > daysInMonth(year, month0)) continue;
      let key = makeDayKey(year, month0, day);
      if (!slash[3] && key > today) {
        year -= 1;
        key = makeDayKey(year, month0, Math.min(day, daysInMonth(year, month0)));
      }
      token.used = true;
      markGlueBefore(tokens, i);
      return key;
    }
    if ((token.norm === 'dia' || token.norm === 'day') && /^\d{1,2}$/.test(tokens[i + 1]?.norm ?? '')) {
      const key = resolveDayOfMonth(Number(tokens[i + 1]!.norm), today);
      if (key) {
        token.used = true;
        tokens[i + 1]!.used = true;
        markGlueBefore(tokens, i);
        return key;
      }
    }
  }
  return null;
}

function parseAmount(tokens: Token[]): number | null {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.used) continue;
    const match = /^(r\$|us\$|\$|€|£)?(\d[\d.,]*)(k|mil)?$/.exec(token.norm);
    if (!match) continue;
    let value = parseLocaleNumber(match[2]!);
    if (value === null) continue;
    token.used = true;
    const next = tokens[i + 1];
    if (match[3] || next?.norm === 'mil' || next?.norm === 'k') {
      value *= 1000;
      if (!match[3] && next) next.used = true;
    }
    const previous = tokens[i - 1];
    if (previous && !previous.used && CURRENCY_WORDS.has(previous.norm)) previous.used = true;
    const after = tokens[i + 1];
    if (after && !after.used && CURRENCY_WORDS.has(after.norm)) after.used = true;
    return Math.abs(value);
  }
  return null;
}

function containsPhrase(haystack: string, phrase: string): boolean {
  return phrase.length > 0 && ` ${haystack} `.includes(` ${phrase} `);
}

function parseAccount(tokens: Token[], accounts: QuickEntryAccount[]): ID | null {
  let best: { id: ID; words: number } | null = null;
  for (const account of accounts) {
    const words = normalizeText(account.name).split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    for (let i = 0; i + words.length <= tokens.length; i++) {
      const slice = tokens.slice(i, i + words.length);
      if (slice.some((t) => t.used) || slice.map((t) => t.norm).join(' ') !== words.join(' ')) continue;
      if (!best || words.length > best.words) best = { id: account.id, words: words.length };
    }
  }
  if (!best) return null;
  const words = normalizeText(accounts.find((a) => a.id === best.id)!.name).split(/\s+/).filter(Boolean);
  for (let i = 0; i + words.length <= tokens.length; i++) {
    const slice = tokens.slice(i, i + words.length);
    if (!slice.some((t) => t.used) && slice.map((t) => t.norm).join(' ') === words.join(' ')) {
      slice.forEach((t) => (t.used = true));
      markGlueBefore(tokens, i);
      break;
    }
  }
  return best.id;
}

function scoreCategory(category: QuickEntryCategory, text: string): number {
  let score = 0;
  const name = normalizeText(category.name).trim();
  if (containsPhrase(text, name)) score = Math.max(score, name.length + 2);
  for (const keyword of category.builtinKey ? (KEYWORDS.get(category.builtinKey) ?? []) : []) {
    if (containsPhrase(text, keyword)) score = Math.max(score, keyword.length);
  }
  // Prefer the specific subcategory over its parent on equal evidence.
  return score > 0 && category.parentId ? score + 0.5 : score;
}

export function parseQuickEntry(
  text: string,
  context: { categories: QuickEntryCategory[]; accounts: QuickEntryAccount[]; today: DayKey },
): QuickEntryDraft {
  const tokens = tokenize(text);
  const date = parseDate(tokens, context.today) ?? context.today;
  const amount = parseAmount(tokens);
  const accountId = parseAccount(tokens, context.accounts);

  let explicitKind: CategoryKind | null = null;
  const joinedAll = tokens.map((t) => t.norm).join(' ');
  for (const hint of INCOME_HINTS) {
    if (!containsPhrase(joinedAll, hint)) continue;
    explicitKind = 'income';
    const words = hint.split(' ');
    if (words.length === 1) tokens.filter((t) => t.norm === hint).forEach((t) => (t.used = true));
  }

  const remaining = tokens.filter((t) => !t.used).map((t) => t.norm).join(' ');
  let bestCategory: { category: QuickEntryCategory; score: number } | null = null;
  for (const category of context.categories) {
    if (explicitKind && category.kind !== explicitKind) continue;
    const score = scoreCategory(category, remaining);
    if (score > 0 && (!bestCategory || score > bestCategory.score)) bestCategory = { category, score };
  }

  const kind: CategoryKind = explicitKind ?? bestCategory?.category.kind ?? 'expense';
  const noteWords = tokens.filter((t) => !t.used).map((t) => t.original);
  while (noteWords.length && GLUE_WORDS.has(normalizeText(noteWords[0]!))) noteWords.shift();
  let note = noteWords.join(' ').replace(/[,;:.\s]+$/, '').trim();
  if (note) note = note.charAt(0).toLocaleUpperCase() + note.slice(1);

  return {
    kind,
    amount,
    date,
    categoryId: bestCategory?.category.id ?? null,
    accountId,
    note: note.slice(0, NOTE_MAX),
  };
}
