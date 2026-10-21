import { Check, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { bankById, bankLogoUrl, BANKS, popularBanks, searchBanks, type Bank } from '@/data/banks';
import type { Account } from '@/domain/types';
import { useT } from '../app/AppContext';
import { EntityIcon, type EntityIconProps } from './EntityIcon';
import { Sheet } from './Sheet';
import { cx } from './primitives';

const BOX = { sm: 'size-8', md: 'size-10', lg: 'size-12', xl: 'size-16' } as const;

/** Institution logo on a white rounded tile (logos are drawn for light backgrounds). */
export function BankLogo({ bank, size = 'md', className }: { bank: Bank; size?: keyof typeof BOX; className?: string }) {
  const url = bankLogoUrl(bank);
  if (!url) {
    const initials = bank.name
      .split(/\s+/)
      .filter((word) => /^[A-Za-zÀ-ú0-9]/.test(word))
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('');
    return (
      <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-[0.8rem] font-bold text-muted', BOX[size], className)} aria-hidden>
        {initials}
      </span>
    );
  }
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-line', BOX[size], className)} aria-hidden>
      <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-contain" />
    </span>
  );
}

/** Account glyph: the bank logo when the account has one, otherwise its icon and color. */
export function AccountIcon({ account, size = 'md', mono }: { account: Pick<Account, 'icon' | 'color' | 'bankId'>; size?: EntityIconProps['size']; mono?: boolean }) {
  const bank = bankById(account.bankId);
  if (bank?.logo) return <BankLogo bank={bank} size={size} />;
  return <EntityIcon icon={account.icon} color={account.color} size={size} mono={mono} />;
}

export function BankPickerSheet({ open, onClose, value, onSelect }: { open: boolean; onClose: () => void; value: string | null; onSelect: (bank: Bank | null) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const results = useMemo(() => (deferred.trim() ? searchBanks(deferred) : null), [deferred]);
  const popular = useMemo(() => popularBanks(), []);
  const choose = (bank: Bank | null) => {
    onSelect(bank);
    onClose();
    setQuery('');
  };
  const row = (bank: Bank) => (
    <button key={bank.id} type="button" onClick={() => choose(bank)} aria-pressed={bank.id === value} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2">
      <BankLogo bank={bank} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{bank.name}</span>
        <span className="block truncate text-xs text-muted">{[bank.id.startsWith('ispb-') ? null : bank.id, bank.aka?.join(', ')].filter(Boolean).join(' · ')}</span>
      </span>
      {bank.id === value && <Check className="size-5 text-primary" aria-hidden />}
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title={t('banks.choose')} tall>
      <div className="sticky top-0 z-10 bg-surface px-4 pb-2">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <Search className="size-4 text-faint" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('banks.search')} className="h-full min-w-0 flex-1 bg-transparent outline-none" enterKeyHint="search" />
        </label>
      </div>
      {results ? (
        <div className="pb-4">
          {results.length ? results.map(row) : <p className="px-6 py-8 text-center text-sm text-muted">{t('banks.notFound')}</p>}
        </div>
      ) : (
        <div className="pb-4">
          <button type="button" onClick={() => choose(null)} className={cx('mx-4 mb-1 flex h-10 items-center rounded-xl px-3 text-sm', value === null ? 'bg-primary-soft font-semibold text-primary' : 'text-muted')}>
            {t('banks.none')}
          </button>
          <p className="px-5 pt-2 pb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t('banks.popular')}</p>
          <div className="grid grid-cols-4 gap-y-1 px-2">
            {popular.map((bank) => (
              <button key={bank.id} type="button" onClick={() => choose(bank)} aria-pressed={bank.id === value} className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 active:bg-surface-2">
                <span className={cx('rounded-full p-0.5 ring-2', bank.id === value ? 'ring-primary' : 'ring-transparent')}>
                  <BankLogo bank={bank} size="lg" />
                </span>
                <span className={cx('w-full truncate text-center text-[0.72rem] leading-tight', bank.id === value ? 'font-semibold text-fg' : 'text-muted')}>{bank.name}</span>
              </button>
            ))}
          </div>
          <p className="px-5 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            {t('banks.all')} ({BANKS.length})
          </p>
          {BANKS.map(row)}
          <p className="px-5 pt-3 text-[0.7rem] text-faint">{t('banks.source')}</p>
        </div>
      )}
    </Sheet>
  );
}
