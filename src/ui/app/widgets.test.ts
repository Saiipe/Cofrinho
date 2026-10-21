import { describe, expect, it } from 'vitest';
import type { Category } from '@/domain/types';
import { widgetCategories } from './widgets';

function category(id: string, parentId: string | null = null, kind: Category['kind'] = 'expense'): Category {
  return { id, bookId: 'b', kind, parentId, name: id, icon: 'tag', color: '#000', order: 0, createdAt: 0, updatedAt: 0 };
}

const food = category('food');
const groceries = category('groceries', 'food');
const transport = category('transport');
const leisure = category('leisure');
const health = category('health');
const salary = category('salary', null, 'income');
const map = new Map([food, groceries, transport, leisure, health, salary].map((c) => [c.id, c]));
const tops = [food, transport, leisure, health];

describe('widget category shortcuts', () => {
  it('puts the most used categories first, counting subcategories in their parent', () => {
    const txs = [
      { kind: 'expense' as const, categoryId: 'transport' },
      { kind: 'expense' as const, categoryId: 'groceries' },
      { kind: 'expense' as const, categoryId: 'groceries' },
      { kind: 'income' as const, categoryId: 'salary' },
    ];
    expect(widgetCategories(txs, map, tops).map((c) => c.id)).toEqual(['food', 'transport', 'leisure']);
  });

  it('fills empty slots with the book order and ranks income separately', () => {
    expect(widgetCategories([], map, tops).map((c) => c.id)).toEqual(['food', 'transport', 'leisure']);
    expect(widgetCategories([{ kind: 'income', categoryId: 'salary' }], map, [salary], 3, 'income').map((c) => c.id)).toEqual(['salary']);
  });
});
