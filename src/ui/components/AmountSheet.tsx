import { useState } from 'react';
import { displayExpression, evaluate, expressionFromDecimal, hasOperator } from '@/domain/calculator';
import { currencyExponent, currencySymbol, minorToDecimalString, toMinor } from '@/domain/money';
import type { Minor } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useFormat } from '../hooks/useFormat';
import { Keypad } from './Keypad';
import { Sheet } from './Sheet';
import { Button } from './primitives';

export interface AmountSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  currency: string;
  initial: Minor | null;
  onSave: (value: Minor) => void;
  /** Shows a secondary action that clears the value. */
  clearLabel?: string;
  onClear?: () => void;
  /** Accepts zero and negative results (balances). */
  allowNonPositive?: boolean;
  hint?: string;
}

/** Amount entry with the calculator keypad, for budgets, balances and other single values. */
export function AmountSheet(props: AmountSheetProps) {
  if (!props.open) return null;
  return <AmountSheetBody {...props} />;
}

function AmountSheetBody({ open, onClose, title, currency, initial, onSave, clearLabel, onClear, allowNonPositive, hint }: AmountSheetProps) {
  const { settings, locale } = useApp();
  const format = useFormat();
  const [negative, setNegative] = useState(initial !== null && initial < 0);
  const [expression, setExpression] = useState(initial !== null && initial !== 0 ? expressionFromDecimal(minorToDecimalString(Math.abs(initial), currency)) : '');
  const value = evaluate(expression);
  const minor = value === null ? 0 : toMinor(value, currency) * (negative ? -1 : 1);
  const submit = () => {
    if (!allowNonPositive && minor <= 0) return;
    onSave(minor);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-4 pt-1">
        {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
        <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3">
          {allowNonPositive && (
            <button type="button" onClick={() => setNegative((n) => !n)} className="h-9 rounded-full bg-surface px-3 font-semibold" aria-pressed={negative}>
              ±
            </button>
          )}
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate text-[1.7rem] font-semibold tabular">
              {negative ? '−' : ''}
              {currencySymbol(currency, locale)} {expression ? displayExpression(expression, format.decimalSeparator) : '0'}
            </div>
            {hasOperator(expression) && <div className="truncate text-sm text-muted tabular">= {format.money(minor, currency)}</div>}
          </div>
        </div>
        {clearLabel && onClear && (
          <Button
            variant="ghost"
            block
            className="mt-2 text-danger"
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            {clearLabel}
          </Button>
        )}
      </div>
      <Keypad expression={expression} onChange={setExpression} onSubmit={submit} decimals={currencyExponent(currency)} decimalSeparator={format.decimalSeparator} full={settings.calculator === 'full'} />
    </Sheet>
  );
}
