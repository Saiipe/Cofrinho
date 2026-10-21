import { CATEGORY_COLORS, TAG_NAME_MAX } from '@/domain/defaults';
import type { ID, Tag } from '@/domain/types';
import { db, newId } from './db';

export function normalizeTagName(name: string): string {
  return name.trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, TAG_NAME_MAX);
}

/** Creates a tag, or returns the existing one with the same name (case-insensitive). */
export async function createTag(bookId: ID, rawName: string, color?: string): Promise<Tag> {
  const name = normalizeTagName(rawName);
  if (!name) throw new Error('Empty tag name');
  return db.transaction('rw', db.tags, async () => {
    const tags = await db.tags.where('bookId').equals(bookId).toArray();
    const same = tags.find((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (same) return same;
    const now = Date.now();
    const tag: Tag = { id: newId(), bookId, name, color: color ?? CATEGORY_COLORS[(tags.length * 5) % CATEGORY_COLORS.length]!, order: tags.length, createdAt: now, updatedAt: now };
    await db.tags.add(tag);
    return tag;
  });
}

export async function updateTag(id: ID, patch: Partial<Pick<Tag, 'name' | 'color'>>): Promise<void> {
  const name = patch.name === undefined ? undefined : normalizeTagName(patch.name);
  await db.tags.update(id, { ...patch, ...(name ? { name } : {}), updatedAt: Date.now() });
}

/** Removes the tag and detaches it from records and recurring plans. */
export async function deleteTag(id: ID): Promise<void> {
  await db.transaction('rw', [db.tags, db.transactions, db.schedules], async () => {
    await db.transactions.where('tagIds').equals(id).modify((tx) => {
      tx.tagIds = (tx.tagIds ?? []).filter((tagId) => tagId !== id);
    });
    await db.schedules
      .filter((s) => s.tagIds?.includes(id) ?? false)
      .modify((s) => {
        s.tagIds = (s.tagIds ?? []).filter((tagId) => tagId !== id);
      });
    await db.tags.delete(id);
  });
}

export async function reorderTags(ids: ID[]): Promise<void> {
  await db.transaction('rw', db.tags, async () => {
    await Promise.all(ids.map((id, order) => db.tags.update(id, { order })));
  });
}

/** How many records use each tag. */
export async function tagUsage(bookId: ID): Promise<Map<ID, number>> {
  const counts = new Map<ID, number>();
  await db.transactions
    .where('bookId')
    .equals(bookId)
    .each((tx) => {
      for (const id of tx.tagIds ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    });
  return counts;
}
