import Dexie, { type Table } from 'dexie';
import type { Account, Budget, Category, Goal, Meta, Recurring, Transaction } from '../domain/types';
import { defaultCategories } from './seed';

export class FinanzDB extends Dexie {
  accounts!: Table<Account, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  recurring!: Table<Recurring, number>;
  budgets!: Table<Budget, number>;
  goals!: Table<Goal, number>;
  meta!: Table<Meta, string>;

  constructor(name = 'finanzen') {
    super(name);
    this.version(1).stores({
      accounts: '++id, order',
      categories: '++id, kind, lastUsedAt',
      transactions: '++id, date, type, accountId, toAccountId, categoryId, recurringId, importHash',
      recurring: '++id, nextDue',
      budgets: '++id, &categoryId',
      goals: '++id',
      meta: 'key',
    });
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(defaultCategories());
    });
  }
}

export const db = new FinanzDB();

export const TABLES = ['accounts', 'categories', 'transactions', 'recurring', 'budgets', 'goals', 'meta'] as const;
export type TableName = (typeof TABLES)[number];

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
