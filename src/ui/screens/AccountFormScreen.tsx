import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { deleteAccount, saveAccount } from '@/data/accounts';
import { db } from '@/data/db';
import { ACCOUNT_TYPES, isLiability } from '@/domain/balances';
import { ACCOUNT_TYPE_STYLE, CATEGORY_COLORS } from '@/domain/defaults';
import type { Account, AccountType } from '@/domain/types';
import { accountTypeLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AmountSheet } from '../components/AmountSheet';
import { EntityIcon } from '../components/EntityIcon';
import { useFeedback } from '../components/feedback';
import { Page, useGoBack } from '../components/Page';
import { ColorSwatches, CurrencyPickerSheet, IconPickerSheet } from '../components/pickers';
import { Button, Card, cx, Divider, Row, SwitchRow, TextField } from '../components/primitives';
import { currencyName } from '../currencies';
import { iconFor } from '../icons';
import { useFormat } from '../hooks/useFormat';

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
  const goBack = useGoBack('/accounts');
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'debit');
  const [icon, setIcon] = useState(existing?.icon ?? ACCOUNT_TYPE_STYLE.debit.icon);
  const [color, setColor] = useState(existing?.color ?? ACCOUNT_TYPE_STYLE.debit.color);
  const [styleTouched, setStyleTouched] = useState(Boolean(existing));
  const [currency, setCurrency] = useState(existing?.currency ?? book.currency);
  const [initial, setInitial] = useState(existing?.initialBalance ?? 0);
  const [exclude, setExclude] = useState(existing?.excludeFromTotals ?? false);
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'icon' | 'currency' | 'balance' | null>(null);
  const liability = isLiability(type);

  const chooseType = (next: AccountType) => {
    setType(next);
    if (!styleTouched) {
      setIcon(ACCOUNT_TYPE_STYLE[next].icon);
      setColor(ACCOUNT_TYPE_STYLE[next].color);
    }
    // Debts are stored negative; flip the sign when switching between asset and liability.
    if (isLiability(next) !== liability && initial !== 0) setInitial(-initial);
  };

  const save = async () => {
    if (!name.trim()) {
      setError(t('accounts.nameRequired'));
      return;
    }
    await saveAccount({ id: existing?.id, bookId: book.id, name, type, icon, color, currency, initialBalance: initial, excludeFromTotals: exclude, isDefault, note });
    toast(t('common.saved'), { tone: 'success' });
    goBack();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: t('accounts.deleteConfirm', { name: existing.name }), message: t('accounts.deleteHint'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteAccount(existing.id);
      navigate('/accounts', { replace: true });
    }
  };

  return (
    <Page title={existing ? t('accounts.edit') : t('accounts.new')} back="/accounts" footer={<Button block onClick={() => void save()}>{t('common.save')}</Button>}>
      <div className="space-y-5 px-4">
        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={() => setSheet('icon')} aria-label={t('accounts.icon')}>
            <EntityIcon icon={icon} color={color} size="xl" mono={false} />
          </button>
          <TextField className="flex-1" label={t('accounts.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('accounts.namePlaceholder')} error={error} maxLength={40} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('accounts.type')}</p>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_TYPES.map((value) => {
              const TypeIcon = iconFor(ACCOUNT_TYPE_STYLE[value].icon);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => chooseType(value)}
                  className={cx('flex h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium', type === value ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface')}
                >
                  <TypeIcon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{accountTypeLabel(value, t)}</span>
                </button>
              );
            })}
          </div>
        </div>

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
          <Divider />
          <Row
            title={liability ? t('accounts.currentDebt') : t('accounts.initialBalance')}
            trailing={<span className="font-semibold text-fg tabular">{format.money(liability ? -initial : initial, currency)}</span>}
            onClick={() => setSheet('balance')}
            chevron
          />
          <Divider />
          <SwitchRow title={t('accounts.exclude')} subtitle={t('accounts.excludeHint')} checked={exclude} onChange={setExclude} />
          <Divider />
          <SwitchRow title={t('accounts.default')} subtitle={t('accounts.defaultHint')} checked={isDefault} onChange={setIsDefault} />
        </Card>

        <TextField label={`${t('common.note')} (${t('common.optional')})`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />

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
        title={liability ? t('accounts.currentDebt') : t('accounts.initialBalance')}
        currency={currency}
        initial={liability ? -initial : initial}
        allowNonPositive
        onSave={(value) => setInitial(liability ? -value : value)}
      />
    </Page>
  );
}
