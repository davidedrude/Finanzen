import type { Account, Cents, ISODate, Transaction } from './types';

/** Wirkung einer Buchung auf ein bestimmtes Konto. */
export function txEffect(tx: Transaction, accountId: number): Cents {
  switch (tx.type) {
    case 'income':
      return tx.accountId === accountId ? tx.amount : 0;
    case 'expense':
      return tx.accountId === accountId ? -tx.amount : 0;
    case 'transfer': {
      let e = 0;
      if (tx.accountId === accountId) e -= tx.amount;
      if (tx.toAccountId === accountId) e += tx.amount;
      return e;
    }
  }
}

/**
 * Salden aller Konten = Startsaldo + Einnahmen − Ausgaben ± Umbuchungen.
 * Optional nur Buchungen bis einschließlich `upTo`.
 */
export function accountBalances(
  accounts: Account[],
  txs: Transaction[],
  upTo?: ISODate,
): Map<number, Cents> {
  const map = new Map<number, Cents>();
  for (const a of accounts) if (a.id != null) map.set(a.id, a.startBalance);
  for (const tx of txs) {
    if (upTo && tx.date > upTo) continue;
    if (tx.type === 'transfer') {
      if (map.has(tx.accountId)) map.set(tx.accountId, map.get(tx.accountId)! - tx.amount);
      if (tx.toAccountId != null && map.has(tx.toAccountId))
        map.set(tx.toAccountId, map.get(tx.toAccountId)! + tx.amount);
    } else if (map.has(tx.accountId)) {
      const sign = tx.type === 'income' ? 1 : -1;
      map.set(tx.accountId, map.get(tx.accountId)! + sign * tx.amount);
    }
  }
  return map;
}

/** Gesamtsaldo über alle (nicht archivierten) Konten. */
export function totalBalance(accounts: Account[], txs: Transaction[], upTo?: ISODate): Cents {
  const active = accounts.filter((a) => !a.archived);
  const balances = accountBalances(active, txs, upTo);
  let total = 0;
  for (const v of balances.values()) total += v;
  return total;
}

/** Vorzeichenbehafteter Betrag aus Sicht der Gesamtfinanzen (Umbuchung = 0). */
export function signedAmount(tx: Transaction): Cents {
  if (tx.type === 'income') return tx.amount;
  if (tx.type === 'expense') return -tx.amount;
  return 0;
}
