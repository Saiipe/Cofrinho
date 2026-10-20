import { DEFAULT_CATEGORIES } from '@/domain/defaults';
import type { Book, BookType, Category, ID, Member } from '@/domain/types';
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
  return db.transaction('rw', [db.books, db.categories, db.members], async () => {
    const last = await db.books.orderBy('order').last();
    const book: Book = { id: newId(), name: input.name.trim(), type: input.type, currency: input.currency, color: input.color, order: (last?.order ?? -1) + 1, createdAt: now, updatedAt: now };
    await db.books.add(book);
    await db.categories.bulkAdd(defaultCategories(book.id, now));
    if (input.type === 'split' && input.members?.length) {
      await db.members.bulkAdd(input.members.map((m, order) => ({ id: newId(), bookId: book.id, name: m.name.trim(), isMe: m.isMe, order, createdAt: now })));
    }
    return book;
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
