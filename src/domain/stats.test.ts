import { describe, expect, it } from 'vitest';
import { change, expenseByCategory, monthlySeries, monthTotals } from './stats';
import type { Transaction } from './types';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  type: 'expense', amount: 0, date: '2026-09-10', accountId: 1, categoryId: 1, createdAt: n++, ...p,
});

describe('Auswertungen', () => {
  const txs = [
    tx({ type: 'income', amount: 300_000 }),
    tx({ amount: 100_000, categoryId: 1 }),
    tx({ amount: 50_000, categoryId: 2 }),
    tx({ type: 'transfer', amount: 70_000, toAccountId: 2 }),
    tx({ amount: 20_000, date: '2026-08-05' }),
  ];
  it('Sparquote ignoriert Umbuchungen', () => {
    const t = monthTotals(txs, '2026-09');
    expect(t.income).toBe(300_000);
    expect(t.expense).toBe(150_000);
    expect(t.savingsRate).toBe(0.5);
    expect(monthTotals(txs, '2026-08').savingsRate).toBeNull();
  });
  it('12-Monats-Serie', () => {
    const s = monthlySeries(txs, '2026-09', 12);
    expect(s).toHaveLength(12);
    expect(s[11].month).toBe('2026-09');
    expect(s[10].expense).toBe(20_000);
    expect(s[0].month).toBe('2025-10');
  });
  it('Kategorien mit "Weitere"', () => {
    const many = Array.from({ length: 8 }, (_, i) => tx({ amount: (8 - i) * 100, categoryId: i + 1 }));
    const slices = expenseByCategory(many, '2026-09', 6);
    expect(slices).toHaveLength(7);
    expect(slices[0].categoryId).toBe(1);
    expect(slices[6]).toMatchObject({ categoryId: null, amount: 300 });
  });
  it('Veränderung', () => {
    expect(change(110, 100)).toBeCloseTo(0.1);
    expect(change(5, 0)).toBeNull();
  });
});
