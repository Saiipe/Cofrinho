import { Landmark, RefreshCw, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { refreshCdi } from '@/data/cdi';
import { annualRate, defaultRule, monthlyRate, project, YIELD_KINDS, type YieldKind, type YieldRule } from '@/domain/investment';
import type { Account, Minor } from '@/domain/types';
import type { MessageKey, Translate } from '@/i18n';
import { useApp } from '../app/AppContext';
import { useFormat } from '../hooks/useFormat';
import { AmountSheet } from './AmountSheet';
import { useFeedback } from './feedback';
import { Button, Card, Chip, cx, Divider, LinkButton, Row, SwitchRow, TextField } from './primitives';
import { Sheet } from './Sheet';

type Format = ReturnType<typeof useFormat>;

/** "115% do CDI", "12% ao ano", "Poupança". */
export function ruleSummary(rule: YieldRule, t: Translate, format: Format): string {
  if (rule.kind === 'savings') return t('invest.kind.savings');
  return t(`invest.summary.${rule.kind}` as MessageKey, { rate: format.percent(rule.rate / 100, 2) });
}

/** "≈ 15,9% ao ano · ≈ 1,23% ao mês" for the rule with the current CDI. */
function equivalentLine(rule: YieldRule, cdi: number, t: Translate, format: Format): string {
  return t('invest.equivalent', { year: format.percent(annualRate(rule, cdi), 2), month: format.percent(monthlyRate(rule, cdi), 2) });
}

const parseRate = (text: string) => Number(text.replace(',', '.').trim());

/** Account form: how an investment yields. `value` null = no rule ("Não sei"). */
export function YieldRuleEditor({ value, onChange, error }: { value: YieldRule | null; onChange: (rule: YieldRule | null) => void; error?: string | null }) {
  const { t, locale, settings } = useApp();
  const format = useFormat();
  const [rateText, setRateText] = useState(value && value.kind !== 'savings' ? value.rate.toLocaleString(locale) : '');
  const kind: YieldKind | 'none' = value?.kind ?? 'none';
  const choose = (next: YieldKind | 'none') => {
    if (next === 'none') return onChange(null);
    const rule = defaultRule(next);
    if (next !== 'savings') setRateText(rule.rate.toLocaleString(locale));
    onChange(value && next !== 'savings' && value.kind !== 'savings' ? { ...rule, taxed: value.taxed } : rule);
  };
  const valid = value && (value.kind === 'savings' || value.rate > 0);

  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-medium text-muted">{t('invest.ruleTitle')}</p>
        <p className="mt-0.5 text-xs text-muted">{t('invest.ruleHint')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...YIELD_KINDS, 'none' as const].map((option) => {
          const active = kind === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => choose(option)}
              className={cx('rounded-2xl border p-3 text-left', active ? 'border-primary bg-primary-soft' : 'border-line bg-surface active:bg-surface-2')}
            >
              <span className={cx('block text-sm leading-tight font-semibold', active && 'text-primary')}>{t(`invest.kind.${option}` as MessageKey)}</span>
              <span className="mt-0.5 block text-[0.72rem] leading-snug text-muted">{t(`invest.kind.${option}.hint` as MessageKey)}</span>
            </button>
          );
        })}
      </div>

      {value && value.kind !== 'savings' && (
        <TextField
          label={t(`invest.rate.${value.kind}` as MessageKey)}
          inputMode="decimal"
          value={rateText}
          onChange={(e) => {
            setRateText(e.target.value);
            const rate = parseRate(e.target.value);
            onChange({ ...value, rate: Number.isFinite(rate) ? rate : 0 });
          }}
          error={error}
          hint={valid ? `${ruleSummary(value, t, format)} ${equivalentLine(value, settings.cdiRate, t, format)}` : undefined}
        />
      )}
      {value && value.kind === 'savings' && <p className="px-1 text-xs text-muted">{equivalentLine(value, settings.cdiRate, t, format)}</p>}
      {value && (
        <Card className="overflow-hidden">
          <SwitchRow title={t('invest.taxed')} subtitle={t('invest.taxedHint')} checked={value.taxed} onChange={(taxed) => onChange({ ...value, taxed })} />
          {value.kind === 'cdi' && (
            <>
              <Divider />
              <CdiRow />
            </>
          )}
        </Card>
      )}
    </section>
  );
}

/** CDI in use and where it came from; opens the sheet to refresh or type it. */
function CdiRow() {
  const { t, settings } = useApp();
  const format = useFormat();
  const [open, setOpen] = useState(false);
  const source = settings.cdiManual ? t('invest.cdiManual') : settings.cdiDate ? t('invest.cdiSource', { date: format.date(settings.cdiDate) }) : t('invest.cdiFallback');
  return (
    <>
      <Row leading={<Landmark className="size-5 text-muted" aria-hidden />} title={t('invest.cdiLine', { rate: format.percent(settings.cdiRate / 100, 2) })} subtitle={source} onClick={() => setOpen(true)} chevron />
      <CdiSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CdiSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, settings, updateSettings, locale } = useApp();
  const format = useFormat();
  const { toast } = useFeedback();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const typed = parseRate(text);
  const typedValid = text.trim() !== '' && typed > 0 && typed < 100;

  const fetchNow = async () => {
    setBusy(true);
    try {
      const rate = await refreshCdi();
      toast(t('invest.cdiUpdated', { rate: format.percent(rate / 100, 2) }), { tone: 'success' });
      onClose();
    } catch {
      toast(t('invest.cdiFailed'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const saveTyped = async () => {
    await updateSettings({ cdiRate: typed, cdiDate: null, cdiManual: true });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('invest.cdiTitle')}>
      <div className="space-y-4 px-4 pb-5">
        <p className="text-sm text-muted">{t('invest.cdiHint')}</p>
        <Button variant="secondary" block icon={RefreshCw} onClick={() => void fetchNow()} disabled={busy}>
          {t('invest.cdiUpdate')}
        </Button>
        <TextField label={t('invest.cdiField')} inputMode="decimal" value={text} placeholder={settings.cdiRate.toLocaleString(locale)} onChange={(e) => setText(e.target.value)} />
        <Button block onClick={() => void saveTyped()} disabled={!typedValid}>
          {t('invest.cdiSave')}
        </Button>
      </div>
    </Sheet>
  );
}

const PERIODS = [1, 6, 12, 24, 60, 120];

/** Account detail: the investment's rule, what it earns now and a projection over time. */
export function YieldCard({ account, balance }: { account: Account; balance: Minor }) {
  const { t, settings } = useApp();
  const format = useFormat();
  const [start, setStart] = useState<Minor | null>(null);
  const [deposit, setDeposit] = useState<Minor>(0);
  const [months, setMonths] = useState(12);
  const [sheet, setSheet] = useState<'start' | 'deposit' | null>(null);
  const rule = account.yieldRule;
  const currency = account.currency;

  if (!rule) {
    return (
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">{t('invest.title')}</h3>
        </div>
        <p className="text-sm text-muted">{t('invest.noRule')}</p>
        <LinkButton to={`/accounts/${account.id}/edit`} variant="secondary" block>
          {t('invest.setRule')}
        </LinkButton>
      </Card>
    );
  }

  const cdi = settings.cdiRate;
  const base = start ?? Math.max(0, balance);
  const perMonth = Math.round(Math.max(0, balance) * monthlyRate(rule, cdi));
  const result = project(base, deposit, months, rule, cdi);
  const periodLabel = (m: number) => (m % 12 === 0 ? t('invest.years', { count: m / 12 }) : t('invest.months', { count: m }));
  const money = (value: Minor) => format.money(value, currency);

  return (
    <Card className="overflow-hidden">
      <div className="space-y-1 p-4 pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">{t('invest.title')}</h3>
        </div>
        <p className="text-[1.05rem] font-semibold">{ruleSummary(rule, t, format)}</p>
        <p className="text-xs text-muted">{equivalentLine(rule, cdi, t, format)}</p>
        {balance > 0 && <p className="pt-1 text-sm text-income">{t(rule.taxed ? 'invest.perMonthTaxed' : 'invest.perMonth', { amount: money(perMonth) })}</p>}
      </div>
      {rule.kind === 'cdi' && (
        <>
          <Divider />
          <CdiRow />
        </>
      )}
      <Divider />
      <div className="space-y-3 p-4">
        <h4 className="text-sm font-semibold">{t('invest.simTitle')}</h4>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSheet('start')} className="rounded-xl bg-surface-2 px-3 py-2.5 text-left active:bg-line">
            <span className="block text-xs text-muted">{t('invest.simStart')}</span>
            <span className="block truncate text-sm font-semibold tabular">{money(base)}</span>
          </button>
          <button type="button" onClick={() => setSheet('deposit')} className="rounded-xl bg-surface-2 px-3 py-2.5 text-left active:bg-line">
            <span className="block text-xs text-muted">{t('invest.simDeposit')}</span>
            <span className="block truncate text-sm font-semibold tabular">{deposit > 0 ? money(deposit) : t('invest.simNoDeposit')}</span>
          </button>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted">{t('invest.simPeriod')}</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {PERIODS.map((m) => (
              <Chip key={m} active={months === m} onClick={() => setMonths(m)} className="h-8 px-3 text-xs">
                {periodLabel(m)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-primary-soft px-3.5 py-3">
          <p className="text-xs text-muted">{t('invest.netTotal')}</p>
          <p className="text-[1.4rem] leading-tight font-semibold tabular">{money(result.netTotal)}</p>
        </div>
        <dl className="space-y-1.5 text-sm">
          {[
            { label: t('invest.invested'), value: money(result.invested) },
            { label: t('invest.grossYield'), value: `+${money(result.grossYield)}`, tone: 'text-income' },
            ...(rule.taxed ? [{ label: t('invest.tax'), value: `-${money(result.tax)}`, tone: 'text-muted' }] : []),
            { label: t('invest.netYield'), value: `+${money(result.netYield)}`, tone: 'text-income font-semibold' },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">{row.label}</dt>
              <dd className={cx('tabular', row.tone)}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[0.72rem] leading-snug text-faint">{t('invest.disclaimer')}</p>
      </div>
      <AmountSheet open={sheet === 'start'} onClose={() => setSheet(null)} title={t('invest.simStart')} currency={currency} initial={base} onSave={setStart} />
      <AmountSheet
        open={sheet === 'deposit'}
        onClose={() => setSheet(null)}
        title={t('invest.simDeposit')}
        currency={currency}
        initial={deposit || null}
        onSave={setDeposit}
        clearLabel={deposit ? t('common.clear') : undefined}
        onClear={() => setDeposit(0)}
      />
    </Card>
  );
}
