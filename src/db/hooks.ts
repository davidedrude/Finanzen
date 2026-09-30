import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { accountBalances } from '../domain/balance';
import type { Account, Budget, Category, Goal, Recurring, Transaction } from '../domain/types';
import { db, getMeta } from './db';

const EMPTY: never[] = [];

export function useAccounts(includeArchived = false): Account[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.accounts.orderBy('order').toArray();
    return includeArchived ? all : all.filter((a) => !a.archived);
  }, [includeArchived]);
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(() => db.categories.toArray());
}

export function useTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.toArray());
}

export function useRecurring(): Recurring[] | undefined {
  return useLiveQuery(() => db.recurring.toArray());
}

export function useBudgets(): Budget[] | undefined {
  return useLiveQuery(() => db.budgets.toArray());
}

export function useGoals(): Goal[] | undefined {
  return useLiveQuery(() => db.goals.toArray());
}

export function useMeta<T>(key: string): T | undefined | null {
  // null = geladen, aber nicht gesetzt
  return useLiveQuery(async () => (await getMeta<T>(key)) ?? null, [key]);
}

export function useCategoryMap(): Map<number, Category> {
  const cats = useCategories() ?? EMPTY;
  return useMemo(() => new Map(cats.map((c) => [c.id!, c])), [cats]);
}

export function useAccountMap(): Map<number, Account> {
  const accs = useLiveQuery(() => db.accounts.toArray()) ?? EMPTY;
  return useMemo(() => new Map(accs.map((a) => [a.id!, a])), [accs]);
}

/** Salden aller Konten (inkl. archivierter). */
export function useBalances(): Map<number, number> | undefined {
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const txs = useTransactions();
  return useMemo(
    () => (accounts && txs ? accountBalances(accounts, txs) : undefined),
    [accounts, txs],
  );
}
