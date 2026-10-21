import { useState } from 'react';
import { MAX_INSTALLMENTS, splitInstallments } from '@/domain/card';
import { DETAILS_MAX } from '@/domain/defaults';
import { FREQUENCIES, MAX_RUN_COUNT, RUN_COUNT_PRESETS } from '@/domain/schedule';
import type { Frequency, Minor } from '@/domain/types';
import type { RepeatRule } from '@/data/transactions';
import { frequencyLabel } from '@/i18n/labels';
import { useT } from '../app/AppContext';
import { useFormat } from '../hooks/useFormat';
import { Sheet } from './Sheet';
import { Button, Chip } from './primitives';

/** "Repetir": turns the record being added into a recurring plan. */
export function RepeatSheet({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: RepeatRule | null; onChange: (rule: RepeatRule | null) => void }) {
  const t = useT();
  const frequency = value?.frequency ?? null;
  const count = value?.totalCount ?? 0;
  const [custom, setCustom] = useState(value && !RUN_COUNT_PRESETS.includes(value.totalCount) ? String(value.totalCount) : '');
  const setFrequency = (next: Frequency | null) => onChange(next ? { frequency: next, totalCount: count } : null);
  const setCount = (next: number) => frequency && onChange({ frequency, totalCount: next });
  return (
    <Sheet open={open} onClose={onClose} title={t('tx.repeatTitle')} footer={<Button block onClick={onClose}>{t('common.done')}</Button>}>
      <div className="space-y-5 px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          <Chip active={frequency === null} onClick={() => setFrequency(null)}>
            {t('tx.repeatNone')}
          </Chip>
          {FREQUENCIES.map((f) => (
            <Chip key={f} active={frequency === f} onClick={() => setFrequency(f)}>
              {frequencyLabel(f, t)}
            </Chip>
          ))}
        </div>
        {frequency && (
          <div>
            <p className="mb-2 text-sm font-medium text-muted">{t('tx.repeatTimes')}</p>
            <div className="flex flex-wrap items-center gap-2">
              {RUN_COUNT_PRESETS.map((n) => (
                <Chip
                  key={n}
                  active={count === n && !custom}
                  onClick={() => {
                    setCustom('');
                    setCount(n);
                  }}
                >
                  {n === 0 ? t('recurring.unlimited') : t('recurring.countTimes', { count: n })}
                </Chip>
              ))}
              <input
                inputMode="numeric"
                value={custom}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setCustom(digits);
                  if (digits) setCount(Math.min(MAX_RUN_COUNT, Math.max(2, Number(digits))));
                }}
                placeholder={t('recurring.countCustom')}
                aria-label={t('recurring.countCustom')}
                className="h-9 w-24 rounded-full border border-line bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        )}
        <p className="text-[0.8rem] text-muted">{t('tx.repeatHint')}</p>
      </div>
    </Sheet>
  );
}

const INSTALLMENT_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24];

/** "Parcelas": splits a credit card purchase into monthly installments. */
export function InstallmentsSheet({ open, onClose, value, onChange, amount, currency }: { open: boolean; onClose: () => void; value: number; onChange: (count: number) => void; amount: Minor; currency: string }) {
  const t = useT();
  const format = useFormat();
  const [custom, setCustom] = useState(INSTALLMENT_PRESETS.includes(value) ? '' : String(value));
  const label = (n: number) => (n === 1 ? t('cards.inFull') : amount > 0 ? t('cards.installmentOf', { count: n, amount: format.money(splitInstallments(amount, n)[n - 1]!, currency) }) : `${n}x`);
  return (
    <Sheet open={open} onClose={onClose} title={t('cards.installmentsTitle')} footer={<Button block onClick={onClose}>{t('common.done')}</Button>}>
      <div className="space-y-4 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {INSTALLMENT_PRESETS.map((n) => (
            <Chip
              key={n}
              active={value === n && !custom}
              className="justify-center"
              onClick={() => {
                setCustom('');
                onChange(n);
              }}
            >
              <span className="truncate">{label(n)}</span>
            </Chip>
          ))}
        </div>
        <label className="flex items-center gap-3 text-sm text-muted">
          {t('recurring.countCustom')}
          <input
            inputMode="numeric"
            value={custom}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
              setCustom(digits);
              if (digits) onChange(Math.min(MAX_INSTALLMENTS, Math.max(1, Number(digits))));
            }}
            placeholder={`2–${MAX_INSTALLMENTS}`}
            className="h-10 w-24 rounded-full border border-line bg-surface px-3 text-fg outline-none focus:border-primary"
          />
        </label>
        <p className="text-[0.8rem] text-muted">{t('cards.installmentHint')}</p>
      </div>
    </Sheet>
  );
}

/** "Observações": longer free text kept with the record. */
export function MemoSheet({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: string; onChange: (text: string) => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('tx.memo')} footer={<Button block onClick={onClose}>{t('common.done')}</Button>}>
      <div className="px-4 pb-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={DETAILS_MAX}
          rows={6}
          placeholder={t('tx.memoPlaceholder')}
          className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-3 text-fg outline-none placeholder:text-faint focus:border-primary"
          data-autofocus
        />
        <p className="mt-1 text-right text-xs text-faint tabular">
          {value.length}/{DETAILS_MAX}
        </p>
      </div>
    </Sheet>
  );
}
