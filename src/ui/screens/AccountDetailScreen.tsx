import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Scale, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { accountBalance, adjustAccountBalance } from '@/data/accounts';
import { db } from '@/data/db';
import { convertMinor } from '@/domain/money';
import { groupByDay } from '@/domain/stats';
import { accountTypeLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AmountSheet } from '../components/AmountSheet';
import { AccountIcon } from '../components/banks';
import { CardDetail } from '../components/CardDetail';
import { useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { Button, Card, EmptyState, IconButton } from '../components/primitives';
import { TransactionDayList } from '../components/TransactionList';
import { useFormat } from '../hooks/useFormat';

export default function AccountDetailScreen() {
  const { id = '' } = useParams();
  const { t } = useApp();
  const { book, accountMap, rate } = useBook();
  const format = useFormat();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [adjusting, setAdjusting] = useState(false);
  const account = accountMap.get(id);
  const txs = useLiveQuery(
    async () => {
      const [from, to] = await Promise.all([db.transactions.where('accountId').equals(id).toArray(), db.transactions.where('toAccountId').equals(id).toArray()]);
      const merged = new Map([...from, ...to].map((tx) => [tx.id, tx]));
      return [...merged.values()];
    },
    [id],
  );
  const balance = useLiveQuery(async () => (account ? accountBalance(account) : 0), [account, txs]);
  const groups = useMemo(() => groupByDay(txs ?? []).slice(0, 120), [txs]);

  if (!account) {
    return (
      <Page title={t('accounts.title')} back="/accounts">
        <EmptyState icon={Wallet} title={t('common.notFound')} />
      </Page>
    );
  }

  const bookRate = account.currency === book.currency ? null : rate(account.currency, book.currency);
  const converted = bookRate !== null && balance !== undefined ? convertMinor(balance, account.currency, book.currency, bookRate) : null;

  const adjust = async (target: number) => {
    const result = await adjustAccountBalance(book, account, target, { note: t('kind.adjustment'), photoIds: [] });
    if (result === 'no_change') toast(t('accounts.noChange'));
    else if (result === 'missing_rate') toast(t('tx.missingRate', { from: account.currency, to: book.currency }), { tone: 'error' });
    else toast(t('accounts.adjusted'), { tone: 'success' });
  };

  const adjustSheet = (
    <AmountSheet open={adjusting} onClose={() => setAdjusting(false)} title={t('accounts.newBalance')} hint={t('accounts.adjustHint')} currency={account.currency} initial={balance ?? 0} allowNonPositive onSave={(v) => void adjust(v)} />
  );

  if (account.type === 'credit') {
    return (
      <Page title={account.name} back="/cards" actions={<IconButton icon={Pencil} label={t('common.edit')} onClick={() => navigate(`/accounts/${account.id}/edit`)} />}>
        {txs && <CardDetail account={account} transactions={txs} onAdjust={() => setAdjusting(true)} />}
        {adjustSheet}
      </Page>
    );
  }

  return (
    <Page title={account.name} back="/accounts" actions={<IconButton icon={Pencil} label={t('common.edit')} onClick={() => navigate(`/accounts/${account.id}/edit`)} />}>
      <div className="space-y-4 px-4">
        <Card className="flex flex-col items-center px-6 py-6 text-center">
          <AccountIcon account={account} size="xl" mono={false} />
          <p className="mt-3 text-sm text-muted">
            {accountTypeLabel(account.type, t)} · {account.currency}
          </p>
          <p className="mt-1 text-sm text-muted">{t('accounts.balance')}</p>
          <p className={`text-[2rem] leading-tight font-semibold ${balance !== undefined && balance < 0 ? 'text-danger' : ''}`}>{balance === undefined ? '…' : format.money(balance, account.currency)}</p>
          {converted !== null && <p className="text-xs text-muted">≈ {format.money(converted)}</p>}
          <Button variant="secondary" size="sm" icon={Scale} className="mt-4" onClick={() => setAdjusting(true)}>
            {t('accounts.adjust')}
          </Button>
        </Card>
        {account.note && <p className="px-1 text-sm text-muted">{account.note}</p>}
        <h2 className="px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('accounts.activity')}</h2>
      </div>
      {txs && txs.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">{t('home.empty')}</p> : <TransactionDayList groups={groups} />}
      {adjustSheet}
    </Page>
  );
}
