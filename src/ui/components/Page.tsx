import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../app/AppContext';
import { cx, IconButton } from './primitives';

export function useGoBack(fallback = '/') {
  const navigate = useNavigate();
  return () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}

export interface TopBarProps {
  title?: ReactNode;
  /** Shows a back arrow; `string` sets where to go when there is no history. */
  back?: boolean | string;
  actions?: ReactNode;
  className?: string;
}

export function TopBar({ title, back, actions, className }: TopBarProps) {
  const t = useT();
  const goBack = useGoBack(typeof back === 'string' ? back : '/');
  return (
    <header className={cx('sticky top-0 z-30 border-b border-line/70 bg-surface/95 pt-safe backdrop-blur', className)}>
      <div className="flex h-14 items-center gap-1 px-2">
        {back ? <IconButton icon={ArrowLeft} label={t('common.back')} onClick={goBack} /> : <span className="w-2" />}
        <h1 className="min-w-0 flex-1 truncate px-1 text-[1.1rem] font-semibold">{title}</h1>
        {actions && <div className="flex items-center">{actions}</div>}
      </div>
    </header>
  );
}

export interface PageProps extends TopBarProps {
  children: ReactNode;
  /** Sticky area under the content (primary actions). */
  footer?: ReactNode;
  /** Leaves room for the bottom tab bar. */
  withTabs?: boolean;
  contentClassName?: string;
}

export function Page({ children, footer, withTabs, contentClassName, ...bar }: PageProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <TopBar {...bar} />
      <main className={cx('flex-1 pt-3.5', withTabs ? 'pb-28' : footer ? 'pb-4' : 'pb-10', contentClassName)}>{children}</main>
      {footer && <div className="sticky bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">{footer}</div>}
    </div>
  );
}
