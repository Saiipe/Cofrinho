import { Check, ChevronRight, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FONT_SCALES, THEMES, type ThemeId } from '@/data/settings';
import { formatMoney, type NumberStyle } from '@/domain/money';
import { LANGUAGES, type MessageKey } from '@/i18n';
import { clearCaches, wipeAllData } from '@/services/maintenance';
import { notificationPermission, requestNotificationPermission, type PermissionState } from '@/services/notifications';
import { getLockConfig } from '@/services/lock';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { Button, cx, Divider, Row, Section, Segmented, SwitchRow } from '../components/primitives';
import { Sheet } from '../components/Sheet';

const NUMBER_STYLES: NumberStyle[] = ['locale', 'comma_dot', 'dot_comma', 'space_comma', 'space_dot', 'apos_dot'];

export default function SettingsScreen() {
  const { settings, updateSettings, t, locale } = useApp();
  const { book } = useBook();
  const { toast } = useFeedback();
  const [sheet, setSheet] = useState<'monthStart' | 'numberStyle' | 'wipe' | null>(null);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [lockEnabled, setLockEnabled] = useState(false);

  useEffect(() => {
    void notificationPermission().then(setPermission);
    void getLockConfig().then((c) => setLockEnabled(c.enabled));
  }, []);

  const set = <K extends keyof typeof settings>(key: K) => (value: (typeof settings)[K]) => void updateSettings({ [key]: value } as Partial<typeof settings>);
  const preview = (style: NumberStyle) => formatMoney(123456789, book.currency, { locale, style, grouping: settings.grouping });

  return (
    <Page title={t('settings.title')} back="/me">
      <div className="space-y-5 pt-2">
        <Section title={t('settings.appearance')}>
          <div className="px-4 py-3">
            <p className="mb-2.5 text-[0.95rem] font-medium">{t('settings.theme')}</p>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t('settings.theme')}>
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === theme.id}
                  aria-label={t(`settings.theme.${theme.id}` as MessageKey)}
                  onClick={() => set('theme')(theme.id as ThemeId)}
                  className="flex flex-col items-center gap-1"
                >
                  <span className={cx('flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-surface', settings.theme === theme.id && 'ring-2 ring-fg')} style={{ backgroundColor: theme.primary }}>
                    {settings.theme === theme.id && <Check className="size-5 text-white" aria-hidden />}
                  </span>
                  <span className="text-[0.7rem] text-muted">{t(`settings.theme.${theme.id}` as MessageKey)}</span>
                </button>
              ))}
            </div>
          </div>
          <Divider />
          <div className="space-y-3 px-4 py-3">
            <SettingLabel>{t('settings.darkMode')}</SettingLabel>
            <Segmented label={t('settings.darkMode')} value={settings.darkMode} onChange={set('darkMode')} options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`settings.dark.${v}`) }))} />
            <SettingLabel>{t('settings.iconStyle')}</SettingLabel>
            <Segmented label={t('settings.iconStyle')} value={settings.iconStyle} onChange={set('iconStyle')} options={(['color', 'mono'] as const).map((v) => ({ value: v, label: t(`settings.iconStyle.${v}`) }))} />
            <SettingLabel>{t('settings.fontSize')}</SettingLabel>
            <Segmented
              label={t('settings.fontSize')}
              value={String(settings.fontScale)}
              onChange={(v) => set('fontScale')(Number(v))}
              options={FONT_SCALES.map((f) => ({ value: String(f.value), label: <span style={{ fontSize: `${f.value * 0.85}rem` }}>Aa</span> }))}
            />
          </div>
        </Section>

        <Section title={t('settings.homeScreen')}>
          <SwitchRow title={t('settings.showBalance')} checked={settings.showBalance} onChange={set('showBalance')} />
          <Divider />
          <div className="space-y-2 px-4 py-3">
            <SettingLabel>{t('settings.balanceMode')}</SettingLabel>
            <Segmented label={t('settings.balanceMode')} value={settings.balanceMode} onChange={set('balanceMode')} options={(['period', 'total'] as const).map((v) => ({ value: v, label: t(`settings.balanceMode.${v}`) }))} />
            <p className="text-xs text-muted">{t('settings.balanceModeHint')}</p>
          </div>
          <Divider />
          <SwitchRow title={t('settings.hideAmounts')} checked={settings.hideAmounts} onChange={set('hideAmounts')} />
          <Divider />
          <SwitchRow title={t('settings.calendarEntry')} checked={settings.calendarEntry} onChange={set('calendarEntry')} />
          <Divider />
          <SwitchRow
            title={t('settings.gardenEntry')}
            checked={settings.gardenEntry}
            onChange={(v) => {
              set('gardenEntry')(v);
              toast(v ? t('garden.entryOn') : t('garden.entryOff'));
            }}
          />
          <Divider />
          <Row title={t('me.widgets')} subtitle={t('shortcuts.title')} to="/shortcuts" />
        </Section>

        <Section title={t('settings.calendar')}>
          <SwitchRow title={t('settings.calendarAmounts')} checked={settings.calendarAmounts} onChange={set('calendarAmounts')} />
          <Divider />
          <div className="space-y-2 px-4 py-3">
            <SettingLabel>{t('settings.weekStart')}</SettingLabel>
            <Segmented
              label={t('settings.weekStart')}
              value={String(settings.weekStart)}
              onChange={(v) => set('weekStart')(Number(v))}
              options={[0, 1, 6].map((d) => ({ value: String(d), label: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2026, 9, 18 + d, 12)) }))}
            />
          </div>
        </Section>

        <Section title={t('settings.numbers')}>
          <Row title={t('settings.monthStart')} subtitle={t('settings.monthStartHint')} trailing={t('settings.monthStartValue', { day: settings.monthStartDay })} onClick={() => setSheet('monthStart')} chevron />
          <Divider />
          <SwitchRow title={t('settings.grouping')} checked={settings.grouping} onChange={set('grouping')} />
          <Divider />
          <Row title={t('settings.numberStyle')} trailing={preview(settings.numberStyle)} onClick={() => setSheet('numberStyle')} chevron />
        </Section>

        <Section title={t('settings.entry')}>
          <div className="space-y-2 px-4 py-3">
            <SettingLabel>{t('settings.calculator')}</SettingLabel>
            <Segmented label={t('settings.calculator')} value={settings.calculator} onChange={set('calculator')} options={(['basic', 'full'] as const).map((v) => ({ value: v, label: t(`settings.calculator.${v}`) }))} />
          </div>
          <Divider />
          <SwitchRow title={t('settings.subcategories')} subtitle={t('settings.subcategoriesHint')} checked={settings.showSubcategories} onChange={set('showSubcategories')} />
          <Divider />
          <SwitchRow title={t('settings.quickEntry')} subtitle={t('settings.quickEntryHint')} checked={settings.quickEntry} onChange={set('quickEntry')} />
          <Divider />
          <Row
            title={t('settings.sound')}
            subtitle={settings.sound ? t('sounds.summary', { volume: t(`sounds.volume.${settings.soundVolume}`) }) : t('common.off')}
            to="/settings/sounds"
          />
          <Divider />
          <SwitchRow title={t('settings.haptics')} checked={settings.haptics} onChange={set('haptics')} />
        </Section>

        <Section title={t('settings.security')}>
          <Link to="/settings/lock" className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-surface-2">
            <Lock className="size-5 text-primary" aria-hidden />
            <span className="flex-1 font-medium">{t('settings.lock')}</span>
            <span className="text-sm text-muted">{lockEnabled ? t('common.on') : t('common.off')}</span>
            <ChevronRight className="size-4 text-faint" aria-hidden />
          </Link>
        </Section>

        <Section title={t('settings.notifications')}>
          <Row
            title={t('settings.notifications')}
            subtitle={permission === 'denied' ? t('reminders.denied') : t('settings.notificationsHint')}
            trailing={
              permission === 'granted' ? (
                t('common.on')
              ) : permission === 'prompt' ? (
                <Button size="sm" variant="secondary" onClick={async () => setPermission(await requestNotificationPermission())}>
                  {t('reminders.allow')}
                </Button>
              ) : (
                t('common.off')
              )
            }
          />
        </Section>

        <Section title={t('settings.language')}>
          <div className="px-4 py-3">
            <Segmented label={t('settings.language')} value={settings.language} onChange={set('language')} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
          </div>
        </Section>

        <Section title={t('settings.data')}>
          <Row
            title={t('settings.clearCache')}
            onClick={async () => {
              await clearCaches();
              toast(t('settings.cacheCleared'), { tone: 'success' });
            }}
          />
          <Divider />
          <Row title={t('settings.deleteAll')} danger onClick={() => setSheet('wipe')} />
        </Section>
      </div>

      <Sheet open={sheet === 'monthStart'} onClose={() => setSheet(null)} title={t('settings.monthStart')}>
        <div className="px-4 pb-5">
          <p className="mb-3 text-sm text-muted">{t('settings.monthStartHint')}</p>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  set('monthStartDay')(day);
                  setSheet(null);
                }}
                className={cx('h-11 rounded-xl text-[0.95rem] font-medium', settings.monthStartDay === day ? 'bg-primary text-primary-fg' : 'bg-surface-2 active:bg-line')}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={sheet === 'numberStyle'} onClose={() => setSheet(null)} title={t('settings.numberStyle')}>
        <div className="pb-4">
          {NUMBER_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => {
                set('numberStyle')(style);
                setSheet(null);
              }}
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium tabular">{preview(style)}</span>
                {style === 'locale' && <span className="block text-xs text-muted">{t('settings.numberStyle.locale')}</span>}
              </span>
              {settings.numberStyle === style && <Check className="size-5 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </Sheet>

      {sheet === 'wipe' && <WipeSheet onClose={() => setSheet(null)} />}
    </Page>
  );
}

function SettingLabel({ children }: { children: string }) {
  return <p className="text-[0.95rem] font-medium">{children}</p>;
}

function WipeSheet({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const [text, setText] = useState('');
  const word = t('settings.deleteAllWord');
  return (
    <Sheet open onClose={onClose} title={t('settings.deleteAllConfirm')}>
      <div className="space-y-4 px-4 pb-5">
        <p className="text-sm text-muted">{t('settings.deleteAllWarning')}</p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t('settings.deleteAllType')}</span>
          <input value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 outline-none focus:border-danger" data-autofocus />
        </label>
        <Button variant="danger" block disabled={text.trim().toUpperCase() !== word} onClick={() => void wipeAllData()}>
          {t('settings.deleteAll')}
        </Button>
      </div>
    </Sheet>
  );
}
