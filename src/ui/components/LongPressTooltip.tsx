import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic, playSound } from '@/services/feedback';

const HOLD_MS = 400;
const MOVE_TOLERANCE = 12;
/** Android takes over a still press near 400 ms (contextmenu, then pointercancel); a cancel this late is a hold, not a scroll. */
const LATE_CANCEL_MS = 300;
const VISIBLE_MS = 2200;
/** Room the tip needs above its control (one line plus the gap). */
const TIP_SPACE = 48;
/** Controls whose name only lives in `aria-label` (icon-only), or that opt in with `data-tip`. */
const SELECTOR = 'button[aria-label], a[aria-label], [role="button"][aria-label], [data-tip]';

/** Height of the status bar area the app draws under (0 in a browser). */
function safeAreaTop(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top)';
  document.body.append(probe);
  const top = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return top;
}

interface Tip {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

interface Press {
  target: HTMLElement;
  text: string;
  x: number;
  y: number;
  at: number;
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
    let press: Press | null = null;
    let fired = false;

    const cancel = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      press = null;
    };
    const hide = () => {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = null;
      setTip(null);
    };
    const show = () => {
      if (!press || fired) return;
      const { target, text } = press;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      fired = true;
      const rect = target.getBoundingClientRect();
      // Above the finger when there is room; icons in the top bar get it below.
      const below = rect.top - TIP_SPACE < safeAreaTop();
      setTip({ text, x: rect.left + rect.width / 2, y: below ? rect.bottom + 10 : rect.top - 10, below });
      haptic('light');
      playSound('pop');
    };
    const release = () => {
      press = null;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      if (!fired) return;
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setTip(null), VISIBLE_MS);
    };

    const onDown = (event: PointerEvent) => {
      fired = false;
      hide();
      cancel();
      if (event.pointerType === 'mouse') return;
      const target = (event.target as Element | null)?.closest?.(SELECTOR);
      if (!(target instanceof HTMLElement) || target.closest('[data-no-tip]')) return;
      const text = (target.dataset.tip ?? target.getAttribute('aria-label') ?? '').trim();
      // Visible text already tells what the control is.
      if (!text || (!target.dataset.tip && (target.textContent ?? '').trim())) return;
      press = { target, text, x: event.clientX, y: event.clientY, at: performance.now() };
      timer = window.setTimeout(show, HOLD_MS);
    };
    const onMove = (event: PointerEvent) => {
      if (press && !fired && Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) cancel();
    };
    const onCancel = () => {
      if (press && !fired && performance.now() - press.at >= LATE_CANCEL_MS) show();
      release();
    };
    const onClick = (event: MouseEvent) => {
      if (!fired) return;
      fired = false;
      event.preventDefault();
      event.stopPropagation();
    };
    // Android's own long-press signal; it can beat our timer when the system hold delay is short.
    const onContextMenu = (event: Event) => {
      if (!press && !fired) return;
      event.preventDefault();
      show();
    };
    const onScroll = () => {
      cancel();
      if (fired) hide();
    };

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', onCancel, true);
    // On `window` so a swallowed click never reaches document listeners (tap sounds).
    window.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancel();
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  if (!tip) return null;
  const margin = 12;
  const half = Math.min(120, window.innerWidth / 2 - margin);
  const left = Math.min(window.innerWidth - margin - half, Math.max(margin + half, tip.x));
  // Position on the outer box, animate the inner one: the pop-in keyframes set `transform` too.
  return createPortal(
    <div className="pointer-events-none fixed z-[110] w-max" style={{ left, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}>
      <div role="tooltip" className="max-w-[240px] animate-pop-in rounded-xl bg-fg px-3 py-2 text-center text-[0.85rem] leading-snug font-medium text-bg shadow-xl">
        {tip.text}
      </div>
    </div>,
    document.body,
  );
}
