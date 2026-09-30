import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { AmountInput, EmptyState, Field, PageHeader, Progress, Segmented, Sheet } from '../components/ui';
import { db } from '../db/db';
import { useAccounts, useBalances, useGoals } from '../db/hooks';
import { addMonths, formatDate, todayISO } from '../domain/dates';
import { goalCurrent, goalProgress } from '../domain/goals';
import { formatCents, formatSigned } from '../domain/money';
import type { Cents, Goal } from '../domain/types';

const GOAL_EMOJIS = ['🎯', '🛟', '✈️', '🏠', '🚗', '💍', '🎓', '💻', '🎁', '🏖️', '👶', '📈'];

export function GoalsPage() {
  const goals = useGoals();
  const balances = useBalances();
  const accounts = useAccounts(true);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [depositFor, setDepositFor] = useState<Goal | null>(null);
  if (!goals || !balances || !accounts) return null;

  const today = todayISO();
  const blank: Goal = {
    name: '', emoji: '🎯', targetAmount: 0, targetDate: addMonths(today, 12), startDate: today, startAmount: 0, manualAmount: 0,
  };

  return (
    <div className="page stack">
      <PageHeader
        title="Sparziele"
        back
        action={<button className="icon-btn" onClick={() => setEditing(blank)} aria-label="Sparziel hinzufügen"><Icon name="plus" /></button>}
      />
      {goals.length === 0 ? (
        <EmptyState
          emoji="🛟"
          title="Noch keine Sparziele"
          text="Lege ein Ziel mit Betrag und Datum an – die App rechnet aus, wie viel du pro Monat zurücklegen musst."
          action={<button className="btn primary" onClick={() => setEditing(blank)}>Sparziel anlegen</button>}
        />
      ) : (
        goals.map((g) => {
          const p = goalProgress(g, goalCurrent(g, balances), today);
          const linked = g.accountId != null ? accounts.find((a) => a.id === g.accountId) : undefined;
          return (
            <section key={g.id} className="card stack" style={{ gap: 12 }}>
              <div className="spread">
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ fontSize: 26 }} aria-hidden="true">{g.emoji}</span>
                  <div>
                    <strong>{g.name}</strong>
                    <div className="small muted">bis {formatDate(g.targetDate)}{linked ? ` · ${linked.name}` : ''}</div>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setEditing(g)} aria-label={`${g.name} bearbeiten`}><Icon name="note" size={18} /></button>
              </div>
              <div>
                <div className="spread" style={{ marginBottom: 8 }}>
                  <span className="big num">{formatCents(p.current)}</span>
                  <span className="muted num">von {formatCents(p.target)}</span>
                </div>
                <Progress ratio={p.ratio} label={`Fortschritt ${g.name}`} />
              </div>
              <div className="stack" style={{ gap: 4 }}>
                <div className={`status ${p.onTrack ? 'ok' : 'warn'}`}>
                  <Icon name={p.onTrack ? 'check' : 'alert'} size={14} stroke={2.4} />
                  {p.reached ? 'Ziel erreicht 🎉' : p.overdue ? 'Zieldatum überschritten' : p.onTrack ? 'Du liegst im Plan' : 'Du liegst hinter dem Plan'}
                </div>
                {!p.reached && (
                  <>
                    <div className="spread small">
                      <span className="muted">Nötig pro Monat</span>
                      <strong className="num">{formatCents(p.perMonth)}{p.overdue ? '' : ` × ${p.monthsLeft}`}</strong>
                    </div>
                    <div className="spread small">
                      <span className="muted">Planstand heute</span>
                      <span className="num">{formatCents(p.expected)}</span>
                    </div>
                  </>
                )}
              </div>
              {g.accountId == null && (
                <button className="btn small" onClick={() => setDepositFor(g)}>
                  <Icon name="plus" size={16} /> Einzahlung / Entnahme
                </button>
              )}
            </section>
          );
        })
      )}
      {editing && <GoalSheet goal={editing} onClose={() => setEditing(null)} />}
      {depositFor && <DepositSheet goal={depositFor} onClose={() => setDepositFor(null)} />}
    </div>
  );
}

function GoalSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const accounts = useAccounts();
  const balances = useBalances();
  const toast = useToast();
  const isNew = goal.id == null;
  const [name, setName] = useState(goal.name);
  const [emoji, setEmoji] = useState(goal.emoji);
  const [target, setTarget] = useState<Cents | null>(goal.targetAmount || null);
  const [targetDate, setTargetDate] = useState(goal.targetDate);
  const [mode, setMode] = useState<'manual' | 'account'>(goal.accountId != null ? 'account' : 'manual');
  const [accountId, setAccountId] = useState<number | undefined>(goal.accountId ?? accounts?.find((a) => a.type === 'savings')?.id);
  const [current, setCurrent] = useState<Cents | null>(goal.manualAmount || null);

  async function save() {
    if (!name.trim()) return toast('Bitte einen Namen eingeben.');
    if (!target || target <= 0) return toast('Bitte einen Zielbetrag eingeben.');
    if (targetDate <= todayISO() && isNew) return toast('Das Zieldatum muss in der Zukunft liegen.');
    const accId = mode === 'account' ? accountId ?? accounts?.[0]?.id : undefined;
    const now = accId != null ? balances?.get(accId) ?? 0 : current ?? 0;
    const g: Goal = {
      ...goal,
      name: name.trim(),
      emoji,
      targetAmount: target,
      targetDate,
      accountId: accId,
      manualAmount: mode === 'manual' ? current ?? 0 : goal.manualAmount,
      // Beim Anlegen: aktueller Stand als Planbasis
      startAmount: isNew ? now : goal.startAmount,
    };
    await db.goals.put(g);
    onClose();
  }

  return (
    <Sheet title={isNew ? 'Neues Sparziel' : 'Sparziel bearbeiten'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="chips">
          {GOAL_EMOJIS.map((e) => (
            <button key={e} type="button" className="chip" aria-pressed={emoji === e} onClick={() => setEmoji(e)} style={{ fontSize: 20 }}>{e}</button>
          ))}
        </div>
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Notgroschen" autoFocus={isNew} maxLength={40} />
        </Field>
        <Field label="Zielbetrag">
          <AmountInput value={target} onChange={setTarget} />
        </Field>
        <Field label="Zieldatum">
          <input className="input" type="date" value={targetDate} onChange={(e) => e.target.value && setTargetDate(e.target.value)} />
        </Field>
        <div className="field">
          <span>Aktueller Stand</span>
          <Segmented
            label="Quelle des Stands"
            value={mode}
            onChange={setMode}
            options={[{ value: 'manual', label: 'Manuell' }, { value: 'account', label: 'Aus Konto' }]}
          />
        </div>
        {mode === 'account' ? (
          <Field label="Konto" hint="Der Saldo dieses Kontos zählt als Stand – ideal für ein eigenes Tagesgeldkonto.">
            <select className="select" value={accountId ?? ''} onChange={(e) => setAccountId(Number(e.target.value))}>
              {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatCents(balances?.get(a.id!) ?? 0)})</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Bereits gespart">
            <AmountInput value={current} onChange={setCurrent} />
          </Field>
        )}
        <button className="btn primary block" type="submit">Speichern</button>
        {!isNew && (
          <button className="btn danger block" type="button" onClick={async () => { await db.goals.delete(goal.id!); onClose(); }}>
            Sparziel löschen
          </button>
        )}
      </form>
    </Sheet>
  );
}

function DepositSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState<Cents | null>(null);
  const [withdraw, setWithdraw] = useState(false);
  async function save() {
    if (!amount) return;
    const delta = withdraw ? -amount : amount;
    await db.goals.update(goal.id!, { manualAmount: Math.max(0, goal.manualAmount + delta) });
    toast(`${formatSigned(delta)} bei „${goal.name}“ verbucht`);
    onClose();
  }
  return (
    <Sheet title={goal.name} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Segmented label="Richtung" value={withdraw ? 'out' : 'in'} onChange={(v) => setWithdraw(v === 'out')}
          options={[{ value: 'in', label: 'Einzahlung', icon: 'plus' }, { value: 'out', label: 'Entnahme', icon: 'up' }]} />
        <Field label="Betrag">
          <AmountInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <p className="hint">Aktueller Stand: {formatCents(goal.manualAmount)}</p>
        <button className="btn primary block" type="submit">Verbuchen</button>
      </form>
    </Sheet>
  );
}
