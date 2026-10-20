import { Camera, ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { addPhoto } from '@/data/photos';
import type { ID } from '@/domain/types';
import { pickFile } from '@/services/files';
import { useBackHandler } from '../app/back';
import { useT } from '../app/AppContext';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { useHorizontalSwipe } from '../hooks/useSwipe';
import { useFeedback } from './feedback';
import { Sheet } from './Sheet';
import { Button, IconButton, Spinner } from './primitives';

export function PhotoThumb({ id, onOpen, onRemove, size = 'size-20' }: { id: ID; onOpen?: () => void; onRemove?: () => void; size?: string }) {
  const t = useT();
  const url = usePhotoUrl(id);
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-surface-2 ${size}`}>
      {url && (
        <button type="button" onClick={onOpen} className="size-full" aria-label={t('tx.photos')}>
          <img src={url} alt="" className="size-full object-cover" />
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t('tx.removePhoto')} className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

function ViewerImage({ id }: { id: ID }) {
  const url = usePhotoUrl(id);
  return url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <Spinner className="text-white" />;
}

export function PhotoViewer({ ids, index, onClose }: { ids: ID[]; index: number; onClose: () => void }) {
  const t = useT();
  const [current, setCurrent] = useState(index);
  const go = (delta: number) => setCurrent((c) => (c + delta + ids.length) % ids.length);
  const swipe = useHorizontalSwipe((direction) => go(direction));
  useBackHandler(true, onClose);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex animate-fade-in flex-col bg-black pt-safe pb-safe" role="dialog" aria-modal="true" aria-label={t('tx.photos')}>
      <div className="flex h-14 items-center justify-between px-2 text-white">
        <span className="px-3 text-sm tabular opacity-80">
          {current + 1} / {ids.length}
        </span>
        <IconButton icon={X} label={t('common.close')} onClick={onClose} className="text-white active:bg-white/15" />
      </div>
      <div {...swipe} className="flex min-h-0 flex-1 touch-pan-y items-center justify-center">
        <ViewerImage id={ids[current]!} />
      </div>
      {ids.length > 1 && (
        <div className="flex justify-center gap-6 py-3">
          <IconButton icon={ChevronLeft} label={t('common.back')} onClick={() => go(-1)} className="text-white active:bg-white/15" />
          <IconButton icon={ChevronRight} label={t('common.more')} onClick={() => go(1)} className="text-white active:bg-white/15" />
        </div>
      )}
    </div>,
    document.body,
  );
}

/** Attach photos from the camera or gallery; `onAdded` reports new ids so a cancelled form can discard them. */
export function PhotosSheet({ open, onClose, photoIds, onChange, onAdded }: { open: boolean; onClose: () => void; photoIds: ID[]; onChange: (ids: ID[]) => void; onAdded: (id: ID) => void }) {
  const t = useT();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const add = async (capture: boolean) => {
    const file = await pickFile({ accept: 'image/*', capture: capture ? 'environment' : undefined });
    if (!file) return;
    setBusy(true);
    try {
      const id = await addPhoto(file);
      onAdded(id);
      onChange([...photoIds, id]);
    } catch {
      toast(t('common.error'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('tx.photos')}>
      <div className="space-y-4 px-4 pb-5">
        {photoIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photoIds.map((id, i) => (
              <PhotoThumb key={id} id={id} onOpen={() => setViewing(i)} onRemove={() => onChange(photoIds.filter((p) => p !== id))} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={Camera} onClick={() => void add(true)} disabled={busy}>
            {t('tx.camera')}
          </Button>
          <Button variant="secondary" icon={Images} onClick={() => void add(false)} disabled={busy}>
            {t('tx.gallery')}
          </Button>
        </div>
        {busy && (
          <div className="flex justify-center text-primary">
            <Spinner />
          </div>
        )}
      </div>
      {viewing !== null && <PhotoViewer ids={photoIds} index={viewing} onClose={() => setViewing(null)} />}
    </Sheet>
  );
}
