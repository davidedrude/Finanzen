import { todayISO } from '../domain/dates';
import { advanceNextDue, dueOccurrences } from '../domain/recurring';
import { db } from './db';

/**
 * Legt alle fälligen wiederkehrenden Buchungen an. Ohne Server läuft das beim
 * App-Start und wenn die App wieder sichtbar wird; verpasste Termine werden nachgeholt.
 * Gibt die Anzahl neu angelegter Buchungen zurück.
 */
export async function runDueRecurring(today = todayISO()): Promise<number> {
  return db.transaction('rw', db.recurring, db.transactions, async () => {
    let created = 0;
    const due = await db.recurring.where('nextDue').belowOrEqual(today).toArray();
    for (const rec of due) {
      const dates = dueOccurrences(rec, today);
      if (dates.length === 0) continue;
      const existing = new Set(
        (await db.transactions.where('recurringId').equals(rec.id!).toArray()).map((t) => t.date),
      );
      const now = Date.now();
      const toAdd = dates
        .filter((d) => !existing.has(d))
        .map((date, i) => ({
          type: rec.type,
          amount: rec.amount,
          date,
          categoryId: rec.type === 'transfer' ? undefined : rec.categoryId,
          accountId: rec.accountId,
          toAccountId: rec.type === 'transfer' ? rec.toAccountId : undefined,
          note: rec.note,
          recurringId: rec.id,
          createdAt: now + i,
        }));
      await db.transactions.bulkAdd(toAdd);
      created += toAdd.length;
      await db.recurring.update(rec.id!, { nextDue: advanceNextDue(rec, dates) });
    }
    return created;
  });
}
