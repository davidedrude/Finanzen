import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { Amount, AmountInput, CategoryBubble, EmptyState, Field, PageHeader, Segmented, Sheet } from '../components/ui';
import { db } from '../db/db';
import { runDueRecurring } from '../db/recurringRunner';
import { useAccountMap, useAccounts, useCategories, useCategoryMap, useRecurring } from '../db/hooks';
import { formatDate, todayISO } from '../domain/dates';
import { formatCents } from '../domain/money';
import { intervalLabel, isFinished } from '../domain/recurring';
import type { Cents, Interval, Recurring, TxType } from '../domain/types';

/** Monatliche Belastung (grob normalisiert) für die Summenzeile. */
function perMonth(r: Recurring): Cents {
  const f = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[r.interval];
  return Math.round(r.amount * f);
}

export function RecurringPage() {
  const items = useRecurring();
  const cats = useCategoryMap();
  const accounts = useAccountMap();
  const [editing, setEditing] = useState<Recurring | null>(null);
  if (!items) return null;

  const first = [...accounts.values()].find((a) => !a.archived);
  const blank: Recurring = {
    type: 'expense', amount: 0, accountId: first?.id ?? 0, interval: 'monthly',
    startDate: todayISO(), nextDue: todayISO(), active: true,
  };
  const sorted = [...items].sort((a, b) => Number(isFinished(a)) - Number(isFinished(b)) || a.nextDue.localeCompare(b.nextDue));
  const active = items.filter((r) => r.active && !isFinished(r));
  const monthlyOut = active.filter((r) => r.type === 'expense').reduce((s, r) => s + perMonth(r), 0);
  const monthlyIn = active.filter((r) => r.type === 'income').reduce((s, r) => s + perMonth(r), 0);

  return (
    <div className="page stack">
      <PageHeader
        title="Wiederkehrend"
        back
        action={<button className="icon-btn" onClick={() => setEditing(blank)} aria-label="Hinzufügen"><Icon name="plus" /></button>}
      />
      {items.length === 0 ? (
        <EmptyState
          emoji="🔁"
          title="Keine wiederkehrenden Buchungen"
          text="Miete, Abos oder Gehalt einmal anlegen – die App bucht sie automatisch zum Fälligkeitsdatum, sobald du sie öffnest."
          action={<button className="btn primary" onClick={() => setEditing(blank)}>Anlegen</button>}
        />
      ) : (
        <>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div className="small muted">Fix pro Monat raus</div>
              <div className="num" style={{ fontWeight: 700 }}>−{formatCents(monthlyOut)}</div>
            </div>
            <div>
              <div className="small muted">Fix pro Monat rein</div>
              <div className="num" style={{ fontWeight: 700, color: 'var(--income)' }}>+{formatCents(monthlyIn)}</div>
            </div>
          </div>
          <div className="list">
            {sorted.map((r) => {
              const c = r.categoryId != null ? cats.get(r.categoryId) : undefined;
              const done = isFinished(r);
              const title = r.note || (r.type === 'transfer' ? 'Umbuchung' : c?.name ?? '–');
              return (
                <button key={r.id} className="list-item" onClick={() => setEditing(r)} style={!r.active || done ? { opacity: 0.55 } : undefined}>
                  {r.type === 'transfer' ? (
                    <span className="icon-bubble round"><Icon name="swap" size={18} /></span>
                  ) : (
                    <CategoryBubble emoji={c?.emoji ?? '❔'} color={c?.color ?? '#888'} round />
                  )}
                  <span className="grow">
                    <span className="title ellipsis" style={{ display: 'block' }}>{title}</span>
                    <span className="sub">
                      {intervalLabel[r.interval]} · {done ? 'beendet' : !r.active ? 'pausiert' : `nächste ${formatDate(r.nextDue)}`}
                      {r.type === 'transfer' ? ` · ${accounts.get(r.accountId)?.name} → ${accounts.get(r.toAccountId!)?.name}` : ''}
                    </span>
                  </span>
                  <Amount cents={r.amount} type={r.type} />
                </button>
              );
            })}
          </div>
        </>
      )}
      {editing && <RecurringSheet rec={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecurringSheet({ rec, onClose }: { rec: Recurring; onClose: () => void }) {
  const accounts = useAccounts();
  const categories = useCategories();
  const toast = useToast();
  const isNew = rec.id == null;
  const [type, setType] = useState<TxType>(rec.type);
  const [amount, setAmount] = useState<Cents | null>(rec.amount || null);
  const [note, setNote] = useState(rec.note ?? '');
  const [categoryId, setCategoryId] = useState<number | undefined>(rec.categoryId);
  const [accountId, setAccountId] = useState(rec.accountId || accounts?.[0]?.id || 0);
  const [toAccountId, setToAccountId] = useState<number | undefined>(rec.toAccountId);
  const [interval, setIntervalValue] = useState<Interval>(rec.interval);
  const [startDate, setStartDate] = useState(isNew ? rec.startDate : rec.nextDue);
  const [endDate, setEndDate] = useState(rec.endDate ?? '');
  const [active, setActive] = useState(rec.active);

  const kind = type === 'income' ? 'income' : 'expense';
  const catOptions = (categories ?? []).filter((c) => c.kind === kind && (!c.archived || c.id === categoryId));
  const catValue = catOptions.some((c) => c.id === categoryId) ? categoryId : catOptions[0]?.id;
  const toOptions = (accounts ?? []).filter((a) => a.id !== accountId);

  async function save() {
    if (!amount || amount <= 0) return toast('Bitte einen Betrag eingeben.');
    if (type === 'transfer' && !(toAccountId ?? toOptions[0]?.id)) return toast('Bitte ein Zielkonto wählen.');
    if (endDate && endDate < startDate) return toast('Das Enddatum liegt vor dem nächsten Termin.');
    const r: Recurring = {
      ...rec,
      type,
      amount,
      note: note.trim() || undefined,
      categoryId: type === 'transfer' ? undefined : catValue,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId ?? toOptions[0]?.id : undefined,
      interval,
      // Ankertag = Tag des (neuen) Starttermins
      startDate: isNew || startDate !== rec.nextDue || interval !== rec.interval ? startDate : rec.startDate,
      nextDue: startDate,
      endDate: endDate || undefined,
      active,
    };
    await db.recurring.put(r);
    onClose();
    const n = await runDueRecurring();
    if (n > 0) toast(n === 1 ? '1 fällige Buchung angelegt' : `${n} fällige Buchungen angelegt`);
  }

  async function remove() {
    await db.recurring.delete(rec.id!);
    toast('Gelöscht – bereits angelegte Buchungen bleiben erhalten');
    onClose();
  }

  return (
    <Sheet title={isNew ? 'Wiederkehrende Buchung' : 'Bearbeiten'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Segmented label="Art" value={type} onChange={setType} options={[
          { value: 'expense', label: 'Ausgabe', icon: 'up' },
          { value: 'income', label: 'Einnahme', icon: 'down' },
          { value: 'transfer', label: 'Umbuchung', icon: 'swap' },
        ]} />
        <Field label="Bezeichnung">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Miete, Netflix, Gehalt" maxLength={60} />
        </Field>
        <Field label="Betrag">
          <AmountInput value={amount} onChange={setAmount} />
        </Field>
        {type !== 'transfer' && (
          <Field label="Kategorie">
            <select className="select" value={catValue ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {catOptions.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={type === 'transfer' ? 'Von Konto' : 'Konto'}>
          <select className="select" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
            {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        {type === 'transfer' && (
          <Field label="Auf Konto">
            <select className="select" value={toAccountId ?? toOptions[0]?.id ?? ''} onChange={(e) => setToAccountId(Number(e.target.value))}>
              {toOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Intervall">
          <select className="select" value={interval} onChange={(e) => setIntervalValue(e.target.value as Interval)}>
            {Object.entries(intervalLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={isNew ? 'Erster Termin' : 'Nächster Termin'}>
            <input className="input" type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
          </Field>
          <Field label="Ende (optional)">
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        {startDate < todayISO() && (
          <p className="hint">Termine in der Vergangenheit werden beim Speichern nachgebucht.</p>
        )}
        {!isNew && (
          <label className="row" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
            Pausieren
          </label>
        )}
        <button className="btn primary block" type="submit">Speichern</button>
        {!isNew && <button className="btn danger block" type="button" onClick={remove}>Löschen</button>}
      </form>
    </Sheet>
  );
}
