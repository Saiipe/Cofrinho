import type { ID, Reminder } from '@/domain/types';
import { db, newId } from './db';

export type ReminderInput = Pick<Reminder, 'name' | 'time' | 'weekdays' | 'enabled'> & { id?: ID };

export async function saveReminder(input: ReminderInput): Promise<ID> {
  const now = Date.now();
  const previous = input.id ? await db.reminders.get(input.id) : undefined;
  const reminder: Reminder = {
    id: previous?.id ?? newId(),
    name: input.name.trim(),
    time: input.time,
    weekdays: [...input.weekdays].sort(),
    enabled: input.enabled,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  await db.reminders.put(reminder);
  return reminder.id;
}

export async function deleteReminder(id: ID): Promise<void> {
  await db.reminders.delete(id);
}

export async function setReminderEnabled(id: ID, enabled: boolean): Promise<void> {
  await db.reminders.update(id, { enabled, updatedAt: Date.now() });
}
