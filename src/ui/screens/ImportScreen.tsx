import { CircleAlert, FileUp, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { applyImport, previewImport } from '@/data/imports';
import { bookTransactions } from '@/data/transactions';
import { dayKey } from '@/domain/dates';
import {
  buildDrafts,
  detectDateOrder,
  guessMapping,
  hasNegativeAmounts,
  IMPORT_FIELDS,
  IMPORT_MAX_MB,
  ImportError,
  readImportTable,
  type DateOrder,
  type ImportDraft,
  type ImportField,
  type ImportMapping,
  type ImportTable,
} from '@/io/importers';
import type { MessageKey } from '@/i18n';
import { pickFile } from '@/services/files';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { InlineNotice, useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { Badge, Button, Card, cx, Divider, Spinner, SwitchRow } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

interface Loaded {
  name: string;
  table: ImportTable;
  mapping: ImportMapping;
  dateOrder: DateOrder;
  negativeIsExpense: boolean;
}

export default function ImportScreen() {
  const { t, locale } = useApp();
  const { book, isSplit } = useBook();
  const format = useFormat();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof bookTransactions>>>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [creating, setCreating] = useState<{ newCategories: number; newAccounts: number } | null>(null);

  const result = useMemo(
    () => (loaded ? buildDrafts(loaded.table, loaded.mapping, { bookCurrency: book.currency, dateOrder: loaded.dateOrder, negativeIsExpense: loaded.negativeIsExpense, existing }) : null),
    [loaded, book.currency, existing],
  );
  const drafts = result?.drafts ?? [];
  const selected = drafts.filter((d) => !excluded.has(d.row));
  const duplicates = drafts.filter((d) => d.duplicate).length;
  const visible = onlyDuplicates ? drafts.filter((d) => d.duplicate) : drafts;

  const choose = async () => {
    const file = await pickFile({ accept: '.csv,.txt,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (!file) return;
    if (file.size > IMPORT_MAX_MB * 1024 * 1024) {
      toast(t('import.tooLarge', { size: IMPORT_MAX_MB }), { tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const table = readImportTable(file.name, new Uint8Array(await file.arrayBuffer()));
      const mapping = table.mapping ?? guessMapping(table.header);
      const dateColumn = mapping.date;
      const dateOrder = detectDateOrder(dateColumn === undefined ? [] : table.rows.map((r) => r[dateColumn] ?? ''), locale === 'en' ? 'mdy' : 'dmy');
      const transactions = await bookTransactions(book.id);
      setExisting(transactions);
      const initial: Loaded = { name: file.name, table, mapping, dateOrder, negativeIsExpense: mapping.kind === undefined && hasNegativeAmounts(table, mapping) };
      setLoaded(initial);
      // Duplicates start unchecked so a re-import does not double the history.
      const firstPass = buildDrafts(table, mapping, { bookCurrency: book.currency, dateOrder, negativeIsExpense: initial.negativeIsExpense, existing: transactions });
      setExcluded(new Set(firstPass.drafts.filter((d) => d.duplicate).map((d) => d.row)));
      setCreating(await previewImport(book, firstPass.drafts, t));
    } catch (error) {
      toast(error instanceof ImportError && error.reason === 'empty' ? t('import.noRows') : error instanceof ImportError && error.reason === 'backup' ? t('backup.invalid') : t('import.invalid'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remap = (field: ImportField, column: number | undefined) => {
    if (!loaded) return;
    const mapping = { ...loaded.mapping };
    if (column === undefined) delete mapping[field];
    else mapping[field] = column;
    setLoaded({ ...loaded, mapping });
  };

  const run = async () => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const outcome = await applyImport(book, selected, t);
      toast(t('import.done', { count: outcome.created }), { tone: 'success' });
      if (outcome.missingRate) toast(t('tx.missingRate', { from: selected.find((d) => d.currency !== book.currency)?.currency ?? '?', to: book.currency }), { tone: 'error' });
      navigate('/', { replace: true });
    } catch {
      toast(t('common.error'), { tone: 'error' });
      setBusy(false);
    }
  };

  if (isSplit) {
    return (
      <Page title={t('import.title')} back="/me">
        <div className="px-4">
          <InlineNotice icon={Info} tone="warning">
            {t('import.splitBook')}
          </InlineNotice>
        </div>
      </Page>
    );
  }

  const fieldLabel = (field: ImportField) => t(`import.col.${field}` as MessageKey);
  const toggle = (draft: ImportDraft) =>
    setExcluded((set) => {
      const next = new Set(set);
      if (next.has(draft.row)) next.delete(draft.row);
      else next.add(draft.row);
      return next;
    });

  return (
    <Page
      title={t('import.title')}
      back="/me"
      footer={
        loaded ? (
          <Button block onClick={() => void run()} disabled={busy || selected.length === 0}>
            {busy ? <Spinner /> : t('import.run', { count: selected.length })}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4 px-4">
        <Card className="flex flex-col items-center px-6 py-6 text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <FileUp className="size-7" aria-hidden />
          </span>
          <p className="text-sm text-muted">{loaded ? loaded.name : t('import.formats')}</p>
          <Button className="mt-4" variant={loaded ? 'secondary' : 'primary'} onClick={() => void choose()} disabled={busy}>
            {busy && !loaded ? <Spinner /> : t('import.pick')}
          </Button>
          <p className="mt-3 text-xs text-faint">{t('import.targetBook', { name: book.name })}</p>
        </Card>

        {loaded && result && (
          <>
            <section>
              <h2 className="mb-1 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('import.columns')}</h2>
              <p className="mb-2 px-1 text-xs text-muted">{t('import.mapHint')}</p>
              <Card className="overflow-hidden">
                {IMPORT_FIELDS.map((field, index) => (
                  <div key={field}>
                    {index > 0 && <Divider />}
                    <label className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-28 shrink-0 text-sm font-medium">{fieldLabel(field)}</span>
                      <select
                        value={loaded.mapping[field] ?? ''}
                        onChange={(e) => remap(field, e.target.value === '' ? undefined : Number(e.target.value))}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-sm"
                      >
                        <option value="">{t('import.col.ignore')}</option>
                        {loaded.table.header.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
                {loaded.mapping.kind === undefined && (
                  <>
                    <Divider />
                    <SwitchRow title={t('import.negativeExpense')} checked={loaded.negativeIsExpense} onChange={(v) => setLoaded({ ...loaded, negativeIsExpense: v })} />
                  </>
                )}
              </Card>
            </section>

            <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
              <b>{t('import.found', { count: drafts.length })}</b>
              {duplicates > 0 && <Badge tone="warning">{t('import.duplicates', { count: duplicates })}</Badge>}
              {result.skipped > 0 && <Badge>{t('import.invalidRows', { count: result.skipped })}</Badge>}
            </div>
            {creating && (creating.newCategories > 0 || creating.newAccounts > 0) && (
              <InlineNotice icon={Info}>
                {[creating.newCategories ? t('import.newCategories', { count: creating.newCategories }) : null, creating.newAccounts ? t('import.newAccounts', { count: creating.newAccounts }) : null].filter(Boolean).join(' · ')}
              </InlineNotice>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setExcluded(new Set())}>
                {t('import.selectAll')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setExcluded(new Set(drafts.map((d) => d.row)))}>
                {t('import.selectNone')}
              </Button>
              {duplicates > 0 && (
                <Button size="sm" variant={onlyDuplicates ? 'primary' : 'secondary'} onClick={() => setOnlyDuplicates((v) => !v)}>
                  {t('import.onlyDuplicates')}
                </Button>
              )}
            </div>

            {drafts.length === 0 ? (
              <InlineNotice icon={CircleAlert} tone="warning">
                {t('import.noRows')}
              </InlineNotice>
            ) : (
              <Card className="overflow-hidden">
                {visible.slice(0, 400).map((draft, index) => {
                  const included = !excluded.has(draft.row);
                  return (
                    <div key={draft.row}>
                      {index > 0 && <Divider />}
                      <label className={cx('flex items-center gap-3 px-4 py-2.5', !included && 'opacity-50')}>
                        <input type="checkbox" checked={included} onChange={() => toggle(draft)} className="size-5 shrink-0 accent-[var(--primary)]" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[0.9rem] font-medium">{draft.note || [draft.categoryName, draft.subcategoryName].filter(Boolean).join(' › ') || t(`kind.${draft.kind}` as MessageKey)}</span>
                            {draft.duplicate && <Badge tone="warning">{t('import.duplicate')}</Badge>}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {format.date(dayKey(draft.date))}
                            {draft.categoryName ? ` · ${draft.categoryName}` : ''}
                            {draft.accountName ? ` · ${draft.accountName}` : ''}
                          </span>
                        </span>
                        <span className={cx('shrink-0 text-sm font-semibold tabular', draft.kind === 'income' && 'text-income')}>
                          {format.money(draft.kind === 'income' ? draft.amount : -draft.amount, draft.currency, { sign: draft.kind === 'income' ? 'always' : 'auto' })}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </div>
    </Page>
  );
}
