import { Directory, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from '@/data/db';
import { isNative } from './platform';

/** Removes regenerable data: exported files waiting to be shared and the offline web cache. */
export async function clearCaches(): Promise<void> {
  if (isNative) {
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache });
    await Promise.all(files.filter((f) => f.type === 'file').map((f) => Filesystem.deleteFile({ path: f.name, directory: Directory.Cache })));
    return;
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

/** Erases every local record and scheduled notification, then restarts on the welcome screen. */
export async function wipeAllData(): Promise<void> {
  if (isNative) {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  await db.delete();
  window.location.replace('/');
}
