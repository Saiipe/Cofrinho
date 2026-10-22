import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, CalendarClock, Goal as GoalIcon, Minus, Pencil, PartyPopper, Plus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '@/data/db';
import { addGoalEntry, removeGoalEntry, setGoalArchived } from '@/data/goals';
import { todayKey } from '@/domain/dates';
import { goalProgress, goalSaved } from '@/domain/goals';
import { haptic, playSound } from '@/services/feedback';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { AmountSheet } from '../components/AmountSheet';
import { ProgressRing } from '../components/charts';
import { EntityIcon } from '../components/EntityIcon';
import { InlineNotice, useFeedback } from '../components/feedback';
import { SwipeRow } from '../components/gestures';
import { Page } from '../components/Page';
import { Button, Card, cx, EmptyState, IconButton } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

export default function GoalDetailScreen() {
  const { id = '' } = useParams();
  const { t } = useApp();
  const { book } = useBook();
  const format = useFormat();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const goal = useLiveQuery(async () => (await db.goals.get(id)) ?? null, [id]);
  const [sheet, setSheet] = useState<'deposit' | 'withdraw' | null>(null);

  if (goal === undefined) return <Page title={t('goals.title')} back="/goals">{null}</Page>;
  if (goal === null) {
    return (
      <Page title={t('goals.title')} back="/goals">
        <EmptyState icon={GoalIcon} title={t('common.notFound')} />
      </Page>
    );
  }

  const progress = goalProgress(goal, todayKey());
  const ringColor = progress.reached ? 'var(--income)' : goal.color;

  const move = async (amount: number) => {
    if (amount < 0 && -amount > progress.saved) {
      haptic('warning');
      toast(t('goals.tooMuch', { amount: format.money(progress.saved) }), { tone: 'error' });
      return;
    }
    const wasReached = progress.reached;
    await addGoalEntry(goal.id, amount);
    const nowSaved = goalSaved({ entries: [...goal.entries, { id: '', date: Date.now(), amount, note: '' }] });
    if (!wasReached && nowSaved >= goal.target) {
      playSound('celebrate');
      haptic('success');
      toast(t('goals.reachedToast', { name: goal.name }), { tone: 'success', duration: 5000 });
    } else {
      if (amount > 0) playSound('coin');
      haptic('success');
      toast(amount > 0 ? t('goals.depositDone', { amount: format.money(amount) }) : t('goals.withdrawDone', { amount: format.money(-amount) }), { tone: 'success' });
    }
  };

  const entries = [...goal.entries].sort((a, b) => b.date - a.date);

  return (
    <Page
      title={goal.name}
      back="/goals"
      actions={
        <>
          <IconButton
            icon={goal.archived ? ArchiveRestore : Archive}
            label={goal.archived ? t('goals.unarchive') : t('goals.archive')}
            onClick={async () => {
              await setGoalArchived(goal.id, !goal.archived);
              toast(t('common.saved'));
            }}
          />
          <IconButton icon={Pencil} label={t('common.edit')} onClick={() => navigate(`/goals/${goal.id}/edit`)} />
        </>
      }
    >
      <div className="space-y-4 px-4 pt-1">
        <Card className="flex flex-col items-center px-6 py-6 text-center">
          <ProgressRing ratio={progress.ratio} color={ringColor} size={148} label={goal.name}>
            <EntityIcon icon={goal.icon} color={goal.color} size="sm" mono={false} />
            <span className="mt-1 text-2xl font-bold tabular">{format.percent(Math.min(progress.ratio, 1), 0)}</span>
          </ProgressRing>
          <p className="mt-4 text-[1.9rem] leading-tight font-semibold tabular">{format.money(progress.saved)}</p>
          <p className="text-sm text-muted">{t('goals.ofTarget', { amount: format.money(goal.target) })}</p>
          {!progress.reached && (
            <p className="mt-1 text-sm">
              {t('goals.remaining')}: <span className="font-semibold tabular">{format.money(progress.remaining)}</span>
            </p>
          )}
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <Button variant="secondary" icon={Minus} onClick={() => setSheet('withdraw')} disabled={progress.saved <= 0}>
              {t('goals.withdraw')}
            </Button>
            <Button icon={Plus} onClick={() => setSheet('deposit')}>
              {t('goals.deposit')}
            </Button>
          </div>
        </Card>

        {progress.reached ? (
          <InlineNotice icon={PartyPopper}>
            <p className="font-medium">{t('goals.reached')}</p>
          </InlineNotice>
        ) : progress.late ? (
          <InlineNotice icon={CalendarClock} tone="warning">
            {t('goals.late')}
          </InlineNotice>
        ) : (
          (progress.perMonth !== null || progress.projected) && (
            <InlineNotice icon={TrendingUp}>
              {progress.perMonth !== null && goal.targetDate && <p>{t('goals.perMonth', { amount: format.money(progress.perMonth), date: format.date(goal.targetDate) })}</p>}
              {progress.projected && <p className={cx(progress.perMonth !== null && 'mt-1')}>{t('goals.projected', { date: format.date(progress.projected) })}</p>}
            </InlineNotice>
          )
        )}

        <section>
          <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('goals.history')}</h2>
          {entries.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted">{t('goals.noHistory')}</p>
          ) : (
            <Card className="overflow-hidden">
              {entries.map((entry) => (
                <SwipeRow
                  key={entry.id}
                  label={t('common.delete')}
                  onDelete={() => {
                    playSound('delete');
                    void removeGoalEntry(goal.id, entry.id);
                  }}
                >
                  <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                    <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-full', entry.amount >= 0 ? 'bg-income/14 text-income' : 'bg-surface-2 text-muted')} aria-hidden>
                      {entry.amount >= 0 ? <Plus className="size-4" /> : <Minus className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.95rem] font-medium">{entry.amount >= 0 ? t('goals.deposit') : t('goals.withdraw')}</span>
                      <span className="block truncate text-xs text-muted">{[format.dateTime(entry.date), entry.note].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={cx('shrink-0 font-semibold tabular', entry.amount >= 0 && 'text-income')}>{format.money(entry.amount, undefined, { sign: 'always' })}</span>
                  </div>
                </SwipeRow>
              ))}
            </Card>
          )}
        </section>
      </div>

      <AmountSheet open={sheet === 'deposit'} onClose={() => setSheet(null)} title={t('goals.depositTitle')} currency={book.currency} initial={null} onSave={(v) => void move(v)} />
      <AmountSheet open={sheet === 'withdraw'} onClose={() => setSheet(null)} title={t('goals.withdrawTitle')} currency={book.currency} initial={null} onSave={(v) => void move(-v)} />
    </Page>
  );
}
