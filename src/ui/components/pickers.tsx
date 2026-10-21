import { Check, ChevronLeft, ChevronRight, CreditCard, Search, Settings2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { bookTransactions } from '@/data/transactions';
import { accountBalances } from '@/domain/balances';
import { accountTypeLabel } from '@/i18n/labels';
import { calendarWeeks, dayKey, parseDayKey, todayKey, weekdayOrder, withDay } from '@/domain/dates';
import { currencySymbol } from '@/domain/money';
import type { Account, Category, CategoryKind, DayKey, ID } from '@/domain/types';
import { useApp, useT } from '../app/AppContext';
import { useBook, useOptionalBook } from '../app/BookContext';
import { allCurrencies, currencyName } from '../currencies';
import { useFormat } from '../hooks/useFormat';
import { ICON_GROUPS, iconFor } from '../icons';
import { AccountIcon } from './banks';
import { CategoryIcon, EntityIcon } from './EntityIcon';
import { Sheet } from './Sheet';
import { Button, Chip, cx, IconButton } from './primitives';

// ---------- Date ----------

export function DatePickerSheet({
  open,
  onClose,
  value,
  onChange,
  withTime = true,
  title,
}: {
  open: boolean;
  onClose: () => void;
  value: number;
  onChange: (value: number) => void;
  withTime?: boolean;
  title?: string;
}) {
  const t = useT();
  const { settings } = useApp();
  const format = useFormat();
  const selected = dayKey(value);
  const [cursor, setCursor] = useState(() => parseDayKey(selected));
  const weeks = calendarWeeks(cursor.year, cursor.month, settings.weekStart);
  const today = todayKey();
  const shift = (delta: number) => {
    const total = cursor.year * 12 + cursor.month + delta;
    setCursor({ year: Math.floor(total / 12), month: ((total % 12) + 12) % 12, day: 1 });
  };
  const pick = (key: DayKey) => {
    onChange(withDay(key, value));
    if (!withTime) onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? t('tx.chooseDate')}
      footer={
        withTime ? (
          <div className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm text-muted">
              {t('common.time')}
              <input
                type="time"
                value={`${String(new Date(value).getHours()).padStart(2, '0')}:${String(new Date(value).getMinutes()).padStart(2, '0')}`}
                onChange={(event) => {
                  const [h, m] = event.target.value.split(':').map(Number);
                  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return;
                  const d = new Date(value);
                  d.setHours(h, m, 0, 0);
                  onChange(d.getTime());
                }}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-fg"
              />
            </label>
            <Button onClick={onClose}>{t('common.done')}</Button>
          </div>
        ) : undefined
      }
    >
      <div className="px-4 pb-4">
        <div className="mb-3 flex gap-2">
          <Chip active={selected === today} onClick={() => { setCursor(parseDayKey(today)); pick(today); }}>
            {t('common.today')}
          </Chip>
          <Chip
            active={selected === dayKey(Date.now() - 86_400_000)}
            onClick={() => {
              const y = dayKey(Date.now() - 86_400_000);
              setCursor(parseDayKey(y));
              pick(y);
            }}
          >
            {t('common.yesterday')}
          </Chip>
        </div>
        <div className="flex items-center justify-between">
          <IconButton icon={ChevronLeft} label={t('home.previousMonth')} onClick={() => shift(-1)} />
          <span className="text-base font-semibold">{format.monthYear(cursor.year, cursor.month)}</span>
          <IconButton icon={ChevronRight} label={t('home.nextMonth')} onClick={() => shift(1)} />
        </div>
        <div className="mt-1 grid grid-cols-7 text-center text-xs font-medium text-faint">
          {weekdayOrder(settings.weekStart).map((d) => (
            <span key={d} className="py-1.5">
              {format.weekdayNarrow(d)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {weeks.flat().map((key) => {
            const { month, day } = parseDayKey(key);
            const outside = month !== cursor.month;
            const isSelected = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pick(key)}
                aria-pressed={isSelected}
                aria-label={format.date(key)}
                className={cx(
                  'mx-auto flex size-10 items-center justify-center rounded-full text-[0.95rem]',
                  isSelected ? 'bg-primary font-semibold text-primary-fg' : key === today ? 'font-semibold text-primary ring-1 ring-primary' : outside ? 'text-faint' : 'text-fg active:bg-surface-2',
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

// ---------- Month ----------

export function MonthPickerSheet({ open, onClose, year, month, onSelect }: { open: boolean; onClose: () => void; year: number; month: number; onSelect: (year: number, month: number) => void }) {
  const t = useT();
  const format = useFormat();
  const [viewYear, setViewYear] = useState(year);
  const now = new Date();
  return (
    <Sheet open={open} onClose={onClose} title={t('home.pickMonth')}>
      <div className="px-4 pb-5">
        <div className="mb-3 flex items-center justify-between">
          <IconButton icon={ChevronLeft} label={String(viewYear - 1)} onClick={() => setViewYear((y) => y - 1)} />
          <span className="text-lg font-semibold tabular">{viewYear}</span>
          <IconButton icon={ChevronRight} label={String(viewYear + 1)} onClick={() => setViewYear((y) => y + 1)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, m) => {
            const active = viewYear === year && m === month;
            const current = viewYear === now.getFullYear() && m === now.getMonth();
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onSelect(viewYear, m);
                  onClose();
                }}
                className={cx(
                  'h-12 rounded-xl text-[0.95rem] font-medium',
                  active ? 'bg-primary text-primary-fg' : current ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-fg active:bg-line',
                )}
              >
                {format.monthShort(m)}
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          block
          className="mt-3"
          onClick={() => {
            onSelect(now.getFullYear(), now.getMonth());
            onClose();
          }}
        >
          {t('common.today')}
        </Button>
      </div>
    </Sheet>
  );
}

// ---------- Account ----------

export function AccountPickerSheet({
  open,
  onClose,
  value,
  onSelect,
  allowNone = true,
  exclude,
  title,
}: {
  open: boolean;
  onClose: () => void;
  value: ID | null;
  onSelect: (account: Account | null) => void;
  allowNone?: boolean;
  exclude?: ID | null;
  title?: string;
}) {
  const t = useT();
  const { book, accounts } = useBook();
  const format = useFormat();
  const options = accounts.filter((a) => a.id !== exclude);
  const cards = options.filter((a) => a.type === 'credit');
  const others = options.filter((a) => a.type !== 'credit');
  // Balances only while the sheet is open, to show each card's available limit.
  const transactions = useLiveQuery(async () => (open && cards.length ? bookTransactions(book.id) : null), [open, book.id, cards.length]);
  const balances = transactions ? accountBalances(cards, transactions) : null;
  const choose = (account: Account | null) => {
    onSelect(account);
    onClose();
  };
  const hint = (account: Account) => {
    if (account.type !== 'credit') return account.currency === book.currency ? accountTypeLabel(account.type, t) : account.currency;
    const balance = balances?.get(account.id);
    if (!account.creditLimit || balance === undefined) return accountTypeLabel(account.type, t);
    return t('cards.availableShort', { amount: format.money(account.creditLimit - Math.max(0, -balance), account.currency) });
  };
  const row = (account: Account) => <PickerRow key={account.id} selected={account.id === value} onClick={() => choose(account)} leading={<AccountIcon account={account} />} label={account.name} hint={hint(account)} />;
  const heading = (text: string) => <p className="px-5 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{text}</p>;
  return (
    <Sheet open={open} onClose={onClose} title={title ?? t('tx.chooseAccount')}>
      <div className="pb-3">
        {allowNone && (
          <PickerRow selected={value === null} onClick={() => choose(null)} leading={<EntityIcon icon="circle-ellipsis" color="#8b93a1" mono={false} />} label={t('tx.noAccount')} />
        )}
        {cards.length > 0 && others.length > 0 && heading(t('accounts.groupCards'))}
        {cards.map(row)}
        {cards.length > 0 && others.length > 0 && heading(t('accounts.groupAccounts'))}
        {others.map(row)}
        <div className="mx-4 mt-2 grid grid-cols-2 gap-2">
          <Link to="/accounts/new" onClick={onClose} className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary active:bg-primary-soft">
            <Settings2 className="size-4" aria-hidden />
            {t('accounts.new')}
          </Link>
          <Link to="/accounts/new?type=credit" onClick={onClose} className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary active:bg-primary-soft">
            <CreditCard className="size-4" aria-hidden />
            {t('cards.new.short')}
          </Link>
        </div>
      </div>
    </Sheet>
  );
}

function PickerRow({ selected, onClick, leading, label, hint }: { selected: boolean; onClick: () => void; leading?: ReactNode; label: string; hint?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2">
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
      {selected && <Check className="size-5 text-primary" aria-hidden />}
    </button>
  );
}

// ---------- Currency ----------

export function CurrencyPickerSheet({ open, onClose, value, onSelect, title }: { open: boolean; onClose: () => void; value: string; onSelect: (code: string) => void; title?: string }) {
  const t = useT();
  const { locale } = useApp();
  const bookContext = useOptionalBook();
  const [query, setQuery] = useState('');
  const used = useMemo(
    () => [...new Set(bookContext ? [bookContext.book.currency, ...bookContext.accounts.map((a) => a.currency), value] : [value, 'BRL', 'USD', 'EUR'])],
    [bookContext, value],
  );
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCurrencies()
      .map((code) => ({ code, name: currencyName(code, locale) }))
      .filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [query, locale]);
  const choose = (code: string) => {
    onSelect(code);
    onClose();
    setQuery('');
  };
  const row = (code: string, name: string) => (
    <PickerRow
      key={code}
      selected={code === value}
      onClick={() => choose(code)}
      leading={<span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">{currencySymbol(code, locale)}</span>}
      label={`${code} · ${name}`}
    />
  );
  return (
    <Sheet open={open} onClose={onClose} title={title ?? t('tx.chooseCurrency')} tall>
      <div className="sticky top-0 z-10 bg-surface px-4 pb-2">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <Search className="size-4 text-faint" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('currencies.search')} className="h-full min-w-0 flex-1 bg-transparent outline-none" data-autofocus />
        </label>
      </div>
      {!query && (
        <>
          <p className="px-5 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{t('currencies.used')}</p>
          {used.map((code) => row(code, currencyName(code, locale)))}
          <p className="px-5 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{t('currencies.others')}</p>
        </>
      )}
      <div className="pb-4">{list.map((c) => row(c.code, c.name))}</div>
    </Sheet>
  );
}

// ---------- Category ----------

export function CategoryPickerSheet({
  open,
  onClose,
  kind,
  value,
  onSelect,
  allowNone,
}: {
  open: boolean;
  onClose: () => void;
  kind: CategoryKind;
  value: ID | null;
  onSelect: (category: Category | null) => void;
  allowNone?: boolean;
}) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('tx.chooseCategory')} tall>
      <CategoryGrid
        kind={kind}
        value={value}
        onSelect={(category) => {
          onSelect(category);
          onClose();
        }}
        allowNone={allowNone}
      />
    </Sheet>
  );
}

/**
 * Category grid. Tapping a parent with subcategories reveals them below the parent's row;
 * the parent itself remains selectable as "general".
 */
export function CategoryGrid({ kind, value, onSelect, allowNone, compact }: { kind: CategoryKind; value: ID | null; onSelect: (category: Category | null) => void; allowNone?: boolean; compact?: boolean }) {
  const t = useT();
  const { settings } = useApp();
  const { topCategories, childrenOf, categoryMap, categoryName } = useBook();
  const tops = topCategories(kind);
  const selected = value ? categoryMap.get(value) : undefined;
  const [expanded, setExpanded] = useState<ID | null>(selected?.parentId ?? (selected && childrenOf(selected.id).length ? selected.id : null));
  const columns = 4;
  const rows: Category[][] = [];
  for (let i = 0; i < tops.length; i += columns) rows.push(tops.slice(i, i + columns));
  const children = expanded && settings.showSubcategories ? childrenOf(expanded) : [];

  if (!tops.length) {
    return (
      <div className="px-6 py-8 text-center text-sm text-muted">
        {t('tx.noCategories')}{' '}
        <Link className="font-semibold text-primary" to="/categories">
          {t('tx.manageCategories')}
        </Link>
      </div>
    );
  }

  const cell = (category: Category, active: boolean, sub = false) => (
    <button
      key={category.id}
      type="button"
      onClick={() => {
        if (!sub && settings.showSubcategories && childrenOf(category.id).length) setExpanded((e) => (e === category.id && value === category.id ? null : category.id));
        onSelect(category);
      }}
      aria-pressed={active}
      className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 active:bg-surface-2"
    >
      <span className={cx('rounded-full p-0.5 ring-2', active ? 'ring-primary' : 'ring-transparent')}>
        <CategoryIcon category={category} size={sub ? 'md' : compact ? 'md' : 'lg'} />
      </span>
      <span className={cx('w-full truncate text-center text-[0.75rem] leading-tight', active ? 'font-semibold text-fg' : 'text-muted')}>{categoryName(category)}</span>
    </button>
  );

  return (
    <div className="px-2 pb-3">
      {allowNone && (
        <button type="button" onClick={() => onSelect(null)} className={cx('mx-2 mb-2 flex h-10 items-center gap-2 rounded-xl px-3 text-sm', value === null ? 'bg-primary-soft font-semibold text-primary' : 'text-muted')}>
          {t('common.uncategorized')}
        </button>
      )}
      {rows.map((row, index) => (
        <div key={index}>
          <div className="grid grid-cols-4">{row.map((c) => cell(c, value === c.id || selected?.parentId === c.id))}</div>
          {children.length > 0 && row.some((c) => c.id === expanded) && (
            <div className="mx-1 my-1 grid grid-cols-4 rounded-2xl bg-surface-2 py-1">{children.map((c) => cell(c, value === c.id, true))}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- Icon & color ----------

export function IconPickerSheet({ open, onClose, value, color, onSelect }: { open: boolean; onClose: () => void; value: string; color: string; onSelect: (icon: string) => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('categories.chooseIcon')} tall>
      <div className="px-3 pb-5">
        {ICON_GROUPS.map((group) => (
          <div key={group.key} className="mb-3" data-no-tip>
            <p className="px-2 pt-2 pb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{t(group.key)}</p>
            <div className="grid grid-cols-6 gap-1">
              {group.icons.map((icon) => {
                const Icon = iconFor(icon);
                const active = icon === value;
                return (
                  <button
                    key={`${group.key}-${icon}`}
                    type="button"
                    aria-label={icon}
                    aria-pressed={active}
                    onClick={() => {
                      onSelect(icon);
                      onClose();
                    }}
                    className={cx('flex aspect-square items-center justify-center rounded-2xl', active ? 'text-white' : 'text-fg active:bg-surface-2')}
                    style={active ? { backgroundColor: color } : undefined}
                  >
                    <Icon className="size-6" aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function ColorSwatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (color: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5" data-no-tip>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cx('flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-surface', color === value && 'ring-2 ring-fg')}
          style={{ backgroundColor: color }}
        >
          {color === value && <Check className="size-4 text-white" aria-hidden />}
        </button>
      ))}
    </div>
  );
}
