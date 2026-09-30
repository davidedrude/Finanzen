import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { AmountInput, ColorPicker, Field, PageHeader, Sheet } from '../components/ui';
import { db } from '../db/db';
import { useAccounts, useBalances } from '../db/hooks';
import { PALETTE } from '../db/seed';
import { formatCents } from '../domain/money';
import type { Account, AccountType, Cents } from '../domain/types';

const typeLabel: Record<AccountType, string> = {
  giro: 'Girokonto',
  cash: 'Bargeld',
  savings: 'Sparkonto / Tagesgeld',
  other: 'Sonstiges',
};
const typeEmoji: Record<AccountType, string> = { giro: '🏦', cash: '💶', savings: '🐷', other: '💳' };

export function AccountsPage() {
  const accounts = useAccounts(true);
  const balances = useBalances();
  const [editing, setEditing] = useState<Account | null>(null);

  if (!accounts || !balances) return null;
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const total = active.reduce((s, a) => s + (balances.get(a.id!) ?? 0), 0);

  const blank: Account = { name: '', type: 'giro', startBalance: 0, color: PALETTE[active.length % PALETTE.length], archived: false, order: accounts.length };

  const row = (a: Account) => (
    <button key={a.id} className="list-item" onClick={() => setEditing(a)}>
      <span className="icon-bubble" aria-hidden="true">
        {typeEmoji[a.type]}
        <span className="dot" style={{ background: a.color }} />
      </span>
      <span className="grow">
        <span className="title" style={{ display: 'block' }}>{a.name}</span>
        <span className="sub">{typeLabel[a.type]}{a.archived ? ' · archiviert' : ''}</span>
      </span>
      <span className="amt num">{formatCents(balances.get(a.id!) ?? 0)}</span>
    </button>
  );

  return (
    <div className="page stack">
      <PageHeader
        title="Konten"
        back
        action={<button className="icon-btn" onClick={() => setEditing(blank)} aria-label="Konto hinzufügen"><Icon name="plus" /></button>}
      />
      <div className="card">
        <div className="card-title">Gesamt</div>
        <div className="big num">{formatCents(total)}</div>
      </div>
      <div className="list">{active.map(row)}</div>
      <button className="btn block" onClick={() => setEditing(blank)}><Icon name="plus" size={18} /> Konto hinzufügen</button>
      {archived.length > 0 && (
        <>
          <div className="section-title">Archiviert</div>
          <div className="list">{archived.map(row)}</div>
        </>
      )}
      {editing && <AccountSheet account={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccountSheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type);
  const [start, setStart] = useState<Cents | null>(account.startBalance);
  const [color, setColor] = useState(account.color);
  const isNew = account.id == null;

  async function save() {
    if (!name.trim()) return toast('Bitte einen Namen eingeben.');
    await db.accounts.put({ ...account, name: name.trim(), type, startBalance: start ?? 0, color });
    onClose();
  }

  async function removeOrArchive() {
    const used =
      (await db.transactions.where('accountId').equals(account.id!).count()) +
      (await db.transactions.where('toAccountId').equals(account.id!).count()) +
      (await db.recurring.filter((r) => r.accountId === account.id || r.toAccountId === account.id).count());
    if (used > 0) {
      await db.accounts.update(account.id!, { archived: !account.archived });
      toast(account.archived ? 'Konto wiederhergestellt' : 'Konto archiviert – Buchungen bleiben erhalten');
    } else {
      if ((await db.accounts.filter((a) => !a.archived).count()) <= 1) return toast('Mindestens ein Konto wird benötigt.');
      await db.accounts.delete(account.id!);
      await db.goals.filter((g) => g.accountId === account.id).modify({ accountId: undefined });
      toast('Konto gelöscht');
    }
    onClose();
  }

  return (
    <Sheet title={isNew ? 'Neues Konto' : 'Konto bearbeiten'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={isNew} maxLength={40} placeholder="z. B. Tagesgeld" />
        </Field>
        <Field label="Art">
          <select className="select" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Startsaldo" hint="Kontostand vor deiner ersten erfassten Buchung.">
          <AmountInput value={start} onChange={setStart} allowNegative />
        </Field>
        <div className="field">
          <span>Farbe</span>
          <ColorPicker value={color} onChange={setColor} colors={PALETTE} />
        </div>
        <button className="btn primary block" type="submit">Speichern</button>
        {!isNew && (
          <button className="btn danger block" type="button" onClick={removeOrArchive}>
            {account.archived ? 'Wiederherstellen' : 'Archivieren / Löschen'}
          </button>
        )}
      </form>
    </Sheet>
  );
}
