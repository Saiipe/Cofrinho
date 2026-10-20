import { Delete, Fingerprint } from 'lucide-react';
import { haptic } from '@/services/feedback';
import { useT } from '../app/AppContext';
import { cx } from './primitives';

export const PIN_MIN = 4;
export const PIN_MAX = 6;

/** Numeric PIN entry: dots for progress, big keys, optional biometric key. */
export function PinPad({ value, onChange, onBiometric, error }: { value: string; onChange: (value: string) => void; onBiometric?: () => void; error?: boolean }) {
  const t = useT();
  const press = (digit: string) => {
    if (value.length >= PIN_MAX) return;
    haptic('light');
    onChange(value + digit);
  };
  return (
    <div className="flex flex-col items-center">
      <div className={cx('mb-8 flex h-4 gap-3', error && 'animate-[pop-in_200ms]')} aria-live="polite" aria-label={`${value.length}/${PIN_MAX}`}>
        {Array.from({ length: Math.max(PIN_MIN, value.length) }, (_, i) => (
          <span key={i} className={cx('size-3.5 rounded-full border-2', error ? 'border-danger bg-danger' : i < value.length ? 'border-primary bg-primary' : 'border-faint')} />
        ))}
      </div>
      <div className="grid w-72 grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button key={digit} type="button" onClick={() => press(digit)} aria-label={t('lock.digit', { digit })} className="mx-auto flex size-18 items-center justify-center rounded-full bg-surface-2 text-2xl font-medium active:bg-line">
            {digit}
          </button>
        ))}
        {onBiometric ? (
          <button type="button" onClick={onBiometric} aria-label={t('lock.useBiometric')} className="mx-auto flex size-18 items-center justify-center rounded-full text-primary active:bg-primary-soft">
            <Fingerprint className="size-8" aria-hidden />
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => press('0')} aria-label={t('lock.digit', { digit: '0' })} className="mx-auto flex size-18 items-center justify-center rounded-full bg-surface-2 text-2xl font-medium active:bg-line">
          0
        </button>
        <button type="button" onClick={() => onChange(value.slice(0, -1))} aria-label={t('keypad.backspace')} className="mx-auto flex size-18 items-center justify-center rounded-full text-fg active:bg-surface-2">
          <Delete className="size-7" aria-hidden />
        </button>
      </div>
    </div>
  );
}
