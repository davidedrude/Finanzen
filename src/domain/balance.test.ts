import { describe, expect, it } from 'vitest';
import { accountBalances, totalBalance } from './balance';
import type { Account, Transaction } from './types';

const acc = (id: number, start: number, archived = false): Account => ({
  id, name: `K${id}`, type: 'giro', startBalance: start, color: '#000', archived, order: id,
});
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  type: 'expense', amount: 0, date: '2026-09-01', accountId: 1, createdAt: n++, ...p,
});

describe('Salden', () => {
  const accounts = [acc(1, 100_000), acc(2, 5_000), acc(3, 0)];
  const txs = [
    tx({ type: 'income', amount: 250_000, accountId: 1, date: '2026-09-01' }),
    tx({ type: 'expense', amount: 1_999, accountId: 1, date: '2026-09-02' }),
    tx({ type: 'expense', amount: 450, accountId: 2, date: '2026-09-03' }),
    tx({ type: 'transfer', amount: 50_000, accountId: 1, toAccountId: 3, date: '2026-09-05' }),
  ];

  it('Startsaldo + Einnahmen − Ausgaben ± Umbuchungen', () => {
    const b = accountBalances(accounts, txs);
    expect(b.get(1)).toBe(100_000 + 250_000 - 1_999 - 50_000);
    expect(b.get(2)).toBe(4_550);
    expect(b.get(3)).toBe(50_000);
  });

  it('Umbuchungen verändern den Gesamtsaldo nicht', () => {
    const without = totalBalance(accounts, txs.slice(0, 3));
    expect(totalBalance(accounts, txs)).toBe(without);
    expect(without).toBe(105_000 + 250_000 - 1_999 - 450);
  });

  it('Stichtag', () => {
    expect(accountBalances(accounts, txs, '2026-09-01').get(1)).toBe(350_000);
  });

  it('archivierte Konten zählen nicht zum Gesamtsaldo', () => {
    expect(totalBalance([acc(1, 100), acc(2, 999, true)], [])).toBe(100);
  });

  it('viele Cent-Beträge ohne Rundungsfehler', () => {
    const many = Array.from({ length: 1000 }, () => tx({ type: 'expense', amount: 10, accountId: 3 }));
    expect(accountBalances([acc(3, 0)], many).get(3)).toBe(-10_000);
  });
});
