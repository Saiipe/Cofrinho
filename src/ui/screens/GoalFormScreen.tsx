import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '@/data/db';
import { deleteGoal, saveGoal } from '@/data/goals';
import { dayKey, todayKey, withDay } from '@/domain/dates';
import { CATEGORY_COLORS } from '@/domain/defaults';
import { GOAL_NAME_MAX } from '@/domain/goals';
import type { DayKey, Goal } from '@/domain/types';
import type { MessageKey } from '@/i18n';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AmountSheet } from '../components/AmountSheet';
import { EntityIcon } from '../components/EntityIcon';
import { useFeedback } from '../components/feedback';
import { Page, useGoBack } from '../components/Page';
import { ColorSwatches, DatePickerSheet, IconPickerSheet } from '../components/pickers';
import { Button, Card, Chip, Divider, Row, TextField } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

export default function GoalFormScreen() {
  const { id } = useParams();
  const existing = useLiveQuery(async () => (id ? ((await db.goals.get(id)) ?? null) : null), [id]);
  if (id && existing === undefined) return <div className="min-h-dvh bg-bg" />;
  return <GoalForm key={id ?? 'new'} existing={existing ?? null} />;
}

const QUICK_ICONS = ['piggy-bank', 'plane', 'shield', 'house', 'car', 'graduation-cap', 'gift', 'laptop', 'heart', 'baby'];

function GoalForm({ existing }: { existing: Goal | null }) {
  const { t } = useApp();
  const { book } = useBook();
  const format = useFormat();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const goBack = useGoBack('/goals');
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'piggy-bank');
  const [color, setColor] = useState(existing?.color ?? '#16a34a');
  const [target, setTarget] = useState(existing?.target ?? 0);
  const [targetDate, setTargetDate] = useState<DayKey | null>(existing?.targetDate ?? null);
  const [initial, setInitial] = useState(0);
  const [error, setError] = useState<MessageKey | null>(null);
  const [sheet, setSheet] = useState<'icon' | 'target' | 'date' | 'initial' | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('goals.nameRequired');
    if (target <= 0) {
      toast(t('goals.targetRequired'), { tone: 'error' });
      return setSheet('target');
    }
    const id = await saveGoal({ id: existing?.id, bookId: book.id, name, icon, color, target, targetDate }, existing ? 0 : initial);
    toast(t('common.saved'), { tone: 'success' });
    if (existing) goBack();
    else navigate(`/goals/${id}`, { replace: true });
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: t('goals.deleteConfirm', { name: existing.name }), message: t('goals.deleteHint'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteGoal(existing.id);
      navigate('/goals', { replace: true });
    }
  };

  return (
    <Page title={existing ? t('goals.edit') : t('goals.new')} back="/goals" footer={<Button block onClick={() => void save()}>{t('common.save')}</Button>}>
      <div className="space-y-5 px-4 pt-2">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setSheet('icon')} aria-label={t('goals.icon')}>
            <EntityIcon icon={icon} color={color} size="xl" mono={false} />
          </button>
          <TextField
            className="flex-1"
            label={t('goals.name')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={t('goals.namePlaceholder')}
            maxLength={GOAL_NAME_MAX}
            error={error ? t(error) : null}
            autoFocus={!existing}
          />
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto" data-no-tip>
          {QUICK_ICONS.map((option) => (
            <button key={option} type="button" onClick={() => setIcon(option)} aria-pressed={icon === option} className="shrink-0 rounded-full p-0.5 ring-2 ring-transparent aria-pressed:ring-primary">
              <EntityIcon icon={option} color={color} size="sm" mono={false} />
            </button>
          ))}
        </div>

        <Card className="overflow-hidden">
          <Row title={t('goals.target')} trailing={<span className="font-semibold text-fg tabular">{target > 0 ? format.money(target) : '—'}</span>} onClick={() => setSheet('target')} chevron />
          {!existing && (
            <>
              <Divider />
              <Row title={t('goals.initial')} trailing={<span className="tabular">{format.money(initial)}</span>} onClick={() => setSheet('initial')} chevron />
            </>
          )}
        </Card>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('goals.targetDate')}</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!targetDate} onClick={() => setTargetDate(null)}>
              {t('goals.noDate')}
            </Chip>
            <Chip active={Boolean(targetDate)} onClick={() => setSheet('date')}>
              <CalendarDays className="size-4" aria-hidden />
              {targetDate ? format.date(targetDate) : t('common.select')}
            </Chip>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('categories.color')}</p>
          <ColorSwatches colors={CATEGORY_COLORS} value={color} onChange={setColor} label={t('categories.color')} />
        </div>

        {existing && (
          <Button variant="ghost" block className="text-danger" onClick={() => void remove()}>
            {t('common.delete')}
          </Button>
        )}
      </div>

      <IconPickerSheet open={sheet === 'icon'} onClose={() => setSheet(null)} value={icon} color={color} onSelect={setIcon} />
      <AmountSheet open={sheet === 'target'} onClose={() => setSheet(null)} title={t('goals.target')} currency={book.currency} initial={target || null} onSave={setTarget} />
      <AmountSheet open={sheet === 'initial'} onClose={() => setSheet(null)} title={t('goals.initial')} currency={book.currency} initial={initial || null} onSave={setInitial} />
      {sheet === 'date' && (
        <DatePickerSheet
          open
          onClose={() => setSheet(null)}
          value={withDay(targetDate ?? todayKey(), Date.now())}
          onChange={(ms) => setTargetDate(dayKey(ms))}
          withTime={false}
          title={t('goals.targetDate')}
        />
      )}
    </Page>
  );
}
