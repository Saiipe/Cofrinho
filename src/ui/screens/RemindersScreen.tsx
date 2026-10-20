import { useLiveQuery } from 'dexie-react-hooks';
import { BellOff, BellRing, Info, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { deleteReminder, saveReminder, setReminderEnabled } from '@/data/reminders';
import { weekdayOrder } from '@/domain/dates';
import type { Reminder } from '@/domain/types';
import { notificationPermission, requestNotificationPermission, type PermissionState } from '@/services/notifications';
import { isNative } from '@/services/platform';
import { useApp } from '../app/AppContext';
import { InlineNotice, useFeedback } from '../components/feedback';
import { SwipeRow } from '../components/gestures';
import { Page } from '../components/Page';
import { Button, Card, Chip, EmptyState, IconButton, Switch } from '../components/primitives';
import { Sheet } from '../components/Sheet';
import { useFormat } from '../hooks/useFormat';

export default function RemindersScreen() {
  const { settings, t } = useApp();
  const format = useFormat();
  const { confirm } = useFeedback();
  const reminders = useLiveQuery(async () => (await db.reminders.toArray()).sort((a, b) => a.time.localeCompare(b.time)), []);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);

  useEffect(() => {
    void notificationPermission().then(setPermission);
  }, []);

  const days = (reminder: Reminder) =>
    reminder.weekdays.length === 0 || reminder.weekdays.length === 7
      ? t('reminders.everyDay')
      : weekdayOrder(settings.weekStart)
          .filter((d) => reminder.weekdays.includes(d))
          .map((d) => format.weekdayShort(d))
          .join(', ');

  return (
    <Page title={t('reminders.title')} back="/me" actions={<IconButton icon={Plus} label={t('reminders.new')} onClick={() => setEditing('new')} />}>
      <div className="space-y-4 px-4">
        {permission === 'prompt' && (
          <InlineNotice icon={BellRing}>
            <p>{t('reminders.permission')}</p>
            <Button size="sm" className="mt-2" onClick={async () => setPermission(await requestNotificationPermission())}>
              {t('reminders.allow')}
            </Button>
          </InlineNotice>
        )}
        {permission === 'denied' && (
          <InlineNotice icon={BellOff} tone="warning">
            {t('reminders.denied')}
          </InlineNotice>
        )}
        {reminders && reminders.length === 0 ? (
          <EmptyState icon={BellRing} title={t('reminders.empty')} hint={t('reminders.emptyHint')} action={<Button onClick={() => setEditing('new')}>{t('reminders.new')}</Button>} />
        ) : (
          <Card className="overflow-hidden">
            {(reminders ?? []).map((reminder) => (
              <SwipeRow
                key={reminder.id}
                label={t('common.delete')}
                onDelete={async () => {
                  if (await confirm({ title: t('reminders.deleteConfirm'), confirmLabel: t('common.delete'), destructive: true })) await deleteReminder(reminder.id);
                }}
              >
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <button type="button" onClick={() => setEditing(reminder)} className="min-w-0 flex-1 text-left">
                    <span className="block text-2xl font-semibold tabular">{reminder.time}</span>
                    <span className="block truncate text-sm text-muted">
                      {days(reminder)} · {reminder.name}
                    </span>
                  </button>
                  <Switch checked={reminder.enabled} onChange={(v) => void setReminderEnabled(reminder.id, v)} label={reminder.name} />
                </div>
              </SwipeRow>
            ))}
          </Card>
        )}
        {!isNative && <InlineNotice icon={Info}>{t('reminders.webLimit')}</InlineNotice>}
      </div>
      {editing && <ReminderSheet reminder={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function ReminderSheet({ reminder, onClose }: { reminder: Reminder | null; onClose: () => void }) {
  const { settings, t } = useApp();
  const format = useFormat();
  const [time, setTime] = useState(reminder?.time ?? '21:00');
  const [name, setName] = useState(reminder?.name ?? t('reminders.defaultMessage'));
  const [weekdays, setWeekdays] = useState<number[]>(reminder?.weekdays ?? []);
  const toggle = (d: number) => setWeekdays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));
  const save = async () => {
    if ((await notificationPermission()) === 'prompt') await requestNotificationPermission();
    await saveReminder({ id: reminder?.id, name: name.trim() || t('reminders.defaultMessage'), time, weekdays: weekdays.length === 7 ? [] : weekdays, enabled: reminder?.enabled ?? true });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={reminder ? t('reminders.edit') : t('reminders.new')} footer={<Button block onClick={() => void save()}>{t('common.save')}</Button>}>
      <div className="space-y-5 px-4 pb-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t('reminders.time')}</span>
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className="h-14 w-full rounded-xl border border-line bg-surface px-4 text-2xl font-semibold tabular outline-none focus:border-primary" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t('reminders.message')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 outline-none focus:border-primary" />
        </label>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('reminders.days')}</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={weekdays.length === 0} onClick={() => setWeekdays([])}>
              {t('reminders.everyDay')}
            </Chip>
            {weekdayOrder(settings.weekStart).map((d) => (
              <Chip key={d} active={weekdays.includes(d)} onClick={() => toggle(d)}>
                {format.weekdayShort(d)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
