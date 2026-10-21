import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './primitives';

/**
 * Small SVG charts drawn to the validated chart spec: bars ≤ 24px with a 4px rounded data end,
 * square at the baseline; solid hairline grid; values readable by tap/keyboard and via the
 * table each chart is paired with on its screen.
 */

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Rounds up to 1/2/2.5/5 × 10ⁿ so gridlines land on clean values. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  for (const step of [1, 2, 2.5, 5, 10]) if (value <= step * base) return step * base;
  return 10 * base;
}

/** Column with a 4px rounded top and a square base. */
function columnPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0) return '';
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

export interface ColumnPoint {
  key: string;
  /** Axis label; empty labels are skipped. */
  label: string;
  value: number;
}

export interface ColumnChartProps {
  points: ColumnPoint[];
  color: string;
  height?: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
  formatTick: (value: number) => string;
  average?: number;
  averageLabel?: string;
  ariaLabel: string;
}

const AXIS_WIDTH = 40;
const LABEL_BAND = 22;

export function ColumnChart({ points, color, height = 168, selected, onSelect, formatTick, average, averageLabel, ariaLabel }: ColumnChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = niceMax(Math.max(...points.map((p) => p.value), average ?? 0));
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const plotHeight = height - LABEL_BAND;
  const slot = points.length ? plotWidth / points.length : 0;
  const barWidth = Math.max(2, Math.min(24, slot - 2));
  const y = (value: number) => plotHeight - (value / max) * (plotHeight - 6);
  const selectedIndex = points.findIndex((p) => p.key === selected);

  const pick = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !slot) return;
    const index = Math.floor((clientX - rect.left - AXIS_WIDTH) / slot);
    if (index >= 0 && index < points.length) onSelect(points[index]!.key);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!points.length) return;
    const current = selectedIndex < 0 ? points.length - 1 : selectedIndex;
    if (event.key === 'ArrowRight') onSelect(points[Math.min(points.length - 1, current + 1)]!.key);
    else if (event.key === 'ArrowLeft') onSelect(points[Math.max(0, current - 1)]!.key);
    else if (event.key === 'Escape') onSelect(null);
    else return;
    event.preventDefault();
  };

  const ticks = [0, max / 2, max];
  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerMove={(e) => e.buttons && pick(e.clientX)}
      className="touch-pan-y select-none outline-none"
      style={{ height }}
    >
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={AXIS_WIDTH} x2={width} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth={1} />
              <text x={AXIS_WIDTH - 6} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--chart-label)" className="tabular">
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const x = AXIS_WIDTH + index * slot + (slot - barWidth) / 2;
            const top = y(point.value);
            const dimmed = selectedIndex >= 0 && index !== selectedIndex;
            return <path key={point.key} d={columnPath(x, top, barWidth, plotHeight - top)} fill={color} opacity={dimmed ? 0.35 : 1} />;
          })}
          {average !== undefined && average > 0 && (
            <g>
              <line x1={AXIS_WIDTH} x2={width} y1={y(average)} y2={y(average)} stroke="var(--muted)" strokeWidth={1} />
              {averageLabel && (
                <text x={width} y={y(average) - 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                  {averageLabel}
                </text>
              )}
            </g>
          )}
          {points.map((point, index) =>
            point.label ? (
              <text key={`l-${point.key}`} x={AXIS_WIDTH + index * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={10} fill={index === selectedIndex ? 'var(--fg)' : 'var(--chart-label)'}>
                {point.label}
              </text>
            ) : null,
          )}
        </svg>
      )}
    </div>
  );
}

export interface PairedPoint {
  key: string;
  label: string;
  a: number;
  b: number;
}

/** Two series side by side per slot (income vs. expenses), with a 2px gap between the pair. */
export function PairedColumnChart({
  points,
  colors,
  height = 180,
  selected,
  onSelect,
  formatTick,
  ariaLabel,
}: {
  points: PairedPoint[];
  colors: [string, string];
  height?: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
  formatTick: (value: number) => string;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = niceMax(Math.max(...points.flatMap((p) => [p.a, p.b])));
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const plotHeight = height - LABEL_BAND;
  const slot = points.length ? plotWidth / points.length : 0;
  const barWidth = Math.max(2, Math.min(12, (slot - 6) / 2));
  const y = (value: number) => plotHeight - (value / max) * (plotHeight - 6);
  const selectedIndex = points.findIndex((p) => p.key === selected);
  const pick = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !slot) return;
    const index = Math.floor((clientX - rect.left - AXIS_WIDTH) / slot);
    if (index >= 0 && index < points.length) onSelect(points[index]!.key);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!points.length) return;
    const current = selectedIndex < 0 ? points.length - 1 : selectedIndex;
    if (event.key === 'ArrowRight') onSelect(points[Math.min(points.length - 1, current + 1)]!.key);
    else if (event.key === 'ArrowLeft') onSelect(points[Math.max(0, current - 1)]!.key);
    else if (event.key === 'Escape') onSelect(null);
    else return;
    event.preventDefault();
  };
  return (
    <div ref={ref} role="img" aria-label={ariaLabel} tabIndex={0} onKeyDown={onKeyDown} onPointerDown={(e) => pick(e.clientX)} onPointerMove={(e) => e.buttons && pick(e.clientX)} className="touch-pan-y select-none outline-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          {[0, max / 2, max].map((tick) => (
            <g key={tick}>
              <line x1={AXIS_WIDTH} x2={width} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth={1} />
              <text x={AXIS_WIDTH - 6} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--chart-label)">
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const center = AXIS_WIDTH + index * slot + slot / 2;
            const dimmed = selectedIndex >= 0 && index !== selectedIndex;
            const ya = y(point.a);
            const yb = y(point.b);
            return (
              <g key={point.key} opacity={dimmed ? 0.35 : 1}>
                <path d={columnPath(center - barWidth - 1, ya, barWidth, plotHeight - ya)} fill={colors[0]} />
                <path d={columnPath(center + 1, yb, barWidth, plotHeight - yb)} fill={colors[1]} />
                <text x={center} y={height - 6} textAnchor="middle" fontSize={10} fill={index === selectedIndex ? 'var(--fg)' : 'var(--chart-label)'}>
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export interface ShareSegment {
  key: string;
  value: number;
  color: string;
  label: string;
}

/** Part-to-whole bar: segments separated by a 2px surface gap. */
export function ShareBar({ segments, ariaLabel, onSelect, selected }: { segments: ShareSegment[]; ariaLabel: string; onSelect?: (key: string) => void; selected?: string | null }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;
  return (
    <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={ariaLabel}>
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          aria-label={segment.label}
          onClick={() => onSelect?.(segment.key)}
          className={cx('h-full min-w-[3px] transition-opacity', selected && selected !== segment.key && 'opacity-35')}
          style={{ flexGrow: segment.value, flexBasis: 0, backgroundColor: segment.color }}
        />
      ))}
    </div>
  );
}

/** Progress against a limit; color carries severity, the track is a lighter step of the same hue. */
export function Meter({ ratio, label, className }: { ratio: number; label: string; className?: string }) {
  const tone = ratio > 1 ? 'var(--status-critical)' : ratio >= 0.8 ? 'var(--status-warning)' : 'var(--primary)';
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(ratio, 9.99) * 100)}
      className={cx('h-2 w-full overflow-hidden rounded-full', className)}
      style={{ backgroundColor: `color-mix(in srgb, ${tone} 18%, transparent)` }}
    >
      <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: tone }} />
    </div>
  );
}

export function ChartLegend({ items }: { items: { color: string; label: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-muted">
      {items.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
  label: string;
}

function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const point = (radius: number, angle: number) => [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)] as const;
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(outer, start);
  const [x2, y2] = point(outer, end);
  const [x3, y3] = point(inner, end);
  const [x4, y4] = point(inner, start);
  return `M${x1},${y1}A${outer},${outer} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${inner},${inner} 0 ${large} 0 ${x4},${y4}Z`;
}

/**
 * Part-to-whole ring (≤ 6 segments: callers fold the tail into "Other"). Segments are separated by
 * a 2px surface gap. Tapping a slice reports its key (the caller decides what a repeated tap does);
 * the selected slice is enlarged and the rest dimmed; tapping the center clears the selection.
 */
export function DonutChart({
  segments,
  size = 156,
  thickness = 24,
  selected,
  onSelect,
  center,
  ariaLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
  center?: ReactNode;
  ariaLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const pad = 4;
  const c = size / 2;
  const outer = c - pad;
  const inner = outer - thickness;
  let angle = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const sweep = total > 0 ? (segment.value / total) * Math.PI * 2 : 0;
      const arc = { segment, start: angle, end: angle + sweep };
      angle += sweep;
      return arc;
    });
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={ariaLabel} className="block overflow-visible">
        {arcs.length === 1 ? (
          <circle
            cx={c}
            cy={c}
            r={(outer + inner) / 2}
            fill="none"
            stroke={arcs[0]!.segment.color}
            strokeWidth={thickness}
            onClick={() => onSelect(arcs[0]!.segment.key)}
          />
        ) : (
          arcs.map(({ segment, start, end }) => {
            const active = selected === segment.key;
            // Hairline slices stay visible and tappable.
            const visibleEnd = Math.max(end, start + 0.02);
            return (
              <path
                key={segment.key}
                d={arcPath(c, c, active ? outer + pad : outer, inner, start, visibleEnd)}
                fill={segment.color}
                stroke="var(--surface)"
                strokeWidth={2}
                strokeLinejoin="round"
                opacity={selected && !active ? 0.35 : 1}
                className="cursor-pointer transition-opacity"
                onClick={() => onSelect(segment.key)}
              >
                <title>{segment.label}</title>
              </path>
            );
          })
        )}
      </svg>
      {center && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="absolute inset-0 m-auto flex flex-col items-center justify-center rounded-full text-center"
          style={{ width: inner * 2 - 8, height: inner * 2 - 8 }}
          tabIndex={-1}
        >
          {center}
        </button>
      )}
    </div>
  );
}

/** Circular progress toward a target; the track is a lighter step of the same hue. */
export function ProgressRing({ ratio, size = 132, thickness = 12, color = 'var(--primary)', children, label }: { ratio: number; size?: number; thickness?: number; color?: string; children?: ReactNode; label: string }) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
      <svg width={size} height={size} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`color-mix(in srgb, ${color} 16%, transparent)`} strokeWidth={thickness} />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${circumference * clamped} ${circumference}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
