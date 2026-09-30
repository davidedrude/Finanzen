import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { AmountInput, CategoryBubble, EmptyState, Field, PageHeader, Progress, Sheet, StatusBadge } from '../components/ui';
import { db } from '../db/db';
import { useBudgets, useCategories, useCategoryMap, useTransactions } from '../db/hooks';
import { budgetSummary } from '../domain/budget';
import { currentMonth, monthName } from '../domain/dates';
import { formatCents } from '../domain/money';
import type { Budget, Cents } from '../domain/types';

export function BudgetsPage() {
  const budgets = useBudgets();
  const txs = useTransactions();
  const cats = useCategoryMap();
  const [editing, setEditing] = useState<Budget | null>(null);
  if (!budgets || !txs) return null;

  const month = currentMonth();
  const s = budgetSummary(budgets, txs, month);
  const blank: Budget = { categoryId: 0, monthlyLimit: 0 };

  return (
    <div className="page stack">
      <PageHeader
        title="Budgets"
        back
        action={<button className="icon-btn" onClick={() => setEditing(blank)} aria-label="Budget hinzufügen"><Icon name="plus" /></button>}
      />
      {budgets.length === 0 ? (
        <EmptyState
          emoji="🎯"
          title="Noch keine Budgets"
          text="Lege ein Monatslimit für Kategorien wie Lebensmittel oder Restaurant fest. Ab 80 % wirst du gewarnt."
          action={<button className="btn primary" onClick={() => setEditing(blank)}>Budget anlegen</button>}
        />
      ) : (
        <>
          <div className="card">
            <div className="card-title">{monthName(month)}</div>
            <div className="spread">
              <div>
                <div className="big num">{formatCents(Math.abs(s.totalRemaining))}</div>
                <div className="small muted">{s.totalRemaining >= 0 ? 'übrig' : 'über dem Limit'} von {formatCents(s.totalLimit)}</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Progress ratio={s.totalLimit ? s.totalSpent / s.totalLimit : 0} state={s.overCount ? 'over' : s.warnCount ? 'warn' : 'ok'} label="Gesamtbudget" />
            </div>
          </div>
          <div className="list">
            {s.items.map((b) => {
              const c = cats.get(b.categoryId);
              const budget = budgets.find((x) => x.categoryId === b.categoryId)!;
              return (
                <button key={b.categoryId} className="list-item" onClick={() => setEditing(budget)} style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
                  <CategoryBubble emoji={c?.emoji ?? '❔'} color={c?.color ?? '#888'} />
                  <span className="grow stack" style={{ gap: 6 }}>
                    <span className="spread">
                      <span className="title ellipsis">{c?.name}</span>
                      <span className="num small">{formatCents(b.spent)} / {formatCents(b.limit)}</span>
                    </span>
                    <Progress ratio={b.ratio} state={b.state} label={`Budget ${c?.name}`} />
                    <span className="spread small">
                      <span className="muted">
                        {b.remaining >= 0 ? `Noch ${formatCents(b.remaining)}` : `${formatCents(-b.remaining)} drüber`}
                      </span>
                      {b.state === 'ok' ? <span className="faint num">{Math.round(b.ratio * 100)} %</span> : <StatusBadge state={b.state} />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button className="btn block" onClick={() => setEditing(blank)}><Icon name="plus" size={18} /> Budget hinzufügen</button>
        </>
      )}
      {editing && <BudgetSheet budget={editing} taken={budgets.map((b) => b.categoryId)} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BudgetSheet({ budget, taken, onClose }: { budget: Budget; taken: number[]; onClose: () => void }) {
  const categories = useCategories();
  const toast = useToast();
  const isNew = budget.id == null;
  const options = (categories ?? []).filter(
    (c) => c.kind === 'expense' && !c.archived && (c.id === budget.categoryId || !taken.includes(c.id!)),
  );
  const [categoryId, setCategoryId] = useState(budget.categoryId || options[0]?.id || 0);
  const [limit, setLimit] = useState<Cents | null>(budget.monthlyLimit || null);

  async function save() {
    if (!categoryId) return toast('Bitte eine Kategorie wählen.');
    if (!limit || limit <= 0) return toast('Bitte ein Limit eingeben.');
    await db.budgets.put({ ...budget, categoryId, monthlyLimit: limit });
    onClose();
  }

  return (
    <Sheet title={isNew ? 'Neues Budget' : 'Budget bearbeiten'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label="Kategorie">
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} disabled={!isNew}>
            {options.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Monatslimit">
          <AmountInput value={limit} onChange={setLimit} autoFocus />
        </Field>
        <button className="btn primary block" type="submit">Speichern</button>
        {!isNew && (
          <button className="btn danger block" type="button" onClick={async () => { await db.budgets.delete(budget.id!); onClose(); }}>
            Budget entfernen
          </button>
        )}
      </form>
    </Sheet>
  );
}
