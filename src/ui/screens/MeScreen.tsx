import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownToLine, ArrowUpFromLine, BellRing, BookCopy, CalendarSync, CloudUpload, Coins, Flame, Info, Landmark, ReceiptText, Settings, Shapes, Sprout, Target,
} from 'lucide-react';
import { db } from '@/data/db';
import { todayKey } from '@/domain/dates';
import { recordingStats } from '@/domain/stats';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { Page } from '../components/Page';
import { Card, Divider, Row, Section } from '../components/primitives';
import { AppLogo } from '../components/AppLogo';

function MenuIcon({ icon: Icon }: { icon: typeof Settings }) {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
      <Icon className="size-5" />
    </span>
  );
}

export default function MeScreen() {
  const { t } = useApp();
  const { book, books, isSplit, accounts } = useBook();
  const createdAt = useLiveQuery(async () => (await db.transactions.orderBy('createdAt').keys()) as number[], []);
  const stats = recordingStats(createdAt ?? [], todayKey());

  const organize = [
    { to: '/books', icon: BookCopy, title: t('me.books'), trailing: String(books.length) },
    ...(isSplit ? [] : [{ to: '/accounts', icon: Landmark, title: t('me.accounts'), trailing: accounts.length ? String(accounts.length) : undefined }]),
    { to: '/categories', icon: Shapes, title: t('me.categories') },
    ...(isSplit
      ? []
      : [
          { to: '/budget', icon: Target, title: t('me.budget') },
          { to: '/recurring', icon: CalendarSync, title: t('me.recurring') },
        ]),
    { to: '/reminders', icon: BellRing, title: t('me.reminders') },
    { to: '/currencies', icon: Coins, title: t('me.currencies') },
  ];
  const tools = [
    ...(isSplit ? [] : [{ to: '/import', icon: ArrowDownToLine, title: t('me.import') }]),
    { to: '/export', icon: ArrowUpFromLine, title: t('me.export') },
    { to: '/backup', icon: CloudUpload, title: t('me.backup') },
    { to: '/garden', icon: Sprout, title: t('me.garden') },
  ];
  const app = [
    { to: '/settings', icon: Settings, title: t('me.settings') },
    { to: '/about', icon: Info, title: t('me.about') },
  ];

  const list = (items: { to: string; icon: typeof Settings; title: string; trailing?: string }[]) =>
    items.map((item, index) => (
      <div key={item.to}>
        {index > 0 && <Divider inset />}
        <Row to={item.to} leading={<MenuIcon icon={item.icon} />} title={item.title} trailing={item.trailing} />
      </div>
    ));

  return (
    <Page title={t('me.title')} withTabs>
      <div className="space-y-5 pt-1">
        <div className="px-4">
          <Card className="px-4 py-4">
            <div className="flex items-center gap-3">
              <AppLogo className="size-12" />
              <div className="min-w-0">
                <p className="font-semibold">{t('app.name')}</p>
                <p className="truncate text-sm text-muted">
                  {t('me.currentBook')}: {book.name}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { icon: ReceiptText, label: t('me.records'), value: stats.totalRecords },
                { icon: CalendarSync, label: t('me.activeDays'), value: stats.activeDays },
                { icon: Flame, label: t('me.streak'), value: stats.streak },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl bg-surface-2 px-2 py-2.5">
                  <Icon className="mx-auto mb-1 size-4 text-primary" aria-hidden />
                  <p className="text-lg leading-tight font-semibold">{value}</p>
                  <p className="text-[0.7rem] text-muted">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Section title={t('me.organize')}>{list(organize)}</Section>
        <Section title={t('me.tools')}>{list(tools)}</Section>
        <Section title={t('me.app')}>{list(app)}</Section>
      </div>
    </Page>
  );
}
