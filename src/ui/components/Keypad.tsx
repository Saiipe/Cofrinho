import { Check, Delete } from 'lucide-react';
import { useRef } from 'react';
import { pressKey, type CalcKey } from '@/domain/calculator';
import { haptic, playSound } from '@/services/feedback';
import { useT } from '../app/AppContext';
import { cx } from './primitives';

export interface KeypadProps {
  expression: string;
  onChange: (expression: string) => void;
  onSubmit: () => void;
  decimals: number;
  decimalSeparator: string;
  full: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
}

const BASIC: (CalcKey | 'ok')[][] = [
  ['1', '2', '3', 'back'],
  ['4', '5', '6', '-'],
  ['7', '8', '9', '+'],
  ['.', '0', 'ok'],
];

const FULL: (CalcKey | 'ok')[][] = [
  ['1', '2', '3', 'back'],
  ['4', '5', '6', '/'],
  ['7', '8', '9', '*'],
  ['.', '0', '-', '+'],
  ['ok'],
];

const GLYPHS: Partial<Record<CalcKey, string>> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** Amount keypad with a built-in calculator; long-press backspace clears everything. */
export function Keypad({ expression, onChange, onSubmit, decimals, decimalSeparator, full, submitLabel, submitDisabled }: KeypadProps) {
  const t = useT();
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const rows = full ? FULL : BASIC;

  const press = (key: CalcKey) => {
    haptic('light');
    onChange(pressKey(expression, key, decimals));
  };

  const startBackspace = () => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      haptic('medium');
      playSound('close');
      onChange('');
    }, 550);
  };
  const endBackspace = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div className="grid grid-cols-4 gap-1.5 px-2 pt-1.5 pb-2" role="group" aria-label={t('common.amount')} data-sound="key">
      {rows.flat().map((key) => {
        if (key === 'ok') {
          return (
            <button
              key="ok"
              type="button"
              disabled={submitDisabled}
              data-sound="tap"
              onClick={() => {
                haptic('medium');
                onSubmit();
              }}
              className={cx(
                'flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-fg active:opacity-85 disabled:opacity-45',
                full ? 'col-span-4' : 'col-span-2',
              )}
            >
              <Check className="size-6" aria-hidden />
              {submitLabel ?? t('keypad.ok')}
            </button>
          );
        }
        if (key === 'back') {
          return (
            <button
              key="back"
              type="button"
              aria-label={t('keypad.backspace')}
              data-no-tip
              onPointerDown={startBackspace}
              onPointerUp={endBackspace}
              onPointerLeave={endBackspace}
              onClick={() => {
                if (!longPressed.current) press('back');
              }}
              onContextMenu={(event) => event.preventDefault()}
              className="flex h-14 items-center justify-center rounded-2xl bg-surface-2 text-fg active:bg-line"
            >
              <Delete className="size-6" aria-hidden />
            </button>
          );
        }
        const operator = GLYPHS[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className={cx(
              'flex h-14 items-center justify-center rounded-2xl text-[1.45rem] font-medium active:bg-line',
              operator ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-fg',
            )}
          >
            {operator ?? (key === '.' ? decimalSeparator : key)}
          </button>
        );
      })}
    </div>
  );
}
