import { parseLocaleNumber, toMinor } from '@/domain/money';
import { computeSplit, FULL_PERCENT, type SplitResult } from '@/domain/split';
import type { ID, Member, Minor, SplitMethod } from '@/domain/types';
import type { MessageKey } from '@/i18n';
import { memberLabel } from '@/i18n/labels';
import { useT } from '../app/AppContext';
import { useFormat } from '../hooks/useFormat';
import { Chip, cx, Segmented } from './primitives';

export interface SplitDraft {
  payerId: ID;
  participants: ID[];
  method: SplitMethod;
  /** Raw text typed per member for non-equal methods. */
  inputs: Record<ID, string>;
}

export function initialSplitDraft(members: Member[], me: Member | undefined): SplitDraft {
  return { payerId: me?.id ?? members[0]?.id ?? '', participants: members.map((m) => m.id), method: 'equal', inputs: {} };
}

/** Turns the typed inputs into domain inputs for `computeSplit`. */
export function resolveSplit(draft: SplitDraft, total: Minor, currency: string): SplitResult {
  const inputs = draft.participants.map((memberId) => {
    const value = parseLocaleNumber(draft.inputs[memberId] ?? '') ?? 0;
    const input = draft.method === 'amount' ? toMinor(value, currency) : draft.method === 'percent' ? Math.round(value * 100) : value;
    return { memberId, input };
  });
  return computeSplit(total, draft.method, inputs);
}

const METHODS: SplitMethod[] = ['equal', 'amount', 'shares', 'percent'];

export function SplitEditor({ draft, onChange, members, total, currency }: { draft: SplitDraft; onChange: (draft: SplitDraft) => void; members: Member[]; total: Minor; currency: string }) {
  const t = useT();
  const format = useFormat();
  const nameOf = (m: Member) => memberLabel(m, t);
  const toggleParticipant = (id: ID) => {
    const participants = draft.participants.includes(id) ? draft.participants.filter((p) => p !== id) : [...draft.participants, id];
    onChange({ ...draft, participants: members.map((m) => m.id).filter((m) => participants.includes(m)) });
  };
  const result = total > 0 ? resolveSplit(draft, total, currency) : null;

  let status: string | null = null;
  if (draft.participants.length && total > 0) {
    if (draft.method === 'equal') status = t('split.perPerson', { amount: format.money(Math.floor(total / draft.participants.length), currency) });
    else if (draft.method === 'amount') {
      const typed = draft.participants.reduce((sum, id) => sum + toMinor(parseLocaleNumber(draft.inputs[id] ?? '') ?? 0, currency), 0);
      const diff = total - typed;
      status = diff === 0 ? null : diff > 0 ? t('split.remaining', { amount: format.money(diff, currency) }) : t('split.over', { amount: format.money(-diff, currency) });
    } else if (draft.method === 'percent') {
      const typed = draft.participants.reduce((sum, id) => sum + Math.round((parseLocaleNumber(draft.inputs[id] ?? '') ?? 0) * 100), 0);
      const diff = FULL_PERCENT - typed;
      if (diff !== 0) status = diff > 0 ? t('split.percentLeft', { value: diff / 100 }) : t('split.percentOver', { value: -diff / 100 });
    }
  }
  const shareOf = (id: ID) => (result?.ok ? result.parts.find((p) => p.memberId === id)?.share : undefined);

  return (
    <div className="space-y-4 px-4 py-3">
      <div>
        <p className="mb-2 text-sm font-medium text-muted">{t('split.paidBy')}</p>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <Chip key={m.id} active={draft.payerId === m.id} onClick={() => onChange({ ...draft, payerId: m.id })}>
              {nameOf(m)}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-muted">{t('split.participants')}</p>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <Chip key={m.id} active={draft.participants.includes(m.id)} onClick={() => toggleParticipant(m.id)}>
              {nameOf(m)}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-muted">{t('split.method')}</p>
        <Segmented label={t('split.method')} value={draft.method} onChange={(method) => onChange({ ...draft, method, inputs: {} })} options={METHODS.map((m) => ({ value: m, label: t(`split.method.${m}` as MessageKey) }))} />
      </div>
      {draft.method !== 'equal' && (
        <div className="space-y-2">
          {members
            .filter((m) => draft.participants.includes(m.id))
            .map((m) => (
              <label key={m.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[0.95rem]">{nameOf(m)}</span>
                {draft.method === 'shares' && shareOf(m.id) !== undefined && <span className="tabular text-xs text-muted">{format.money(shareOf(m.id)!, currency)}</span>}
                <input
                  inputMode="decimal"
                  value={draft.inputs[m.id] ?? ''}
                  onChange={(e) => onChange({ ...draft, inputs: { ...draft.inputs, [m.id]: e.target.value.replace(/[^\d.,]/g, '') } })}
                  placeholder={draft.method === 'percent' ? '%' : draft.method === 'shares' ? '1' : '0'}
                  aria-label={nameOf(m)}
                  className="h-11 w-28 rounded-xl border border-line bg-surface px-3 text-right tabular outline-none focus:border-primary"
                />
              </label>
            ))}
        </div>
      )}
      {status && <p className={cx('text-sm', result && !result.ok ? 'text-danger' : 'text-muted')}>{status}</p>}
    </div>
  );
}
