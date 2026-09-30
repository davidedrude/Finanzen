import { useState } from 'react';
import { db, setMeta } from '../db/db';
import { AmountInput, Field } from '../components/ui';
import type { Cents } from '../domain/types';

export function Onboarding() {
  const [name, setName] = useState('Girokonto');
  const [start, setStart] = useState<Cents | null>(null);

  async function create() {
    await setMeta('installedAt', Date.now());
    await db.accounts.add({
      name: name.trim() || 'Girokonto',
      type: 'giro',
      startBalance: start ?? 0,
      color: '#2a78d6',
      archived: false,
      order: 0,
    });
  }

  return (
    <div className="onboarding page">
      <img className="logo" src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" />
      <div className="stack" style={{ gap: 10 }}>
        <h1>Willkommen bei Finanzen</h1>
        <p className="muted">
          Behalte im Blick, wo dein Geld steht, wofür du es ausgibst und ob du deine Sparziele erreichst.
          Alle Daten bleiben ausschließlich auf diesem Gerät.
        </p>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <strong>Dein erstes Konto</strong>
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Aktueller Kontostand" hint="Weitere Konten wie Bargeld oder Tagesgeld kannst du später anlegen.">
          <AmountInput value={start} onChange={setStart} allowNegative />
        </Field>
        <button className="btn primary block" type="submit">Los geht’s</button>
      </form>
    </div>
  );
}
