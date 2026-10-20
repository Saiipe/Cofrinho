import { HardDrive, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { APP_VERSION } from '@/services/platform';
import { useApp } from '../app/AppContext';
import { Page } from '../components/Page';
import { Card } from '../components/primitives';
import { AppLogo } from '../components/AppLogo';

export default function AboutScreen() {
  const { t, locale } = useApp();
  const [storage, setStorage] = useState<{ persisted: boolean; usage: number | null } | null>(null);

  useEffect(() => {
    void (async () => {
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      const estimate = await navigator.storage?.estimate?.();
      setStorage({ persisted, usage: estimate?.usage ?? null });
    })();
  }, []);

  const size = (bytes: number) => new Intl.NumberFormat(locale, { style: 'unit', unit: bytes > 1e6 ? 'megabyte' : 'kilobyte', maximumFractionDigits: 1 }).format(bytes > 1e6 ? bytes / 1e6 : bytes / 1e3);

  const section = (Icon: typeof ShieldCheck, title: string, body: string) => (
    <Card className="flex gap-3 px-4 py-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </Card>
  );

  return (
    <Page title={t('about.title')} back="/me">
      <div className="space-y-3 px-4">
        <Card className="flex flex-col items-center px-6 py-7 text-center">
          <AppLogo className="size-20" />
          <p className="mt-3 text-xl font-bold">{t('app.name')}</p>
          <p className="text-sm text-muted">{t('about.version', { version: APP_VERSION })}</p>
          <p className="mt-2 text-sm text-muted">{t('app.tagline')}</p>
        </Card>
        {section(ShieldCheck, t('about.privacy'), t('about.privacyText'))}
        {storage &&
          section(
            HardDrive,
            t('about.storage'),
            [storage.persisted ? t('about.persisted') : t('about.notPersisted'), storage.usage !== null ? t('about.usage', { used: size(storage.usage) }) : null].filter(Boolean).join(' · '),
          )}
        {section(Sparkles, t('about.credits'), t('about.creditsText'))}
      </div>
    </Page>
  );
}
