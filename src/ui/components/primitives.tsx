import { ChevronRight, type LucideIcon } from 'lucide-react';
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { haptic } from '@/services/feedback';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg active:opacity-85',
  secondary: 'bg-surface-2 text-fg active:bg-line',
  ghost: 'text-primary active:bg-primary-soft',
  danger: 'bg-danger text-white active:opacity-85',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  block?: boolean;
}

const BUTTON_SIZES = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-4 text-[0.95rem] gap-2', lg: 'h-13 px-5 text-base gap-2' };

function buttonClass(variant: ButtonVariant, size: keyof typeof BUTTON_SIZES, block?: boolean, className?: string): string {
  return cx(
    'inline-flex select-none items-center justify-center rounded-xl font-semibold transition-[opacity,background-color] disabled:opacity-45',
    BUTTON_SIZES[size],
    BUTTON_VARIANTS[variant],
    block && 'w-full',
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, block, className, children, onClick, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, block, className)}
      onClick={(event) => {
        haptic('light');
        onClick?.(event);
      }}
      {...rest}
    >
      {Icon && <Icon className="size-[1.15em] shrink-0" aria-hidden />}
      {children}
    </button>
  );
});

/** A navigation link styled as a button (never nest a <button> inside a link). */
export function LinkButton({ to, variant = 'primary', size = 'md', icon: Icon, block, className, children }: { to: string; variant?: ButtonVariant; size?: keyof typeof BUTTON_SIZES; icon?: LucideIcon; block?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={buttonClass(variant, size, block, className)} onClick={() => haptic('light')}>
      {Icon && <Icon className="size-[1.15em] shrink-0" aria-hidden />}
      {children}
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'hero' | 'primary';
}

export function IconButton({ icon: Icon, label, tone = 'default', className, onClick, ...rest }: IconButtonProps) {
  const tones = {
    default: 'text-fg active:bg-surface-2',
    hero: 'text-hero-fg active:bg-white/15',
    primary: 'text-primary active:bg-primary-soft',
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors', tones[tone], className)}
      onClick={(event) => {
        haptic('light');
        onClick?.(event);
      }}
      {...rest}
    >
      <Icon className="size-[1.35rem]" aria-hidden />
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl bg-surface shadow-card', className)}>{children}</div>;
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('px-4', className)}>
      {(title || action) && (
        <div className="mb-2 flex items-end justify-between gap-2 px-1">
          {title && <h2 className="text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{title}</h2>}
          {action}
        </div>
      )}
      <Card className="overflow-hidden">{children}</Card>
    </section>
  );
}

export interface RowProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
  className?: string;
}

/** List row; renders as a link, a button or a static block depending on props. */
export function Row({ leading, title, subtitle, trailing, to, onClick, chevron, danger, className }: RowProps) {
  const content = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[0.95rem] font-medium', danger ? 'text-danger' : 'text-fg')}>{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[0.8rem] text-muted">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right text-sm text-muted">{trailing}</span>}
      {(chevron ?? Boolean(to)) && <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />}
    </>
  );
  const classes = cx('flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left', (to || onClick) && 'active:bg-surface-2', className);
  if (to) {
    return (
      <Link to={to} className={classes} onClick={() => haptic('light')}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={() => {
          haptic('light');
          onClick();
        }}
      >
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

export function Divider({ inset = false }: { inset?: boolean }) {
  return <div className={cx('h-px bg-line', inset && 'ml-16')} />;
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic('light');
        onChange(!checked);
      }}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-45', checked ? 'bg-primary' : 'bg-line')}
    >
      <span className={cx('absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  );
}

/** A row with a label/hint on the left and a switch on the right. */
export function SwitchRow({ title, subtitle, checked, onChange, leading }: { title: string; subtitle?: string; checked: boolean; onChange: (v: boolean) => void; leading?: ReactNode }) {
  return <Row leading={leading} title={title} subtitle={subtitle} trailing={<Switch checked={checked} onChange={onChange} label={title} />} />;
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({ options, value, onChange, label, className, tone = 'default' }: { options: SegmentedOption<T>[]; value: T; onChange: (value: T) => void; label: string; className?: string; tone?: 'default' | 'hero' }) {
  return (
    <div role="tablist" aria-label={label} className={cx('flex rounded-xl p-1', tone === 'hero' ? 'bg-black/15' : 'bg-surface-2', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              haptic('light');
              onChange(option.value);
            }}
            className={cx(
              'h-9 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors',
              tone === 'hero'
                ? active
                  ? 'bg-white text-black/85 shadow-sm dark:bg-surface dark:text-fg'
                  : 'text-hero-fg/85'
                : active
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-muted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField({ label, hint, error, className, ...rest }, ref) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <input
        ref={ref}
        id={id}
        className={cx(
          'h-12 w-full rounded-xl border bg-surface px-3.5 text-fg outline-none placeholder:text-faint focus:border-primary',
          error ? 'border-danger' : 'border-line',
        )}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {(error || hint) && <span className={cx('mt-1.5 block text-[0.8rem]', error ? 'text-danger' : 'text-muted')}>{error || hint}</span>}
    </label>
  );
});

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic('light');
        onClick?.();
      }}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-8" aria-hidden />
      </span>
      <p className="text-base font-semibold text-fg">{title}</p>
      {hint && <p className="mt-1.5 max-w-xs text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-hidden />;
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'primary' | 'warning' | 'danger' | 'success' }) {
  const tones = {
    default: 'bg-surface-2 text-muted',
    primary: 'bg-primary-soft text-primary',
    warning: 'bg-warning/18 text-fg',
    danger: 'bg-critical/14 text-critical',
    success: 'bg-income/14 text-income',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold', tones[tone])}>{children}</span>;
}
