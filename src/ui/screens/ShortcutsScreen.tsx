import { CreditCard, Goal, Info, LayoutGrid, Minus, Plus, Search, ShieldCheck, Sprout, SquarePlus, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { nativeCapabilities, pinShortcut, requestPinWidget, type ShortcutIcon, type WidgetKind } from '@/services/native';
import { isNative } from '@/services/platform';
import type { MessageKey } from '@/i18n';
import { useApp } from '../app/AppContext';
import { InlineNotice, useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { Button, Divider, Row, Section } from '../components/primitives';

interface ShortcutOption {
  id: string;
  icon: ShortcutIcon;
  glyph: LucideIcon;
  color: string;
  label: MessageKey;
  path: string;
}

export const SHORTCUTS: ShortcutOption[] = [
  { id: 'new-expense', icon: 'expense', glyph: Minus, color: '#dc2626', label: 'shortcuts.expense', path: '/tx/new?kind=expense' },
  { id: 'new-income', icon: 'income', glyph: Plus, color: '#16a34a', label: 'shortcuts.income', path: '/tx/new?kind=income' },
  { id: 'search', icon: 'search', glyph: Search, color: '#0f766e', label: 'shortcuts.search', path: '/search' },
  { id: 'garden', icon: 'garden', glyph: Sprout, color: '#65a30d', label: 'shortcuts.garden', path: '/garden' },
  { id: 'goals', icon: 'goals', glyph: Goal, color: '#7c3aed', label: 'shortcuts.goals', path: '/goals' },
  { id: 'cards', icon: 'cards', glyph: CreditCard, color: '#2563eb', label: 'shortcuts.cards', path: '/cards' },
];

const WIDGETS: { kind: WidgetKind; title: MessageKey; hint: MessageKey }[] = [
  { kind: 'quick', title: 'widgets.quick', hint: 'widgets.quickHint' },
  { kind: 'summary', title: 'widgets.summary', hint: 'widgets.summaryHint' },
];

function Glyph({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }} aria-hidden>
      <Icon className="size-5" strokeWidth={2.4} />
    </span>
  );
}

export default function ShortcutsScreen() {
  const { t } = useApp();
  const { toast } = useFeedback();
  const [caps, setCaps] = useState<{ pinShortcuts: boolean; pinWidgets: boolean } | null>(null);

  useEffect(() => {
    void nativeCapabilities().then(setCaps);
  }, []);

  const addShortcut = async (option: ShortcutOption) => {
    if (!caps?.pinShortcuts) {
      toast(t('shortcuts.unsupported'), { duration: 6000 });
      return;
    }
    const requested = await pinShortcut(option.id, t(option.label), option.path, option.icon);
    toast(requested ? t('shortcuts.requested') : t('shortcuts.unsupported'), { duration: requested ? 3500 : 6000 });
  };

  const addWidget = async (kind: WidgetKind) => {
    const requested = caps?.pinWidgets ? await requestPinWidget(kind) : false;
    toast(requested ? t('widgets.requested') : t('widgets.manual'), { duration: requested ? 3500 : 7000 });
  };

  return (
    <Page title={t('me.widgets')} back="/me">
      <div className="space-y-5 pt-1">
        {!isNative && (
          <div className="px-4">
            <InlineNotice icon={Info}>
              <p>{t('widgets.webOnly')}</p>
              <p className="mt-1">{t('shortcuts.webHint')}</p>
            </InlineNotice>
          </div>
        )}

        <Section title={t('widgets.title')}>
          <p className="px-4 pt-3 text-sm text-muted">{t('widgets.hint')}</p>
          {WIDGETS.map((widget, index) => (
            <div key={widget.kind}>
              {index > 0 && <Divider inset />}
              <Row
                leading={<Glyph icon={widget.kind === 'quick' ? SquarePlus : LayoutGrid} color="#0f766e" />}
                title={t(widget.title)}
                subtitle={t(widget.hint)}
                trailing={
                  <Button size="sm" variant="secondary" onClick={() => void addWidget(widget.kind)} disabled={!isNative}>
                    {t('widgets.add')}
                  </Button>
                }
              />
            </div>
          ))}
        </Section>

        <div className="px-4">
          <InlineNotice icon={ShieldCheck}>{t('widgets.privacy')}</InlineNotice>
        </div>

        <Section title={t('shortcuts.title')}>
          <p className="px-4 pt-3 text-sm text-muted">{t('shortcuts.hint')}</p>
          {SHORTCUTS.map((option, index) => (
            <div key={option.id}>
              {index > 0 && <Divider inset />}
              <Row
                leading={<Glyph icon={option.glyph} color={option.color} />}
                title={t(option.label)}
                trailing={
                  <Button size="sm" variant="secondary" onClick={() => void addShortcut(option)} disabled={!isNative}>
                    {t('shortcuts.create')}
                  </Button>
                }
              />
            </div>
          ))}
        </Section>
      </div>
    </Page>
  );
}
