import { QUICK_MODE } from '../quickMode';
import { AppLogo } from './AppLogo';

export function Splash() {
  // The mini screen opens over the home screen: nothing to show until the sheet is ready.
  if (QUICK_MODE) return <div className="min-h-dvh" aria-busy="true" />;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg" aria-busy="true">
      <AppLogo className="size-20 animate-pulse" />
    </div>
  );
}

/** Lightweight placeholder while a lazily loaded screen downloads. */
export function PageFallback() {
  return <div className="min-h-dvh bg-bg" aria-busy="true" />;
}
