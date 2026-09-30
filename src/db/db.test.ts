import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { accountBalances } from '../domain/balance';
import { createBackup, restoreBackup, validateBackup } from './backup';
import { db } from './db';
import { runDueRecurring } from './recurringRunner';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Datenbank', () => {
  it('legt Standardkategorien an', async () => {
    expect(await db.categories.where('kind').equals('expense').count()).toBeGreaterThan(10);
    expect(await db.categories.where('kind').equals('income').count()).toBeGreaterThan(3);
  });

  it('wiederkehrende Buchungen: nachholen, idempotent, Saldo stimmt', async () => {
    const acc = await db.accounts.add({ name: 'Giro', type: 'giro', startBalance: 100_000, color: '#000', archived: false, order: 0 });
    await db.recurring.add({
      type: 'expense', amount: 80_000, accountId: acc, categoryId: 3, interval: 'monthly',
      startDate: '2026-07-01', nextDue: '2026-07-01', active: true, note: 'Miete',
    });
    expect(await runDueRecurring('2026-09-30')).toBe(3);
    expect(await runDueRecurring('2026-09-30')).toBe(0);
    const rec = await db.recurring.toCollection().first();
    expect(rec!.nextDue).toBe('2026-10-01');
    const txs = await db.transactions.toArray();
    expect(txs.map((t) => t.date).sort()).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
    const bal = accountBalances(await db.accounts.toArray(), txs);
    expect(bal.get(acc)).toBe(100_000 - 240_000);
  });

  it('Backup: Export → Validierung → Wiederherstellung', async () => {
    await db.accounts.add({ name: 'Giro', type: 'giro', startBalance: 1234, color: '#000', archived: false, order: 0 });
    await db.transactions.add({ type: 'expense', amount: 999, date: '2026-09-01', accountId: 1, createdAt: 1 });
    const backup = validateBackup(JSON.parse(JSON.stringify(await createBackup())));
    await db.transactions.clear();
    await db.accounts.clear();
    await restoreBackup(backup);
    expect(await db.transactions.count()).toBe(1);
    expect((await db.accounts.get(1))!.startBalance).toBe(1234);
  });

  it('Backup: lehnt fremde Dateien ab', () => {
    expect(() => validateBackup({ foo: 1 })).toThrow(/kein Finanzen-Backup/);
    expect(() => validateBackup({ format: 'finanzen-backup', version: 99, data: {} })).toThrow(/neueren/);
  });
});
