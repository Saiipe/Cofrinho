import { ChevronRight, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { reorderBooks, setCurrentBook } from '@/data/books';
import { bookTypeLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { BOOK_ICONS } from '../components/BookSwitcher';
import { EntityIcon } from '../components/EntityIcon';
import { useFeedback } from '../components/feedback';
import { SortableList } from '../components/gestures';
import { Page } from '../components/Page';
import { Badge, Button, Card, IconButton } from '../components/primitives';

export default function BooksScreen() {
  const { t } = useApp();
  const { book: current, books } = useBook();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  return (
    <Page title={t('books.title')} back="/me" actions={<IconButton icon={Plus} label={t('books.new')} onClick={() => navigate('/books/new')} />}>
      <div className="space-y-3 px-4">
        <Card className="overflow-hidden">
          <SortableList
            items={books}
            onReorder={(ids) => void reorderBooks(ids)}
            renderItem={(book, handle) => (
              <div className="flex items-center border-b border-line pr-1">
                <Link to={`/books/${book.id}/edit`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:bg-surface-2">
                  <EntityIcon icon={BOOK_ICONS[book.type]} color={book.color} mono={false} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{book.name}</span>
                      {book.id === current.id && <Badge tone="primary">{t('books.current')}</Badge>}
                    </span>
                    <span className="block text-xs text-muted">
                      {bookTypeLabel(book.type, t)} · {book.currency}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-faint" aria-hidden />
                </Link>
                {book.id !== current.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await setCurrentBook(book.id);
                      toast(t('books.switched', { name: book.name }));
                      navigate('/');
                    }}
                  >
                    {t('common.select')}
                  </Button>
                )}
                {handle}
              </div>
            )}
          />
        </Card>
        <p className="px-1 text-xs text-muted">{t('common.dragToSort')}</p>
      </div>
    </Page>
  );
}
