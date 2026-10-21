import { App as NativeApp } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { db } from '@/data/db';
import { refreshRatesIfStale } from '@/data/rates';
import { runDueSchedules } from '@/data/schedules';
import { transactionsInPeriod } from '@/data/transactions';
import { monthPeriodOf, todayKey } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { totals } from '@/domain/stats';
import { getLockConfig } from '@/services/lock';
import { deepLinkPath, updateWidgets } from '@/services/native';
import { notifyNow, startWebReminderTimers, syncNativeReminders } from '@/services/notifications';
import { isNative } from '@/services/platform';
import { useFeedback } from '../components/feedback';
import { useFormat } from '../hooks/useFormat';
import { useApp } from './AppContext';
import { useBook } from './BookContext';
import { handleBack } from './back';

const TAB_ROOTS = ['/', '/charts', '/reports', '/me'];

/** The URL that cold-started the app (widget, shortcut) is handled once per process. */
let launchUrlHandled = false;

/**
 * App-wide background duties: recurring catch-up on open/resume, rate refresh, reminders,
 * Android back button, and system bar styling.
 */
export function Lifecycle() {
  const { settings, t, dark } = useApp();
  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const reminders = useLiveQuery(() => db.reminders.toArray(), []);
  const moneyFormat = { locale: settings.language, style: settings.numberStyle, grouping: settings.grouping };
  const formatRef = useRef(moneyFormat);
  formatRef.current = moneyFormat;

  // Recurring transactions: run now and whenever the app returns to the foreground.
  useEffect(() => {
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        const runs = await runDueSchedules();
        const count = runs.reduce((sum, r) => sum + r.created.length, 0);
        if (count) {
          toast(t('home.recurringRan', { count }), { tone: 'success' });
          for (const { schedule, created } of runs) {
            const amount = formatMoney(schedule.amount, schedule.currency, formatRef.current);
            await notifyNow(t('recurring.notificationTitle'), t('recurring.ran', { name: schedule.name, amount: created.length > 1 ? `${created.length}× ${amount}` : amount }));
          }
        }
      } finally {
        running = false;
      }
    };
    void run();
    const onVisible = () => document.visibilityState === 'visible' && void run();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [toast, t]);

  useEffect(() => {
    void refreshRatesIfStale(settings.ratesUpdatedAt);
    // Ask the browser not to evict our IndexedDB under storage pressure.
    void navigator.storage?.persist?.();
  }, [settings.ratesUpdatedAt]);

  // Reminders: OS-scheduled on Android, in-page timers on the web.
  useEffect(() => {
    if (!reminders) return;
    if (isNative) {
      void syncNativeReminders(reminders, t('reminders.notificationTitle'));
      return;
    }
    return startWebReminderTimers(reminders, (reminder) => {
      if (document.visibilityState === 'visible') toast(reminder.name);
      else void notifyNow(t('reminders.notificationTitle'), reminder.name);
    });
  }, [reminders, t, toast]);

  // Android hardware back: close overlays, then go back, then leave tabs, then ask before leaving the app.
  useEffect(() => {
    if (!isNative) return;
    let asking = false;
    const listener = NativeApp.addListener('backButton', () => {
      if (handleBack()) return;
      const path = pathRef.current;
      if (path === '/') {
        if (asking) return;
        asking = true;
        void confirm({ title: t('app.exitTitle'), message: t('app.exitHint'), confirmLabel: t('app.exit') }).then((leave) => {
          asking = false;
          if (leave) void NativeApp.exitApp();
        });
      } else if (TAB_ROOTS.includes(path)) navigate('/', { replace: true });
      else if (window.history.state?.idx > 0) navigate(-1);
      else navigate('/', { replace: true });
    });
    return () => void listener.then((handle) => handle.remove());
  }, [navigate, confirm, t]);

  // Home-screen shortcuts and widgets open `cofrinho://…` links.
  useEffect(() => {
    if (!isNative) return;
    const open = (url: string | undefined) => {
      const path = url ? deepLinkPath(url) : null;
      if (path) navigate(path);
    };
    if (!launchUrlHandled) {
      launchUrlHandled = true;
      void NativeApp.getLaunchUrl().then((launch) => open(launch?.url));
    }
    const listener = NativeApp.addListener('appUrlOpen', ({ url }) => open(url));
    return () => void listener.then((handle) => handle.remove());
  }, [navigate]);

  // Light status-bar icons over the colored home header and in dark mode.
  useEffect(() => {
    if (!isNative) return;
    const overHero = location.pathname === '/' && !dark;
    void SystemBars.setStyle({ style: dark || overHero ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  }, [location.pathname, dark]);

  useWidgetSync();

  return null;
}

/** Keeps the home-screen widgets showing the current month of the current book. */
function useWidgetSync() {
  const { settings, t } = useApp();
  const { book } = useBook();
  const format = useFormat();
  const today = todayKey();
  const period = useMemo(() => monthPeriodOf(today, settings.monthStartDay), [today, settings.monthStartDay]);
  const transactions = useLiveQuery(async () => (isNative ? transactionsInPeriod(book.id, period) : null), [book.id, period.start, period.end]);
  const lock = useLiveQuery(async () => (isNative ? getLockConfig() : null), []);

  useEffect(() => {
    if (!transactions || !lock) return;
    const sums = totals(transactions);
    // Amounts on the home screen are visible to anyone holding the phone.
    const hidden = settings.hideAmounts || lock.enabled;
    const money = (value: number, sign?: 'always') => (hidden ? '••••' : format.money(value, undefined, sign ? { sign } : undefined));
    const timer = window.setTimeout(() => {
      void updateWidgets({
        month: format.periodLabel(period),
        spentLabel: t('widgets.spent'),
        spent: money(sums.expense),
        incomeLabel: t('widgets.received'),
        income: money(sums.income),
        balanceLabel: t('widgets.balance'),
        balance: money(sums.balance, 'always'),
        expenseButton: t('kind.expense'),
        incomeButton: t('kind.income'),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [transactions, lock, settings.hideAmounts, format, period, t]);
}
