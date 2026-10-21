import { Rocket } from 'lucide-react';
import { PLANNED, RELEASES } from '@/changelog';
import { APP_VERSION } from '@/services/platform';
import { useApp } from '../app/AppContext';
import { Page } from '../components/Page';
import { Card } from '../components/primitives';
import { ReleaseNotes } from '../components/ReleaseNotes';

export default function WhatsNewScreen() {
  const { t, locale } = useApp();
  return (
    <Page title={t('changelog.title')} back="/about">
      <div className="space-y-4 px-4 pt-1">
        <p className="px-1 text-xs text-muted">{t('changelog.scheme')}</p>
        {RELEASES.map((release) => (
          <Card key={release.version} className="px-4 py-4">
            <ReleaseNotes release={release} current={release.version === APP_VERSION} />
          </Card>
        ))}
        <section className="pb-4">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">
            <Rocket className="size-4" aria-hidden />
            {t('changelog.planned')}
          </h2>
          <Card className="overflow-hidden">
            {PLANNED.map((item, index) => (
              <div key={item.version} className={index > 0 ? 'flex gap-3 border-t border-line px-4 py-3' : 'flex gap-3 px-4 py-3'}>
                <span className="w-9 shrink-0 font-semibold text-muted tabular">{item.version}</span>
                <span className="text-[0.9rem]">{item.text[locale]}</span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </Page>
  );
}
