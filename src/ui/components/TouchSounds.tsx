import { useEffect } from 'react';
import { isSound, playSound, type Sound } from '@/services/feedback';

const CONTROL = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="option"], [role="radio"], [data-sound]';

/** A control's own `data-sound` (an ancestor's also applies; "none" mutes), else the sound of its role. */
function soundOf(control: Element): Sound | null {
  const chosen = control.closest<HTMLElement | SVGElement>('[data-sound]')?.dataset.sound;
  if (chosen) return isSound(chosen) ? chosen : null;
  const role = control.getAttribute('role');
  // Read before the click handler flips it.
  if (role === 'switch') return control.getAttribute('aria-checked') === 'true' ? 'toggleOff' : 'toggleOn';
  if (role === 'tab' || role === 'option' || role === 'radio' || control.hasAttribute('aria-pressed')) return 'select';
  return 'tap';
}

/**
 * A short sound for every tap on a control, app-wide. Clicks swallowed by the long-press tooltip
 * stop at `window` and never get here.
 */
export function TouchSounds() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const control = (event.target as Element | null)?.closest?.(CONTROL);
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
      const sound = soundOf(control);
      if (sound) playSound(sound);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
