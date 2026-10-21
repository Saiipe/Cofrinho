import Dexie, { type EntityTable } from 'dexie';
import type {
  Account,
  Book,
  Budget,
  Category,
  CustomRate,
  Goal,
  Member,
  NoteSuggestion,
  Photo,
  RateRow,
  Reminder,
  Schedule,
  Tag,
  Transaction,
} from '@/domain/types';

/** Small key/value records: settings, lock config, garden state. */
export interface KvRow {
  key: string;
  value: unknown;
}

export class AppDatabase extends Dexie {
  books!: EntityTable<Book, 'id'>;
  members!: EntityTable<Member, 'id'>;
  accounts!: EntityTable<Account, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  schedules!: EntityTable<Schedule, 'id'>;
  reminders!: EntityTable<Reminder, 'id'>;
  notes!: EntityTable<NoteSuggestion, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  rates!: EntityTable<RateRow, 'code'>;
  customRates!: EntityTable<CustomRate, 'id'>;
  kv!: EntityTable<KvRow, 'key'>;
  tags!: EntityTable<Tag, 'id'>;
  goals!: EntityTable<Goal, 'id'>;

  constructor(name = 'cofrinho') {
    super(name);
    this.version(1).stores({
      books: 'id, order',
      members: 'id, bookId',
      accounts: 'id, bookId',
      categories: 'id, bookId, parentId',
      transactions: 'id, bookId, [bookId+date], categoryId, accountId, toAccountId, scheduleId, createdAt',
      budgets: 'id, bookId',
      schedules: 'id, bookId',
      reminders: 'id',
      notes: 'id, bookId',
      photos: 'id',
      rates: 'code',
      customRates: 'id',
      kv: 'key',
    });
    // 2.0: tags on records; 4.0: savings goals. Existing rows need no migration (new fields are optional).
    this.version(2).stores({
      transactions: 'id, bookId, [bookId+date], categoryId, accountId, toAccountId, scheduleId, createdAt, *tagIds',
      tags: 'id, bookId',
      goals: 'id, bookId',
    });
  }
}

export const db = new AppDatabase();

/** Tables that belong to a single book and are wiped with it. */
export const BOOK_TABLES = ['members', 'accounts', 'categories', 'transactions', 'budgets', 'schedules', 'notes', 'tags', 'goals'] as const;

export function newId(): string {
  return crypto.randomUUID();
}
