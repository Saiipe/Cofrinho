import { useLiveQuery } from 'dexie-react-hooks';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '@/data/db';
import { deleteSchedule, runDueSchedules, saveSchedule } from '@/data/schedules';
import { dayKey, todayKey, withDay } from '@/domain/dates';
import { NOTE_MAX } from '@/domain/defaults';
import { dueOccurrences, FREQUENCIES, initialLastRun, MAX_RUN_COUNT, nextOccurrence, recomputeLastRun, runsUntil, SCHEDULE_NAME_MAX } from '@/domain/schedule';
import type { DayKey, Frequency, ID, Schedule } from '@/domain/types';
import { frequencyLabel } from '@/i18n/labels';
import type { MessageKey } from '@/i18n';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AmountSheet } from '../components/AmountSheet';
import { CategoryIcon } from '../components/EntityIcon';
import { InlineNotice, useFeedback } from '../components/feedback';
import { Page, useGoBack } from '../components/Page';
import { AccountPickerSheet, CategoryPickerSheet, CurrencyPickerSheet, DatePickerSheet } from '../components/pickers';
import { Button, Card, Chip, Divider, Row, Segmented, SwitchRow, TextField } from '../components/primitives';
import { RepeatEndPicker } from '../components/TransactionExtras';
import { useFormat } from '../hooks/useFormat';

type Kind = Schedule['kind'];

export default function RecurringFormScreen() {
  const { id } = useParams();
  const existing = useLiveQuery(async () => (id ? ((await db.schedules.get(id)) ?? null) : null), [id]);
  if (id && existing === undefined) return <div className="min-h-dvh bg-bg" />;
  return <RecurringForm key={id ?? 'new'} existing={existing ?? null} />;
}

function RecurringForm({ existing }: { existing: Schedule | null }) {
  const { t } = useApp();
  const { book, accountMap, categoryMap, categoryName, defaultAccount } = useBook();
  const format = useFormat();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const goBack = useGoBack('/recurring');
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'expense');
  const [categoryId, setCategoryId] = useState<ID | null>(existing?.categoryId ?? null);
  const [accountId, setAccountId] = useState<ID | null>(existing ? existing.accountId : (defaultAccount?.id ?? null));
  const [toAccountId, setToAccountId] = useState<ID | null>(existing?.toAccountId ?? null);
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [currency, setCurrency] = useState(existing?.currency ?? book.currency);
  const [toAmount, setToAmount] = useState<number | null>(existing?.toAmount ?? null);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayKey());
  const [count, setCount] = useState(existing?.totalCount ?? 0);
  const [endDate, setEndDate] = useState<DayKey | null>(existing?.endDate ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [paused, setPaused] = useState(existing?.status === 'paused');
  // New plans record the start date (and any dates since) right away, so they show up in the list at once.
  const [backfill, setBackfill] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'category' | 'account' | 'from' | 'to' | 'amount' | 'toAmount' | 'currency' | 'date' | null>(null);

  const account = accountId ? accountMap.get(accountId) : undefined;
  const toAccount = toAccountId ? accountMap.get(toAccountId) : undefined;
  const entryCurrency = kind === 'transfer' ? (account?.currency ?? book.currency) : currency;
  const needsToAmount = kind === 'transfer' && account && toAccount && account.currency !== toAccount.currency;
  const category = categoryId ? categoryMap.get(categoryId) : undefined;

  const rule = { frequency, startDate };
  const today = todayKey();
  const ruleChanged = existing && (existing.frequency !== frequency || existing.startDate !== startDate || existing.totalCount !== count);
  const canBackfill = !existing && startDate <= today;
  const lastRun = existing ? (ruleChanged ? recomputeLastRun(rule, existing.lastRunDate, today) : existing.lastRunDate) : canBackfill && backfill ? null : initialLastRun(rule, today);
  const next = nextOccurrence({ ...rule, lastRunDate: lastRun, totalCount: count, runCount: existing?.runCount ?? 0, endDate });
  const backfillCount = canBackfill ? dueOccurrences({ ...rule, lastRunDate: null, totalCount: count, runCount: 0, endDate }, today).length : 0;

  const fail = (key: MessageKey) => {
    setError(t(key));
    toast(t(key), { tone: 'error' });
  };

  const save = async () => {
    if (!name.trim()) return fail('recurring.nameRequired');
    if (amount <= 0) return fail('tx.amountRequired');
    if (kind !== 'transfer' && !categoryId && categoryMap.size > 0) return fail('tx.categoryRequired');
    if (kind === 'transfer' && (!account || !toAccount)) return fail('tx.accountsRequired');
    if (kind === 'transfer' && account?.id === toAccount?.id) return fail('tx.sameAccount');
    if (count > MAX_RUN_COUNT) return fail('recurring.countMax');
    if (endDate && runsUntil(rule, endDate) === 0) return fail('repeat.endBeforeStart');
    await saveSchedule({
      id: existing?.id,
      bookId: book.id,
      name,
      kind,
      categoryId: kind === 'transfer' ? null : categoryId,
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId : null,
      frequency,
      startDate,
      amount,
      currency: entryCurrency,
      toAmount: needsToAmount ? toAmount : null,
      totalCount: endDate ? 0 : count,
      ...(endDate ? { endDate } : {}),
      note,
      paused,
      backfill: canBackfill && backfill,
    });
    const runs = await runDueSchedules();
    const created = runs.reduce((sum, r) => sum + r.created.length, 0);
    toast(created ? t('home.recurringRan', { count: created }) : t('common.saved'), { tone: 'success' });
    goBack();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: t('recurring.deleteConfirm', { name: existing.name }), message: t('recurring.deleteHint'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteSchedule(existing.id);
      navigate('/recurring', { replace: true });
    }
  };

  return (
    <Page title={existing ? t('recurring.edit') : t('recurring.new')} back="/recurring" footer={<Button block onClick={() => void save()}>{t('common.save')}</Button>}>
      <div className="space-y-5 px-4 pt-1">
        <TextField
          label={t('recurring.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('recurring.namePlaceholder')}
          maxLength={SCHEDULE_NAME_MAX}
          hint={`${name.length}/${SCHEDULE_NAME_MAX}`}
          error={error === t('recurring.nameRequired') ? error : null}
          autoFocus={!existing}
        />
        <Segmented
          label={t('common.type')}
          value={kind}
          onChange={(k) => {
            setKind(k);
            if (category && k !== 'transfer' && category.kind !== k) setCategoryId(null);
          }}
          options={[
            { value: 'expense', label: t('kind.expense') },
            { value: 'income', label: t('kind.income') },
            { value: 'transfer', label: t('kind.transfer') },
          ]}
        />

        <Card className="overflow-hidden">
          {kind !== 'transfer' ? (
            <>
              <Row leading={<CategoryIcon category={category} size="sm" />} title={t('common.category')} trailing={category ? categoryName(category) : t('tx.chooseCategory')} onClick={() => setSheet('category')} chevron />
              <Divider />
              <Row title={t('common.account')} trailing={account?.name ?? t('tx.noAccount')} onClick={() => setSheet('account')} chevron />
              <Divider />
              <Row title={t('common.currency')} trailing={currency} onClick={() => setSheet('currency')} chevron />
            </>
          ) : (
            <>
              <Row title={t('tx.fromAccount')} trailing={account?.name ?? t('tx.chooseAccount')} onClick={() => setSheet('from')} chevron />
              <Divider />
              <Row title={t('tx.toAccount')} trailing={toAccount?.name ?? t('tx.chooseAccount')} onClick={() => setSheet('to')} chevron />
            </>
          )}
          <Divider />
          <Row title={t('common.amount')} trailing={<span className="font-semibold text-fg tabular">{format.money(amount, entryCurrency)}</span>} onClick={() => setSheet('amount')} chevron />
          {needsToAmount && (
            <>
              <Divider />
              <Row title={t('tx.receivedAmount', { currency: toAccount!.currency })} trailing={toAmount ? format.money(toAmount, toAccount!.currency) : '—'} onClick={() => setSheet('toAmount')} chevron />
            </>
          )}
          <Divider />
          <Row title={t('recurring.startDate')} trailing={format.date(startDate)} onClick={() => setSheet('date')} chevron />
        </Card>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('recurring.frequency')}</p>
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <Chip key={f} active={frequency === f} onClick={() => setFrequency(f)}>
                {frequencyLabel(f, t)}
              </Chip>
            ))}
          </div>
        </div>

        <RepeatEndPicker
          rule={rule}
          count={count}
          endDate={endDate}
          onChange={(end) => {
            setCount(end.count);
            setEndDate(end.endDate);
          }}
        />

        <TextField label={`${t('common.note')} (${t('common.optional')})`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />

        {canBackfill && (
          <Card>
            <SwitchRow title={t('recurring.backfill')} subtitle={backfill ? t('recurring.backfillHint', { count: backfillCount }) : t('recurring.backfillOff')} checked={backfill} onChange={setBackfill} />
          </Card>
        )}

        {existing && existing.status !== 'completed' && (
          <Card>
            <SwitchRow title={t('recurring.pause')} checked={paused} onChange={setPaused} />
          </Card>
        )}

        <InlineNotice icon={Info}>
          {next && !paused && (
            <p className="mb-1 font-medium">{t('recurring.next', { date: format.date(next) })}</p>
          )}
          {t('recurring.hint')}
        </InlineNotice>

        {existing && (
          <Button variant="ghost" block className="text-danger" onClick={() => void remove()}>
            {t('common.delete')}
          </Button>
        )}
      </div>

      <CategoryPickerSheet open={sheet === 'category'} onClose={() => setSheet(null)} kind={kind === 'income' ? 'income' : 'expense'} value={categoryId} onSelect={(c) => setCategoryId(c?.id ?? null)} />
      <AccountPickerSheet
        open={sheet === 'account'}
        onClose={() => setSheet(null)}
        value={accountId}
        onSelect={(a) => {
          setAccountId(a?.id ?? null);
          if (a && !amount) setCurrency(a.currency);
        }}
      />
      <AccountPickerSheet open={sheet === 'from'} onClose={() => setSheet(null)} value={accountId} onSelect={(a) => setAccountId(a?.id ?? null)} allowNone={false} exclude={toAccountId} title={t('tx.fromAccount')} />
      <AccountPickerSheet open={sheet === 'to'} onClose={() => setSheet(null)} value={toAccountId} onSelect={(a) => setToAccountId(a?.id ?? null)} allowNone={false} exclude={accountId} title={t('tx.toAccount')} />
      <CurrencyPickerSheet open={sheet === 'currency'} onClose={() => setSheet(null)} value={currency} onSelect={setCurrency} />
      <AmountSheet open={sheet === 'amount'} onClose={() => setSheet(null)} title={t('common.amount')} currency={entryCurrency} initial={amount || null} onSave={setAmount} />
      {needsToAmount && <AmountSheet open={sheet === 'toAmount'} onClose={() => setSheet(null)} title={t('tx.receivedAmount', { currency: toAccount!.currency })} currency={toAccount!.currency} initial={toAmount} onSave={setToAmount} />}
      <DatePickerSheet open={sheet === 'date'} onClose={() => setSheet(null)} value={withDay(startDate, Date.now())} onChange={(ms) => setStartDate(dayKey(ms))} withTime={false} title={t('recurring.startDate')} />
    </Page>
  );
}
