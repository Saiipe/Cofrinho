import { useLiveQuery } from 'dexie-react-hooks';
import { CircleCheck, ExternalLink, Wallet, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { transactionsInPeriod, saveTransaction } from '@/data/transactions';
import { resolveAmounts } from '@/domain/amounts';
import { displayExpression, evaluate, hasOperator } from '@/domain/calculator';
import { monthPeriodOf, todayKey } from '@/domain/dates';
import { currencyExponent, currencySymbol, minorToDecimalString, toMinor } from '@/domain/money';
import type { CategoryKind, ID } from '@/domain/types';
import type { MessageKey } from '@/i18n';
import { haptic, playSound } from '@/services/feedback';
import { rewardRecording } from '@/services/garden';
import { getLockConfig } from '@/services/lock';
import { closeQuickAdd, openInApp, updateWidgets } from '@/services/native';
import { useApp } from '../app/AppContext';
import { useBackHandler } from '../app/back';
import { useBook } from '../app/BookContext';
import { widgetCategories, widgetPayload } from '../app/widgets';
import { CategoryIcon } from '../components/EntityIcon';
import { useFeedback } from '../components/feedback';
import { Keypad } from '../components/Keypad';
import { AccountPickerSheet, CategoryPickerSheet } from '../components/pickers';
import { cx, IconButton, Segmented } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

const RECENT_DAYS = 60;

/**
 * Compact record form shown in the Android "mini screen" that the widgets open over the home
 * screen: kind, amount, category and account, then it saves and closes by itself.
 * In the browser it behaves as a normal page.
 */
export default function QuickAddScreen() {
  const { settings, t, locale } = useApp();
  const { book, isSplit, accountMap, categoryMap, topCategories, categoryName, defaultAccount, rate } = useBook();
  const format = useFormat();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get('category');
  const [kind, setKind] = useState<CategoryKind>(() => (params.get('kind') === 'income' ? 'income' : 'expense'));
  const [categoryId, setCategoryId] = useState<ID | null>(() => (requested && categoryMap.has(requested) ? requested : null));
  const [accountId, setAccountId] = useState<ID | null>(defaultAccount?.id ?? null);
  const [expression, setExpression] = useState('');
  const [sheet, setSheet] = useState<'category' | 'account' | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const close = async () => {
    if (!(await closeQuickAdd())) navigate('/', { replace: true });
  };
  useBackHandler(true, () => void close());

  // Categories used in the last weeks come first.
  const recent = useLiveQuery(() => transactionsInPeriod(book.id, { start: Date.now() - RECENT_DAYS * 86_400_000, end: Date.now() + 86_400_000 }), [book.id]);
  const shortcuts = useMemo(() => {
    const ranked = widgetCategories(recent ?? [], categoryMap, topCategories(kind), 12, kind);
    const selected = categoryId ? categoryMap.get(categoryId) : undefined;
    return selected && !ranked.some((c) => c.id === selected.id) ? [selected, ...ranked.slice(0, 11)] : ranked;
  }, [recent, kind, categoryMap, topCategories, categoryId]);

  const account = accountId ? accountMap.get(accountId) : undefined;
  const currency = account?.currency ?? book.currency;
  const evaluated = evaluate(expression);
  const amount = evaluated !== null && evaluated > 0 ? toMinor(evaluated, currency) : 0;

  const fail = (key: MessageKey, values?: Record<string, string>) => {
    haptic('warning');
    toast(t(key, values), { tone: 'error' });
  };

  const save = async () => {
    if (saving) return;
    if (amount <= 0) return fail('tx.amountRequired');
    if (!categoryId && categoryMap.size > 0) return fail('quick.pickCategory');
    const resolved = resolveAmounts({ kind, currency, originalAmount: amount, bookCurrency: book.currency, accountCurrency: account?.currency ?? null }, rate);
    if (!resolved.ok) return fail('tx.missingRate', resolved.missing);
    setSaving(true);
    try {
      await saveTransaction({ bookId: book.id, kind, date: Date.now(), currency, originalAmount: amount, categoryId, accountId: account?.id ?? null, toAccountId: null, note: '', photoIds: [], ...resolved.value });
      const reward = await rewardRecording();
      playSound(reward.reasons.length ? 'coin' : 'save');
      haptic('success');
      setDone(true);
      // Refresh the widgets before the window goes away.
      const period = monthPeriodOf(todayKey(), settings.monthStartDay);
      const [month, lock] = await Promise.all([transactionsInPeriod(book.id, period), getLockConfig()]);
      const top = widgetCategories(month, categoryMap, topCategories('expense')).map((c) => ({ id: c.id, name: categoryName(c) }));
      await updateWidgets(widgetPayload({ transactions: month, period, hidden: settings.hideAmounts || lock.enabled, shortcuts: top }, format, t));
      window.setTimeout(() => void close(), 900);
    } catch {
      setSaving(false);
      toast(t('common.error'), { tone: 'error' });
    }
  };

  const moreOptions = async () => {
    const query = new URLSearchParams({ kind });
    if (amount > 0) query.set('amount', minorToDecimalString(amount, currency));
    if (categoryId) query.set('category', categoryId);
    if (account) query.set('account', account.id);
    const path = `/tx/new?${query.toString()}`;
    if (!(await openInApp(path))) navigate(path, { replace: true });
  };

  if (isSplit) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col justify-end">
        <div className="absolute inset-0 animate-fade-in bg-[var(--overlay)]" onClick={() => void close()} aria-hidden />
        <section role="dialog" aria-modal="true" aria-label={t('quick.title')} className="relative mx-auto w-full max-w-lg animate-sheet-in rounded-t-3xl bg-surface px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-center shadow-2xl">
          <p className="text-muted">{t('quick.splitBook')}</p>
          <button type="button" onClick={() => void moreOptions()} className="mx-auto mt-4 flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 font-semibold text-primary-fg">
            <ExternalLink className="size-4" aria-hidden />
            {t('quick.moreOptions')}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 animate-fade-in bg-[var(--overlay)]" onClick={() => void close()} aria-hidden />
      <section role="dialog" aria-modal="true" aria-label={t('quick.title')} className="relative mx-auto w-full max-w-lg animate-sheet-in rounded-t-3xl bg-surface pb-safe shadow-2xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        {done ? (
          <div className="flex flex-col items-center px-6 pt-8 pb-12 text-center" role="status">
            <CircleCheck className="size-14 animate-pop-in text-income" aria-hidden />
            <p className="mt-3 text-xl font-semibold">{t('quick.saved')}</p>
            <p className="mt-1 text-muted">
              {kind === 'expense' ? '−' : '+'}
              {format.money(amount, currency)} · {categoryName(categoryId)}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 pt-1.5">
              <Segmented
                className="flex-1"
                label={t('common.type')}
                value={kind}
                onChange={(next) => {
                  setKind(next);
                  const selected = categoryId ? categoryMap.get(categoryId) : undefined;
                  if (selected && selected.kind !== next) setCategoryId(null);
                }}
                options={[
                  { value: 'expense', label: t('kind.expense') },
                  { value: 'income', label: t('kind.income') },
                ]}
              />
              <IconButton icon={X} label={t('common.close')} onClick={() => void close()} />
            </div>

            <div className="no-scrollbar flex gap-1 overflow-x-auto px-2 pt-3" data-no-tip>
              {shortcuts.map((category) => {
                const active = category.id === categoryId || categoryMap.get(categoryId ?? '')?.parentId === category.id;
                return (
                  <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} aria-pressed={active} className="flex w-[4.6rem] shrink-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 active:bg-surface-2">
                    <span className={cx('rounded-full p-0.5 ring-2', active ? 'ring-primary' : 'ring-transparent')}>
                      <CategoryIcon category={category} />
                    </span>
                    <span className={cx('w-full truncate text-center text-[0.72rem] leading-tight', active ? 'font-semibold text-fg' : 'text-muted')}>{categoryName(category)}</span>
                  </button>
                );
              })}
              <button type="button" onClick={() => setSheet('category')} className="flex w-[4.6rem] shrink-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 active:bg-surface-2">
                <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-line text-sm font-semibold text-muted">…</span>
                <span className="w-full truncate text-center text-[0.72rem] leading-tight text-muted">{t('quick.more')}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 pt-2">
              <button type="button" onClick={() => setSheet('account')} className="flex h-9 min-w-0 shrink items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium">
                <Wallet className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{account?.name ?? t('tx.noAccount')}</span>
              </button>
              <div className="min-w-0 flex-1 text-right" aria-live="polite">
                <span className={cx('block truncate font-semibold tabular', hasOperator(expression) ? 'text-lg text-muted' : 'text-[1.8rem] leading-tight')}>
                  {currencySymbol(currency, locale)} {expression ? displayExpression(expression, format.decimalSeparator) : '0'}
                </span>
                {hasOperator(expression) && <span className="block truncate text-[1.4rem] leading-tight font-semibold tabular">= {format.money(amount, currency)}</span>}
              </div>
            </div>

            <Keypad expression={expression} onChange={setExpression} onSubmit={() => void save()} decimals={currencyExponent(currency)} decimalSeparator={format.decimalSeparator} full={settings.calculator === 'full'} submitDisabled={saving} />

            <button type="button" onClick={() => void moreOptions()} className="mx-auto mb-2 flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary active:bg-primary-soft">
              <ExternalLink className="size-4" aria-hidden />
              {t('quick.moreOptions')}
            </button>
          </>
        )}
      </section>

      <CategoryPickerSheet open={sheet === 'category'} onClose={() => setSheet(null)} kind={kind} value={categoryId} onSelect={(c) => setCategoryId(c?.id ?? null)} />
      <AccountPickerSheet open={sheet === 'account'} onClose={() => setSheet(null)} value={accountId} onSelect={(a) => setAccountId(a?.id ?? null)} />
    </div>
  );
}
