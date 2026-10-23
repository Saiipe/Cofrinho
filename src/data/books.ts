import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, DEFAULT_TAGS } from '@/domain/defaults';
import type { Account, Book, BookType, Category, ID, Member, Tag } from '@/domain/types';
import { createTranslator, type Language, type MessageKey } from '@/i18n';
import { BOOK_TABLES, db, newId } from './db';
import { getSettings, updateSettings } from './settings';

export function defaultCategories(bookId: ID, now = Date.now()): Category[] {
  const rows: Category[] = [];
  let order = 0;
  for (const def of DEFAULT_CATEGORIES) {
    const parentId = newId();
    rows.push({ id: parentId, bookId, kind: def.kind, parentId: null, name: '', builtinKey: def.key, icon: def.icon, color: def.color, order: order++, createdAt: now, updatedAt: now });
    def.children?.forEach((child, index) => {
      rows.push({ id: newId(), bookId, kind: def.kind, parentId, name: '', builtinKey: child.key, icon: child.icon, color: def.color, order: index, createdAt: now, updatedAt: now });
    });
  }
  return rows;
}

export function defaultTags(bookId: ID, language: Language = 'pt-BR', now = Date.now()): Tag[] {
  const t = createTranslator(language);
  return DEFAULT_TAGS.map((def, order) => ({
    id: newId(),
    bookId,
    name: t(`tag.default.${def.key}` as MessageKey),
    color: def.color,
    order,
    createdAt: now,
    updatedAt: now,
  }));
}

export function defaultAccounts(bookId: ID, currency: string, language: Language = 'pt-BR', now = Date.now()): Account[] {
  const t = createTranslator(language);
  return DEFAULT_ACCOUNTS.map((def, order) => ({
    id: newId(),
    bookId,
    name: t(`account.default.${def.key}` as MessageKey),
    type: def.type,
    icon: def.icon,
    color: def.color,
    currency,
    initialBalance: 0,
    excludeFromTotals: false,
    isDefault: Boolean(def.isDefault),
    note: t(`account.default.${def.key}.note` as MessageKey),
    order,
    createdAt: now,
    updatedAt: now,
  }));
}

export interface NewBookInput {
  name: string;
  type: BookType;
  currency: string;
  color: string;
  /** Split books only; exactly one entry should have `isMe`. */
  members?: { name: string; isMe: boolean }[];
}

export async function createBook(input: NewBookInput): Promise<Book> {
  const now = Date.now();
  const settings = await getSettings();
  return db.transaction('rw', [db.books, db.categories, db.members, db.tags], async () => {
    const last = await db.books.orderBy('order').last();
    const book: Book = { id: newId(), name: input.name.trim(), type: input.type, currency: input.currency, color: input.color, order: (last?.order ?? -1) + 1, createdAt: now, updatedAt: now };
    await db.books.add(book);
    await db.categories.bulkAdd(defaultCategories(book.id, now));
    await db.tags.bulkAdd(defaultTags(book.id, settings.language, now));
    if (input.type === 'split' && input.members?.length) {
      await db.members.bulkAdd(input.members.map((m, order) => ({ id: newId(), bookId: book.id, name: m.name.trim(), isMe: m.isMe, order, createdAt: now })));
    }
    return book;
  });
}

const DEFAULTS_SEED_KEY = 'defaultsSeededV3';

/** Backfills new built-in categories, subcategories, example tags and default accounts into existing books once. */
export async function ensureBookDefaults(language: Language = 'pt-BR'): Promise<void> {
  const done = await db.kv.get(DEFAULTS_SEED_KEY);
  if (done?.value === true) return;
  const now = Date.now();
  await db.transaction('rw', [db.books, db.categories, db.tags, db.accounts, db.kv], async () => {
    const books = await db.books.toArray();
    for (const book of books) {
      const existingCats = await db.categories.where('bookId').equals(book.id).toArray();
      const newCats: Category[] = [];
      let nextParentOrder = existingCats.filter((c) => c.parentId === null).reduce((max, c) => Math.max(max, c.order + 1), 0);

      for (const def of DEFAULT_CATEGORIES) {
        let parent = existingCats.find((c) => c.parentId === null && c.builtinKey === def.key);
        if (!parent) {
          parent = {
            id: newId(),
            bookId: book.id,
            kind: def.kind,
            parentId: null,
            name: '',
            builtinKey: def.key,
            icon: def.icon,
            color: def.color,
            order: nextParentOrder++,
            createdAt: now,
            updatedAt: now,
          };
          newCats.push(parent);
          existingCats.push(parent);
        }
        if (def.children?.length) {
          let nextChildOrder = existingCats.filter((c) => c.parentId === parent!.id).reduce((max, c) => Math.max(max, c.order + 1), 0);
          for (const child of def.children) {
            const exists = existingCats.some((c) => c.builtinKey === child.key);
            if (!exists) {
              const row: Category = {
                id: newId(),
                bookId: book.id,
                kind: def.kind,
                parentId: parent.id,
                name: '',
                builtinKey: child.key,
                icon: child.icon,
                color: def.color,
                order: nextChildOrder++,
                createdAt: now,
                updatedAt: now,
              };
              newCats.push(row);
              existingCats.push(row);
            }
          }
        }
      }
      if (newCats.length) await db.categories.bulkAdd(newCats);

      const existingTags = await db.tags.where('bookId').equals(book.id).toArray();
      const sampleTags = defaultTags(book.id, language, now);
      let nextTagOrder = existingTags.reduce((max, tag) => Math.max(max, tag.order + 1), 0);
      const newTags: Tag[] = [];
      for (const sample of sampleTags) {
        const exists = existingTags.some((tag) => tag.name.toLocaleLowerCase() === sample.name.toLocaleLowerCase());
        if (!exists) {
          newTags.push({ ...sample, order: nextTagOrder++ });
        }
      }
      if (newTags.length) await db.tags.bulkAdd(newTags);

      if (book.type !== 'split') {
        const existingAccounts = await db.accounts.where('bookId').equals(book.id).toArray();
        const sampleAccounts = defaultAccounts(book.id, book.currency, language, now);
        const hasDefault = existingAccounts.some((acc) => acc.isDefault);
        let nextAccOrder = existingAccounts.reduce((max, acc) => Math.max(max, acc.order + 1), 0);
        const newAccounts: Account[] = [];
        for (const sample of sampleAccounts) {
          const exists = existingAccounts.some((acc) => acc.name.toLocaleLowerCase() === sample.name.toLocaleLowerCase());
          if (!exists) {
            newAccounts.push({
              ...sample,
              isDefault: sample.isDefault && !hasDefault,
              order: nextAccOrder++,
            });
          }
        }
        if (newAccounts.length) await db.accounts.bulkAdd(newAccounts);
      }
    }
    await db.kv.put({ key: DEFAULTS_SEED_KEY, value: true });
  });
}

const RAW_DEFAULT_TEXT = /^(account|tag)\.default\.[\w.]+$/;

/**
 * Early builds could store default account and tag names as their untranslated keys
 * ("account.default.checking"). Translates any such leftover in place; real names are never touched.
 */
export async function repairDefaultNames(language: Language = 'pt-BR'): Promise<number> {
  const t = createTranslator(language);
  const fix = (text: string) => (RAW_DEFAULT_TEXT.test(text) ? t(text as MessageKey) : text);
  return db.transaction('rw', [db.accounts, db.tags], async () => {
    let fixed = 0;
    const accounts = await db.accounts.filter((a) => RAW_DEFAULT_TEXT.test(a.name) || RAW_DEFAULT_TEXT.test(a.note)).toArray();
    for (const account of accounts) {
      await db.accounts.update(account.id, { name: fix(account.name), note: fix(account.note), updatedAt: Date.now() });
      fixed++;
    }
    const tags = await db.tags.filter((tag) => RAW_DEFAULT_TEXT.test(tag.name)).toArray();
    for (const tag of tags) {
      await db.tags.update(tag.id, { name: fix(tag.name), updatedAt: Date.now() });
      fixed++;
    }
    return fixed;
  });
}

export async function updateBook(id: ID, patch: Partial<Pick<Book, 'name' | 'currency' | 'color'>>): Promise<void> {
  await db.books.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setCurrentBook(id: ID): Promise<void> {
  await updateSettings({ currentBookId: id });
}

/** Removes the book and everything inside it, photos included. */
export async function deleteBook(id: ID): Promise<void> {
  const tables = [db.books, db.photos, ...BOOK_TABLES.map((name) => db.table(name))];
  await db.transaction('rw', tables, async () => {
    const photoIds = (await db.transactions.where('bookId').equals(id).toArray()).flatMap((tx) => tx.photoIds);
    if (photoIds.length) await db.photos.bulkDelete(photoIds);
    for (const name of BOOK_TABLES) await db.table(name).where('bookId').equals(id).delete();
    await db.books.delete(id);
  });
  const settings = await getSettings();
  if (settings.currentBookId === id) {
    const next = await db.books.orderBy('order').first();
    await updateSettings({ currentBookId: next?.id ?? null });
  }
}

export async function reorderBooks(ids: ID[]): Promise<void> {
  await db.transaction('rw', db.books, async () => {
    await Promise.all(ids.map((id, order) => db.books.update(id, { order })));
  });
}

export async function addMember(bookId: ID, name: string): Promise<Member> {
  const count = await db.members.where('bookId').equals(bookId).count();
  const member: Member = { id: newId(), bookId, name: name.trim(), isMe: false, order: count, createdAt: Date.now() };
  await db.members.add(member);
  return member;
}

export async function renameMember(id: ID, name: string): Promise<void> {
  await db.members.update(id, { name: name.trim() });
}

export async function isMemberReferenced(bookId: ID, memberId: ID): Promise<boolean> {
  const txs = await db.transactions.where('bookId').equals(bookId).toArray();
  return txs.some((tx) => tx.split && (tx.split.payerId === memberId || tx.split.toMemberId === memberId || tx.split.parts.some((p) => p.memberId === memberId)));
}

/** Members referenced by records are kept so history stays consistent. */
export async function removeMember(bookId: ID, memberId: ID): Promise<'removed' | 'in_use'> {
  if (await isMemberReferenced(bookId, memberId)) return 'in_use';
  await db.members.delete(memberId);
  return 'removed';
}
