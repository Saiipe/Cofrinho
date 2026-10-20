import { isValidTotalBudget, reconcileTotalBudget } from '@/domain/budget';
import type { ID, Minor } from '@/domain/types';
import { db, newId } from './db';

async function upsert(bookId: ID, categoryId: ID | null, amount: Minor | null): Promise<void> {
  const existing = await db.budgets.where('bookId').equals(bookId).filter((b) => b.categoryId === categoryId).first();
  if (amount === null || amount <= 0) {
    if (existing) await db.budgets.delete(existing.id);
    return;
  }
  await db.budgets.put({ id: existing?.id ?? newId(), bookId, categoryId, amount, updatedAt: Date.now() });
}

export type TotalBudgetResult = { ok: true } | { ok: false; minimum: Minor };

export async function setTotalBudget(bookId: ID, amount: Minor | null): Promise<TotalBudgetResult> {
  return db.transaction('rw', db.budgets, async () => {
    const categories = (await db.budgets.where('bookId').equals(bookId).toArray()).filter((b) => b.categoryId !== null);
    const amounts = categories.map((b) => b.amount);
    if (amount !== null && !isValidTotalBudget(amount, amounts)) {
      return { ok: false, minimum: amounts.reduce((a, b) => a + b, 0) };
    }
    await upsert(bookId, null, amount);
    return { ok: true };
  });
}

/** Sets one category budget; the total grows automatically when categories add up to more. */
export async function setCategoryBudget(bookId: ID, categoryId: ID, amount: Minor | null): Promise<{ autoUpdated: boolean; total: Minor | null }> {
  return db.transaction('rw', db.budgets, async () => {
    await upsert(bookId, categoryId, amount);
    const all = await db.budgets.where('bookId').equals(bookId).toArray();
    const total = all.find((b) => b.categoryId === null)?.amount ?? null;
    const reconciled = reconcileTotalBudget(total, all.filter((b) => b.categoryId !== null).map((b) => b.amount));
    if (reconciled.autoUpdated) await upsert(bookId, null, reconciled.total);
    return reconciled;
  });
}
