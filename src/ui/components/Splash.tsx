import { AppLogo } from './AppLogo';

export function Splash() {
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
