import { Play } from 'lucide-react';
import type { MessageKey } from '@/i18n';
import { previewSound, SOUND_GROUPS, type SoundGroup, type SoundVolume } from '@/services/feedback';
import { useApp } from '../app/AppContext';
import { Page } from '../components/Page';
import { Divider, IconButton, Section, Segmented, SwitchRow } from '../components/primitives';

const VOLUMES: SoundVolume[] = ['low', 'medium', 'high'];
const GROUPS = Object.keys(SOUND_GROUPS) as SoundGroup[];

/** Sounds on/off, volume and which kinds of sound play, each with a button to hear it. */
export default function SoundSettingsScreen() {
  const { settings, updateSettings, t } = useApp();

  const setEnabled = (on: boolean) => {
    void updateSettings({ sound: on });
    if (on) previewSound('toggleOn', settings.soundVolume);
  };
  const setVolume = (volume: SoundVolume) => {
    void updateSettings({ soundVolume: volume });
    previewSound('save', volume);
  };

  return (
    <Page title={t('settings.sound')} back="/settings">
      <div className="space-y-5 pt-2 pb-6">
        <Section>
          <SwitchRow title={t('sounds.enabled')} subtitle={t('sounds.enabledHint')} checked={settings.sound} onChange={setEnabled} />
          {settings.sound && (
            <>
              <Divider />
              {/* The new volume plays its own sample instead of the tab click. */}
              <div className="space-y-2 px-4 py-3" data-sound="none">
                <p className="text-[0.95rem] font-medium">{t('sounds.volume')}</p>
                <Segmented
                  label={t('sounds.volume')}
                  value={settings.soundVolume}
                  onChange={setVolume}
                  options={VOLUMES.map((volume) => ({ value: volume, label: <span className="capitalize">{t(`sounds.volume.${volume}`)}</span> }))}
                />
              </div>
            </>
          )}
        </Section>

        {settings.sound && (
          <div>
            <Section title={t('sounds.which')}>
              {GROUPS.map((group, index) => (
                <div key={group}>
                  {index > 0 && <Divider inset />}
                  <SwitchRow
                    leading={<IconButton icon={Play} label={t('sounds.preview')} tone="primary" data-sound="none" onClick={() => previewSound(SOUND_GROUPS[group][0], settings.soundVolume)} />}
                    title={t(`sounds.group.${group}` as MessageKey)}
                    subtitle={t(`sounds.group.${group}.hint` as MessageKey)}
                    checked={settings.sounds[group] !== false}
                    onChange={(on) => void updateSettings({ sounds: { ...settings.sounds, [group]: on } })}
                  />
                </div>
              ))}
            </Section>
            <p className="mt-2 px-5 text-[0.8rem] text-muted">{t('sounds.whichHint')}</p>
          </div>
        )}
      </div>
    </Page>
  );
}
