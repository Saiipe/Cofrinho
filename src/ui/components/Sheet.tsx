import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useBackHandler } from '../app/back';
import { useT } from '../app/AppContext';
import { cx, IconButton } from './primitives';

let openCount = 0;

/** Locks page scroll while any overlay is open. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    openCount++;
    document.body.style.overflow = 'hidden';
    return () => {
      openCount--;
      if (openCount === 0) document.body.style.overflow = '';
    };
  }, [active]);
}

function useInitialFocus(active: boolean, panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const target = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
    target?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, [active, panel]);
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Taller sheet for long lists (pickers). */
  tall?: boolean;
}

/** Bottom sheet: the mobile-native container for pickers and quick forms. */
export function Sheet({ open, onClose, title, children, footer, tall }: SheetProps) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useBackHandler(open, onClose);
  useScrollLock(open);
  useInitialFocus(open, panel);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 animate-fade-in bg-[var(--overlay)]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          'relative mx-auto flex w-full max-w-lg animate-sheet-in flex-col rounded-t-3xl bg-surface pb-safe shadow-2xl outline-none',
          tall ? 'h-[88dvh]' : 'max-h-[88dvh]',
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        {title && (
          <div className="flex shrink-0 items-center gap-2 py-1.5 pr-2 pl-5">
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-semibold">
              {title}
            </h2>
            <IconButton icon={X} label={t('common.close')} onClick={onClose} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-4 pt-3 pb-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
}

/** Centered modal for confirmations. */
export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useBackHandler(open, onClose);
  useScrollLock(open);
  useInitialFocus(open, panel);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 animate-fade-in bg-[var(--overlay)]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-sm animate-pop-in rounded-3xl bg-surface p-6 shadow-2xl outline-none"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {children && <div className="mt-2 text-[0.95rem] text-muted">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}
