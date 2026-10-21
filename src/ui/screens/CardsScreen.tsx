import { useLiveQuery } from 'dexie-react-hooks';
import { CreditCard, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { bankById } from '@/data/banks';
import { bookTransactions } from '@/data/transactions';
import { buildInvoices, cardRule, cycleOf } from '@/domain/card';
import { todayKey } from '@/domain/dates';
import type { Account, Transaction } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AccountIcon } from '../components/banks';
import { CardLimit } from '../components/CardDetail';
import { Page } from '../components/Page';
import { Card, EmptyState, IconButton, LinkButton } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

export default function CardsScreen() {
  const { t } = useApp();
  const { book, accounts } = useBook();
  const navigate = useNavigate();
  const all = useLiveQuery(() => bookTransactions(book.id), [book.id]);
  const cards = accounts.filter((a) => a.type === 'credit');

  return (
    <Page title={t('cards.title')} back="/me" actions={<IconButton icon={Plus} label={t('cards.new')} onClick={() => navigate('/accounts/new?type=credit')} />}>
      {cards.length === 0 ? (
        <EmptyState icon={CreditCard} title={t('cards.empty')} hint={t('cards.emptyHint')} action={<LinkButton to="/accounts/new?type=credit">{t('cards.new')}</LinkButton>} />
      ) : (
        <div className="space-y-3 px-4">
          {cards.map((card) => (
            <CardTile key={card.id} card={card} transactions={(all ?? []).filter((tx) => tx.accountId === card.id || tx.toAccountId === card.id)} />
          ))}
        </div>
      )}
    </Page>
  );
}

function CardTile({ card, transactions }: { card: Account; transactions: Transaction[] }) {
  const { t } = useApp();
  const format = useFormat();
  const bank = bankById(card.bankId);
  const rule = cardRule(card);
  const today = todayKey();
  const current = rule ? cycleOf(today, rule) : null;
  const invoice = rule && current ? buildInvoices({ id: card.id, initialBalance: card.initialBalance, ...rule }, transactions, today).find((i) => i.key === current.key) : undefined;
  return (
    <Link to={`/accounts/${card.id}`} className="block">
      <Card className="px-4 py-4 active:bg-surface-2">
        <div className="mb-3 flex items-center gap-3">
          <AccountIcon account={card} size="lg" mono={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{card.name}</p>
            <p className="truncate text-xs text-muted">{bank?.name ?? t('accounts.type.credit')}</p>
          </div>
          {current && (
            <div className="shrink-0 text-right">
              <p className="text-[0.7rem] text-muted">{t('cards.dueOn', { date: format.dayMonth(current.due) })}</p>
              <p className="font-semibold tabular">{format.money(Math.max(0, (invoice?.charges ?? 0) - (invoice?.paid ?? 0)), card.currency)}</p>
            </div>
          )}
        </div>
        <CardLimit account={card} transactions={transactions} />
        {!rule && <p className="mt-2 text-xs text-primary">{t('cards.setupHint')}</p>}
      </Card>
    </Link>
  );
}
