import { App as NativeApp } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { db } from '@/data/db';
import { refreshRatesIfStale } from '@/data/rates';
import { runDueSchedules } from '@/data/schedules';
import { formatMoney } from '@/domain/money';
import { notifyNow, startWebReminderTimers, syncNativeReminders } from '@/services/notifications';
import { isNative } from '@/services/platform';
import { useFeedback } from '../components/feedback';
import { useApp } from './AppContext';
import { handleBack } from './back';

const TAB_ROOTS = ['/', '/charts', '/reports', '/me'];

/**
 * App-wide background duties: recurring catch-up on open/resume, rate refresh, reminders,
 * Android back button, and system bar styling.
 */
export function Lifecycle() {
  const { settings, t, dark } = useApp();
  const { toast } = useFeedback();
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

  // Android hardware back: close overlays, then go back, then leave tabs, then minimize.
  useEffect(() => {
    if (!isNative) return;
    const listener = NativeApp.addListener('backButton', () => {
      if (handleBack()) return;
      const path = pathRef.current;
      if (path === '/') void NativeApp.minimizeApp();
      else if (TAB_ROOTS.includes(path)) navigate('/', { replace: true });
      else if (window.history.state?.idx > 0) navigate(-1);
      else navigate('/', { replace: true });
    });
    return () => void listener.then((handle) => handle.remove());
  }, [navigate]);

  // Light status-bar icons over the colored home header and in dark mode.
  useEffect(() => {
    if (!isNative) return;
    const overHero = location.pathname === '/' && !dark;
    void SystemBars.setStyle({ style: dark || overHero ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  }, [location.pathname, dark]);

  return null;
}
