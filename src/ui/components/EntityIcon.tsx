import type { Category } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { iconFor } from '../icons';
import { cx } from './primitives';

const SIZES = {
  sm: ['size-8', 'size-4'],
  md: ['size-10', 'size-5'],
  lg: ['size-12', 'size-6'],
  xl: ['size-16', 'size-8'],
} as const;

export interface EntityIconProps {
  icon: string;
  color: string;
  size?: keyof typeof SIZES;
  /** Overrides the user's icon style preference. */
  mono?: boolean;
  className?: string;
}

/** Glyph in a circle: the entity color with a white glyph, or the theme tint in "mono" style. */
export function EntityIcon({ icon, color, size = 'md', mono, className }: EntityIconProps) {
  const { settings } = useApp();
  const Icon = iconFor(icon);
  const [box, glyph] = SIZES[size];
  const isMono = mono ?? settings.iconStyle === 'mono';
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full', box, isMono ? 'bg-primary-soft text-primary' : 'text-white', className)}
      style={isMono ? undefined : { backgroundColor: color }}
      aria-hidden
    >
      <Icon className={glyph} strokeWidth={2} />
    </span>
  );
}

export function CategoryIcon({ category, size }: { category: Category | undefined; size?: EntityIconProps['size'] }) {
  if (!category) return <EntityIcon icon="circle-help" color="#8b93a1" size={size} />;
  return <EntityIcon icon={category.icon} color={category.color} size={size} />;
}
