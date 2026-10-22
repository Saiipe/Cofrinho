import { useLiveQuery } from 'dexie-react-hooks';
import { Coins, Droplets, Info, Smartphone, Sparkles, Sprout } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MAX_STAGE, pendingLuck, stageProgress, WATER_COST } from '@/domain/garden';
import type { MessageKey } from '@/i18n';
import { haptic, playSound } from '@/services/feedback';
import { getGarden, harvestLuck, water } from '@/services/garden';
import { nativeCapabilities, pinShortcut } from '@/services/native';
import { isNative } from '@/services/platform';
import { useApp } from '../app/AppContext';
import { InlineNotice, useFeedback } from '../components/feedback';
import { GardenScene } from '../components/GardenScene';
import { Page } from '../components/Page';
import { Button, Card, Divider, Row, SwitchRow } from '../components/primitives';

export default function GardenScreen() {
  const { settings, updateSettings, t } = useApp();
  const { toast } = useFeedback();
  const garden = useLiveQuery(getGarden, []);
  const [watering, setWatering] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!garden) return <Page title={t('garden.title')} back>{null}</Page>;

  const { stage, ratio } = stageProgress(garden.growth);
  const pending = pendingLuck(garden, now);
  const stageName = t(`garden.stage.${stage}` as MessageKey);

  const onWater = async () => {
    if (garden.coins < WATER_COST) {
      haptic('warning');
      playSound('error');
      toast(t('garden.notEnough'));
      return;
    }
    const next = await water();
    if (!next) return;
    setWatering(true);
    haptic('success');
    playSound('save');
    window.setTimeout(() => setWatering(false), 1100);
    toast(t('garden.watered'));
  };

  const onHarvest = async () => {
    const amount = await harvestLuck();
    if (amount > 0) {
      playSound('coin');
      haptic('success');
      toast(t('garden.collected', { n: amount }), { tone: 'success' });
      setNow(Date.now());
    }
  };

  return (
    <Page title={t('garden.title')} back>
      <div className="space-y-4 px-4">
        <GardenScene stage={stage} watering={watering} />

        <Card className="px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">{t('garden.stage', { n: stage + 1, total: MAX_STAGE + 1, name: stageName })}</p>
            <span className="text-xs text-muted tabular">{Math.round(ratio * 100)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={t('garden.growth')}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${ratio * 100}%` }} />
          </div>
          {stage === MAX_STAGE && <p className="mt-2 text-sm text-muted">{t('garden.maxed')}</p>}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="flex items-center gap-3 px-4 py-3">
            <Coins className="size-6 text-[#ca8a04]" aria-hidden />
            <div>
              <p className="text-xs text-muted">{t('garden.coins')}</p>
              <p className="text-xl font-semibold">{garden.coins}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 px-4 py-3">
            <Sparkles className="size-6 text-primary" aria-hidden />
            <div>
              <p className="text-xs text-muted">{t('garden.luck')}</p>
              <p className="text-xl font-semibold">{garden.luck}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-2">
          <Button block icon={Droplets} onClick={() => void onWater()} disabled={stage === MAX_STAGE}>
            {t('garden.waterCost', { cost: WATER_COST })}
          </Button>
          {stage > 0 && (
            <Button block variant="secondary" icon={Sprout} onClick={() => void onHarvest()} disabled={pending === 0}>
              {t('garden.collect', { n: pending })}
            </Button>
          )}
        </div>
        {pending === 0 && stage > 0 && <p className="text-center text-xs text-muted">{t('garden.nothingYet')}</p>}

        <InlineNotice icon={Info}>
          <p className="font-medium">{t('garden.howTo')}</p>
          <p className="mt-1">{t('garden.howToText')}</p>
        </InlineNotice>

        <Card className="overflow-hidden">
          <SwitchRow
            title={t('settings.gardenEntry')}
            checked={settings.gardenEntry}
            onChange={(v) => {
              void updateSettings({ gardenEntry: v });
              toast(v ? t('garden.entryOn') : t('garden.entryOff'));
            }}
          />
          {isNative && (
            <>
              <Divider />
              <Row
                leading={<Smartphone className="size-5 text-primary" aria-hidden />}
                title={t('garden.createShortcut')}
                onClick={async () => {
                  const caps = await nativeCapabilities();
                  const requested = caps.pinShortcuts && (await pinShortcut('garden', t('shortcuts.garden'), '/garden', 'garden'));
                  toast(requested ? t('shortcuts.requested') : t('shortcuts.unsupported'), { duration: requested ? 3500 : 6000 });
                }}
              />
            </>
          )}
        </Card>
      </div>
    </Page>
  );
}
