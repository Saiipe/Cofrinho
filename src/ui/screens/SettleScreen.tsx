import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { bookTransactions } from '@/data/transactions';
import { minorToDecimalString } from '@/domain/money';
import { isSettled, memberBalances, pairwiseDebts, smartSettlement, type Debt } from '@/domain/split';
import { memberLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { Page } from '../components/Page';
import { Button, Card, cx, Divider, EmptyState, Segmented } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

export default function SettleScreen() {
  const { t } = useApp();
  const { book, members, memberMap } = useBook();
  const format = useFormat();
  const navigate = useNavigate();
  const [view, setView] = useState<'smart' | 'direct'>('smart');
  const all = useLiveQuery(() => bookTransactions(book.id), [book.id]);
  if (!all) return <Page title={t('split.settleUp')} back>{null}</Page>;

  const balances = memberBalances(all, members.map((m) => m.id));
  const plan = view === 'smart' ? smartSettlement(balances) : pairwiseDebts(all);
  const name = (id: string) => memberLabel(memberMap.get(id), t);
  const record = (debt: Debt) => navigate(`/tx/new?kind=split_payment&from=${debt.from}&to=${debt.to}&amount=${minorToDecimalString(debt.amount, book.currency)}`);

  return (
    <Page title={t('split.settleUp')} back>
      <div className="space-y-4 px-4">
        <section>
          <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('split.balances')}</h2>
          <Card className="overflow-hidden">
            {members.map((member, index) => {
              const value = balances.get(member.id) ?? 0;
              return (
                <div key={member.id}>
                  {index > 0 && <Divider />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary" aria-hidden>
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{name(member.id)}</span>
                    <span className={cx('text-sm font-semibold tabular', value > 0 ? 'text-income' : value < 0 ? 'text-fg' : 'text-muted')}>
                      {value > 0 ? t('split.lent', { amount: format.money(value) }) : value < 0 ? t('split.borrowed', { amount: format.money(-value) }) : t('split.even')}
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>
        </section>

        {isSettled(balances) ? (
          <Card>
            <EmptyState icon={PartyPopper} title={t('split.allSettled')} />
          </Card>
        ) : (
          <section>
            <Segmented
              label={t('split.settleUp')}
              value={view}
              onChange={setView}
              options={[
                { value: 'smart', label: t('split.smart') },
                { value: 'direct', label: t('split.direct') },
              ]}
            />
            {view === 'smart' && <p className="mt-2 px-1 text-xs text-muted">{t('split.smartHint')}</p>}
            <Card className="mt-3 overflow-hidden">
              {plan.map((debt, index) => (
                <div key={`${debt.from}-${debt.to}`}>
                  {index > 0 && <Divider />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[0.95rem] font-medium">
                        <span className="truncate">{name(debt.from)}</span>
                        <ArrowRight className="size-4 shrink-0 text-faint" aria-hidden />
                        <span className="truncate">{name(debt.to)}</span>
                      </span>
                      <span className="block text-sm text-muted tabular">{format.money(debt.amount)}</span>
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => record(debt)}>
                      {t('split.record')}
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          </section>
        )}
      </div>
    </Page>
  );
}
