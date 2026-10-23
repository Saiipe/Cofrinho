import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRightLeft, CalendarSync, Info, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { db } from '@/data/db';
import { deleteSchedule } from '@/data/schedules';
import { nextOccurrence } from '@/domain/schedule';
import type { Schedule } from '@/domain/types';
import { frequencyLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { CategoryIcon } from '../components/EntityIcon';
import { InlineNotice, useFeedback } from '../components/feedback';
import { SwipeRow } from '../components/gestures';
import { Page } from '../components/Page';
import { Badge, Card, EmptyState, IconButton, LinkButton } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

export default function RecurringScreen() {
  const { t } = useApp();
  const { book, categoryMap, categoryName } = useBook();
  const format = useFormat();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const schedules = useLiveQuery(async () => (await db.schedules.where('bookId').equals(book.id).toArray()).sort((a, b) => a.name.localeCompare(b.name)), [book.id]);

  const remove = async (schedule: Schedule) => {
    if (await confirm({ title: t('recurring.deleteConfirm', { name: schedule.name }), message: t('recurring.deleteHint'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteSchedule(schedule.id);
      toast(t('common.deleted'));
    }
  };

  return (
    <Page title={t('recurring.title')} back="/me" actions={<IconButton icon={Plus} label={t('recurring.new')} onClick={() => navigate('/recurring/new')} />}>
      <div className="space-y-4 px-4">
        {schedules && schedules.length === 0 ? (
          <EmptyState
            icon={CalendarSync}
            title={t('recurring.empty')}
            hint={t('recurring.emptyHint')}
            action={<LinkButton to="/recurring/new">{t('recurring.new')}</LinkButton>}
          />
        ) : (
          <Card className="overflow-hidden">
            {(schedules ?? []).map((schedule) => {
              const next = schedule.status === 'active' ? nextOccurrence(schedule) : null;
              const category = schedule.categoryId ? categoryMap.get(schedule.categoryId) : undefined;
              return (
                <SwipeRow key={schedule.id} label={t('common.delete')} onDelete={() => void remove(schedule)}>
                  <Link to={`/recurring/${schedule.id}/edit`} className="flex items-center gap-3 border-b border-line px-4 py-3 active:bg-surface-2">
                    {schedule.kind === 'transfer' ? (
                      <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
                        <ArrowRightLeft className="size-5" />
                      </span>
                    ) : (
                      <CategoryIcon category={category} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{schedule.name}</span>
                        {schedule.status === 'completed' && <Badge tone="success">{t('recurring.completed')}</Badge>}
                        {schedule.status === 'paused' && <Badge tone="warning">{t('recurring.paused')}</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[frequencyLabel(schedule.frequency, t), next ? t('recurring.next', { date: format.date(next) }) : null, schedule.kind !== 'transfer' && category ? categoryName(category) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular">{format.money(schedule.amount, schedule.currency)}</span>
                      <span className="block text-xs text-muted">
                        {schedule.endDate
                          ? t('recurring.until', { date: format.date(schedule.endDate) })
                          : schedule.totalCount > 0
                            ? t('recurring.progress', { done: schedule.runCount, total: schedule.totalCount })
                            : t('recurring.runs', { count: schedule.runCount })}
                      </span>
                    </span>
                  </Link>
                </SwipeRow>
              );
            })}
          </Card>
        )}
        <InlineNotice icon={Info}>{t('recurring.hint')}</InlineNotice>
      </div>
    </Page>
  );
}
