import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { db } from '@/data/db';
import { buildRateTable, lookupRate, type RateTable } from '@/data/rates';
import type { Account, Book, Category, CategoryKind, ID, Member } from '@/domain/types';
import { categoryLabel } from '@/i18n/labels';
import { useApp } from './AppContext';

interface BookContextValue {
  book: Book;
  books: Book[];
  isSplit: boolean;
  categories: Category[];
  categoryMap: Map<ID, Category>;
  accounts: Account[];
  accountMap: Map<ID, Account>;
  members: Member[];
  memberMap: Map<ID, Member>;
  me: Member | undefined;
  rates: RateTable;
  rate: (from: string, to: string) => number | null;
  categoryName: (category: Category | ID | null | undefined) => string;
  /** Top-level categories of a kind, in display order. */
  topCategories: (kind: CategoryKind) => Category[];
  childrenOf: (parentId: ID) => Category[];
  defaultAccount: Account | undefined;
}

const BookContext = createContext<BookContextValue | null>(null);

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export function BookProvider({ children, fallback }: { children: ReactNode; fallback: (state: 'loading' | 'empty') => ReactNode }) {
  const { settings, t } = useApp();
  const books = useLiveQuery(() => db.books.orderBy('order').toArray(), []);
  const book = books?.find((b) => b.id === settings.currentBookId) ?? books?.[0];
  const bookId = book?.id ?? '';
  const categories = useLiveQuery(() => db.categories.where('bookId').equals(bookId).toArray(), [bookId]);
  const accounts = useLiveQuery(() => db.accounts.where('bookId').equals(bookId).toArray(), [bookId]);
  const members = useLiveQuery(() => db.members.where('bookId').equals(bookId).toArray(), [bookId]);
  const market = useLiveQuery(() => db.rates.toArray(), []);
  const custom = useLiveQuery(() => db.customRates.toArray(), []);

  const value = useMemo<BookContextValue | null>(() => {
    if (!book || !books || !categories || !accounts || !members || !market || !custom) return null;
    const sortedCategories = [...categories].sort(byOrder);
    const sortedAccounts = [...accounts].sort(byOrder);
    const sortedMembers = [...members].sort(byOrder);
    const categoryMap = new Map(sortedCategories.map((c) => [c.id, c]));
    const rates = buildRateTable(market, custom);
    return {
      book,
      books,
      isSplit: book.type === 'split',
      categories: sortedCategories,
      categoryMap,
      accounts: sortedAccounts,
      accountMap: new Map(sortedAccounts.map((a) => [a.id, a])),
      members: sortedMembers,
      memberMap: new Map(sortedMembers.map((m) => [m.id, m])),
      me: sortedMembers.find((m) => m.isMe),
      rates,
      rate: (from, to) => lookupRate(rates, from, to),
      categoryName: (category) => {
        const resolved = typeof category === 'string' ? categoryMap.get(category) : (category ?? undefined);
        return categoryLabel(resolved, t);
      },
      topCategories: (kind) => sortedCategories.filter((c) => c.kind === kind && c.parentId === null),
      childrenOf: (parentId) => sortedCategories.filter((c) => c.parentId === parentId),
      defaultAccount: sortedAccounts.find((a) => a.isDefault),
    };
  }, [book, books, categories, accounts, members, market, custom, t]);

  if (books && books.length === 0) return <>{fallback('empty')}</>;
  if (!value) return <>{fallback('loading')}</>;
  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

export function useBook(): BookContextValue {
  const value = useContext(BookContext);
  if (!value) throw new Error('useBook outside BookProvider');
  return value;
}

/** For components that also render outside a book (onboarding). */
export function useOptionalBook(): BookContextValue | null {
  return useContext(BookContext);
}
