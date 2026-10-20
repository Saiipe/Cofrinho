import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.softwarefinance.cofrinho',
  appName: 'Cofrinho',
  webDir: 'dist',
  android: {
    // IndexedDB lives in the WebView profile; keep it across app updates.
    allowMixedContent: false,
    backgroundColor: '#f6f7f9',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_cofrinho',
      iconColor: '#0f766e',
    },
  },
};

export default config;
