import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { playSound } from '@/services/feedback';
import { useT } from '../app/AppContext';
import { Dialog } from './Sheet';
import { Button, cx } from './primitives';

type ToastTone = 'default' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}

interface FeedbackContextValue {
  toast: (message: string, options?: { tone?: ToastTone; action?: ToastItem['action']; duration?: number }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((item) => item.id !== id)), []);

  const toast = useCallback<FeedbackContextValue['toast']>(
    (message, options = {}) => {
      const id = nextId.current++;
      if (options.tone === 'success') playSound('success');
      else if (options.tone === 'error') playSound('error');
      setToasts((list) => [...list.slice(-2), { id, message, tone: options.tone ?? 'default', action: options.action }]);
      window.setTimeout(() => dismiss(id), options.duration ?? (options.action ? 5000 : 2800));
    },
    [dismiss],
  );

  const confirm = useCallback<FeedbackContextValue['confirm']>((options) => new Promise((resolve) => setDialog({ ...options, resolve })), []);

  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)]" aria-live="polite">
          {toasts.map((item) => (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-md animate-toast-in items-center gap-3 rounded-2xl bg-fg px-4 py-3 text-[0.9rem] text-bg shadow-xl"
            >
              {item.tone === 'success' && <CircleCheck className="size-5 shrink-0 text-income" aria-hidden />}
              {item.tone === 'error' && <CircleAlert className="size-5 shrink-0 text-danger" aria-hidden />}
              <span className="min-w-0 flex-1">{item.message}</span>
              {item.action && (
                <button
                  type="button"
                  className="shrink-0 font-semibold text-primary"
                  onClick={() => {
                    item.action!.onClick();
                    dismiss(item.id);
                  }}
                >
                  {item.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
      <Dialog
        open={dialog !== null}
        onClose={() => close(false)}
        title={dialog?.title ?? ''}
        actions={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant={dialog?.destructive ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus data-sound={dialog?.destructive ? 'delete' : undefined}>
              {dialog?.confirmLabel ?? t('common.confirm')}
            </Button>
          </>
        }
      >
        {dialog?.message}
      </Dialog>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback outside FeedbackProvider');
  return value;
}

export function InlineNotice({ tone = 'default', children, icon: Icon }: { tone?: 'default' | 'warning' | 'danger'; children: ReactNode; icon?: typeof CircleAlert }) {
  return (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[0.85rem]',
        tone === 'warning' && 'bg-warning/15 text-fg',
        tone === 'danger' && 'bg-critical/12 text-fg',
        tone === 'default' && 'bg-primary-soft text-fg',
      )}
    >
      {Icon && <Icon className={cx('mt-0.5 size-4 shrink-0', tone === 'danger' ? 'text-critical' : tone === 'warning' ? 'text-[#a16207] dark:text-warning' : 'text-primary')} aria-hidden />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
