import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { db } from '@/data/db';
import { setCategoryBudget, setTotalBudget } from '@/data/budgets';
import { transactionsInPeriod } from '@/data/transactions';
import { budgetProgress, dailyAllowance } from '@/domain/budget';
import { todayKey } from '@/domain/dates';
import { categoryBreakdown } from '@/domain/stats';
import type { ID } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AmountSheet } from '../components/AmountSheet';
import { Meter } from '../components/charts';
import { CategoryIcon } from '../components/EntityIcon';
import { useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { Button, Card, Divider, IconButton } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';
import { usePeriod } from '../hooks/usePeriod';

export default function BudgetScreen() {
  const { t } = useApp();
  const { book, categoryMap, categoryName, topCategories } = useBook();
  const format = useFormat();
  const { toast } = useFeedback();
  const { period, shift } = usePeriod('month');
  const budgets = useLiveQuery(() => db.budgets.where('bookId').equals(book.id).toArray(), [book.id]);
  const txs = useLiveQuery(() => transactionsInPeriod(book.id, period), [book.id, period.start, period.end]);
  const [editing, setEditing] = useState<ID | 'total' | null>(null);

  const refs = useMemo(() => new Map([...categoryMap].map(([id, c]) => [id, { id, parentId: c.parentId }])), [categoryMap]);
  const spentByCategory = useMemo(() => new Map(categoryBreakdown(txs ?? [], 'expense', refs).map((s) => [s.categoryId, s.amount])), [txs, refs]);
  const spentTotal = [...spentByCategory.values()].reduce((a, b) => a + b, 0);
  const total = budgets?.find((b) => b.categoryId === null)?.amount ?? 0;
  const byCategory = new Map((budgets ?? []).filter((b) => b.categoryId).map((b) => [b.categoryId!, b.amount]));
  const progress = budgetProgress(total, spentTotal);
  const allowance = dailyAllowance(progress.remaining, period, todayKey());
  const editingCategory = editing && editing !== 'total' ? categoryMap.get(editing) : undefined;

  const saveTotal = async (amount: number | null) => {
    const result = await setTotalBudget(book.id, amount);
    if (!result.ok) toast(t('budget.totalTooLow', { amount: format.money(result.minimum) }), { tone: 'error' });
  };
  const saveCategory = async (categoryId: ID, amount: number | null) => {
    const result = await setCategoryBudget(book.id, categoryId, amount);
    if (result.autoUpdated && result.total !== null) toast(t('budget.autoUpdated', { amount: format.money(result.total) }));
  };

  return (
    <Page title={t('budget.title')} back="/me">
      <div className="space-y-4 px-4">
        <div className="flex items-center justify-between">
          <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => shift(-1)} />
          <div className="text-center">
            <p className="font-semibold">{format.periodLabel(period)}</p>
            <p className="text-xs text-muted">{format.periodRange(period)}</p>
          </div>
          <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => shift(1)} />
        </div>

        <Card className="px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{t('budget.total')}</p>
              <p className="text-[1.75rem] leading-tight font-semibold">{total ? format.money(total) : t('budget.notSet')}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setEditing('total')}>
              {total ? t('common.edit') : t('budget.set')}
            </Button>
          </div>
          {total > 0 && (
            <>
              <Meter ratio={progress.ratio} label={t('budget.total')} className="mt-4" />
              <div className="mt-2 flex justify-between text-[0.8rem] text-muted">
                <span>
                  {t('budget.spent')}: <b className="text-fg">{format.money(spentTotal)}</b>
                </span>
                <span>
                  {progress.exceeded ? t('budget.over') : t('budget.left')}: <b className="text-fg">{format.money(Math.abs(progress.remaining))}</b>
                </span>
              </div>
              {progress.exceeded ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="size-4 text-[var(--status-critical)]" aria-hidden />
                  {t('budget.exceeded')}
                </p>
              ) : (
                allowance.perDay > 0 && <p className="mt-3 text-sm text-muted">{t('budget.perDay', { amount: format.money(allowance.perDay), days: allowance.daysLeft })}</p>
              )}
            </>
          )}
        </Card>

        <section>
          <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('budget.byCategory')}</h2>
          <Card className="overflow-hidden">
            {topCategories('expense').map((category, index) => {
              const budget = byCategory.get(category.id) ?? 0;
              const spent = spentByCategory.get(category.id) ?? 0;
              const p = budgetProgress(budget, spent);
              return (
                <div key={category.id}>
                  {index > 0 && <Divider inset />}
                  <button type="button" onClick={() => setEditing(category.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                    <CategoryIcon category={category} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{categoryName(category)}</span>
                        <span className="shrink-0 text-sm tabular">
                          {budget ? (
                            <>
                              {format.money(spent)} <span className="text-muted">/ {format.money(budget)}</span>
                            </>
                          ) : (
                            <span className="text-muted">{spent ? format.money(spent) : t('budget.notSet')}</span>
                          )}
                        </span>
                      </span>
                      {budget > 0 && <Meter ratio={p.ratio} label={categoryName(category)} className="mt-2" />}
                    </span>
                  </button>
                </div>
              );
            })}
          </Card>
          <p className="mt-2 px-1 text-xs text-muted">{t('budget.hint')}</p>
        </section>
      </div>

      <AmountSheet
        open={editing === 'total'}
        onClose={() => setEditing(null)}
        title={t('budget.total')}
        currency={book.currency}
        initial={total || null}
        onSave={(amount) => void saveTotal(amount)}
        clearLabel={total ? t('budget.remove') : undefined}
        onClear={() => void saveTotal(null)}
      />
      <AmountSheet
        open={Boolean(editingCategory)}
        onClose={() => setEditing(null)}
        title={editingCategory ? t('budget.amountFor', { name: categoryName(editingCategory) }) : ''}
        currency={book.currency}
        initial={editingCategory ? (byCategory.get(editingCategory.id) ?? null) : null}
        onSave={(amount) => editingCategory && void saveCategory(editingCategory.id, amount)}
        clearLabel={editingCategory && byCategory.get(editingCategory.id) ? t('budget.remove') : undefined}
        onClear={() => editingCategory && void saveCategory(editingCategory.id, null)}
      />
    </Page>
  );
}
