import { parseCdiPayload } from '@/domain/investment';
import { updateSettings, type Settings } from './settings';

/** Banco Central SGS series 4389: CDI annualized (252 business days), % a year. */
const CDI_SOURCE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json';

/** Downloads today's CDI and stores it; resolves to the new rate. */
export async function refreshCdi(fetcher: typeof fetch = fetch): Promise<number> {
  const response = await fetcher(CDI_SOURCE, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const cdi = parseCdiPayload(await response.json());
  if (!cdi) throw new Error('Unexpected CDI payload');
  await updateSettings({ cdiRate: cdi.rate, cdiDate: cdi.date, cdiCheckedAt: Date.now(), cdiManual: false });
  return cdi.rate;
}

const DAY_MS = 86_400_000;

/** Checks the CDI in the background at most once a day, unless the user typed it; offline is silent. */
export async function refreshCdiIfStale(settings: Pick<Settings, 'cdiCheckedAt' | 'cdiManual'>): Promise<void> {
  if (settings.cdiManual) return;
  if (settings.cdiCheckedAt && Date.now() - settings.cdiCheckedAt < DAY_MS) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    await refreshCdi();
  } catch {
    // Keep the last known CDI.
  }
}
