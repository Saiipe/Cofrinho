import { GripVertical, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { haptic } from '@/services/feedback';
import { useT } from '../app/AppContext';
import { cx } from './primitives';

const ACTION_WIDTH = 88;

/** Swipe left to reveal a delete action (the row stays tappable; a tap while open closes it). */
export function SwipeRow({ children, onDelete, label }: { children: ReactNode; onDelete: () => void; label: string }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ x: number; y: number; base: number; axis: 'x' | 'y' | null } | null>(null);

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, base: offset, axis: null };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        g.axis = 'x';
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (Math.abs(dy) > 8) {
        g.axis = 'y';
      }
    }
    if (g.axis === 'x') setOffset(Math.max(-ACTION_WIDTH * 1.25, Math.min(0, g.base + dx)));
  };
  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.axis === 'x') {
      setDragging(false);
      setOffset((value) => {
        const open = value < -ACTION_WIDTH / 2;
        if (open && g.base === 0) haptic('light');
        return open ? -ACTION_WIDTH : 0;
      });
    }
  };

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={() => {
          setOffset(0);
          onDelete();
        }}
        tabIndex={offset ? 0 : -1}
        aria-hidden={offset === 0}
        className="absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-0.5 bg-danger text-xs font-semibold text-white"
      >
        <Trash2 className="size-5" aria-hidden />
        {label}
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          if (offset !== 0) {
            event.preventDefault();
            event.stopPropagation();
            setOffset(0);
          }
        }}
        className={cx('relative touch-pan-y bg-surface', !dragging && 'transition-transform duration-200')}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}

interface DragState {
  id: string;
  startY: number;
  dy: number;
  order: string[];
}

/**
 * Reorderable list: drag the grip handle; the handle also responds to ↑/↓ for keyboard users.
 * `renderItem` receives the handle element to place inside the row.
 */
export function SortableList<T extends { id: string }>({ items, onReorder, renderItem }: { items: T[]; onReorder: (ids: string[]) => void; renderItem: (item: T, handle: ReactNode) => ReactNode }) {
  const t = useT();
  const [drag, setDrag] = useState<DragState | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const heights = useRef(new Map<string, number>());
  const byId = new Map(items.map((item) => [item.id, item]));
  const order = drag?.order ?? items.map((item) => item.id);

  useLayoutEffect(() => {
    for (const [id, el] of rows.current) heights.current.set(id, el.offsetHeight);
  });

  const start = (id: string, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    haptic('medium');
    setDrag({ id, startY: event.clientY, dy: 0, order: items.map((item) => item.id) });
  };

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const pointerY = event.clientY;
    setDrag((current) => {
      if (!current) return current;
      let { startY, order: next } = current;
      const dy = pointerY - startY;
      const index = next.indexOf(current.id);
      // Swap with a neighbour once the dragged row passes its midpoint.
      if (dy > 0 && index < next.length - 1) {
        const below = next[index + 1]!;
        const belowHeight = heights.current.get(below) ?? 56;
        if (dy > belowHeight / 2) {
          next = [...next];
          next.splice(index, 2, below, current.id);
          startY += belowHeight;
        }
      } else if (dy < 0 && index > 0) {
        const above = next[index - 1]!;
        const aboveHeight = heights.current.get(above) ?? 56;
        if (-dy > aboveHeight / 2) {
          next = [...next];
          next.splice(index - 1, 2, current.id, above);
          startY -= aboveHeight;
        }
      }
      return { ...current, startY, order: next, dy: pointerY - startY };
    });
  };

  const end = () => {
    if (!drag) return;
    const changed = drag.order.some((id, i) => id !== items[i]?.id);
    setDrag(null);
    if (changed) onReorder(drag.order);
  };

  const keyMove = (id: string, event: KeyboardEvent) => {
    const index = order.indexOf(id);
    const target = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : -1;
    if (target < 0 || target >= order.length) return;
    event.preventDefault();
    const next = [...order];
    next.splice(index, 1);
    next.splice(target, 0, id);
    onReorder(next);
  };

  return (
    <div>
      {order.map((id) => {
        const item = byId.get(id);
        if (!item) return null;
        const active = drag?.id === id;
        const handle = (
          <button
            type="button"
            aria-label={t('common.dragToSort')}
            onPointerDown={(e) => start(id, e)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => keyMove(id, e)}
            className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-faint active:cursor-grabbing"
          >
            <GripVertical className="size-5" aria-hidden />
          </button>
        );
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rows.current.set(id, el);
              else rows.current.delete(id);
            }}
            className={cx('relative bg-surface', active && 'z-10 shadow-xl')}
            style={active ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            {renderItem(item, handle)}
          </div>
        );
      })}
    </div>
  );
}
