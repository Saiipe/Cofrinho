import type { Category, CategoryKind, ID } from '@/domain/types';
import { db, newId } from './db';

export interface CategoryInput {
  id?: ID;
  bookId: ID;
  kind: CategoryKind;
  parentId: ID | null;
  name: string;
  icon: string;
  color: string;
}

export async function saveCategory(input: CategoryInput): Promise<ID> {
  const now = Date.now();
  if (input.id) {
    await db.categories.update(input.id, { name: input.name.trim(), icon: input.icon, color: input.color, updatedAt: now });
    return input.id;
  }
  const siblings = await db.categories.where('bookId').equals(input.bookId).filter((c) => c.kind === input.kind && c.parentId === input.parentId).toArray();
  const category: Category = {
    id: newId(),
    bookId: input.bookId,
    kind: input.kind,
    parentId: input.parentId,
    name: input.name.trim(),
    icon: input.icon,
    color: input.color,
    order: siblings.reduce((max, c) => Math.max(max, c.order + 1), 0),
    createdAt: now,
    updatedAt: now,
  };
  await db.categories.add(category);
  return category.id;
}

/** Deletes a category with its subcategories. Records and plans keep existing without a category. */
export async function deleteCategory(id: ID): Promise<void> {
  await db.transaction('rw', [db.categories, db.transactions, db.schedules, db.budgets, db.notes], async () => {
    const children = await db.categories.where('parentId').equals(id).primaryKeys();
    const ids = [id, ...children];
    await db.transactions.where('categoryId').anyOf(ids).modify({ categoryId: null });
    await db.schedules.filter((s) => s.categoryId !== null && ids.includes(s.categoryId)).modify({ categoryId: null });
    await db.budgets.filter((b) => b.categoryId !== null && ids.includes(b.categoryId)).delete();
    await db.notes.filter((n) => n.categoryId !== null && ids.includes(n.categoryId)).delete();
    await db.categories.bulkDelete(ids);
  });
}

export async function reorderCategories(ids: ID[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    await Promise.all(ids.map((id, order) => db.categories.update(id, { order })));
  });
}
