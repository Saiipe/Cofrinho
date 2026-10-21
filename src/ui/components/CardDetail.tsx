import { ChevronLeft, ChevronRight, CreditCard, Info, Plus, Scale, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { bankById } from '@/data/banks';
import { accountBalances } from '@/domain/balances';
import { buildInvoices, cardRule, cycleOf, shiftCycle, type CardInvoice, type InvoiceCycle, type InvoiceStatus } from '@/domain/card';
import { parseDayKey, todayKey } from '@/domain/dates';
import { minorToDecimalString } from '@/domain/money';
import { groupByDay } from '@/domain/stats';
import type { Account, Transaction } from '@/domain/types';
import type { MessageKey } from '@/i18n';
import { useApp } from '../app/AppContext';
import { useFormat } from '../hooks/useFormat';
import { AccountIcon } from './banks';
import { Meter } from './charts';
import { InlineNotice } from './feedback';
import { Badge, Button, Card, cx, IconButton } from './primitives';
import { TransactionDayList } from './TransactionList';

const STATUS_TONE: Record<InvoiceStatus, 'default' | 'primary' | 'warning' | 'danger' | 'success'> = {
  open: 'primary',
  closed: 'warning',
  paid: 'success',
  overdue: 'danger',
  empty: 'default',
};

export function cardUsage(account: Account, transactions: Transaction[]): { used: number; available: number | null; ratio: number | null } {
  const balance = accountBalances([account], transactions).get(account.id) ?? account.initialBalance;
  const used = Math.max(0, -balance);
  const limit = account.creditLimit ?? 0;
  return { used, available: limit > 0 ? limit - used : null, ratio: limit > 0 ? used / limit : null };
}

/** Limit used vs. available, as a meter with both numbers. */
export function CardLimit({ account, transactions }: { account: Account; transactions: Transaction[] }) {
  const { t } = useApp();
  const format = useFormat();
  const { used, available, ratio } = cardUsage(account, transactions);
  if (ratio === null) {
    return (
      <p className="text-sm text-muted">
        {t('cards.used')}: <span className="font-semibold text-fg tabular">{format.money(used, account.currency)}</span> · {t('cards.noLimit')}
      </p>
    );
  }
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[0.8rem]">
        <span className="text-muted">
          {t('cards.used')} <span className="font-semibold text-fg tabular">{format.money(used, account.currency)}</span>
        </span>
        <span className="text-muted">
          {t('cards.available')} <span className={available! < 0 ? 'font-semibold text-danger tabular' : 'font-semibold text-fg tabular'}>{format.money(available!, account.currency)}</span>
        </span>
      </div>
      <Meter ratio={ratio} label={`${t('cards.limit')} ${format.money(account.creditLimit!, account.currency)}`} />
      {available! < 0 && <p className="mt-1 text-xs font-medium text-danger">{t('cards.overLimit', { amount: format.money(-available!, account.currency) })}</p>}
    </div>
  );
}

/** Credit card view: limit, one invoice at a time, its purchases and the next invoices. */
export function CardDetail({ account, transactions, onAdjust }: { account: Account; transactions: Transaction[]; onAdjust: () => void }) {
  const { t } = useApp();
  const format = useFormat();
  const navigate = useNavigate();
  const rule = cardRule(account);
  const today = todayKey();
  const [cycle, setCycle] = useState<InvoiceCycle | null>(() => (rule ? cycleOf(today, rule) : null));
  const invoices = useMemo(() => (rule ? buildInvoices({ id: account.id, initialBalance: account.initialBalance, ...rule }, transactions, today) : []), [rule?.closingDay, rule?.dueDay, account.id, account.initialBalance, transactions, today]);
  const bank = bankById(account.bankId);
  const monthName = (key: string) => {
    const { year, month } = parseDayKey(`${key}-01`);
    return format.monthYear(year, month);
  };

  const header = (
    <Card className="px-4 py-4">
      <div className="mb-3 flex items-center gap-3">
        <AccountIcon account={account} size="lg" mono={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{account.name}</p>
          <p className="truncate text-xs text-muted">
            {[bank?.name, account.creditLimit ? `${t('cards.limit')} ${format.money(account.creditLimit, account.currency)}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <CardLimit account={account} transactions={transactions} />
      <p className="mt-2 text-[0.7rem] text-faint">{t('cards.limitHint')}</p>
    </Card>
  );

  if (!rule || !cycle) {
    return (
      <div className="space-y-4 px-4">
        {header}
        <InlineNotice icon={Info}>
          <p>{t('cards.setupHint')}</p>
          <Link to={`/accounts/${account.id}/edit`} className="mt-1 inline-block font-semibold text-primary">
            {t('cards.setup')}
          </Link>
        </InlineNotice>
        <Button block variant="secondary" icon={Plus} onClick={() => navigate(`/tx/new?kind=expense&account=${account.id}`)}>
          {t('cards.newPurchase')}
        </Button>
      </div>
    );
  }

  const invoice: CardInvoice = invoices.find((i) => i.key === cycle.key) ?? { ...cycle, charges: 0, paid: 0, status: today < cycle.close ? 'open' : 'empty', transactionIds: [] };
  const ids = new Set(invoice.transactionIds);
  const purchases = transactions.filter((tx) => ids.has(tx.id));
  const due = Math.max(0, invoice.charges - invoice.paid);
  const upcoming = invoices.filter((i) => i.close > cycle.close && i.charges > 0).slice(0, 6);
  const pay = () => {
    const note = t('cards.payNote', { month: monthName(invoice.key) });
    navigate(`/tx/new?kind=transfer&toAccount=${account.id}&amount=${minorToDecimalString(due, account.currency)}&note=${encodeURIComponent(note)}`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4 px-4">
        {header}

        <Card className="px-4 pt-2 pb-4">
          <div className="flex items-center">
            <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => setCycle(shiftCycle(cycle, -1, rule))} />
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[0.95rem] font-semibold">{t('cards.invoice', { month: monthName(invoice.key) })}</p>
            </div>
            <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => setCycle(shiftCycle(cycle, 1, rule))} />
          </div>
          <div className="mt-1 flex flex-col items-center text-center">
            <Badge tone={STATUS_TONE[invoice.status]}>{t(`cards.status.${invoice.status}` as MessageKey)}</Badge>
            <p className="mt-2 text-[2rem] leading-tight font-semibold tabular">{format.money(Math.max(0, invoice.charges), account.currency)}</p>
            {invoice.paid > 0 && <p className="text-xs text-muted">{t('cards.paidPart', { amount: format.money(invoice.paid, account.currency) })}</p>}
            <p className="mt-1 text-xs text-muted">
              {today < invoice.close ? t('cards.closesOn', { date: format.date(invoice.close) }) : t('cards.closedOn', { date: format.date(invoice.close) })} · {t('cards.dueOn', { date: format.date(invoice.due) })}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={Plus} onClick={() => navigate(`/tx/new?kind=expense&account=${account.id}`)}>
              {t('cards.newPurchase')}
            </Button>
            <Button icon={CreditCard} onClick={pay} disabled={due <= 0}>
              {t('cards.pay')}
            </Button>
          </div>
        </Card>

        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('cards.upcoming')}</h2>
            <Card className="overflow-hidden">
              {upcoming.map((next, index) => (
                <button
                  key={next.key}
                  type="button"
                  onClick={() => setCycle(next)}
                  className={cx('flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2', index > 0 && 'border-t border-line')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] font-medium">{t('cards.invoice', { month: monthName(next.key) })}</span>
                    <span className="block text-xs text-muted">{t('cards.dueOn', { date: format.date(next.due) })}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular">{format.money(next.charges, account.currency)}</span>
                  <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                </button>
              ))}
            </Card>
          </section>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" icon={Scale} onClick={onAdjust}>
            {t('accounts.adjust')}
          </Button>
          <Link to={`/accounts/${account.id}/edit`} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary active:bg-primary-soft">
            <Settings2 className="size-4" aria-hidden />
            {t('cards.setup')}
          </Link>
        </div>

        <h2 className="px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('cards.purchases')}</h2>
      </div>
      {purchases.length ? <TransactionDayList groups={groupByDay(purchases)} /> : <p className="px-4 py-4 text-center text-sm text-muted">{t('cards.noPurchases')}</p>}
    </div>
  );
}
