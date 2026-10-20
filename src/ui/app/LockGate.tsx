import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getLockConfig, verifyBiometric, verifyPin, type LockConfig } from '@/services/lock';
import { haptic } from '@/services/feedback';
import { PIN_MIN, PinPad } from '../components/PinPad';
import { useT } from './AppContext';
import { AppLogo } from '../components/AppLogo';

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

/**
 * Covers the app with the PIN screen on cold start and after the configured time in background.
 * The app stays mounted underneath so navigation state survives a resume.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const t = useT();
  const [config, setConfig] = useState<LockConfig | null>(null);
  const [locked, setLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const attempts = useRef(0);
  const hiddenAt = useRef<number | null>(null);

  const tryBiometric = useCallback(async () => {
    if (await verifyBiometric(t('app.name'), t('lock.title'))) {
      haptic('success');
      setLocked(false);
    }
  }, [t]);

  useEffect(() => {
    void getLockConfig().then((loaded) => {
      setConfig(loaded);
      setLocked(loaded.enabled);
      if (loaded.enabled && loaded.biometric) void tryBiometric();
    });
  }, [tryBiometric]);

  // Re-lock after the configured time in background.
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const latest = await getLockConfig();
      setConfig(latest);
      if (latest.enabled && hiddenAt.current !== null && Date.now() - hiddenAt.current >= latest.timeoutSec * 1000) {
        setPin('');
        setLocked(true);
        if (latest.biometric) void tryBiometric();
      }
      hiddenAt.current = null;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [tryBiometric]);

  const onPinChange = async (value: string) => {
    if (Date.now() < blockedUntil) return;
    setError(false);
    setPin(value);
    if (value.length < (config?.length ?? PIN_MIN)) return;
    if (await verifyPin(value)) {
      attempts.current = 0;
      haptic('success');
      setPin('');
      setLocked(false);
    } else {
      attempts.current++;
      haptic('warning');
      setError(true);
      setTimeout(() => setPin(''), 350);
      if (attempts.current >= MAX_ATTEMPTS) {
        attempts.current = 0;
        setBlockedUntil(Date.now() + COOLDOWN_MS);
      }
    }
  };

  const showLock = config === null || (config.enabled && locked);
  const blocked = Date.now() < blockedUntil;

  return (
    <>
      {children}
      {showLock && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg px-6 pt-safe pb-safe" role="dialog" aria-modal="true" aria-label={t('lock.title')}>
          {config && (
            <>
              <AppLogo className="mb-4 size-16" />
              <h1 className="text-xl font-semibold">{t('lock.title')}</h1>
              <p className="mt-1 mb-8 text-sm text-muted">{blocked ? t('lock.tooMany', { seconds: Math.ceil((blockedUntil - Date.now()) / 1000) }) : error ? t('lock.wrong') : t('lock.enterPin')}</p>
              <PinPad value={pin} onChange={(v) => void onPinChange(v)} onBiometric={config.biometric ? () => void tryBiometric() : undefined} error={error} />
              <p className="mt-8 max-w-xs text-center text-xs text-faint">{t('lock.forgot')}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
