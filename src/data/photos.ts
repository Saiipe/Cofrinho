import type { ID, Photo } from '@/domain/types';
import { db, newId } from './db';

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Downscales a picked image to a JPEG of at most 1600px so receipts stay readable but small. */
async function compress(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Image encoding failed');
  return { blob, width, height };
}

export async function addPhoto(file: Blob): Promise<ID> {
  const { blob, width, height } = await compress(file);
  const photo: Photo = { id: newId(), blob, width, height, createdAt: Date.now() };
  await db.photos.add(photo);
  return photo.id;
}

/** Photos picked in a form but discarded before saving. */
export async function discardPhotos(ids: ID[]): Promise<void> {
  if (ids.length) await db.photos.bulkDelete(ids);
}
