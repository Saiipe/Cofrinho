import { useRef, type PointerEvent } from 'react';

/**
 * Horizontal swipe on touch screens (vertical scrolling keeps working through `touch-action: pan-y`).
 * `direction` is 1 for a swipe to the left (next) and -1 to the right (previous).
 */
export function useHorizontalSwipe(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number; time: number } | null>(null);
  return {
    onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse') return;
      start.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    },
    onPointerUp(event: PointerEvent) {
      const origin = start.current;
      start.current = null;
      if (!origin) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - origin.time < 700) onSwipe(dx < 0 ? 1 : -1);
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}
