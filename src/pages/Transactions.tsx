import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { useTxSheet } from '../components/txContext';
import { TxRow } from '../components/TxRow';
import { EmptyState, MonthSwitcher, PageHeader } from '../components/ui';
import { db } from '../db/db';
import { useAccountMap, useCategoryMap, useTransactions } from '../db/hooks';
import { signedAmount } from '../domain/balance';
import { addMonthsToKey, currentMonth, formatDayHeading, monthLabel } from '../domain/dates';
import { formatSigned } from '../domain/money';
import type { Transaction, TxType } from '../domain/types';

export function TransactionsPage() {
  const txs = useTransactions();
  const cats = useCategoryMap();
  const accounts = useAccountMap();
  const openTx = useTxSheet();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TxType | 'all'>('all');
  const [accountFilter, setAccountFilter] = useState<number | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');

  const filtered = useMemo(() => {
    if (!txs) return [];
    const q = query.trim().toLowerCase();
    return txs
      .filter((t) => {
        // Bei einer Suche über alle Monate suchen
        if (!q && !t.date.startsWith(month)) return false;
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (accountFilter !== 'all' && t.accountId !== accountFilter && t.toAccountId !== accountFilter) return false;
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
        if (q) {
          const hay = `${t.note ?? ''} ${cats.get(t.categoryId!)?.name ?? ''} ${(t.amount / 100).toFixed(2).replace('.', ',')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  }, [txs, month, query, typeFilter, accountFilter, categoryFilter, cats]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!txs) return null;

  const remove = async (tx: Transaction) => {
    await db.transactions.delete(tx.id!);
    toast('Buchung gelöscht', { label: 'Rückgängig', run: () => void db.transactions.add(tx) });
  };

  const hasFilter = typeFilter !== 'all' || accountFilter !== 'all' || categoryFilter !== 'all';
  const catList = [...cats.values()].filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return (
    <div className="page">
      <PageHeader title="Buchungen" />

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span className="faint" style={{ position: 'absolute', left: 14, top: 14 }}>
          <Icon name="search" size={20} />
        </span>
        <input
          className="input"
          type="search"
          placeholder="Suchen (Notiz, Kategorie, Betrag)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ paddingLeft: 44 }}
          aria-label="Buchungen durchsuchen"
        />
      </div>

      <div className="chips" style={{ marginBottom: 8 }}>
        <label className="chip" aria-pressed={typeFilter !== 'all'}>
          {typeFilter === 'all' ? 'Alle Arten' : typeFilter === 'income' ? 'Einnahmen' : typeFilter === 'expense' ? 'Ausgaben' : 'Umbuchungen'}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TxType | 'all')} aria-label="Art filtern">
            <option value="all">Alle Arten</option>
            <option value="expense">Ausgaben</option>
            <option value="income">Einnahmen</option>
            <option value="transfer">Umbuchungen</option>
          </select>
        </label>
        <label className="chip" aria-pressed={accountFilter !== 'all'}>
          {accountFilter === 'all' ? 'Alle Konten' : accounts.get(accountFilter)?.name}
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            aria-label="Konto filtern"
          >
            <option value="all">Alle Konten</option>
            {[...accounts.values()].map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="chip" aria-pressed={categoryFilter !== 'all'}>
          {categoryFilter === 'all' ? 'Alle Kategorien' : `${cats.get(categoryFilter)?.emoji} ${cats.get(categoryFilter)?.name}`}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            aria-label="Kategorie filtern"
          >
            <option value="all">Alle Kategorien</option>
            {catList.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
        </label>
        {hasFilter && (
          <button className="chip" onClick={() => { setTypeFilter('all'); setAccountFilter('all'); setCategoryFilter('all'); }}>
            <Icon name="close" size={14} /> Zurücksetzen
          </button>
        )}
      </div>

      {!query && (
        <MonthSwitcher
          label={monthLabel(month)}
          onPrev={() => setMonth((m) => addMonthsToKey(m, -1))}
          onNext={() => setMonth((m) => addMonthsToKey(m, 1))}
          nextDisabled={month >= currentMonth()}
        />
      )}

      {txs.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title="Noch keine Buchungen"
          text="Erfasse Ausgaben mit dem + Button oder importiere einen Kontoauszug unter „Mehr“."
          action={<button className="btn primary" onClick={() => openTx()}>Buchung erfassen</button>}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title={query || hasFilter ? 'Nichts gefunden' : 'Keine Buchungen in diesem Monat'}
          text={query || hasFilter ? 'Probiere einen anderen Suchbegriff oder Filter.' : 'Wechsle den Monat oder erfasse eine neue Buchung.'}
        />
      ) : (
        groups.map(([date, items]) => {
          const daySum = items.reduce((s, t) => s + signedAmount(t), 0);
          return (
            <section key={date}>
              <div className="day-head">
                <span>{formatDayHeading(date)}</span>
                {daySum !== 0 && <span className="num">{formatSigned(daySum)}</span>}
              </div>
              <div className="list">
                {items.map((t) => (
                  <Swipe key={t.id} onDelete={() => remove(t)}>
                    <TxRow tx={t} category={cats.get(t.categoryId!)} accounts={accounts} onClick={() => openTx(t)} />
                  </Swipe>
                ))}
              </div>
            </section>
          );
        })
      )}
      {query && filtered.length > 0 && (
        <p className="hint" style={{ textAlign: 'center', marginTop: 16 }}>{filtered.length} Treffer in allen Monaten</p>
      )}
    </div>
  );
}

/** Nach links wischen zum Löschen (mit Rückgängig im Toast). */
function Swipe({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  const swiped = useRef(false);
  const TRIGGER = 110;

  return (
    <div
      className="swipe"
      onPointerDown={(e) => {
        swiped.current = false;
        if (e.pointerType === 'mouse') return;
        start.current = { x: e.clientX, y: e.clientY, locked: null };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (s.locked == null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.locked = Math.abs(mx) > Math.abs(my);
        if (s.locked) setDx(Math.min(0, mx));
      }}
      onPointerUp={() => {
        if (start.current?.locked) swiped.current = true;
        if (dx < -TRIGGER) onDelete();
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
      onClickCapture={(e) => {
        // Nach einem Wischen keinen Klick auslösen
        if (swiped.current) e.stopPropagation();
      }}
    >
      {dx < 0 && (
        <div className="swipe-bg" aria-hidden="true">
          <Icon name="trash" size={20} />
        </div>
      )}
      <div style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? 'transform .2s' : 'none' }}>{children}</div>
    </div>
  );
}
