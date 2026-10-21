import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { releasesSince, type ChangeKind, type Release } from '@/changelog';
import type { MessageKey } from '@/i18n';
import { APP_VERSION } from '@/services/platform';
import { useApp } from '../app/AppContext';
import { QUICK_MODE } from '../quickMode';
import { Sheet } from './Sheet';
import { Badge, Button, cx } from './primitives';

const KIND_TONE: Record<ChangeKind, 'primary' | 'default' | 'warning'> = { feature: 'primary', improvement: 'default', fix: 'warning' };

/** One release: "5.0 · Widgets" and its changes, each tagged New / Improvement / Fix. */
export function ReleaseNotes({ release, current, className }: { release: Release; current?: boolean; className?: string }) {
  const { t, locale } = useApp();
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {release.version.replace(/\.0$/, '')} · {release.title[locale]}
        </h3>
        {current && <Badge tone="primary">{t('changelog.current')}</Badge>}
      </div>
      <ul className="mt-2.5 space-y-2">
        {release.changes.map((change, index) => (
          <li key={index} className="flex items-start gap-2 text-[0.9rem]">
            <span className="mt-0.5 shrink-0">
              <Badge tone={KIND_TONE[change.kind]}>{t(`changelog.kind.${change.kind}` as MessageKey)}</Badge>
            </span>
            <span className="min-w-0 flex-1">{change.text[locale]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** After an update, shows once what changed since the version the user last ran. */
export function UpdateNotes() {
  const { settings, updateSettings, t } = useApp();
  const navigate = useNavigate();
  const pending = !QUICK_MODE && settings.onboarded && settings.lastSeenVersion !== APP_VERSION;
  const releases = pending ? releasesSince(settings.lastSeenVersion, APP_VERSION) : [];
  const done = () => void updateSettings({ lastSeenVersion: APP_VERSION });
  const nothingNew = pending && releases.length === 0;
  // A downgrade or a version without notes is simply recorded.
  useEffect(() => {
    if (nothingNew) void updateSettings({ lastSeenVersion: APP_VERSION });
  }, [nothingNew, updateSettings]);
  if (!pending || nothingNew) return null;
  return (
    <Sheet
      open
      onClose={done}
      title={t('changelog.updated', { version: APP_VERSION.replace(/\.0$/, '') })}
      tall={releases.length > 2}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              done();
              navigate('/whats-new');
            }}
          >
            {t('changelog.see')}
          </Button>
          <Button onClick={done}>{t('changelog.gotIt')}</Button>
        </div>
      }
    >
      <div className="px-5 pb-4">
        {settings.lastSeenVersion && <p className="mb-3 text-sm text-muted">{t('changelog.since', { version: settings.lastSeenVersion.replace(/\.0$/, '') })}</p>}
        {releases.map((release, index) => (
          <ReleaseNotes key={release.version} release={release} className={cx(index > 0 && 'mt-4 border-t border-line pt-4')} />
        ))}
      </div>
    </Sheet>
  );
}
