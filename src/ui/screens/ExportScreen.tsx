import { useLiveQuery } from 'dexie-react-hooks';
import { FileDown } from 'lucide-react';
import { useState } from 'react';
import { transactionsInPeriod } from '@/data/transactions';
import { addDays, addMonthsClamped, dayKey, dayStart, daysBetween, makeDayKey, monthPeriodOf, parseDayKey, todayKey, withDay } from '@/domain/dates';
import { buildExportRows, EXPORT_FORMATS, exportCsv, exportHtml, exportJson, exportXlsx, type ExportFormat } from '@/io/exporters';
import type { MessageKey } from '@/i18n';
import { deliverFile, stampedFileName } from '@/services/files';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { DatePickerSheet } from '../components/pickers';
import { Button, Card, Chip, Divider, Row, Spinner } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

const MIME: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  html: 'text/html;charset=utf-8',
};

/** The original app allows at most one year per export; keep the same limit. */
const MAX_DAYS = 366;

export default function ExportScreen() {
  const { settings, t, locale } = useApp();
  const { book, categoryMap, accountMap, memberMap } = useBook();
  const format = useFormat();
  const { toast } = useFeedback();
  const today = todayKey();
  const month = monthPeriodOf(today, settings.monthStartDay);
  const [kind, setKind] = useState<ExportFormat>('xlsx');
  const [start, setStart] = useState(month.startKey);
  const [end, setEnd] = useState(today);
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const [busy, setBusy] = useState(false);
  const range = { start: dayStart(start), end: dayStart(addDays(end, 1)) };
  const txs = useLiveQuery(() => transactionsInPeriod(book.id, range), [book.id, range.start, range.end]);
  const span = daysBetween(start, end) + 1;
  const invalid = end < start ? t('export.rangeInvalid') : span > MAX_DAYS ? t('export.maxYear') : null;

  const presets: { label: string; start: string; end: string }[] = [
    { label: t('common.today'), start: today, end: today },
    { label: format.periodLabel(month), start: month.startKey, end: addDays(month.endKey, -1) },
    { label: String(parseDayKey(today).year), start: makeDayKey(parseDayKey(today).year, 0, 1), end: today },
    { label: '12m', start: addDays(addMonthsClamped(today, -12), 1), end: today },
  ];

  const run = async () => {
    if (invalid || !txs) return;
    if (!txs.length) {
      toast(t('export.empty'));
      return;
    }
    setBusy(true);
    try {
      const ctx = { book, categories: categoryMap, accounts: accountMap, members: memberMap, t, locale, money: format.moneyFormat, range: { start, end } };
      const rows = buildExportRows(txs, ctx);
      const data = kind === 'xlsx' ? exportXlsx(rows, ctx) : kind === 'csv' ? exportCsv(rows, ctx, format.decimalSeparator) : kind === 'json' ? exportJson(rows, ctx) : exportHtml(rows, ctx);
      const base = `cofrinho-${book.name.normalize('NFD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase()}`;
      await deliverFile(data, stampedFileName(base, kind), MIME[kind]);
      toast(t('export.done'), { tone: 'success' });
    } catch {
      toast(t('common.error'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={t('export.title')}
      back="/me"
      footer={
        <Button block icon={busy ? undefined : FileDown} onClick={() => void run()} disabled={busy || Boolean(invalid)}>
          {busy ? <Spinner /> : t('export.run')}
        </Button>
      }
    >
      <div className="space-y-5 px-4">
        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('export.format')}</p>
          <div className="grid grid-cols-2 gap-2">
            {EXPORT_FORMATS.map((f) => (
              <Chip key={f} active={kind === f} onClick={() => setKind(f)} className="h-11 justify-center">
                {t(`export.fmt.${f}` as MessageKey)}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('export.period')}</p>
          <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
            {presets.map((p) => (
              <Chip
                key={p.label}
                active={start === p.start && end === p.end}
                onClick={() => {
                  setStart(p.start);
                  setEnd(p.end);
                }}
              >
                {p.label}
              </Chip>
            ))}
          </div>
          <Card className="overflow-hidden">
            <Row title={t('export.start')} trailing={format.date(start)} onClick={() => setPicking('start')} chevron />
            <Divider />
            <Row title={t('export.end')} trailing={format.date(end)} onClick={() => setPicking('end')} chevron />
          </Card>
          <p className={`mt-2 px-1 text-sm ${invalid ? 'text-danger' : 'text-muted'}`}>{invalid ?? (txs ? t('export.count', { count: txs.length }) : '…')}</p>
          {!invalid && <p className="px-1 text-xs text-faint">{t('export.maxYear')}</p>}
        </div>
      </div>
      <DatePickerSheet open={picking === 'start'} onClose={() => setPicking(null)} value={withDay(start, Date.now())} onChange={(ms) => setStart(dayKey(ms))} withTime={false} title={t('export.start')} />
      <DatePickerSheet open={picking === 'end'} onClose={() => setPicking(null)} value={withDay(end, Date.now())} onChange={(ms) => setEnd(dayKey(ms))} withTime={false} title={t('export.end')} />
    </Page>
  );
}
