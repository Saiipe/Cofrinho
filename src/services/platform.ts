import { Capacitor } from '@capacitor/core';

/** True inside the Android/iOS app shell; false in the browser/PWA. */
export const isNative = Capacitor.isNativePlatform();

export const platform = Capacitor.getPlatform();

export const APP_VERSION = __APP_VERSION__;
