import type { Photo } from '@/domain/types';
import { db } from './db';
import { getSettings, updateSettings, type Settings } from './settings';

export const BACKUP_FORMAT = 'cofrinho-backup';
/** 2: adds tags and goals (older backups restore with both empty). */
export const BACKUP_VERSION = 2;

/** Tables copied verbatim into a backup. Lock configuration is device-specific and never exported. */
const DATA_TABLES = ['books', 'members', 'accounts', 'categories', 'transactions', 'budgets', 'schedules', 'reminders', 'notes', 'rates', 'customRates', 'tags', 'goals'] as const;
type DataTable = (typeof DATA_TABLES)[number];

/** kv entries that travel with a backup. */
const PORTABLE_KV = ['garden'] as const;

interface SerializedPhoto {
  id: string;
  width: number;
  height: number;
  createdAt: number;
  type: string;
  base64: string;
}

export interface BackupPayload {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  tables: Record<DataTable, unknown[]>;
  settings: Partial<Settings>;
  kv: Record<string, unknown>;
  photos: SerializedPhoto[];
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function serializePhoto(photo: Photo): Promise<SerializedPhoto> {
  const bytes = new Uint8Array(await photo.blob.arrayBuffer());
  return { id: photo.id, width: photo.width, height: photo.height, createdAt: photo.createdAt, type: photo.blob.type || 'image/jpeg', base64: bytesToBase64(bytes) };
}

export async function createBackup(options: { includePhotos: boolean }): Promise<BackupPayload> {
  const tables = {} as Record<DataTable, unknown[]>;
  for (const name of DATA_TABLES) tables[name] = await db.table(name).toArray();
  const kv: Record<string, unknown> = {};
  for (const key of PORTABLE_KV) {
    const row = await db.kv.get(key);
    if (row) kv[key] = row.value;
  }
  const photos = options.includePhotos ? await Promise.all((await db.photos.toArray()).map(serializePhoto)) : [];
  const { lastBackupAt: _ignored, lastSeenVersion: _seen, ...settings } = await getSettings();
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), tables, settings, kv, photos };
}

export async function markBackupDone(): Promise<void> {
  await updateSettings({ lastBackupAt: Date.now() });
}

export class InvalidBackupError extends Error {}

/** Validates the envelope and the shape of every row before anything is written. */
export function parseBackup(text: string): BackupPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new InvalidBackupError('Not JSON');
  }
  if (!raw || typeof raw !== 'object') throw new InvalidBackupError('Not an object');
  const payload = raw as Partial<BackupPayload>;
  if (payload.format !== BACKUP_FORMAT || typeof payload.version !== 'number' || payload.version > BACKUP_VERSION) {
    throw new InvalidBackupError('Unknown format');
  }
  if (!payload.tables || typeof payload.tables !== 'object') throw new InvalidBackupError('Missing tables');
  const tables = {} as Record<DataTable, unknown[]>;
  for (const name of DATA_TABLES) {
    const rows = (payload.tables as Record<string, unknown>)[name] ?? [];
    if (!Array.isArray(rows)) throw new InvalidBackupError(`Bad table ${name}`);
    const keyField = name === 'rates' ? 'code' : 'id';
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof (row as Record<string, unknown>)[keyField] !== 'string') {
        throw new InvalidBackupError(`Bad row in ${name}`);
      }
    }
    tables[name] = rows;
  }
  if (!tables.books.length) throw new InvalidBackupError('No books');
  const photos = Array.isArray(payload.photos) ? payload.photos.filter((p): p is SerializedPhoto => !!p && typeof p.id === 'string' && typeof p.base64 === 'string') : [];
  return {
    format: BACKUP_FORMAT,
    version: payload.version,
    exportedAt: typeof payload.exportedAt === 'number' ? payload.exportedAt : 0,
    tables,
    settings: payload.settings && typeof payload.settings === 'object' ? payload.settings : {},
    kv: payload.kv && typeof payload.kv === 'object' ? payload.kv : {},
    photos,
  };
}

/** Replaces all local data with the backup contents in one transaction. */
export async function restoreBackup(backup: BackupPayload): Promise<void> {
  const tableHandles = [...DATA_TABLES.map((name) => db.table(name)), db.photos, db.kv];
  await db.transaction('rw', tableHandles, async () => {
    for (const name of DATA_TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(backup.tables[name]);
    }
    await db.photos.clear();
    await db.photos.bulkAdd(
      backup.photos.map((p) => ({ id: p.id, width: p.width, height: p.height, createdAt: p.createdAt, blob: new Blob([base64ToBytes(p.base64)], { type: p.type }) })),
    );
    for (const key of PORTABLE_KV) {
      if (key in backup.kv) await db.kv.put({ key, value: backup.kv[key] });
    }
    const current = await getSettings();
    const books = backup.tables.books as { id: string }[];
    const currentBookId = books.some((b) => b.id === backup.settings.currentBookId) ? backup.settings.currentBookId! : books[0]!.id;
    await db.kv.put({ key: 'settings', value: { ...current, ...backup.settings, currentBookId, onboarded: true, lastBackupAt: current.lastBackupAt, lastSeenVersion: current.lastSeenVersion } });
  });
}

export function backupSummary(backup: BackupPayload): { books: number; records: number; photos: number } {
  return { books: backup.tables.books.length, records: backup.tables.transactions.length, photos: backup.photos.length };
}
