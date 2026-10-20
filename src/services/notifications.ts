import { LocalNotifications, Weekday } from '@capacitor/local-notifications';
import type { Reminder } from '@/domain/types';
import { isNative } from './platform';

export type PermissionState = 'granted' | 'denied' | 'prompt';

export async function notificationPermission(): Promise<PermissionState> {
  if (isNative) {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  }
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (isNative) {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  }
  if (typeof Notification === 'undefined') return 'denied';
  const result = await Notification.requestPermission();
  return result === 'default' ? 'prompt' : result;
}

let nextImmediateId = 50_000;

/** Shows a notification right away (recurring runs, web reminders). Silently skipped without permission. */
export async function notifyNow(title: string, body: string): Promise<void> {
  if ((await notificationPermission()) !== 'granted') return;
  if (isNative) {
    // Inexact on purpose: an exact request makes the plugin open the "Alarms & reminders" settings screen.
    await LocalNotifications.schedule({ notifications: [{ id: nextImmediateId++, title, body, isExactNotification: false }] }).catch(() => undefined);
    return;
  }
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' });
  else new Notification(title, { body, icon: '/icons/icon-192.png' });
}

/** Reminder notification ids live in [1000, 9999] so they can be replaced without touching others. */
const REMINDER_ID_BASE = 1000;

const WEEKDAYS: Weekday[] = [Weekday.Sunday, Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday, Weekday.Thursday, Weekday.Friday, Weekday.Saturday];

/** Native: (re)schedules repeating OS notifications for every enabled reminder. */
export async function syncNativeReminders(reminders: Reminder[], title: string): Promise<void> {
  if (!isNative) return;
  const pending = await LocalNotifications.getPending();
  const stale = pending.notifications.filter((n) => n.id >= REMINDER_ID_BASE && n.id < REMINDER_ID_BASE + 9000);
  if (stale.length) await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
  if ((await notificationPermission()) !== 'granted') return;

  const notifications = reminders
    .filter((r) => r.enabled)
    .flatMap((reminder, index) => {
      const [hour, minute] = reminder.time.split(':').map(Number) as [number, number];
      const days = reminder.weekdays.length ? reminder.weekdays : [null];
      return days.map((day) => ({
        id: REMINDER_ID_BASE + index * 8 + (day === null ? 7 : day),
        title,
        body: reminder.name,
        schedule: { on: day === null ? { hour, minute } : { weekday: WEEKDAYS[day], hour, minute }, allowWhileIdle: true },
        // A few minutes of drift is fine for a reminder; see notifyNow about exact alarms.
        isExactNotification: false,
      }));
    });
  if (notifications.length) await LocalNotifications.schedule({ notifications }).catch(() => undefined);
}

/** Web: reminders can only fire while the page is alive; schedules timers for the rest of today. */
export function startWebReminderTimers(reminders: Reminder[], fire: (reminder: Reminder) => void): () => void {
  if (isNative) return () => {};
  const timers: number[] = [];
  const now = new Date();
  for (const reminder of reminders) {
    if (!reminder.enabled) continue;
    if (reminder.weekdays.length && !reminder.weekdays.includes(now.getDay())) continue;
    const [hour, minute] = reminder.time.split(':').map(Number) as [number, number];
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).getTime();
    const delay = at - now.getTime();
    if (delay > 0 && delay < 86_400_000) timers.push(window.setTimeout(() => fire(reminder), delay));
  }
  return () => timers.forEach((id) => window.clearTimeout(id));
}
