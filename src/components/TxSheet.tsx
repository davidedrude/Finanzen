import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import { useAccounts, useCategories } from '../db/hooks';
import { formatDateChip, todayISO } from '../domain/dates';
import { formatCents } from '../domain/money';
import type { Transaction, TxType } from '../domain/types';
import { Icon } from './Icon';
import { useToast } from './toast';
import { CategoryBubble, Segmented, Sheet } from './ui';

const LAST_ACCOUNT = 'finanzen.lastAccount';
const MAX_DIGITS = 9;

function readLastAccount(): number | null {
  try {
    const v = localStorage.getItem(LAST_ACCOUNT);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
function writeLastAccount(id: number) {
  try {
    localStorage.setItem(LAST_ACCOUNT, String(id));
  } catch {
    /* egal */
  }
}

/**
 * Schnelleingabe & Bearbeiten. Neu: Betrag tippen → Kategorie antippen = gespeichert.
 * Bearbeiten: Kategorie wählen, dann "Speichern".
 */
export function TxSheet({ initial, onClose }: { initial?: Transaction; onClose: () => void }) {
  const editing = initial?.id != null;
  const accounts = useAccounts();
  const categories = useCategories();
  const toast = useToast();

  const [type, setType] = useState<TxType>(initial?.type ?? 'expense');
  const [digits, setDigits] = useState(initial ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [accountId, setAccountId] = useState<number | undefined>(initial?.accountId);
  const [toAccountId, setToAccountId] = useState<number | undefined>(initial?.toAccountId);
  const [categoryId, setCategoryId] = useState<number | undefined>(initial?.categoryId);
  const [note, setNote] = useState(initial?.note ?? '');
  const [showNote, setShowNote] = useState(!!initial?.note);
  const [showAll, setShowAll] = useState(false);
  const [shake, setShake] = useState(0);

  // Standardkonto: zuletzt genutztes, sonst erstes
  useEffect(() => {
    if (!accounts?.length || accountId != null) return;
    const last = readLastAccount();
    setAccountId(accounts.find((a) => a.id === last)?.id ?? accounts[0].id);
  }, [accounts, accountId]);
  useEffect(() => {
    if (type !== 'transfer' || !accounts || toAccountId != null) return;
    setToAccountId(accounts.find((a) => a.id !== accountId)?.id);
  }, [type, accounts, accountId, toAccountId]);

  const amount = Number(digits || '0');

  const pressDigit = (d: string) =>
    setDigits((cur) => {
      const next = (cur + d).replace(/^0+/, '');
      return next.length > MAX_DIGITS ? cur : next;
    });
  const backspace = () => setDigits((cur) => cur.slice(0, -1));

  // Physische Tastatur (Desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (/^\d$/.test(e.key)) pressDigit(e.key);
      else if (e.key === 'Backspace') backspace();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const kind = type === 'income' ? 'income' : 'expense';
  const sortedCats = useMemo(
    () =>
      (categories ?? [])
        .filter((c) => c.kind === kind && (!c.archived || c.id === categoryId))
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt || a.order - b.order),
    [categories, kind, categoryId],
  );
  const visibleCats = showAll ? sortedCats : sortedCats.slice(0, 8);

  async function save(catId = categoryId) {
    if (amount <= 0) {
      setShake((s) => s + 1);
      return;
    }
    if (accountId == null) return;
    if (type === 'transfer' && (toAccountId == null || toAccountId === accountId)) {
      toast('Bitte ein anderes Zielkonto wählen.');
      return;
    }
    if (type !== 'transfer' && catId == null) {
      toast('Bitte eine Kategorie wählen.');
      return;
    }
    const tx: Transaction = {
      ...(initial ?? {}),
      type,
      amount,
      date,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : catId,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    const id = await db.transactions.put(tx);
    if (catId != null && type !== 'transfer') await db.categories.update(catId, { lastUsedAt: Date.now() });
    writeLastAccount(accountId);
    onClose();
    if (editing) toast('Änderung gespeichert');
    else toast(`${formatCents(amount)} gespeichert`, { label: 'Rückgängig', run: () => db.transactions.delete(id) });
  }

  async function remove() {
    if (!initial?.id) return;
    const copy = { ...initial };
    await db.transactions.delete(initial.id);
    onClose();
    toast('Buchung gelöscht', { label: 'Rückgängig', run: () => void db.transactions.add(copy) });
  }

  const noAccounts = accounts && accounts.length === 0;
  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : '';

  return (
    <Sheet title={editing ? 'Buchung bearbeiten' : 'Neue Buchung'} onClose={onClose}>
      {noAccounts ? (
        <p className="muted">Lege zuerst unter „Mehr → Konten“ ein Konto an.</p>
      ) : (
        <>
          <Segmented
            label="Art der Buchung"
            value={type}
            onChange={(t) => {
              setType(t);
              setCategoryId(undefined);
              setShowAll(false);
            }}
            options={[
              { value: 'expense', label: 'Ausgabe', icon: 'up' },
              { value: 'income', label: 'Einnahme', icon: 'down' },
              { value: 'transfer', label: 'Umbuchung', icon: 'swap' },
            ]}
          />

          <div
            key={shake}
            className={`qa-amount${amount === 0 ? ' zero' : ''}${shake ? ' shake' : ''}`}
            aria-live="polite"
            style={type === 'income' && amount ? { color: 'var(--income)' } : undefined}
          >
            {amount ? sign : ''}
            {formatCents(amount)}
          </div>

          <div className="chips" style={{ marginBottom: 12 }}>
            <label className="chip">
              <Icon name="calendar" size={16} />
              {formatDateChip(date)}
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label="Datum"
              />
            </label>
            <label className="chip">
              <Icon name="wallet" size={16} />
              {accounts?.find((a) => a.id === accountId)?.name ?? 'Konto'}
              <select
                value={accountId ?? ''}
                onChange={(e) => setAccountId(Number(e.target.value))}
                aria-label={type === 'transfer' ? 'Von Konto' : 'Konto'}
              >
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="chip" aria-pressed={showNote} onClick={() => setShowNote((s) => !s)}>
              <Icon name="note" size={16} />
              {note ? note.slice(0, 16) + (note.length > 16 ? '…' : '') : 'Notiz'}
            </button>
          </div>

          {showNote && (
            <input
              className="input"
              placeholder="Notiz (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ marginBottom: 12 }}
              autoFocus={!initial?.note}
              maxLength={200}
            />
          )}

          {type === 'transfer' ? (
            <div className="stack" style={{ gap: 12 }}>
              <label className="field">
                <span>Auf Konto</span>
                <select
                  className="select"
                  value={toAccountId ?? ''}
                  onChange={(e) => setToAccountId(Number(e.target.value))}
                >
                  {accounts?.filter((a) => a.id !== accountId).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              {accounts && accounts.length < 2 && (
                <p className="hint">Für Umbuchungen brauchst du mindestens zwei Konten.</p>
              )}
            </div>
          ) : (
            <>
              <div className="cat-grid" role="group" aria-label="Kategorie">
                {visibleCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cat-btn"
                    aria-pressed={editing && categoryId === c.id}
                    onClick={() => {
                      setCategoryId(c.id);
                      if (!editing) void save(c.id);
                    }}
                  >
                    <CategoryBubble emoji={c.emoji} color={c.color} round />
                    <span className="label">{c.name}</span>
                  </button>
                ))}
              </div>
              {sortedCats.length > 8 && (
                <button type="button" className="btn ghost small block" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? 'Weniger anzeigen' : `Alle ${sortedCats.length} Kategorien`}
                </button>
              )}
            </>
          )}

          <div className="numpad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((d) => (
              <button key={d} type="button" onClick={() => pressDigit(d)}>{d}</button>
            ))}
            <button type="button" onClick={backspace} aria-label="Löschen">
              <Icon name="backspace" size={24} stroke={1.8} />
            </button>
          </div>

          {(editing || type === 'transfer') && (
            <div className="stack" style={{ gap: 8, marginTop: 14 }}>
              <button className="btn primary block" onClick={() => save()}>
                {editing ? 'Speichern' : 'Umbuchung speichern'}
              </button>
              {editing && (
                <button className="btn danger block" onClick={remove}>
                  <Icon name="trash" size={18} /> Löschen
                </button>
              )}
            </div>
          )}
          {!editing && type !== 'transfer' && (
            <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>
              Betrag eingeben, dann Kategorie antippen – fertig.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
