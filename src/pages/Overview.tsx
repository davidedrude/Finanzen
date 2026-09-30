import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Delta, EmptyState, Progress, StatusBadge } from '../components/ui';
import { useTxSheet } from '../components/txContext';
import { exportBackup } from '../db/backup';
import { useAccounts, useBalances, useBudgets, useCategoryMap, useGoals, useMeta, useTransactions } from '../db/hooks';
import { totalBalance } from '../domain/balance';
import { budgetSummary } from '../domain/budget';
import { addMonthsToKey, currentMonth, monthName, parts, todayISO } from '../domain/dates';
import { goalCurrent, goalProgress } from '../domain/goals';
import { formatCents } from '../domain/money';
import { monthTotals } from '../domain/stats';

const DAY = 86_400_000;

export function OverviewPage() {
  const accounts = useAccounts();
  const txs = useTransactions();
  const budgets = useBudgets();
  const goals = useGoals();
  const cats = useCategoryMap();
  const balances = useBalances();
  const lastBackup = useMeta<number>('lastBackupAt');
  const installedAt = useMeta<number>('installedAt');
  const openTx = useTxSheet();

  if (!accounts || !txs || !budgets || !goals || !balances) return null;

  const today = todayISO();
  const month = currentMonth();
  const prev = addMonthsToKey(month, -1);
  const total = totalBalance(accounts, txs);
  const cur = monthTotals(txs, month);
  const prevFull = monthTotals(txs, prev);
  // Fairer Vergleich: Vormonat bis zum gleichen Tag
  const day = parts(today)[2];
  const prevSamePeriod = monthTotals(
    txs.filter((t) => Number(t.date.slice(8, 10)) <= day),
    prev,
  );
  const budget = budgetSummary(budgets, txs, month);

  const ref = lastBackup ?? installedAt ?? null;
  const backupDays = ref ? Math.floor((Date.now() - ref) / DAY) : null;
  const showBackupHint = txs.length > 0 && backupDays != null && backupDays >= 30;

  return (
    <div className="page stack">
      <header className="page-header">
        <h1>Übersicht</h1>
      </header>

      {showBackupHint && (
        <div className="banner">
          <Icon name="info" size={20} />
          <span className="grow">
            {lastBackup ? `Dein letztes Backup ist ${backupDays} Tage alt.` : 'Du hast noch kein Backup erstellt.'}
          </span>
          <button className="btn small" onClick={() => void exportBackup()}>Sichern</button>
        </div>
      )}

      <section className="card" aria-labelledby="h-saldo">
        <div className="card-title" id="h-saldo">Gesamtsaldo</div>
        <div className={`hero num`}>{formatCents(total)}</div>
        <div className="stack" style={{ gap: 4, marginTop: 14 }}>
          {accounts.map((a) => (
            <div key={a.id} className="spread small">
              <span className="row muted" style={{ gap: 8 }}>
                <span className="legend-swatch" style={{ background: a.color, borderRadius: '50%' }} />
                {a.name}
              </span>
              <span className="num">{formatCents(balances.get(a.id!) ?? 0)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="h-monat">
        <div className="card-title" id="h-monat">Ausgaben im {monthName(month)}</div>
        <div className="big num">{formatCents(cur.expense)}</div>
        <div style={{ marginTop: 6 }}>
          <Delta current={cur.expense} previous={prevSamePeriod.expense} invert />
        </div>
        <div className="spread small muted" style={{ marginTop: 12 }}>
          <span>Vormonat gesamt</span>
          <span className="num">{formatCents(prevFull.expense)}</span>
        </div>
        <div className="spread small muted" style={{ marginTop: 4 }}>
          <span>Einnahmen diesen Monat</span>
          <span className="num" style={cur.income ? { color: 'var(--income)' } : undefined}>
            {cur.income ? '+' : ''}{formatCents(cur.income)}
          </span>
        </div>
        {txs.length === 0 && (
          <button className="btn primary block" style={{ marginTop: 16 }} onClick={() => openTx()}>
            <Icon name="plus" size={18} /> Erste Buchung erfassen
          </button>
        )}
      </section>

      <section className="card" aria-labelledby="h-budget">
        <div className="spread">
          <div className="card-title" id="h-budget">Budget</div>
          <Link className="card-link" to="/mehr/budgets" style={{ marginTop: -14 }}>
            {budgets.length ? 'Alle' : 'Anlegen'}
          </Link>
        </div>
        {budgets.length === 0 ? (
          <p className="muted small">Lege Monatslimits für Kategorien fest, um rechtzeitig gewarnt zu werden.</p>
        ) : (
          <>
            <div className="big num">
              {budget.totalRemaining >= 0 ? formatCents(budget.totalRemaining) : `−${formatCents(-budget.totalRemaining)}`}
            </div>
            <p className="small muted" style={{ marginBottom: 12 }}>
              {budget.totalRemaining >= 0 ? 'übrig' : 'über dem Limit'} von {formatCents(budget.totalLimit)}
            </p>
            <Progress
              ratio={budget.totalLimit ? budget.totalSpent / budget.totalLimit : 0}
              state={budget.overCount ? 'over' : budget.warnCount ? 'warn' : 'ok'}
              label="Gesamtbudget verbraucht"
            />
            <div className="stack" style={{ gap: 12, marginTop: 16 }}>
              {budget.items.slice(0, 3).map((b) => {
                const c = cats.get(b.categoryId);
                return (
                  <div key={b.categoryId}>
                    <div className="spread small" style={{ marginBottom: 6 }}>
                      <span className="row ellipsis" style={{ gap: 6 }}>
                        {c?.emoji} {c?.name}
                        <StatusBadge state={b.state} />
                      </span>
                      <span className="num muted">{Math.round(b.ratio * 100)} %</span>
                    </div>
                    <Progress ratio={b.ratio} state={b.state} label={`Budget ${c?.name}`} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="h-ziele">
        <div className="spread">
          <div className="card-title" id="h-ziele">Sparziele</div>
          <Link className="card-link" to="/mehr/sparziele" style={{ marginTop: -14 }}>
            {goals.length ? 'Alle' : 'Anlegen'}
          </Link>
        </div>
        {goals.length === 0 ? (
          <p className="muted small">Setze dir ein Ziel – z. B. Notgroschen oder Urlaub – und sieh, wie viel du monatlich sparen musst.</p>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            {goals.map((g) => {
              const p = goalProgress(g, goalCurrent(g, balances), today);
              return (
                <div key={g.id}>
                  <div className="spread small" style={{ marginBottom: 6 }}>
                    <span className="ellipsis" style={{ fontWeight: 500 }}>{g.emoji} {g.name}</span>
                    <span className="num muted">
                      {formatCents(p.current)} / {formatCents(p.target)}
                    </span>
                  </div>
                  <Progress ratio={p.ratio} label={`Sparziel ${g.name}`} />
                  <div className={`status ${p.onTrack ? 'ok' : 'warn'}`} style={{ marginTop: 6 }}>
                    <Icon name={p.onTrack ? 'check' : 'alert'} size={14} stroke={2.4} />
                    {p.reached
                      ? 'Ziel erreicht'
                      : p.onTrack
                        ? `Im Plan · ${formatCents(p.perMonth)} pro Monat`
                        : `Hinter dem Plan · ${formatCents(p.perMonth)} pro Monat nötig`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {txs.length === 0 && budgets.length === 0 && goals.length === 0 && (
        <EmptyState
          emoji="🌱"
          title="Alles bereit"
          text="Tippe auf das + unten rechts, um deine erste Ausgabe in wenigen Sekunden zu erfassen."
        />
      )}
    </div>
  );
}
