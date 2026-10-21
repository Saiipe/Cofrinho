import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '@/services/feedback';

const HOLD_MS = 450;
const MOVE_TOLERANCE = 10;
const VISIBLE_MS = 1600;
/** Controls whose name only lives in `aria-label` (icon-only), or that opt in with `data-tip`. */
const SELECTOR = 'button[aria-label], a[aria-label], [role="button"][aria-label], [data-tip]';

interface Tip {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

/**
 * Touch and hold an icon to see what it does. The press that shows the tip does not activate
 * the control. Opt out with `data-no-tip` (controls with their own long-press or drag gesture).
 */
export function LongPressTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    let hideTimer: number | null = null;
    let start: { x: number; y: number } | null = null;
    let fired = false;

    const cancel = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      start = null;
    };
    const hide = () => {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = null;
      setTip(null);
    };

    const onDown = (event: PointerEvent) => {
      fired = false;
      hide();
      if (event.pointerType === 'mouse') return;
      const target = (event.target as Element | null)?.closest?.(SELECTOR);
      if (!(target instanceof HTMLElement) || target.closest('[data-no-tip]')) return;
      const text = (target.dataset.tip ?? target.getAttribute('aria-label') ?? '').trim();
      // Visible text already tells what the control is.
      if (!text || (!target.dataset.tip && (target.textContent ?? '').trim())) return;
      start = { x: event.clientX, y: event.clientY };
      timer = window.setTimeout(() => {
        timer = null;
        fired = true;
        const rect = target.getBoundingClientRect();
        const below = rect.top < 80;
        setTip({ text, x: rect.left + rect.width / 2, y: below ? rect.bottom + 8 : rect.top - 8, below });
        haptic('light');
      }, HOLD_MS);
    };
    const onMove = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE) cancel();
    };
    const onUp = () => {
      cancel();
      if (fired) hideTimer = window.setTimeout(() => setTip(null), VISIBLE_MS);
    };
    const onClick = (event: MouseEvent) => {
      if (!fired) return;
      fired = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onContextMenu = (event: Event) => {
      if (timer !== null || fired) event.preventDefault();
    };
    const onScroll = () => {
      cancel();
      if (!fired) return;
      hide();
    };

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancel();
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  if (!tip) return null;
  const margin = 12;
  const half = Math.min(120, window.innerWidth / 2 - margin);
  const left = Math.min(window.innerWidth - margin - half, Math.max(margin + half, tip.x));
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[90] max-w-[240px] animate-pop-in rounded-xl bg-fg px-3 py-2 text-center text-[0.85rem] leading-snug font-medium text-bg shadow-xl"
      style={{ left, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
