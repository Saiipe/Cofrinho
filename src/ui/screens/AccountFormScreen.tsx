import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Plus, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { deleteAccount, saveAccount } from '@/data/accounts';
import { bankById } from '@/data/banks';
import { addCardBacklog, type CardBacklogItem } from '@/data/cards';
import { db } from '@/data/db';
import { ACCOUNT_TYPES, isLiability } from '@/domain/balances';
import { cardRule } from '@/domain/card';
import { ACCOUNT_TYPE_STYLE, CATEGORY_COLORS } from '@/domain/defaults';
import type { Account, AccountType } from '@/domain/types';
import type { MessageKey } from '@/i18n';
import { accountTypeLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AmountSheet } from '../components/AmountSheet';
import { AccountIcon, BankLogo, BankPickerSheet } from '../components/banks';
import { BacklogList, CardBacklogSheet, type BacklogMode } from '../components/CardBacklog';
import { useFeedback } from '../components/feedback';
import { Page, useGoBack } from '../components/Page';
import { ColorSwatches, CurrencyPickerSheet, IconPickerSheet } from '../components/pickers';
import { Button, Card, cx, Divider, Row, SwitchRow, TextField } from '../components/primitives';
import { Sheet } from '../components/Sheet';
import { currencyName } from '../currencies';
import { useFormat } from '../hooks/useFormat';
import { iconFor } from '../icons';

/** Types whose account usually belongs to a bank or app (the institution picker is shown). */
const WITH_INSTITUTION: AccountType[] = ['debit', 'credit', 'virtual', 'investment'];

export default function AccountFormScreen() {
  const { id } = useParams();
  const existing = useLiveQuery(async () => (id ? ((await db.accounts.get(id)) ?? null) : null), [id]);
  if (id && existing === undefined) return <div className="min-h-dvh bg-bg" />;
  return <AccountForm key={id ?? 'new'} existing={existing ?? null} />;
}

function AccountForm({ existing }: { existing: Account | null }) {
  const { t, locale } = useApp();
  const { book } = useBook();
  const format = useFormat();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedType = params.get('type') as AccountType | null;
  const initialType: AccountType = existing?.type ?? (requestedType && ACCOUNT_TYPES.includes(requestedType) ? requestedType : 'debit');
  const goBack = useGoBack(initialType === 'credit' ? '/cards' : '/accounts');
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(initialType);
  const [icon, setIcon] = useState(existing?.icon ?? ACCOUNT_TYPE_STYLE[initialType].icon);
  const [color, setColor] = useState(existing?.color ?? ACCOUNT_TYPE_STYLE[initialType].color);
  const [styleTouched, setStyleTouched] = useState(Boolean(existing));
  const [bankId, setBankId] = useState<string | null>(existing?.bankId ?? null);
  const [creditLimit, setCreditLimit] = useState(existing?.creditLimit ?? 0);
  const [closingDay, setClosingDay] = useState<number | null>(existing?.closingDay ?? null);
  const [dueDay, setDueDay] = useState<number | null>(existing?.dueDay ?? null);
  const [currency, setCurrency] = useState(existing?.currency ?? book.currency);
  const [initial, setInitial] = useState(existing?.initialBalance ?? 0);
  const [exclude, setExclude] = useState(existing?.excludeFromTotals ?? false);
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [note, setNote] = useState(existing?.note ?? '');
  const [backlog, setBacklog] = useState<CardBacklogItem[]>([]);
  const [backlogMode, setBacklogMode] = useState<BacklogMode | null>(null);
  const [showMore, setShowMore] = useState(Boolean(existing && (existing.excludeFromTotals || existing.currency !== book.currency || existing.note)));
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'icon' | 'currency' | 'balance' | 'bank' | 'limit' | 'closing' | 'due' | null>(null);
  const bank = bankById(bankId);
  const liability = isLiability(type);
  const isCard = type === 'credit';
  const rule = closingDay && dueDay ? cardRule({ closingDay, dueDay }) : null;

  const chooseType = (next: AccountType) => {
    setType(next);
    if (!styleTouched) {
      setIcon(ACCOUNT_TYPE_STYLE[next].icon);
      setColor(ACCOUNT_TYPE_STYLE[next].color);
    }
    // Debts are stored negative; flip the sign when switching between asset and liability.
    if (isLiability(next) !== liability && initial !== 0) setInitial(-initial);
    if (!WITH_INSTITUTION.includes(next)) setBankId(null);
  };

  const save = async () => {
    const finalName = name.trim() || (isCard && bank ? bank.name.slice(0, 40) : '');
    if (!finalName) {
      setError(t('accounts.nameRequired'));
      return;
    }
    const id = await saveAccount({
      id: existing?.id,
      bookId: book.id,
      name: finalName,
      type,
      icon,
      color,
      currency,
      // New cards start from their purchases (backlog), not from a loose opening debt.
      initialBalance: isCard && !existing ? 0 : initial,
      excludeFromTotals: exclude,
      isDefault,
      note,
      bankId: bankId ?? undefined,
      creditLimit: creditLimit > 0 ? creditLimit : undefined,
      closingDay: closingDay ?? undefined,
      dueDay: dueDay ?? undefined,
    });
    if (isCard && backlog.length) {
      const card = await db.accounts.get(id);
      const result = card ? await addCardBacklog(book, card, backlog, t('cards.balanceNote')) : { created: 0, skipped: backlog.length };
      if (result.skipped) toast(t('cards.backlogSkipped'), { tone: 'error' });
      else toast(t('cards.backlogSaved', { count: result.created }), { tone: 'success' });
    } else {
      toast(t('common.saved'), { tone: 'success' });
    }
    if (isCard && !existing) navigate(`/accounts/${id}`, { replace: true });
    else goBack();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: t('accounts.deleteConfirm', { name: existing.name }), message: t('accounts.deleteHint'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteAccount(existing.id);
      navigate(isCard ? '/cards' : '/accounts', { replace: true });
    }
  };

  const typeGrid = (
    <div className="grid grid-cols-2 gap-2">
      {ACCOUNT_TYPES.map((value) => {
        const TypeIcon = iconFor(ACCOUNT_TYPE_STYLE[value].icon);
        const active = type === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => chooseType(value)}
            data-tip={`${accountTypeLabel(value, t)}: ${t(`accounts.type.${value}.hint` as MessageKey)}`}
            className={cx('flex min-h-16 items-start gap-2.5 rounded-2xl border p-3 text-left', active ? 'border-primary bg-primary-soft' : 'border-line bg-surface active:bg-surface-2')}
          >
            <TypeIcon className={cx('mt-0.5 size-5 shrink-0', active ? 'text-primary' : 'text-muted')} aria-hidden />
            <span className="min-w-0">
              <span className={cx('block text-sm leading-tight font-semibold', active && 'text-primary')}>{accountTypeLabel(value, t)}</span>
              <span className="mt-0.5 block text-[0.72rem] leading-snug text-muted">{t(`accounts.type.${value}.hint` as MessageKey)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const balanceLabel = t(`accounts.balance.${type}` as MessageKey);

  return (
    <Page title={existing ? t('accounts.edit') : isCard ? t('cards.new') : t('accounts.new')} back={isCard ? '/cards' : '/accounts'} footer={<Button block onClick={() => void save()}>{t('common.save')}</Button>}>
      <div className="space-y-5 px-4 pt-1">
        {!existing && (
          <section>
            <p className="mb-2 text-sm font-medium text-muted">{t('accounts.whatType')}</p>
            {typeGrid}
          </section>
        )}

        {WITH_INSTITUTION.includes(type) && (
          <Card className="overflow-hidden">
            <Row
              leading={bank ? <BankLogo bank={bank} /> : undefined}
              title={type === 'investment' ? t('accounts.bank.investment') : type === 'virtual' ? t('accounts.bank.virtual') : t('accounts.bank')}
              subtitle={bank?.name}
              trailing={bank ? undefined : t('banks.none')}
              onClick={() => setSheet('bank')}
              chevron
            />
          </Card>
        )}

        <div className="flex items-end gap-3">
          <button type="button" onClick={() => setSheet('icon')} aria-label={t('accounts.iconColor')} className="mb-0.5">
            <AccountIcon account={{ icon, color, bankId: bankId ?? undefined }} size="lg" mono={false} />
          </button>
          <TextField
            className="flex-1"
            label={t(`accounts.name.${type}` as MessageKey)}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={isCard && bank ? bank.name : t(`accounts.placeholder.${type}` as MessageKey)}
            error={error}
            maxLength={40}
          />
        </div>

        {isCard ? (
          <>
            <section>
              <p className="mb-2 text-sm font-medium text-muted">{t('accounts.cardDetails')}</p>
              <Card className="overflow-hidden">
                <Row title={t('cards.limit')} trailing={<span className="font-semibold text-fg tabular">{creditLimit > 0 ? format.money(creditLimit, currency) : t('cards.dayNotSet')}</span>} onClick={() => setSheet('limit')} chevron />
                <Divider />
                <Row title={t('cards.closingDay')} trailing={closingDay ? t('cards.dayValue', { day: closingDay }) : t('cards.dayNotSet')} onClick={() => setSheet('closing')} chevron />
                <Divider />
                <Row title={t('cards.dueDay')} trailing={dueDay ? t('cards.dayValue', { day: dueDay }) : t('cards.dayNotSet')} onClick={() => setSheet('due')} chevron />
              </Card>
              <p className="mt-1.5 px-1 text-xs text-muted">{closingDay ? t('cards.bestDay', { day: closingDay }) : t('cards.setupHint')}</p>
            </section>

            {existing ? (
              <Card className="overflow-hidden">
                <Row leading={<ReceiptText className="size-5 text-primary" aria-hidden />} title={t('cards.purchasesLink')} to={`/accounts/${existing.id}`} />
              </Card>
            ) : (
              <section>
                <p className="mb-1 text-sm font-medium text-muted">{t('cards.backlogTitle')}</p>
                <p className="mb-2.5 text-xs text-muted">{t('cards.backlogHint')}</p>
                <BacklogList items={backlog} currency={currency} onRemove={(index) => setBacklog((list) => list.filter((_, i) => i !== index))} />
                <div className={cx('grid grid-cols-2 gap-2', backlog.length > 0 && 'mt-2')}>
                  <Button variant="secondary" icon={Plus} onClick={() => setBacklogMode('purchase')}>
                    {t('cards.addPurchase')}
                  </Button>
                  <Button variant="secondary" icon={Plus} onClick={() => setBacklogMode('balance')}>
                    {t('cards.addBalance')}
                  </Button>
                </div>
              </section>
            )}
          </>
        ) : (
          <section>
            <Card className="overflow-hidden">
              <Row
                title={balanceLabel}
                trailing={<span className="font-semibold text-fg tabular">{format.money(liability ? -initial : initial, currency)}</span>}
                onClick={() => setSheet('balance')}
                chevron
              />
            </Card>
            <p className="mt-1.5 px-1 text-xs text-muted">{t(`accounts.balanceHint.${type}` as MessageKey)}</p>
          </section>
        )}

        <Card>
          <SwitchRow title={t('accounts.useByDefault')} subtitle={t('accounts.useByDefaultHint')} checked={isDefault} onChange={setIsDefault} />
        </Card>

        <section>
          <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="flex w-full items-center gap-1 px-1 py-1 text-sm font-semibold text-primary">
            {t('accounts.moreOptions')}
            <ChevronDown className={cx('size-4 transition-transform', showMore && 'rotate-180')} aria-hidden />
          </button>
          {showMore && (
            <div className="mt-2 space-y-4">
              {existing && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted">{t('accounts.type')}</p>
                  {typeGrid}
                </div>
              )}
              <div>
                <p className="mb-2 text-sm font-medium text-muted">{t('categories.color')}</p>
                <ColorSwatches
                  colors={CATEGORY_COLORS}
                  value={color}
                  onChange={(c) => {
                    setColor(c);
                    setStyleTouched(true);
                  }}
                  label={t('categories.color')}
                />
              </div>
              <Card className="overflow-hidden">
                <Row title={t('common.currency')} trailing={`${currency} · ${currencyName(currency, locale)}`} onClick={() => setSheet('currency')} chevron />
                {isCard && existing && existing.initialBalance !== 0 && (
                  <>
                    <Divider />
                    <Row title={t('accounts.legacyDebt')} trailing={<span className="tabular">{format.money(-initial, currency)}</span>} onClick={() => setSheet('balance')} chevron />
                  </>
                )}
                <Divider />
                <SwitchRow title={t('accounts.exclude')} subtitle={t('accounts.excludeHint')} checked={exclude} onChange={setExclude} />
              </Card>
              <TextField label={`${t('common.note')} (${t('common.optional')})`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
            </div>
          )}
        </section>

        {existing && (
          <Button variant="ghost" block className="text-danger" onClick={() => void remove()}>
            {t('common.delete')}
          </Button>
        )}
      </div>

      <IconPickerSheet
        open={sheet === 'icon'}
        onClose={() => setSheet(null)}
        value={icon}
        color={color}
        onSelect={(i) => {
          setIcon(i);
          setStyleTouched(true);
        }}
      />
      <CurrencyPickerSheet open={sheet === 'currency'} onClose={() => setSheet(null)} value={currency} onSelect={setCurrency} />
      <AmountSheet
        open={sheet === 'balance'}
        onClose={() => setSheet(null)}
        title={isCard ? t('accounts.legacyDebt') : balanceLabel}
        currency={currency}
        initial={liability ? -initial : initial}
        allowNonPositive
        onSave={(value) => setInitial(liability ? -value : value)}
      />
      <BankPickerSheet
        open={sheet === 'bank'}
        onClose={() => setSheet(null)}
        value={bankId}
        onSelect={(picked) => {
          setBankId(picked?.id ?? null);
          if (picked && !name.trim()) setName(picked.name.slice(0, 40));
        }}
      />
      <AmountSheet
        open={sheet === 'limit'}
        onClose={() => setSheet(null)}
        title={t('cards.limit')}
        currency={currency}
        initial={creditLimit || null}
        onSave={setCreditLimit}
        clearLabel={creditLimit ? t('common.clear') : undefined}
        onClear={() => setCreditLimit(0)}
      />
      <DaySheet open={sheet === 'closing'} onClose={() => setSheet(null)} title={t('cards.closingDay')} value={closingDay} onChange={setClosingDay} />
      <DaySheet open={sheet === 'due'} onClose={() => setSheet(null)} title={t('cards.dueDay')} value={dueDay} onChange={setDueDay} />
      <CardBacklogSheet
        open={backlogMode !== null}
        onClose={() => setBacklogMode(null)}
        mode={backlogMode ?? 'purchase'}
        currency={currency}
        rule={rule}
        onAdd={(item) => setBacklog((list) => [...list, item])}
      />
    </Page>
  );
}

function DaySheet({ open, onClose, title, value, onChange }: { open: boolean; onClose: () => void; title: string; value: number | null; onChange: (day: number) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid grid-cols-7 gap-1.5 px-4 pb-5">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => {
              onChange(day);
              onClose();
            }}
            className={cx('h-11 rounded-xl text-[0.95rem] font-medium', value === day ? 'bg-primary text-primary-fg' : 'bg-surface-2 active:bg-line')}
          >
            {day}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
