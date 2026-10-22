import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { biometricAvailable, disableLock, enableBiometric, enableLock, getLockConfig, LOCK_TIMEOUTS, updateLock, verifyPin, type LockConfig } from '@/services/lock';
import type { MessageKey } from '@/i18n';
import { haptic, playSound } from '@/services/feedback';
import { useApp } from '../app/AppContext';
import { useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { PIN_MAX, PIN_MIN, PinPad } from '../components/PinPad';
import { Button, Card, Divider, Row, Segmented, SwitchRow } from '../components/primitives';
import { Sheet } from '../components/Sheet';

type Flow = { kind: 'create' } | { kind: 'verify'; then: 'disable' | 'change' };

export default function LockSettingsScreen() {
  const { t } = useApp();
  const { toast } = useFeedback();
  const [config, setConfig] = useState<LockConfig | null>(null);
  const [canBiometric, setCanBiometric] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);

  const reload = () => void getLockConfig().then(setConfig);
  useEffect(() => {
    reload();
    void biometricAvailable().then(setCanBiometric);
  }, []);

  if (!config) return <Page title={t('settings.lock')} back="/settings">{null}</Page>;

  return (
    <Page title={t('settings.lock')} back="/settings">
      <div className="space-y-4 px-4">
        <Card className="flex flex-col items-center px-6 py-6 text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" aria-hidden />
          </span>
          <p className="font-semibold">{config.enabled ? t('lock.enabled') : t('lock.disabled')}</p>
          <p className="mt-1 text-sm text-muted">{t('lock.forgot')}</p>
          {!config.enabled && (
            <Button className="mt-4" onClick={() => setFlow({ kind: 'create' })}>
              {t('lock.enable')}
            </Button>
          )}
        </Card>

        {config.enabled && (
          <>
            <Card className="overflow-hidden">
              <Row title={t('lock.changePin')} onClick={() => setFlow({ kind: 'verify', then: 'change' })} chevron />
              <Divider />
              {canBiometric ? (
                <SwitchRow
                  title={t('lock.biometric')}
                  checked={config.biometric}
                  onChange={async (on) => {
                    if (on) {
                      if (!(await enableBiometric(t('app.name'), t('lock.title')))) toast(t('lock.biometricUnavailable'), { tone: 'error' });
                    } else {
                      await updateLock({ biometric: false, credentialId: null });
                    }
                    reload();
                  }}
                />
              ) : (
                <Row title={t('lock.biometric')} subtitle={t('lock.biometricUnavailable')} />
              )}
              <Divider />
              <div className="space-y-2 px-4 py-3">
                <p className="text-[0.95rem] font-medium">{t('lock.timeout')}</p>
                <Segmented
                  label={t('lock.timeout')}
                  value={String(config.timeoutSec)}
                  onChange={async (v) => {
                    await updateLock({ timeoutSec: Number(v) });
                    reload();
                  }}
                  options={LOCK_TIMEOUTS.map((s) => ({ value: String(s), label: t(`lock.timeout.${s}` as MessageKey) }))}
                />
              </div>
            </Card>
            <Button variant="ghost" block className="text-danger" onClick={() => setFlow({ kind: 'verify', then: 'disable' })}>
              {t('common.off')}
            </Button>
          </>
        )}
      </div>

      {flow && (
        <PinFlowSheet
          flow={flow}
          onClose={() => setFlow(null)}
          onDone={async (result) => {
            if (result === 'disable') {
              await disableLock();
              toast(t('lock.disabled'));
            } else if (result === 'change') {
              setFlow({ kind: 'create' });
              return;
            } else {
              toast(t('lock.enabled'), { tone: 'success' });
            }
            setFlow(null);
            reload();
          }}
        />
      )}
    </Page>
  );
}

function PinFlowSheet({ flow, onClose, onDone }: { flow: Flow; onClose: () => void; onDone: (result: 'created' | 'disable' | 'change') => void }) {
  const { t } = useApp();
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const creating = flow.kind === 'create';
  const title = creating ? (first ? t('lock.confirmPin') : t('lock.createPin')) : t('lock.enterPin');

  const submit = async (value: string) => {
    if (creating) {
      if (!first) {
        setFirst(value);
        setPin('');
        return;
      }
      if (value !== first) {
        haptic('warning');
        playSound('error');
        setError(t('lock.mismatch'));
        setFirst(null);
        setPin('');
        return;
      }
      await enableLock(value);
      onDone('created');
      return;
    }
    if (await verifyPin(value)) onDone(flow.then);
    else {
      haptic('warning');
      playSound('error');
      setError(t('lock.wrong'));
      setPin('');
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        creating ? (
          <Button block disabled={pin.length < PIN_MIN} onClick={() => void submit(pin)}>
            {t('common.confirm')}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center px-4 pt-2 pb-6">
        <p className="mb-6 min-h-5 text-sm text-danger">{error}</p>
        <PinPad
          value={pin}
          error={Boolean(error) && pin.length === 0}
          onChange={async (value) => {
            setError(null);
            setPin(value);
            if (!creating && value.length >= PIN_MIN && value.length <= PIN_MAX) {
              const config = await getLockConfig();
              if (value.length === config.length) void submit(value);
            } else if (creating && value.length === PIN_MAX) void submit(value);
          }}
        />
      </div>
    </Sheet>
  );
}
