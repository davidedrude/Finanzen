import { lastMonths } from './dates';
import type { Cents, MonthKey, Transaction } from './types';

export interface MonthTotals {
  month: MonthKey;
  income: Cents;
  expense: Cents;
  net: Cents;
  /** (Einnahmen − Ausgaben) / Einnahmen; null ohne Einnahmen. */
  savingsRate: number | null;
}

export function savingsRate(income: Cents, expense: Cents): number | null {
  if (income <= 0) return null;
  return (income - expense) / income;
}

/** Summen eines Monats. Umbuchungen zählen weder als Einnahme noch als Ausgabe. */
export function monthTotals(txs: Transaction[], month: MonthKey): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (!tx.date.startsWith(month)) continue;
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') expense += tx.amount;
  }
  return { month, income, expense, net: income - expense, savingsRate: savingsRate(income, expense) };
}

/** Summen für die letzten n Monate bis `end` (aufsteigend) in einem Durchlauf. */
export function monthlySeries(txs: Transaction[], end: MonthKey, n = 12): MonthTotals[] {
  const months = lastMonths(end, n);
  const acc = new Map(months.map((m) => [m, { income: 0, expense: 0 }]));
  for (const tx of txs) {
    const a = acc.get(tx.date.slice(0, 7));
    if (!a) continue;
    if (tx.type === 'income') a.income += tx.amount;
    else if (tx.type === 'expense') a.expense += tx.amount;
  }
  return months.map((month) => {
    const { income, expense } = acc.get(month)!;
    return { month, income, expense, net: income - expense, savingsRate: savingsRate(income, expense) };
  });
}

export interface CategorySlice {
  /** null = zusammengefasste "Weitere". */
  categoryId: number | null;
  amount: Cents;
  share: number;
}

/**
 * Ausgaben je Kategorie, absteigend. Ab `maxSlices` werden die kleinsten
 * zu "Weitere" zusammengefasst, damit das Diagramm lesbar bleibt.
 */
export function expenseByCategory(txs: Transaction[], month: MonthKey, maxSlices = 6): CategorySlice[] {
  const map = new Map<number, Cents>();
  let total = 0;
  for (const tx of txs) {
    if (tx.type !== 'expense' || !tx.date.startsWith(month)) continue;
    const id = tx.categoryId ?? -1;
    map.set(id, (map.get(id) ?? 0) + tx.amount);
    total += tx.amount;
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const slices: CategorySlice[] = [];
  let rest = 0;
  sorted.forEach(([id, amount], i) => {
    if (i < maxSlices || sorted.length === maxSlices + 1) {
      slices.push({ categoryId: id === -1 ? null : id, amount, share: total ? amount / total : 0 });
    } else rest += amount;
  });
  if (rest > 0) slices.push({ categoryId: null, amount: rest, share: rest / total });
  return slices;
}

/** Relative Veränderung (0.12 = +12 %); null wenn Vergleichswert 0. */
export function change(current: Cents, previous: Cents): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}
