import { resolveAmounts } from '@/domain/amounts';
import { ACCOUNT_TYPE_STYLE, CATEGORY_COLORS, NOTE_MAX } from '@/domain/defaults';
import { normalizeText } from '@/domain/quickEntry';
import type { Account, Book, Category, ID, Transaction } from '@/domain/types';
import type { Translate } from '@/i18n';
import { categoryLabel } from '@/i18n/labels';
import type { ImportDraft } from '@/io/importers';
import { db, newId } from './db';
import { loadRateTable, lookupRate } from './rates';

const key = (text: string) => normalizeText(text).trim();

interface Resolver {
  category(kind: 'expense' | 'income', name: string, sub: string): ID | null;
  account(name: string): Account | null;
  newCategories: Category[];
  newAccounts: Account[];
}

function createResolver(book: Book, categories: Category[], accounts: Account[], t: Translate): Resolver {
  const now = Date.now();
  const byName = new Map<string, Category>();
  const nameKey = (kind: string, parentId: ID | null, name: string) => `${kind}|${parentId ?? ''}|${key(name)}`;
  for (const c of categories) byName.set(nameKey(c.kind, c.parentId, categoryLabel(c, t)), c);
  const accountsByName = new Map(accounts.map((a) => [key(a.name), a]));
  const newCategories: Category[] = [];
  const newAccounts: Account[] = [];

  const ensureCategory = (kind: 'expense' | 'income', parentId: ID | null, name: string, color: string): Category => {
    const k = nameKey(kind, parentId, name);
    let category = byName.get(k);
    if (!category) {
      category = {
        id: newId(),
        bookId: book.id,
        kind,
        parentId,
        name: name.trim(),
        icon: 'circle-ellipsis',
        color,
        order: 1000 + newCategories.length,
        createdAt: now,
        updatedAt: now,
      };
      byName.set(k, category);
      newCategories.push(category);
    }
    return category;
  };

  return {
    newCategories,
    newAccounts,
    category(kind, name, sub) {
      if (!name.trim()) return null;
      const parent = ensureCategory(kind, null, name, CATEGORY_COLORS[newCategories.length % CATEGORY_COLORS.length]!);
      return sub.trim() ? ensureCategory(kind, parent.id, sub, parent.color).id : parent.id;
    },
    account(name) {
      if (!name.trim()) return null;
      let account = accountsByName.get(key(name));
      if (!account) {
        account = {
          id: newId(),
          bookId: book.id,
          name: name.trim(),
          type: 'debit',
          ...ACCOUNT_TYPE_STYLE.debit,
          currency: book.currency,
          initialBalance: 0,
          excludeFromTotals: false,
          isDefault: false,
          note: '',
          order: accounts.length + newAccounts.length,
          createdAt: now,
          updatedAt: now,
        };
        accountsByName.set(key(name), account);
        newAccounts.push(account);
      }
      return account;
    },
  };
}

/** How many categories and accounts an import would create, for the confirmation screen. */
export async function previewImport(book: Book, drafts: ImportDraft[], t: Translate): Promise<{ newCategories: number; newAccounts: number }> {
  const [categories, accounts] = await Promise.all([db.categories.where('bookId').equals(book.id).toArray(), db.accounts.where('bookId').equals(book.id).toArray()]);
  const resolver = createResolver(book, categories, accounts, t);
  for (const d of drafts) {
    resolver.category(d.kind, d.categoryName, d.subcategoryName);
    resolver.account(d.accountName);
  }
  return { newCategories: resolver.newCategories.length, newAccounts: resolver.newAccounts.length };
}

export interface ImportOutcome {
  created: number;
  /** Drafts dropped because no exchange rate exists for their currency. */
  missingRate: number;
}

export async function applyImport(book: Book, drafts: ImportDraft[], t: Translate): Promise<ImportOutcome> {
  const table = await loadRateTable();
  const rate = (from: string, to: string) => lookupRate(table, from, to);
  return db.transaction('rw', [db.categories, db.accounts, db.transactions], async () => {
    const [categories, accounts] = await Promise.all([db.categories.where('bookId').equals(book.id).toArray(), db.accounts.where('bookId').equals(book.id).toArray()]);
    const resolver = createResolver(book, categories, accounts, t);
    const now = Date.now();
    const created: Transaction[] = [];
    let missingRate = 0;
    for (const draft of drafts) {
      const categoryId = resolver.category(draft.kind, draft.categoryName, draft.subcategoryName);
      let account = resolver.account(draft.accountName);
      let resolved = resolveAmounts(
        { kind: draft.kind, currency: draft.currency, originalAmount: draft.amount, bookCurrency: book.currency, accountCurrency: account?.currency ?? null },
        rate,
      );
      if (!resolved.ok && account) {
        // Keep the record even if the account currency cannot be converted: drop the account link.
        account = null;
        resolved = resolveAmounts({ kind: draft.kind, currency: draft.currency, originalAmount: draft.amount, bookCurrency: book.currency, accountCurrency: null }, rate);
      }
      if (!resolved.ok) {
        missingRate++;
        continue;
      }
      created.push({
        id: newId(),
        bookId: book.id,
        kind: draft.kind,
        date: draft.date,
        ...resolved.value,
        currency: draft.currency,
        originalAmount: draft.amount,
        categoryId,
        accountId: account?.id ?? null,
        toAccountId: null,
        note: draft.note.slice(0, NOTE_MAX),
        photoIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    if (resolver.newCategories.length) await db.categories.bulkAdd(resolver.newCategories);
    if (resolver.newAccounts.length) await db.accounts.bulkAdd(resolver.newAccounts);
    await db.transactions.bulkAdd(created);
    return { created: created.length, missingRate };
  });
}
