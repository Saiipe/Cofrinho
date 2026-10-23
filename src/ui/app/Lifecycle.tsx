import { App as NativeApp } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ensureBookDefaults, repairDefaultNames } from '@/data/books';
import { refreshCdiIfStale } from '@/data/cdi';
import { db } from '@/data/db';
import { refreshRatesIfStale } from '@/data/rates';
import { forecastTransactions, runDueSchedules } from '@/data/schedules';
import { bookTransactions, transactionsInPeriod } from '@/data/transactions';
import { accountBalances } from '@/domain/balances';
import { monthPeriodOf, todayKey } from '@/domain/dates';
import { convertMinor, formatMoney } from '@/domain/money';
import { getLockConfig } from '@/services/lock';
import { deepLinkPath, updateWidgets } from '@/services/native';
import { notifyNow, startWebReminderTimers, syncNativeReminders } from '@/services/notifications';
import { isNative } from '@/services/platform';
import { useFeedback } from '../components/feedback';
import { useFormat } from '../hooks/useFormat';
import { useApp } from './AppContext';
import { useBook } from './BookContext';
import { handleBack } from './back';
import { widgetCategories, widgetExtras, widgetPayload } from './widgets';

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
    void ensureBookDefaults(settings.language).then(() => repairDefaultNames(settings.language));
    void refreshRatesIfStale(settings.ratesUpdatedAt);
    void refreshCdiIfStale(settings);
    // Ask the browser not to evict our IndexedDB under storage pressure.
    void navigator.storage?.persist?.();
  }, [settings.ratesUpdatedAt, settings.cdiCheckedAt, settings.cdiManual]);

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
      // The mini screen already starts on its link; do not stack it twice.
      if (path && path !== window.location.pathname + window.location.search) navigate(path);
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
  const { book, categoryMap, topCategories, categoryName, accounts, rate } = useBook();
  const format = useFormat();
  const today = todayKey();
  const period = useMemo(() => monthPeriodOf(today, settings.monthStartDay), [today, settings.monthStartDay]);
  const transactions = useLiveQuery(async () => (isNative ? transactionsInPeriod(book.id, period) : null), [book.id, period.start, period.end]);
  const lock = useLiveQuery(async () => (isNative ? getLockConfig() : null), []);
  // Budget, goals, upcoming and wealth widgets.
  const extras = useLiveQuery(async () => {
    if (!isNative) return null;
    const [budgets, goals, forecast, all] = await Promise.all([
      db.budgets.where('bookId').equals(book.id).toArray(),
      db.goals.where('bookId').equals(book.id).toArray(),
      forecastTransactions(book.id, today),
      bookTransactions(book.id),
    ]);
    return { budget: budgets.find((b) => b.categoryId === null)?.amount ?? 0, goals, forecast, all };
  }, [book.id, today]);

  useEffect(() => {
    if (!transactions || !lock || !extras) return;
    const hidden = settings.hideAmounts || lock.enabled;
    const shortcuts = widgetCategories(transactions, categoryMap, topCategories('expense')).map((c) => ({ id: c.id, name: categoryName(c) }));
    const toBook = (amount: number, currency: string) => {
      if (currency === book.currency) return amount;
      const r = rate(currency, book.currency);
      return r === null ? null : convertMinor(amount, currency, book.currency, r);
    };
    const data = {
      ...widgetPayload({ transactions, period, hidden, shortcuts }, format, t),
      ...widgetExtras(
        { today, period, transactions, budget: extras.budget, goals: extras.goals, forecast: extras.forecast, accounts, balances: accountBalances(accounts, extras.all), toBook, cdi: settings.cdiRate, hidden },
        format,
        t,
      ),
    };
    const timer = window.setTimeout(() => void updateWidgets(data), 500);
    return () => window.clearTimeout(timer);
  }, [transactions, lock, extras, settings.hideAmounts, settings.cdiRate, format, period, today, t, categoryMap, topCategories, categoryName, accounts, rate, book.currency]);
}
