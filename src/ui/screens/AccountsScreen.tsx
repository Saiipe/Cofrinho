import { useLiveQuery } from 'dexie-react-hooks';
import { Landmark, Pin, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { deleteAccount, reorderAccounts, setDefaultAccount } from '@/data/accounts';
import { bookTransactions } from '@/data/transactions';
import { accountBalances, balanceSheet } from '@/domain/balances';
import { convertMinor } from '@/domain/money';
import { accountTypeLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { EntityIcon } from '../components/EntityIcon';
import { useFeedback } from '../components/feedback';
import { SortableList, SwipeRow } from '../components/gestures';
import { Page } from '../components/Page';
import { Badge, Card, cx, EmptyState, IconButton, LinkButton } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

export default function AccountsScreen() {
  const { t } = useApp();
  const { book, accounts, rate } = useBook();
  const format = useFormat();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const all = useLiveQuery(() => bookTransactions(book.id), [book.id]);
  const balances = accountBalances(accounts, all ?? []);
  const sheet = balanceSheet(accounts, balances, (amount, currency) => {
    const r = rate(currency, book.currency);
    return r === null ? 0 : convertMinor(amount, currency, book.currency, r);
  });

  const remove = async (id: string, name: string) => {
    if (await confirm({ title: t('accounts.deleteConfirm', { name }), message: t('accounts.deleteHint'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteAccount(id);
      toast(t('common.deleted'));
    }
  };

  return (
    <Page title={t('accounts.title')} back="/me" actions={<IconButton icon={Plus} label={t('accounts.new')} onClick={() => navigate('/accounts/new')} />}>
      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={t('accounts.empty')}
          hint={t('accounts.emptyHint')}
          action={<LinkButton to="/accounts/new">{t('accounts.new')}</LinkButton>}
        />
      ) : (
        <div className="space-y-4 px-4">
          <Card className="grid grid-cols-3 divide-x divide-line px-1 py-3.5 text-center">
            {[
              { label: t('accounts.net'), value: sheet.net },
              { label: t('accounts.assets'), value: sheet.assets },
              { label: t('accounts.liabilities'), value: sheet.liabilities },
            ].map((item) => (
              <div key={item.label} className="min-w-0 px-2">
                <p className="text-xs text-muted">{item.label}</p>
                <p className="mt-0.5 truncate font-semibold">{format.money(item.value)}</p>
              </div>
            ))}
          </Card>
          <Card className="overflow-hidden">
            <SortableList
              items={accounts}
              onReorder={(ids) => void reorderAccounts(ids)}
              renderItem={(account, handle) => (
                <SwipeRow label={t('common.delete')} onDelete={() => void remove(account.id, account.name)}>
                  <div className="flex items-center border-b border-line pr-1 last:border-0">
                    <Link to={`/accounts/${account.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:bg-surface-2">
                      <EntityIcon icon={account.icon} color={account.color} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{account.name}</span>
                          {account.excludeFromTotals && <Badge>{t('charts.excluded')}</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {accountTypeLabel(account.type, t)} · {account.currency}
                        </span>
                      </span>
                      <span className={cx('shrink-0 font-semibold tabular', (balances.get(account.id) ?? 0) < 0 && 'text-danger')}>{format.money(balances.get(account.id) ?? 0, account.currency)}</span>
                    </Link>
                    <IconButton
                      icon={Pin}
                      label={t('accounts.makeDefault')}
                      aria-pressed={account.isDefault}
                      onClick={() => void setDefaultAccount(book.id, account.isDefault ? null : account.id)}
                      className={account.isDefault ? 'text-primary' : 'text-faint'}
                    />
                    {handle}
                  </div>
                </SwipeRow>
              )}
            />
          </Card>
          <p className="px-1 text-xs text-muted">
            {t('accounts.defaultHint')} · {t('common.dragToSort')}
          </p>
        </div>
      )}
    </Page>
  );
}
