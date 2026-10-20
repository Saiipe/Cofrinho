import { ChartPie, FileBarChart, House, Plus, UserRound } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import { haptic } from '@/services/feedback';
import { useT } from './AppContext';
import { cx } from '../components/primitives';

export function BottomNav() {
  const t = useT();
  const navigate = useNavigate();
  const item = (to: string, Icon: typeof House, label: string) => (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={() => haptic('light')}
      className={({ isActive }) => cx('flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[0.7rem] font-medium', isActive ? 'text-primary' : 'text-faint')}
    >
      {({ isActive }) => (
        <>
          <Icon className="size-6" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur" aria-label="Menu">
      <div className="mx-auto flex max-w-lg items-stretch">
        {item('/', House, t('nav.home'))}
        {item('/charts', ChartPie, t('nav.charts'))}
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            aria-label={t('nav.add')}
            onClick={() => {
              haptic('medium');
              navigate('/tx/new');
            }}
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg shadow-primary/30 ring-4 ring-bg transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.6} aria-hidden />
          </button>
        </div>
        {item('/reports', FileBarChart, t('nav.reports'))}
        {item('/me', UserRound, t('nav.me'))}
      </div>
    </nav>
  );
}
