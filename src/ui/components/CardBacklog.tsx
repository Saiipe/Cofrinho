import { Minus, Plus, ReceiptText, Shapes, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import type { CardBacklogItem } from '@/data/cards';
import { remainingInstallments } from '@/data/cards';
import { backlogInvoices, dayInCycle, MAX_INSTALLMENTS, type CardRule, type InvoiceCycle } from '@/domain/card';
import { todayKey } from '@/domain/dates';
import type { ID } from '@/domain/types';
import { haptic } from '@/services/feedback';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { useFormat } from '../hooks/useFormat';
import { AmountSheet } from './AmountSheet';
import { CategoryIcon } from './EntityIcon';
import { useFeedback } from './feedback';
import { CategoryPickerSheet } from './pickers';
import { Button, Card, Chip, Divider, IconButton, Row, Segmented, TextField } from './primitives';
import { Sheet } from './Sheet';

export type BacklogMode = CardBacklogItem['kind'];

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) haptic('light');
    onChange(next);
  };
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1 text-[0.95rem] font-medium">{label}</span>
      <IconButton icon={Minus} label={`${label} −`} onClick={() => step(-1)} disabled={value <= min} className="bg-surface-2 disabled:opacity-40" data-no-tip />
      <span className="w-8 text-center text-lg font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <IconButton icon={Plus} label={`${label} +`} onClick={() => step(1)} disabled={value >= max} className="bg-surface-2 disabled:opacity-40" data-no-tip />
    </div>
  );
}

/** Adds one thing that was already on the card before it was registered in the app. */
export function CardBacklogSheet({ open, ...props }: { open: boolean; onClose: () => void; mode: BacklogMode; currency: string; rule: CardRule | null; onAdd: (item: CardBacklogItem) => void }) {
  if (!open) return null;
  return <BacklogForm {...props} />;
}

function BacklogForm({ onClose, mode, currency, rule, onAdd }: { onClose: () => void; mode: BacklogMode; currency: string; rule: CardRule | null; onAdd: (item: CardBacklogItem) => void }) {
  const { t } = useApp();
  const { categoryName, categoryMap } = useBook();
  const format = useFormat();
  const { toast } = useFeedback();
  const today = todayKey();
  const invoices = rule ? backlogInvoices(today, rule) : null;
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<ID | null>(null);
  const [split, setSplit] = useState(false);
  const [count, setCount] = useState(3);
  const [current, setCurrent] = useState(1);
  const [amount, setAmount] = useState(0);
  const [invoice, setInvoice] = useState<InvoiceCycle | null>(invoices?.open ?? null);
  const [sheet, setSheet] = useState<'category' | 'amount' | null>(null);

  const installments = mode === 'purchase' && split ? count : 1;
  const remaining = remainingInstallments({ count: installments, current: Math.min(current, installments) });
  const add = () => {
    if (amount <= 0) {
      toast(t('cards.needsAmount'), { tone: 'error' });
      return setSheet('amount');
    }
    if (mode === 'purchase' && !categoryId && categoryMap.size > 0) {
      toast(t('cards.needsCategory'), { tone: 'error' });
      return setSheet('category');
    }
    onAdd({
      kind: mode,
      description: description.trim(),
      categoryId: mode === 'purchase' ? categoryId : null,
      amount,
      count: installments,
      current: Math.min(current, installments),
      day: invoice ? dayInCycle(invoice, today) : today,
    });
    haptic('success');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === 'purchase' ? t('cards.backlogPurchase') : t('cards.backlogBalance')}
      tall={mode === 'purchase'}
      footer={
        <Button block onClick={add}>
          {t('cards.addToCard')}
        </Button>
      }
    >
      <div className="space-y-4 px-4 pb-4">
        {mode === 'purchase' ? (
          <>
            <TextField label={t('cards.purchaseName')} placeholder={t('cards.purchaseNamePlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={60} />
            <Card className="overflow-hidden border border-line shadow-none">
              <Row
                leading={categoryId ? <CategoryIcon category={categoryMap.get(categoryId)} size="sm" /> : <Shapes className="size-5 text-muted" aria-hidden />}
                title={t('common.category')}
                trailing={categoryId ? categoryName(categoryId) : t('tx.chooseCategory')}
                onClick={() => setSheet('category')}
                chevron
              />
            </Card>
            <Segmented
              label={t('cards.installments')}
              value={split ? 'split' : 'full'}
              onChange={(v) => setSplit(v === 'split')}
              options={[
                { value: 'full', label: t('cards.paymentInFull') },
                { value: 'split', label: t('cards.paymentInstallments') },
              ]}
            />
            {split && (
              <Card className="overflow-hidden border border-line shadow-none">
                <Stepper
                  label={t('cards.totalInstallments')}
                  value={count}
                  min={2}
                  max={MAX_INSTALLMENTS}
                  onChange={(n) => {
                    setCount(n);
                    if (current > n) setCurrent(n);
                  }}
                />
                <Divider />
                <Stepper label={t('cards.currentInstallment')} value={Math.min(current, count)} min={1} max={count} onChange={setCurrent} />
              </Card>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{t('cards.backlogBalanceHint')}</p>
        )}

        <Card className="overflow-hidden border border-line shadow-none">
          <Row
            leading={<Wallet className="size-5 text-muted" aria-hidden />}
            title={mode === 'balance' ? t('common.amount') : split ? t('cards.installmentValue') : t('cards.purchaseValue')}
            trailing={<span className="font-semibold text-fg tabular">{amount > 0 ? format.money(amount, currency) : '—'}</span>}
            onClick={() => setSheet('amount')}
            chevron
          />
        </Card>

        {invoices?.closed && (
          <div>
            <p className="mb-2 text-sm font-medium text-muted">{t('cards.whichInvoice')}</p>
            <div className="flex flex-wrap gap-2">
              {[invoices.closed, invoices.open].map((cycle) => (
                <Chip key={cycle.key} active={invoice?.key === cycle.key} onClick={() => setInvoice(cycle)}>
                  <ReceiptText className="size-4" aria-hidden />
                  {cycle.key === invoices.closed!.key ? t('cards.invoiceClosed', { date: format.dayMonth(cycle.due) }) : t('cards.invoiceOpen', { date: format.dayMonth(cycle.due) })}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {mode === 'purchase' && split && amount > 0 && (
          <p className="rounded-xl bg-primary-soft px-3.5 py-3 text-sm">
            {t('cards.backlogSummary', { count: remaining, from: Math.min(current, count), to: count, total: count })}
            <br />
            <span className="font-semibold">{t('cards.backlogRemaining', { amount: format.money(amount * remaining, currency) })}</span>
          </p>
        )}
      </div>

      <CategoryPickerSheet open={sheet === 'category'} onClose={() => setSheet(null)} kind="expense" value={categoryId} onSelect={(c) => setCategoryId(c?.id ?? null)} />
      <AmountSheet
        open={sheet === 'amount'}
        onClose={() => setSheet(null)}
        title={mode === 'balance' ? t('cards.backlogBalance') : split ? t('cards.installmentValue') : t('cards.purchaseValue')}
        currency={currency}
        initial={amount || null}
        onSave={setAmount}
      />
    </Sheet>
  );
}

/** Pending backlog items shown in the card form before the card is saved. */
export function BacklogList({ items, currency, onRemove }: { items: CardBacklogItem[]; currency: string; onRemove: (index: number) => void }) {
  const { t } = useApp();
  const { categoryMap, categoryName } = useBook();
  const format = useFormat();
  if (!items.length) return null;
  return (
    <Card className="overflow-hidden">
      {items.map((item, index) => {
        const remaining = remainingInstallments(item);
        const subtitle =
          item.kind === 'balance'
            ? t('cards.backlogBalance')
            : item.count > 1
              ? `${item.current}/${item.count} · ${t('cards.backlogRemaining', { amount: format.money(item.amount * remaining, currency) })}`
              : t('cards.paymentInFull');
        return (
          <div key={index}>
            {index > 0 && <Divider inset />}
            <div className="flex min-h-14 items-center gap-3 py-2 pr-1 pl-4">
              {item.kind === 'purchase' ? <CategoryIcon category={item.categoryId ? categoryMap.get(item.categoryId) : undefined} /> : <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden><ReceiptText className="size-5" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.95rem] font-medium">{item.description || (item.kind === 'purchase' ? categoryName(item.categoryId) : t('cards.balanceNote'))}</span>
                <span className="block truncate text-xs text-muted">{subtitle}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular">{format.money(item.amount, currency)}</span>
              <IconButton icon={X} label={t('common.delete')} onClick={() => onRemove(index)} />
            </div>
          </div>
        );
      })}
    </Card>
  );
}
