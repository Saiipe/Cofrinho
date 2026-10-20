import { isNative } from './services/platform';

/** Offline support for the web build only; the Android app ships its assets inside the APK. */
export function registerServiceWorker() {
  if (isNative || import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
