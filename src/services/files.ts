import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { bytesToBase64 } from '@/data/backup';
import { isNative } from './platform';

export type FileData = Blob | Uint8Array | string;

function toBlob(data: FileData, mime: string): Blob {
  if (data instanceof Blob) return data;
  const part = typeof data === 'string' ? data : new Uint8Array(data);
  return new Blob([part], { type: mime });
}

/**
 * Hands a generated file to the user. Native: writes it to the cache and opens the share sheet
 * (Drive, e-mail, WhatsApp, Files…). Web: share sheet on mobile when supported, else a download.
 */
export async function deliverFile(data: FileData, fileName: string, mime: string): Promise<'shared' | 'downloaded'> {
  const blob = toBlob(data, mime);
  if (isNative) {
    const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
    await Share.share({ title: fileName, files: [uri], dialogTitle: fileName });
    return 'shared';
  }
  const file = new File([blob], fileName, { type: mime });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

/** Opens the system file/camera picker. Resolves null when the user cancels. */
export function pickFile(options: { accept: string; capture?: 'environment' | 'user'; multiple?: false }): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept;
    if (options.capture) input.setAttribute('capture', options.capture);
    input.style.display = 'none';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.append(input);
    input.click();
  });
}

export function stampedFileName(base: string, extension: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.${extension}`;
}
