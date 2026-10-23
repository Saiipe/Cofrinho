import { CalendarCheck, Hash, Infinity as InfinityIcon } from 'lucide-react';
import { useState } from 'react';
import { MAX_INSTALLMENTS, splitInstallments } from '@/domain/card';
import { DETAILS_MAX } from '@/domain/defaults';
import { addMonthsClamped, dayKey, withDay } from '@/domain/dates';
import { FREQUENCIES, MAX_RUN_COUNT, occurrence, RUN_COUNT_PRESETS, runsUntil, type Recurrence } from '@/domain/schedule';
import type { DayKey, Frequency, Minor } from '@/domain/types';
import type { RepeatRule } from '@/data/transactions';
import { frequencyLabel } from '@/i18n/labels';
import { useT } from '../app/AppContext';
import { useFormat } from '../hooks/useFormat';
import { DatePickerSheet } from './pickers';
import { Button, Chip, cx } from './primitives';
import { Sheet } from './Sheet';

/** "Repetir": turns the record being added into a recurring plan. */
export function RepeatSheet({ open, onClose, value, onChange, startDate }: { open: boolean; onClose: () => void; value: RepeatRule | null; onChange: (rule: RepeatRule | null) => void; startDate: DayKey }) {
  const t = useT();
  const frequency = value?.frequency ?? null;
  const setFrequency = (next: Frequency | null) => onChange(next ? { frequency: next, totalCount: value?.totalCount ?? 0, endDate: value?.endDate } : null);
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
          <RepeatEndPicker
            rule={{ frequency, startDate }}
            count={value?.totalCount ?? 0}
            endDate={value?.endDate ?? null}
            minCount={2}
            onChange={(end) => onChange({ frequency, totalCount: end.count, endDate: end.endDate ?? undefined })}
          />
        )}
        <p className="text-[0.8rem] text-muted">{t('tx.repeatHint')}</p>
      </div>
    </Sheet>
  );
}

type EndMode = 'never' | 'count' | 'date';

/**
 * "Quando termina?": never, after a number of runs, or on a date. Only one applies:
 * choosing a date clears the count and vice versa.
 */
export function RepeatEndPicker({
  rule,
  count,
  endDate,
  minCount = 1,
  onChange,
}: {
  rule: Recurrence;
  count: number;
  endDate: DayKey | null;
  /** Fewest runs accepted (2 when the first run is the record being saved). */
  minCount?: number;
  onChange: (end: { count: number; endDate: DayKey | null }) => void;
}) {
  const t = useT();
  const format = useFormat();
  const [mode, setMode] = useState<EndMode>(endDate ? 'date' : count > 0 ? 'count' : 'never');
  const [custom, setCustom] = useState(count > 0 && !RUN_COUNT_PRESETS.includes(count) ? String(count) : '');
  const [picking, setPicking] = useState(false);
  const presets = RUN_COUNT_PRESETS.filter((n) => n >= minCount);
  const runsToEnd = endDate ? runsUntil(rule, endDate) : 0;

  const choose = (next: EndMode) => {
    setMode(next);
    if (next === 'never') onChange({ count: 0, endDate: null });
    if (next === 'count') onChange({ count: count > 0 ? count : presets[0]!, endDate: null });
    if (next === 'date') onChange({ count: 0, endDate: endDate ?? addMonthsClamped(rule.startDate, 12) });
  };

  // The last run and how many there will be, so the choice is concrete.
  let summary: string | null = null;
  if (mode === 'count' && count > 0) summary = t('repeat.lastRun', { date: format.date(occurrence(rule, count - 1)), count });
  if (mode === 'date' && endDate) summary = runsToEnd > 0 ? t('repeat.lastRun', { date: format.date(occurrence(rule, runsToEnd - 1)), count: runsToEnd }) : t('repeat.endBeforeStart');

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted">{t('repeat.end')}</p>
      <div className="grid grid-cols-3 gap-2">
        {(['never', 'count', 'date'] as const).map((option) => {
          const Icon = option === 'never' ? InfinityIcon : option === 'count' ? Hash : CalendarCheck;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => choose(option)}
              className={cx(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-center text-[0.8rem] leading-tight font-semibold',
                mode === option ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface active:bg-surface-2',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`repeat.end.${option}`)}
            </button>
          );
        })}
      </div>

      {mode === 'never' && <p className="text-xs text-muted">{t('repeat.neverHint')}</p>}

      {mode === 'count' && (
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((n) => (
            <Chip
              key={n}
              active={count === n && !custom}
              onClick={() => {
                setCustom('');
                onChange({ count: n, endDate: null });
              }}
            >
              {t('recurring.countTimes', { count: n })}
            </Chip>
          ))}
          <input
            inputMode="numeric"
            value={custom}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
              setCustom(digits);
              if (digits) onChange({ count: Math.min(MAX_RUN_COUNT, Math.max(minCount, Number(digits))), endDate: null });
            }}
            placeholder={t('recurring.countCustom')}
            aria-label={t('recurring.countCustom')}
            className="h-9 w-24 rounded-full border border-line bg-surface px-3 text-sm outline-none focus:border-primary"
          />
        </div>
      )}

      {mode === 'date' && endDate && (
        <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-left active:bg-surface-2">
          <span className="text-sm text-muted">{t('repeat.endDate')}</span>
          <span className="font-semibold">{format.date(endDate)}</span>
        </button>
      )}

      {summary && <p className={cx('text-xs', mode === 'date' && runsToEnd === 0 ? 'text-danger' : 'text-muted')}>{summary}</p>}

      {endDate && (
        <DatePickerSheet
          open={picking}
          onClose={() => setPicking(false)}
          value={withDay(endDate, Date.now())}
          onChange={(ms) => onChange({ count: 0, endDate: dayKey(ms) })}
          withTime={false}
          title={t('repeat.endDate')}
        />
      )}
    </div>
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
