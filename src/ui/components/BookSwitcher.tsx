import { Check, Settings2 } from 'lucide-react';
import { Link } from 'react-router';
import { setCurrentBook } from '@/data/books';
import { bookTypeLabel } from '@/i18n/labels';
import { useT } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { EntityIcon } from './EntityIcon';
import { useFeedback } from './feedback';
import { Sheet } from './Sheet';

export const BOOK_ICONS = { personal: 'wallet', business: 'store', project: 'briefcase', split: 'hand-coins' } as const;

export function BookSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { book, books } = useBook();
  const { toast } = useFeedback();
  return (
    <Sheet open={open} onClose={onClose} title={t('home.switchBook')}>
      <div className="pb-3">
        {books.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={async () => {
              if (b.id !== book.id) {
                await setCurrentBook(b.id);
                toast(t('books.switched', { name: b.name }));
              }
              onClose();
            }}
            className="flex min-h-15 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2"
          >
            <EntityIcon icon={BOOK_ICONS[b.type]} color={b.color} mono={false} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{b.name}</span>
              <span className="block text-xs text-muted">
                {bookTypeLabel(b.type, t)} · {b.currency}
              </span>
            </span>
            {b.id === book.id && <Check className="size-5 text-primary" aria-label={t('books.current')} />}
          </button>
        ))}
        <Link to="/books" onClick={onClose} className="mx-4 mt-2 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary active:bg-primary-soft">
          <Settings2 className="size-4" aria-hidden />
          {t('me.books')}
        </Link>
      </div>
    </Sheet>
  );
}
