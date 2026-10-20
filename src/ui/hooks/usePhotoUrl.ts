import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/data/db';

/** Object URL for a stored photo, revoked when the component unmounts or the photo changes. */
export function usePhotoUrl(id: string): string | null {
  const photo = useLiveQuery(() => db.photos.get(id), [id]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) return;
    const objectUrl = URL.createObjectURL(photo.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);
  return url;
}
