import { useEffect, useRef } from 'react';

/**
 * Overlays (sheets, dialogs, viewers) register here so the Android back button closes
 * the top-most one before navigating. Escape does the same on desktop browsers.
 */
type Handler = () => void;

const stack: { id: number; handler: { current: Handler } }[] = [];
let nextId = 0;

/** Runs the top-most handler; returns false when nothing was open. */
export function handleBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.handler.current();
  return true;
}

export function useBackHandler(active: boolean, onBack: Handler) {
  const handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => {
    if (!active) return;
    const id = nextId++;
    stack.push({ id, handler });
    return () => {
      const index = stack.findIndex((entry) => entry.id === id);
      if (index >= 0) stack.splice(index, 1);
    };
  }, [active]);
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && handleBack()) event.preventDefault();
  });
}
