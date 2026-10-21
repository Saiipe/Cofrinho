import { GOAL_NAME_MAX } from '@/domain/goals';
import type { DayKey, Goal, GoalEntry, ID, Minor } from '@/domain/types';
import { db, newId } from './db';

export interface GoalInput {
  id?: ID;
  bookId: ID;
  name: string;
  icon: string;
  color: string;
  target: Minor;
  targetDate: DayKey | null;
}

export async function saveGoal(input: GoalInput, initialDeposit: Minor = 0): Promise<ID> {
  const now = Date.now();
  const fields = { name: input.name.trim().slice(0, GOAL_NAME_MAX), icon: input.icon, color: input.color, target: input.target, targetDate: input.targetDate, updatedAt: now };
  return db.transaction('rw', db.goals, async () => {
    if (input.id) {
      await db.goals.update(input.id, fields);
      return input.id;
    }
    const count = await db.goals.where('bookId').equals(input.bookId).count();
    const entries: GoalEntry[] = initialDeposit > 0 ? [{ id: newId(), date: now, amount: initialDeposit, note: '' }] : [];
    const goal: Goal = { id: newId(), bookId: input.bookId, ...fields, entries, archived: false, order: count, createdAt: now };
    await db.goals.add(goal);
    return goal.id;
  });
}

/** Adds a deposit (positive) or a withdrawal (negative). */
export async function addGoalEntry(goalId: ID, amount: Minor, note = '', date = Date.now()): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const goal = await db.goals.get(goalId);
    if (!goal || amount === 0) return;
    const entries = [...goal.entries, { id: newId(), date, amount, note: note.trim() }].sort((a, b) => a.date - b.date);
    await db.goals.update(goalId, { entries, updatedAt: Date.now() });
  });
}

export async function removeGoalEntry(goalId: ID, entryId: ID): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const goal = await db.goals.get(goalId);
    if (!goal) return;
    await db.goals.update(goalId, { entries: goal.entries.filter((e) => e.id !== entryId), updatedAt: Date.now() });
  });
}

export async function setGoalArchived(goalId: ID, archived: boolean): Promise<void> {
  await db.goals.update(goalId, { archived, updatedAt: Date.now() });
}

export async function deleteGoal(goalId: ID): Promise<void> {
  await db.goals.delete(goalId);
}
