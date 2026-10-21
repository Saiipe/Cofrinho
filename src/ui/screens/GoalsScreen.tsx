import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Goal as GoalIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { db } from '@/data/db';
import { todayKey } from '@/domain/dates';
import { goalProgress, goalSaved } from '@/domain/goals';
import type { Goal } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { EntityIcon } from '../components/EntityIcon';
import { Page } from '../components/Page';
import { Badge, Card, cx, EmptyState, IconButton, LinkButton } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

export default function GoalsScreen() {
  const { t } = useApp();
  const { book } = useBook();
  const format = useFormat();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const goals = useLiveQuery(async () => (await db.goals.where('bookId').equals(book.id).toArray()).sort((a, b) => a.order - b.order), [book.id]);
  const active = (goals ?? []).filter((g) => !g.archived);
  const archived = (goals ?? []).filter((g) => g.archived);
  const totalSaved = active.reduce((sum, g) => sum + goalSaved(g), 0);
  const totalTarget = active.reduce((sum, g) => sum + g.target, 0);

  return (
    <Page title={t('goals.title')} back="/me" actions={<IconButton icon={Plus} label={t('goals.new')} onClick={() => navigate('/goals/new')} />}>
      {goals && goals.length === 0 ? (
        <EmptyState icon={GoalIcon} title={t('goals.empty')} hint={t('goals.emptyHint')} action={<LinkButton to="/goals/new">{t('goals.new')}</LinkButton>} />
      ) : (
        <div className="space-y-3 px-4">
          {active.length > 0 && (
            <Card className="px-4 py-4">
              <p className="text-sm text-muted">{t('goals.totalSaved')}</p>
              <p className="text-[1.8rem] leading-tight font-semibold tabular">{format.money(totalSaved)}</p>
              <p className="text-xs text-muted">{t('goals.ofTarget', { amount: format.money(totalTarget) })}</p>
            </Card>
          )}
          {active.map((goal) => (
            <GoalTile key={goal.id} goal={goal} />
          ))}
          {archived.length > 0 && (
            <>
              <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex w-full items-center gap-1 px-1 pt-2 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">
                {t('goals.archived')} ({archived.length})
                <ChevronDown className={cx('size-4 transition-transform', showArchived && 'rotate-180')} aria-hidden />
              </button>
              {showArchived && archived.map((goal) => <GoalTile key={goal.id} goal={goal} />)}
            </>
          )}
        </div>
      )}
    </Page>
  );
}

function GoalTile({ goal }: { goal: Goal }) {
  const { t } = useApp();
  const format = useFormat();
  const progress = goalProgress(goal, todayKey());
  const color = progress.reached ? 'var(--income)' : goal.color;
  return (
    <Link to={`/goals/${goal.id}`} className="block">
      <Card className={cx('px-4 py-3.5 active:bg-surface-2', goal.archived && 'opacity-70')}>
        <div className="flex items-center gap-3">
          <EntityIcon icon={goal.icon} color={goal.color} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold">{goal.name}</p>
              {progress.reached && <Badge tone="success">{t('goals.reached')}</Badge>}
            </div>
            <p className="truncate text-xs text-muted">
              {format.money(progress.saved)} {t('goals.ofTarget', { amount: format.money(goal.target) })}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular">{format.percent(Math.min(progress.ratio, 1), 0)}</span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}>
          <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.min(100, progress.ratio * 100)}%`, backgroundColor: color }} />
        </div>
        {!progress.reached && (progress.perMonth !== null || goal.targetDate) && (
          <p className={cx('mt-1.5 text-xs', progress.late ? 'text-danger' : 'text-muted')}>
            {progress.late
              ? t('goals.late')
              : [goal.targetDate ? format.date(goal.targetDate) : null, progress.daysLeft !== null ? t('goals.daysLeft', { count: progress.daysLeft }) : null].filter(Boolean).join(' · ')}
          </p>
        )}
      </Card>
    </Link>
  );
}
