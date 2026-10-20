import { cx } from './primitives';

/** The app icon artwork (same file as the PWA/launcher icon). */
export function AppLogo({ className }: { className?: string }) {
  return <img src="/icons/icon-192.png" alt="" aria-hidden width={192} height={192} className={cx('shrink-0 select-none', className)} draggable={false} />;
}
