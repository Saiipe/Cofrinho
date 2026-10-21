import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

/**
 * Bridge to the app's own Android plugin (android/app/src/main/java/.../CofrinhoPlugin.java):
 * pinned home-screen shortcuts, home-screen widgets and the data they display.
 */

export type ShortcutIcon = 'expense' | 'income' | 'search' | 'garden' | 'goals' | 'cards';
export type WidgetKind = 'quick' | 'summary';

export interface WidgetData {
  month: string;
  spentLabel: string;
  spent: string;
  incomeLabel: string;
  income: string;
  balanceLabel: string;
  balance: string;
  expenseButton: string;
  incomeButton: string;
}

interface CofrinhoPlugin {
  capabilities(): Promise<{ pinShortcuts: boolean; pinWidgets: boolean }>;
  pinShortcut(options: { id: string; label: string; url: string; icon: ShortcutIcon }): Promise<{ requested: boolean }>;
  requestPinWidget(options: { kind: WidgetKind }): Promise<{ requested: boolean }>;
  updateWidgets(options: WidgetData): Promise<void>;
}

const Cofrinho = registerPlugin<CofrinhoPlugin>('Cofrinho');

/** Links opened from shortcuts and widgets: `cofrinho://tx/new?kind=expense`. */
export const DEEP_LINK_SCHEME = 'cofrinho';

/** In-app path for a deep link, or null when the URL is not ours. */
export function deepLinkPath(url: string): string | null {
  const prefix = `${DEEP_LINK_SCHEME}://`;
  if (!url.toLowerCase().startsWith(prefix)) return null;
  const path = `/${url.slice(prefix.length).replace(/^\/+/, '')}`;
  return /^\/[\w\-/]*(\?[\w\-=&%.]*)?$/.test(path) ? path : null;
}

export async function nativeCapabilities(): Promise<{ pinShortcuts: boolean; pinWidgets: boolean }> {
  if (!isNative) return { pinShortcuts: false, pinWidgets: false };
  try {
    return await Cofrinho.capabilities();
  } catch {
    return { pinShortcuts: false, pinWidgets: false };
  }
}

export async function pinShortcut(id: string, label: string, path: string, icon: ShortcutIcon): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await Cofrinho.pinShortcut({ id, label, url: `${DEEP_LINK_SCHEME}://${path.replace(/^\//, '')}`, icon })).requested;
  } catch {
    return false;
  }
}

export async function requestPinWidget(kind: WidgetKind): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await Cofrinho.requestPinWidget({ kind })).requested;
  } catch {
    return false;
  }
}

export async function updateWidgets(data: WidgetData): Promise<void> {
  if (!isNative) return;
  try {
    await Cofrinho.updateWidgets(data);
  } catch {
    // Older native shells without the plugin simply have no widgets to refresh.
  }
}
