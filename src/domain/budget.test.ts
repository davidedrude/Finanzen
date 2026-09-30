import { describe, expect, it } from 'vitest';
import { budgetState, budgetSummary, spentByCategory } from './budget';
import type { Transaction } from './types';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  type: 'expense', amount: 0, date: '2026-09-10', accountId: 1, categoryId: 1, createdAt: n++, ...p,
});

describe('Budgets', () => {
  it('Schwellen: ok < 80 % ≤ warn ≤ 100 % < over', () => {
    expect(budgetState(7_999, 10_000)).toBe('ok');
    expect(budgetState(8_000, 10_000)).toBe('warn');
    expect(budgetState(10_000, 10_000)).toBe('warn');
    expect(budgetState(10_001, 10_000)).toBe('over');
    expect(budgetState(0, 0)).toBe('ok');
  });

  it('zählt nur Ausgaben des Monats', () => {
    const txs = [
      tx({ amount: 1_000 }),
      tx({ amount: 500, date: '2026-08-31' }),
      tx({ amount: 700, type: 'income' }),
      tx({ amount: 300, categoryId: 2 }),
      tx({ amount: 9_999, type: 'transfer', toAccountId: 2, categoryId: undefined }),
    ];
    const s = spentByCategory(txs, '2026-09');
    expect(s.get(1)).toBe(1_000);
    expect(s.get(2)).toBe(300);
  });

  it('Zusammenfassung, kritischste zuerst', () => {
    const txs = [tx({ amount: 9_000 }), tx({ amount: 1_000, categoryId: 2 }), tx({ amount: 6_000, categoryId: 3 })];
    const s = budgetSummary(
      [
        { categoryId: 1, monthlyLimit: 10_000 },
        { categoryId: 2, monthlyLimit: 20_000 },
        { categoryId: 3, monthlyLimit: 5_000 },
      ],
      txs,
      '2026-09',
    );
    expect(s.items.map((i) => i.categoryId)).toEqual([3, 1, 2]);
    expect(s.items[0].state).toBe('over');
    expect(s.items[0].remaining).toBe(-1_000);
    expect(s.totalLimit).toBe(35_000);
    expect(s.totalSpent).toBe(16_000);
    expect(s.totalRemaining).toBe(19_000);
    expect(s.warnCount).toBe(1);
    expect(s.overCount).toBe(1);
  });
});
