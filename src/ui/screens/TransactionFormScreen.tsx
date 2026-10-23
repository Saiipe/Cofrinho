import { ArrowDown, CalendarDays, Calculator, Camera, ChevronDown, CreditCard, Hash, Mic, NotebookPen, Repeat, Shapes, Sparkles, Wallet, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { discardPhotos } from '@/data/photos';
import { runDueSchedules } from '@/data/schedules';
import { saveInstallments, saveRecurringTransaction, saveTransaction, suggestNotes, type RepeatRule, type TransactionInput } from '@/data/transactions';
import { resolveAmounts } from '@/domain/amounts';
import { cardRule, cycleOf } from '@/domain/card';
import { displayExpression, evaluate, expressionFromDecimal, hasOperator } from '@/domain/calculator';
import { dayKey, parseDayKey, todayKey, withDay } from '@/domain/dates';
import { runsUntil } from '@/domain/schedule';
import { NOTE_MAX } from '@/domain/defaults';
import { convertMinor, currencyExponent, currencySymbol, minorToDecimalString, parseLocaleNumber, toMinor } from '@/domain/money';
import { parseQuickEntry } from '@/domain/quickEntry';
import type { ID, SplitData, Transaction } from '@/domain/types';
import type { MessageKey } from '@/i18n';
import { frequencyLabel, memberLabel } from '@/i18n/labels';
import { haptic, playSound } from '@/services/feedback';
import { rewardRecording } from '@/services/garden';
import { listenOnce, speechSupported } from '@/services/speech';
import { useApp } from '../app/AppContext';
import { useBackHandler } from '../app/back';
import { useBook } from '../app/BookContext';
import { AccountIcon } from '../components/banks';
import { cardUsage } from '../components/CardDetail';
import { useFeedback } from '../components/feedback';
import { Keypad } from '../components/Keypad';
import { useGoBack } from '../components/Page';
import { AccountPickerSheet, CategoryGrid, CategoryPickerSheet, CurrencyPickerSheet, DatePickerSheet } from '../components/pickers';
import { PhotosSheet } from '../components/photos';
import { Button, Chip, cx, IconButton, Segmented } from '../components/primitives';
import { initialSplitDraft, resolveSplit, SplitEditor, type SplitDraft } from '../components/SplitEditor';
import { EntityIcon } from '../components/EntityIcon';
import { TagPickerSheet } from '../components/tags';
import { InstallmentsSheet, MemoSheet, RepeatSheet } from '../components/TransactionExtras';
import { useFormat } from '../hooks/useFormat';

type FormKind = 'expense' | 'income' | 'transfer' | 'split_expense' | 'split_payment';
type SheetName = 'date' | 'account' | 'from' | 'to' | 'currency' | 'photos' | 'category' | 'tags' | 'memo' | 'repeat' | 'installments';

const PERSONAL_KINDS: FormKind[] = ['expense', 'income', 'transfer'];
const SPLIT_KINDS: FormKind[] = ['split_expense', 'split_payment'];

export default function TransactionFormScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const editing = useLiveQuery(async () => (id ? ((await db.transactions.get(id)) ?? null) : null), [id]);
  if (id && editing === undefined) return <div className="min-h-dvh bg-bg" />;
  // A widget or shortcut opening "new" again while the form is open starts a fresh form.
  return <TransactionForm key={id ?? `new-${location.key}`} existing={editing ?? null} params={params} />;
}

function TransactionForm({ existing, params }: { existing: Transaction | null; params: URLSearchParams }) {
  const { settings, t, locale } = useApp();
  const { book, isSplit, accounts, accountMap, members, me, categoryMap, rate, categoryName, defaultAccount } = useBook();
  const format = useFormat();
  const { toast, confirm } = useFeedback();
  const goBack = useGoBack('/');

  const kinds = isSplit ? SPLIT_KINDS : PERSONAL_KINDS;
  const requestedKind = params.get('kind') as FormKind | null;
  const [kind, setKind] = useState<FormKind>(() => {
    if (existing && kinds.includes(existing.kind as FormKind)) return existing.kind as FormKind;
    return requestedKind && kinds.includes(requestedKind) ? requestedKind : kinds[0]!;
  });
  const requestedAccount = params.get('account');
  const initialAccount = existing ? (existing.accountId ? accountMap.get(existing.accountId) : undefined) : ((requestedAccount ? accountMap.get(requestedAccount) : undefined) ?? defaultAccount);
  const [accountId, setAccountId] = useState<ID | null>(existing ? existing.accountId : (initialAccount?.id ?? null));
  const [toAccountId, setToAccountId] = useState<ID | null>(existing?.toAccountId ?? (params.get('toAccount') && accountMap.has(params.get('toAccount')!) ? params.get('toAccount') : null));
  const [currency, setCurrency] = useState(existing?.currency ?? initialAccount?.currency ?? book.currency);
  const [expression, setExpression] = useState(() => {
    if (existing) return expressionFromDecimal(minorToDecimalString(Math.abs(existing.originalAmount), existing.currency));
    const amount = params.get('amount');
    return amount && /^\d+(\.\d+)?$/.test(amount) ? amount : '';
  });
  const [toAmountText, setToAmountText] = useState<string>(() =>
    existing?.kind === 'transfer' && existing.toAccountId ? minorToDecimalString(existing.toAccountAmount, accountMap.get(existing.toAccountId)?.currency ?? book.currency) : '',
  );
  const [categoryId, setCategoryId] = useState<ID | null>(existing?.categoryId ?? params.get('category'));
  const [date, setDate] = useState(() => {
    if (existing) return existing.date;
    const day = params.get('date');
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? withDay(day, Date.now()) : Date.now();
  });
  const [note, setNote] = useState(existing?.note ?? params.get('note')?.slice(0, NOTE_MAX) ?? '');
  const [details, setDetails] = useState(existing?.details ?? '');
  const [tagIds, setTagIds] = useState<ID[]>(existing?.tagIds ?? []);
  const [photoIds, setPhotoIds] = useState<ID[]>(existing?.photoIds ?? []);
  const [repeat, setRepeat] = useState<RepeatRule | null>(null);
  const [installments, setInstallments] = useState(1);
  const [split, setSplit] = useState<SplitDraft>(() => {
    if (existing?.split && existing.kind === 'split_expense') {
      const s = existing.split;
      const inputs: Record<ID, string> = {};
      for (const part of s.parts) {
        if (s.method === 'amount') inputs[part.memberId] = minorToDecimalString(part.input, book.currency);
        else if (s.method === 'percent') inputs[part.memberId] = String(part.input / 100);
        else if (s.method === 'shares') inputs[part.memberId] = String(part.input);
      }
      return { payerId: s.payerId, participants: s.parts.map((p) => p.memberId), method: s.method, inputs };
    }
    return initialSplitDraft(members, me);
  });
  const [fromMember, setFromMember] = useState<ID>(existing?.split?.payerId ?? params.get('from') ?? me?.id ?? members[0]?.id ?? '');
  const [toMember, setToMember] = useState<ID>(existing?.split?.toMemberId ?? params.get('to') ?? members.find((m) => m.id !== (me?.id ?? ''))?.id ?? '');
  const [quickText, setQuickText] = useState('');
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(true);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [saving, setSaving] = useState(false);

  // Closing the system keyboard without "done" (Android back) must bring the amount keypad back.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let fullHeight = viewport.height;
    const onResize = () => {
      fullHeight = Math.max(fullHeight, viewport.height);
      const active = document.activeElement;
      if (viewport.height >= fullHeight * 0.92 && active instanceof HTMLInputElement) active.blur();
    };
    viewport.addEventListener('resize', onResize);
    return () => viewport.removeEventListener('resize', onResize);
  }, []);

  // Photos added in this session are discarded if the form is abandoned.
  const addedPhotos = useRef<ID[]>([]);
  const saved = useRef(false);
  useEffect(
    () => () => {
      if (!saved.current) void discardPhotos(addedPhotos.current);
    },
    [],
  );

  // What the user typed so far, to ask before throwing it away.
  const initial = useRef({ expression, note, details, tags: tagIds.join(), photos: photoIds.join(), categoryId, accountId, date });
  const dirty =
    expression !== initial.current.expression ||
    note.trim() !== initial.current.note.trim() ||
    details.trim() !== initial.current.details.trim() ||
    tagIds.join() !== initial.current.tags ||
    photoIds.join() !== initial.current.photos ||
    (existing !== null && (categoryId !== initial.current.categoryId || accountId !== initial.current.accountId || date !== initial.current.date));

  const close = async () => {
    if (dirty && !saved.current) {
      const discard = await confirm({ title: t('tx.discardTitle'), message: t('tx.discardHint'), confirmLabel: t('tx.discard'), destructive: true });
      if (!discard) return;
    }
    goBack();
  };

  // Android back: first lower the keypad (more room for the form), then leave — asking if something was filled in.
  const keypadShown = keypadOpen && !typing;
  useBackHandler(keypadShown && sheet === null, () => setKeypadOpen(false));
  useBackHandler(!keypadShown && !typing && dirty && sheet === null, () => void close());

  const account = accountId ? accountMap.get(accountId) : undefined;
  const toAccount = toAccountId ? accountMap.get(toAccountId) : undefined;
  const isTransfer = kind === 'transfer';
  const isSplitKind = kind === 'split_expense' || kind === 'split_payment';
  // Transfers are typed in the source account currency; split books stay in the book currency.
  const entryCurrency = isTransfer ? (account?.currency ?? book.currency) : isSplitKind ? book.currency : currency;
  const decimals = currencyExponent(entryCurrency);
  const evaluated = evaluate(expression);
  const amountMinor = evaluated !== null && evaluated > 0 ? toMinor(evaluated, entryCurrency) : 0;

  const card = kind === 'expense' && account?.type === 'credit' ? account : undefined;
  const canInstall = Boolean(card) && !existing;
  const canRepeat = !existing && !isSplitKind;
  const effectiveInstallments = canInstall ? installments : 1;
  const effectiveRepeat = canRepeat ? repeat : null;
  const rule = card ? cardRule(card) : null;
  const cardTxs = useLiveQuery(
    async () => (card ? [...(await db.transactions.where('accountId').equals(card.id).toArray()), ...(await db.transactions.where('toAccountId').equals(card.id).toArray())] : null),
    [card?.id],
  );
  const invoice = rule ? cycleOf(dayKey(date), rule) : null;

  const bookPreview = useMemo(() => {
    if (entryCurrency === book.currency || amountMinor === 0) return null;
    const r = rate(entryCurrency, book.currency);
    return r === null ? 'missing' : convertMinor(amountMinor, entryCurrency, book.currency, r);
  }, [entryCurrency, book.currency, amountMinor, rate]);

  const transferNeedsTarget = isTransfer && account && toAccount && account.currency !== toAccount.currency;
  const suggestedToAmount = useMemo(() => {
    if (!transferNeedsTarget || amountMinor === 0) return null;
    const r = rate(account!.currency, toAccount!.currency);
    return r === null ? null : convertMinor(amountMinor, account!.currency, toAccount!.currency, r);
  }, [transferNeedsTarget, amountMinor, account, toAccount, rate]);

  const notes = useLiveQuery(async () => (typing && !isTransfer ? suggestNotes(book.id, categoryId, note) : []), [typing, book.id, categoryId, note, isTransfer]);

  const changeKind = (next: FormKind) => {
    if (next === kind) return;
    const category = categoryId ? categoryMap.get(categoryId) : undefined;
    if (category && (next === 'transfer' || (next !== 'split_expense' && category.kind !== next))) setCategoryId(null);
    setKind(next);
  };

  const applyQuickEntry = (text: string) => {
    const categories = [...categoryMap.values()].map((c) => ({ id: c.id, kind: c.kind, parentId: c.parentId, name: categoryName(c), builtinKey: c.builtinKey }));
    const draft = parseQuickEntry(text, { categories, accounts: accounts.map((a) => ({ id: a.id, name: a.name })), today: todayKey() });
    if (draft.amount === null) {
      toast(t('tx.quickNothing'));
      return;
    }
    if (!isSplit) setKind(draft.kind);
    if (draft.categoryId) setCategoryId(draft.categoryId);
    if (draft.accountId) {
      setAccountId(draft.accountId);
      setCurrency(accountMap.get(draft.accountId)?.currency ?? currency);
    }
    setExpression(expressionFromDecimal(minorToDecimalString(toMinor(draft.amount, entryCurrency), entryCurrency)));
    setDate(withDay(draft.date, date));
    if (draft.note) setNote(draft.note);
    setQuickText('');
    haptic('success');
    toast(t('tx.quickFilled'));
  };

  const dictate = async () => {
    setListening(true);
    try {
      const text = (await listenOnce(locale).result).trim();
      if (text) {
        setQuickText(text);
        applyQuickEntry(text);
      }
    } catch {
      toast(t('tx.voiceUnavailable'), { tone: 'error' });
    } finally {
      setListening(false);
    }
  };

  const fail = (key: MessageKey, params?: Record<string, string>) => {
    haptic('warning');
    toast(t(key, params), { tone: 'error' });
  };

  const save = async () => {
    if (saving) return;
    if (amountMinor <= 0) {
      setKeypadOpen(true);
      return fail('tx.amountRequired');
    }
    let input: TransactionInput;
    const base = {
      id: existing?.id,
      bookId: book.id,
      date,
      note: note.trim(),
      details,
      tagIds,
      photoIds,
      scheduleId: existing?.scheduleId,
      ...(existing?.installment ? { installment: existing.installment } : {}),
    };

    if (kind === 'expense' || kind === 'income') {
      if (!categoryId && categoryMap.size > 0) return fail('tx.categoryRequired');
      const resolved = resolveAmounts({ kind, currency: entryCurrency, originalAmount: amountMinor, bookCurrency: book.currency, accountCurrency: account?.currency ?? null }, rate);
      if (!resolved.ok) return fail('tx.missingRate', resolved.missing);
      input = { ...base, kind, currency: entryCurrency, originalAmount: amountMinor, categoryId, accountId: account?.id ?? null, toAccountId: null, ...resolved.value };
    } else if (kind === 'transfer') {
      if (!account || !toAccount) return fail('tx.accountsRequired');
      if (account.id === toAccount.id) return fail('tx.sameAccount');
      const typedTarget = transferNeedsTarget ? parseLocaleNumber(toAmountText) : null;
      const override = typedTarget !== null && typedTarget > 0 ? toMinor(typedTarget, toAccount.currency) : null;
      const resolved = resolveAmounts(
        { kind, currency: entryCurrency, originalAmount: amountMinor, bookCurrency: book.currency, accountCurrency: account.currency, toAccountCurrency: toAccount.currency, toAmountOverride: override },
        rate,
      );
      if (!resolved.ok) return fail('tx.missingRate', resolved.missing);
      input = { ...base, kind, currency: entryCurrency, originalAmount: amountMinor, categoryId: null, accountId: account.id, toAccountId: toAccount.id, ...resolved.value };
    } else if (kind === 'split_expense') {
      if (!split.participants.length) return fail('split.noParticipants');
      const result = resolveSplit(split, amountMinor, book.currency);
      if (!result.ok) {
        const map: Record<string, MessageKey> = { amount_mismatch: 'split.amountMismatch', percent_mismatch: 'split.percentMismatch', no_weight: 'split.noWeight', no_participants: 'split.noParticipants', invalid_total: 'tx.amountRequired' };
        return fail(map[result.error]!);
      }
      const data: SplitData = { method: split.method, payerId: split.payerId, parts: result.parts };
      input = { ...base, kind, currency: book.currency, originalAmount: amountMinor, amount: amountMinor, categoryId, accountId: null, accountAmount: 0, toAccountId: null, toAccountAmount: 0, split: data };
    } else {
      if (!fromMember || !toMember || fromMember === toMember) return fail('split.samePerson');
      const data: SplitData = { method: 'equal', payerId: fromMember, toMemberId: toMember, parts: [] };
      input = { ...base, kind, currency: book.currency, originalAmount: amountMinor, amount: amountMinor, categoryId: null, accountId: null, accountAmount: 0, toAccountId: null, toAccountAmount: 0, split: data };
    }
    if (effectiveRepeat && effectiveInstallments > 1) return fail('tx.repeatNotWithInstallments');
    // This record is the first run, so an end date must leave at least one more.
    if (effectiveRepeat?.endDate && runsUntil({ frequency: effectiveRepeat.frequency, startDate: dayKey(date) }, effectiveRepeat.endDate) < 2) return fail('repeat.endTooSoon');

    setSaving(true);
    try {
      let extra: string | null = null;
      if (effectiveRepeat) {
        const category = categoryId ? categoryMap.get(categoryId) : undefined;
        const name = input.note || (kind === 'transfer' ? `${account?.name ?? ''} → ${toAccount?.name ?? ''}` : categoryName(category));
        await saveRecurringTransaction(input, effectiveRepeat, name);
        // Past start dates catch up right away.
        await runDueSchedules();
        extra = t('tx.repeatSaved', { name: name.slice(0, 25) });
      } else if (effectiveInstallments > 1) {
        await saveInstallments(input, effectiveInstallments);
        extra = t('tx.installmentsSaved', { count: effectiveInstallments });
      } else {
        await saveTransaction(input);
      }
      saved.current = true;
      if (existing) {
        toast(t('tx.saved'), { tone: 'success' });
      } else {
        const reward = await rewardRecording();
        playSound(reward.reasons.length ? 'coin' : 'save');
        haptic('success');
        const message = reward.reasons.includes('milestone')
          ? t('garden.milestone', { count: reward.totalRecords })
          : reward.reasons.includes('streak')
            ? t('garden.streak', { count: reward.streak })
            : reward.reasons.includes('first')
              ? t('garden.firstToday')
              : t(`motivation.${1 + (reward.totalRecords % 5)}` as MessageKey);
        toast(extra ?? `${message} ${t('garden.earned', { n: reward.coins })}`, { tone: 'success' });
      }
      goBack();
    } catch {
      setSaving(false);
      toast(t('common.error'), { tone: 'error' });
    }
  };

  const kindOptions = kinds.map((k) => ({ value: k, label: t(`kind.${k}` as MessageKey) }));
  const invoiceMonth = invoice ? parseDayKey(invoice.due) : null;
  const cardInfo =
    card && cardTxs
      ? [
          card.creditLimit ? t('cards.availableShort', { amount: format.money(cardUsage(card, cardTxs).available ?? 0, card.currency) }) : null,
          invoiceMonth ? t('cards.goesTo', { month: format.monthYearShort(invoiceMonth.year, invoiceMonth.month) }) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : invoiceMonth
        ? t('cards.goesTo', { month: format.monthYearShort(invoiceMonth.year, invoiceMonth.month) })
        : '';
  // Extra details as a fixed bar of equal buttons (no horizontal scroll, labels never cut off).
  const tools: ToolProps[] = [
    ...(canRepeat ? [{ id: 'repeat', icon: Repeat, label: repeat ? frequencyLabel(repeat.frequency, t) : t('tx.repeat'), active: Boolean(repeat), onClick: () => setSheet('repeat') }] : []),
    ...(canInstall ? [{ id: 'installments', icon: CreditCard, label: installments > 1 ? `${installments}x` : t('cards.installments'), active: installments > 1, onClick: () => setSheet('installments') }] : []),
    ...(existing?.installment ? [{ id: 'installment', icon: CreditCard, label: `${existing.installment.index}/${existing.installment.count}`, active: true }] : []),
    { id: 'tags', icon: Hash, label: tagIds.length ? t('tags.count', { count: tagIds.length }) : t('tags.title'), active: tagIds.length > 0, onClick: () => setSheet('tags') },
    { id: 'memo', icon: NotebookPen, label: t('tx.memo'), active: details.trim().length > 0, onClick: () => setSheet('memo') },
    { id: 'photos', icon: Camera, label: photoIds.length ? t('tx.photoCount', { count: photoIds.length }) : t('tx.photos'), active: photoIds.length > 0, onClick: () => setSheet('photos') },
  ];

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="shrink-0 border-b border-line/70 bg-surface pt-safe">
        <div className="flex h-14 items-center gap-2 px-2">
          <IconButton icon={X} label={t('common.close')} onClick={() => void close()} />
          <Segmented className="flex-1" label={t('common.type')} options={kindOptions} value={kind} onChange={changeKind} />
          <span className="w-2" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {settings.quickEntry && !existing && (kind === 'expense' || kind === 'income' || kind === 'split_expense') && (
          <form
            className="flex items-center gap-2 px-4 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (quickText.trim()) applyQuickEntry(quickText);
            }}
          >
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface px-3 shadow-card">
              <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
              <input
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                placeholder={listening ? t('tx.listening') : t('tx.quickPlaceholder')}
                enterKeyHint="go"
                className="h-full min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-faint"
                aria-label={t('settings.quickEntry')}
              />
            </label>
            {speechSupported() && <IconButton icon={Mic} label={t('tx.voice')} tone="primary" onClick={() => void dictate()} className={cx(listening && 'animate-pulse bg-primary-soft')} />}
            {quickText.trim() && (
              <button type="submit" className="h-11 rounded-xl bg-primary-soft px-3 text-sm font-semibold text-primary">
                {t('tx.quickApply')}
              </button>
            )}
          </form>
        )}

        {(kind === 'expense' || kind === 'income') && (
          <div className="pt-2">
            <CategoryGrid kind={kind} value={categoryId} onSelect={(c) => setCategoryId(c?.id ?? null)} compact />
          </div>
        )}

        {isTransfer && (
          <div className="space-y-2 px-4 pt-4">
            <AccountButton label={t('tx.fromAccount')} accountId={accountId} onClick={() => setSheet('from')} />
            <div className="flex justify-center text-faint">
              <ArrowDown className="size-5" aria-hidden />
            </div>
            <AccountButton label={t('tx.toAccount')} accountId={toAccountId} onClick={() => setSheet('to')} />
            {transferNeedsTarget && (
              <label className="mt-3 block rounded-2xl bg-surface p-4 shadow-card">
                <span className="text-sm text-muted">{t('tx.receivedAmount', { currency: toAccount!.currency })}</span>
                <input
                  inputMode="decimal"
                  value={toAmountText}
                  onChange={(e) => setToAmountText(e.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder={suggestedToAmount !== null ? format.money(suggestedToAmount, toAccount!.currency, { symbol: false }) : '0'}
                  className="mt-1 h-11 w-full bg-transparent text-xl font-semibold tabular outline-none"
                />
              </label>
            )}
            {accounts.length < 2 && (
              <p className="pt-2 text-center text-sm text-muted">
                <Link to="/accounts/new" className="font-semibold text-primary">
                  {t('accounts.new')}
                </Link>
              </p>
            )}
          </div>
        )}

        {kind === 'split_expense' && <SplitEditor draft={split} onChange={setSplit} members={members} total={amountMinor} currency={book.currency} />}

        {kind === 'split_payment' && (
          <div className="space-y-4 px-4 pt-4">
            {(['from', 'to'] as const).map((side) => (
              <div key={side}>
                <p className="mb-2 text-sm font-medium text-muted">{side === 'from' ? t('split.payer') : t('split.receiver')}</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <Chip key={m.id} active={(side === 'from' ? fromMember : toMember) === m.id} onClick={() => (side === 'from' ? setFromMember(m.id) : setToMember(m.id))}>
                      {memberLabel(m, t)}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 rounded-t-3xl bg-surface pb-safe shadow-[0_-6px_20px_rgb(15_23_42/0.07)]">
        <div className="flex items-center gap-2 px-4 pt-3">
          {!isTransfer && !isSplitKind ? (
            <button type="button" onClick={() => setSheet('currency')} className="flex h-9 shrink-0 items-center rounded-full bg-surface-2 px-3 text-sm font-semibold" aria-label={t('tx.chooseCurrency')}>
              {entryCurrency}
            </button>
          ) : (
            <span className="flex h-9 shrink-0 items-center rounded-full bg-surface-2 px-3 text-sm font-semibold text-muted">{entryCurrency}</span>
          )}
          <button type="button" onClick={() => setKeypadOpen(true)} className="min-w-0 flex-1 text-right" aria-live="polite">
            <span className={cx('block truncate font-semibold tabular', hasOperator(expression) ? 'text-lg text-muted' : 'text-[1.9rem] leading-tight')}>
              {expression ? `${currencySymbol(entryCurrency, locale)} ${displayExpression(expression, format.decimalSeparator)}` : `${currencySymbol(entryCurrency, locale)} 0`}
            </span>
            {hasOperator(expression) && <span className="block truncate text-[1.6rem] leading-tight font-semibold tabular">= {format.money(amountMinor, entryCurrency)}</span>}
          </button>
          <IconButton icon={keypadShown ? ChevronDown : Calculator} label={keypadShown ? t('tx.hideKeypad') : t('tx.showKeypad')} onClick={() => setKeypadOpen(!keypadShown)} className="size-9 text-muted" />
        </div>
        {bookPreview !== null && (
          <p className={cx('px-4 pt-0.5 text-right text-xs', bookPreview === 'missing' ? 'text-danger' : 'text-muted')}>
            {bookPreview === 'missing' ? (
              <Link to="/currencies" className="underline">
                {t('tx.missingRate', { from: entryCurrency, to: book.currency })}
              </Link>
            ) : (
              t('tx.convertedTo', { amount: format.money(bookPreview) })
            )}
          </p>
        )}
        {cardInfo && (
          <p className="truncate px-4 pt-0.5 text-right text-xs text-muted">
            {card?.name} · {cardInfo}
          </p>
        )}

        <div className={cx('grid gap-2 px-4 pt-2.5', (kind === 'expense' || kind === 'income' || kind === 'split_expense') && 'grid-cols-2')}>
          <Chip onClick={() => setSheet('date')} className="min-w-0 justify-start px-3">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {format.dayHeading(dayKey(date))} {format.time(date)}
            </span>
          </Chip>
          {(kind === 'expense' || kind === 'income') && (
            <Chip onClick={() => setSheet('account')} active={Boolean(account)} className="min-w-0 justify-start px-3">
              {account?.type === 'credit' ? <CreditCard className="size-4 shrink-0" aria-hidden /> : <Wallet className="size-4 shrink-0" aria-hidden />}
              <span className="truncate">{account?.name ?? t('tx.noAccount')}</span>
            </Chip>
          )}
          {kind === 'split_expense' && (
            <Chip onClick={() => setSheet('category')} active={Boolean(categoryId)} className="min-w-0 justify-start px-3">
              <Shapes className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{categoryId ? categoryName(categoryId) : t('common.category')}</span>
            </Chip>
          )}
        </div>
        <div className="grid gap-1.5 px-4 pt-2" style={{ gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}>
          {tools.map((tool) => (
            <ToolButton key={tool.id} {...tool} dense={tools.length > 4} />
          ))}
        </div>

        {notes && notes.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-1.5">
            {notes.map((text) => (
              <button key={text} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setNote(text)} className="h-8 shrink-0 rounded-full bg-primary-soft px-3 text-[0.8rem] font-medium text-primary">
                {text}
              </button>
            ))}
          </div>
        )}
        <div className="px-4 pt-2">
          <input
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            placeholder={t('tx.notePlaceholder')}
            enterKeyHint="done"
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-11 w-full rounded-xl bg-surface-2 px-3.5 text-[0.95rem] outline-none placeholder:text-faint"
            aria-label={t('common.note')}
          />
        </div>

        {keypadShown && <Keypad expression={expression} onChange={setExpression} onSubmit={() => void save()} decimals={decimals} decimalSeparator={format.decimalSeparator} full={settings.calculator === 'full'} submitDisabled={saving} />}
        {!keypadShown && !typing && (
          <div className="px-4 pt-3 pb-3">
            <Button block size="lg" onClick={() => void save()} disabled={saving}>
              {t('common.save')}
            </Button>
          </div>
        )}
        {typing && <div className="h-2" />}
      </div>

      <DatePickerSheet open={sheet === 'date'} onClose={() => setSheet(null)} value={date} onChange={setDate} />
      <AccountPickerSheet
        open={sheet === 'account'}
        onClose={() => setSheet(null)}
        title={kind === 'income' ? t('tx.receivedIn') : t('tx.paidWith')}
        value={accountId}
        onSelect={(a) => {
          setAccountId(a?.id ?? null);
          if (a && !expression) setCurrency(a.currency);
        }}
      />
      <AccountPickerSheet open={sheet === 'from'} onClose={() => setSheet(null)} value={accountId} onSelect={(a) => setAccountId(a?.id ?? null)} allowNone={false} exclude={toAccountId} title={t('tx.fromAccount')} />
      <AccountPickerSheet open={sheet === 'to'} onClose={() => setSheet(null)} value={toAccountId} onSelect={(a) => setToAccountId(a?.id ?? null)} allowNone={false} exclude={accountId} title={t('tx.toAccount')} />
      <CurrencyPickerSheet open={sheet === 'currency'} onClose={() => setSheet(null)} value={currency} onSelect={setCurrency} />
      <CategoryPickerSheet open={sheet === 'category'} onClose={() => setSheet(null)} kind="expense" value={categoryId} onSelect={(c) => setCategoryId(c?.id ?? null)} allowNone />
      <PhotosSheet open={sheet === 'photos'} onClose={() => setSheet(null)} photoIds={photoIds} onChange={setPhotoIds} onAdded={(pid) => addedPhotos.current.push(pid)} />
      <TagPickerSheet open={sheet === 'tags'} onClose={() => setSheet(null)} value={tagIds} onChange={setTagIds} />
      <MemoSheet open={sheet === 'memo'} onClose={() => setSheet(null)} value={details} onChange={setDetails} />
      {sheet === 'repeat' && (
        <RepeatSheet
          open
          onClose={() => setSheet(null)}
          startDate={dayKey(date)}
          value={repeat}
          onChange={(next) => {
            setRepeat(next);
            if (next) setInstallments(1);
          }}
        />
      )}
      {sheet === 'installments' && (
        <InstallmentsSheet
          open
          onClose={() => setSheet(null)}
          value={installments}
          amount={amountMinor}
          currency={entryCurrency}
          onChange={(n) => {
            setInstallments(n);
            if (n > 1) setRepeat(null);
          }}
        />
      )}
    </div>
  );
}

function AccountButton({ label, accountId, onClick }: { label: string; accountId: ID | null; onClick: () => void }) {
  const { t } = useApp();
  const { accountMap } = useBook();
  const selected = accountId ? accountMap.get(accountId) : undefined;
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-card active:bg-surface-2">
      {selected ? <AccountIcon account={selected} /> : <EntityIcon icon="wallet" color="#8b93a1" mono={false} />}
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted">{label}</span>
        <span className="block truncate font-semibold">{selected ? selected.name : t('tx.chooseAccount')}</span>
      </span>
      {selected && <span className="text-sm text-muted">{selected.currency}</span>}
    </button>
  );
}

interface ToolProps {
  id: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick?: () => void;
}

function ToolButton({ icon: Icon, label, active, onClick, dense }: ToolProps & { dense?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={active}
      data-tip={label}
      className={cx(
        'flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border leading-none font-medium transition-colors disabled:cursor-default',
        // Five buttons on a narrow phone: slightly smaller labels so "Observações" still fits.
        dense ? 'px-0.5 text-[0.62rem]' : 'px-1 text-[0.68rem]',
        active ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted active:bg-surface-2',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="w-full truncate text-center">{label}</span>
    </button>
  );
}
