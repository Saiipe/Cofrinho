import { ArrowRightLeft, HandCoins, ImageIcon, ReceiptText, Repeat, Scale } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { DayGroup } from '@/domain/stats';
import type { Transaction } from '@/domain/types';
import { useT } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { useFormat } from '../hooks/useFormat';
import { TxAmount } from './Amount';
import { CategoryIcon } from './EntityIcon';
import { cx } from './primitives';

function SystemIcon({ icon: Icon }: { icon: typeof ArrowRightLeft }) {
  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
      <Icon className="size-5" />
    </span>
  );
}

export function TransactionRow({ tx, onClick }: { tx: Transaction; onClick?: () => void }) {
  const t = useT();
  const { categoryMap, accountMap, memberMap, categoryName } = useBook();
  const navigate = useNavigate();
  const category = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
  const accountName = (id: string | null) => (id ? (accountMap.get(id)?.name ?? t('common.unknownAccount')) : null);
  const memberName = (id: string | undefined) => (id ? (memberMap.get(id)?.name ?? '?') : '?');

  let leading = <CategoryIcon category={category} />;
  let title: string;
  let details: (string | null)[];
  switch (tx.kind) {
    case 'transfer':
      leading = <SystemIcon icon={ArrowRightLeft} />;
      title = t('kind.transfer');
      details = [`${accountName(tx.accountId) ?? '—'} → ${accountName(tx.toAccountId) ?? '—'}`, tx.note || null];
      break;
    case 'adjustment':
      leading = <SystemIcon icon={Scale} />;
      title = t('kind.adjustment');
      details = [accountName(tx.accountId), tx.note || null];
      break;
    case 'split_payment':
      leading = <SystemIcon icon={HandCoins} />;
      title = t('split.paidTo', { from: memberName(tx.split?.payerId), to: memberName(tx.split?.toMemberId) });
      details = [tx.note || null];
      break;
    case 'split_expense':
      if (!category) leading = <SystemIcon icon={ReceiptText} />;
      title = tx.note || categoryName(category);
      details = [`${t('split.paidBy')} ${memberName(tx.split?.payerId)}`, tx.note && category ? categoryName(category) : null];
      break;
    default:
      title = categoryName(category);
      details = [tx.note || null, accountName(tx.accountId)];
  }
  const subtitle = details.filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={onClick ?? (() => navigate(`/tx/${tx.id}`))}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[0.95rem] font-medium">{title}</span>
          {tx.scheduleId && <Repeat className="size-3.5 shrink-0 text-faint" aria-label={t('me.recurring')} />}
          {tx.photoIds.length > 0 && <ImageIcon className="size-3.5 shrink-0 text-faint" aria-label={t('tx.photos')} />}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-[0.8rem] text-muted">{subtitle}</span>}
      </span>
      <TxAmount tx={tx} className="shrink-0 text-[0.95rem]" />
    </button>
  );
}

export function DayHeader({ group }: { group: DayGroup<Transaction> }) {
  const { dayHeading, money } = useFormat();
  return (
    <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-1.5">
      <span className="text-[0.8rem] font-semibold text-muted">{dayHeading(group.day)}</span>
      <span className="tabular text-[0.75rem] text-faint">
        {[group.expense ? money(-group.expense) : null, group.income ? money(group.income, undefined, { sign: 'always' }) : null].filter(Boolean).join(' · ')}
      </span>
    </div>
  );
}

/** Records grouped by day, each day in its own card. */
export function TransactionDayList({ groups, className }: { groups: DayGroup<Transaction>[]; className?: string }) {
  return (
    <div className={cx('space-y-2', className)}>
      {groups.map((group) => (
        <section key={group.day} aria-label={group.day}>
          <DayHeader group={group} />
          <div className="mx-4 overflow-hidden rounded-2xl bg-surface shadow-card">
            {group.items.map((tx, index) => (
              <div key={tx.id} className={cx(index > 0 && 'border-t border-line')}>
                <TransactionRow tx={tx} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
