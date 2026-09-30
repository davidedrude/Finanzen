import type { Budget, Cents, MonthKey, Transaction } from './types';

export const WARN_THRESHOLD = 0.8;

export type BudgetState = 'ok' | 'warn' | 'over';

export interface BudgetStatus {
  categoryId: number;
  limit: Cents;
  spent: Cents;
  remaining: Cents;
  /** Verbrauch als Anteil (0.5 = 50 %), kann > 1 sein. */
  ratio: number;
  state: BudgetState;
}

/** Ausgaben je Kategorie in einem Monat (nur Typ "expense"). */
export function spentByCategory(txs: Transaction[], month: MonthKey): Map<number, Cents> {
  const map = new Map<number, Cents>();
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.categoryId == null) continue;
    if (!tx.date.startsWith(month)) continue;
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return map;
}

export function budgetState(spent: Cents, limit: Cents): BudgetState {
  if (limit <= 0) return spent > 0 ? 'over' : 'ok';
  if (spent > limit) return 'over';
  if (spent >= limit * WARN_THRESHOLD) return 'warn';
  return 'ok';
}

export function budgetStatus(budget: Budget, spent: Cents): BudgetStatus {
  const limit = budget.monthlyLimit;
  return {
    categoryId: budget.categoryId,
    limit,
    spent,
    remaining: limit - spent,
    ratio: limit > 0 ? spent / limit : spent > 0 ? Infinity : 0,
    state: budgetState(spent, limit),
  };
}

export interface BudgetSummary {
  items: BudgetStatus[];
  totalLimit: Cents;
  totalSpent: Cents;
  /** Verbleibend über alle Budgets; Überschreitungen einzelner Budgets zählen voll. */
  totalRemaining: Cents;
  warnCount: number;
  overCount: number;
}

/** Status aller Budgets für einen Monat, kritischste zuerst. */
export function budgetSummary(budgets: Budget[], txs: Transaction[], month: MonthKey): BudgetSummary {
  const spent = spentByCategory(txs, month);
  const items = budgets
    .map((b) => budgetStatus(b, spent.get(b.categoryId) ?? 0))
    .sort((a, b) => b.ratio - a.ratio);
  let totalLimit = 0;
  let totalSpent = 0;
  for (const i of items) {
    totalLimit += i.limit;
    totalSpent += i.spent;
  }
  return {
    items,
    totalLimit,
    totalSpent,
    totalRemaining: totalLimit - totalSpent,
    warnCount: items.filter((i) => i.state === 'warn').length,
    overCount: items.filter((i) => i.state === 'over').length,
  };
}
