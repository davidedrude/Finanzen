import { useMemo, useState } from 'react';
import { Donut, GroupedBars, RateBars } from '../components/charts';
import { EmptyState, MonthSwitcher, PageHeader } from '../components/ui';
import { useCategoryMap, useTransactions } from '../db/hooks';
import { currentMonth, addMonthsToKey, monthLabel, monthShortLabel, monthName } from '../domain/dates';
import { formatCents } from '../domain/money';
import { expenseByCategory, monthlySeries } from '../domain/stats';

export function ReportsPage() {
  const txs = useTransactions();
  const cats = useCategoryMap();
  const [month, setMonth] = useState(currentMonth());

  const series = useMemo(() => (txs ? monthlySeries(txs, currentMonth(), 12) : []), [txs]);
  const slices = useMemo(() => (txs ? expenseByCategory(txs, month, 6) : []), [txs, month]);

  if (!txs) return null;
  if (txs.filter((t) => t.type !== 'transfer').length === 0) {
    return (
      <div className="page">
        <PageHeader title="Auswertung" />
        <EmptyState
          emoji="📊"
          title="Noch nichts auszuwerten"
          text="Sobald du Einnahmen und Ausgaben erfasst hast, siehst du hier, wohin dein Geld fließt und wie viel du sparst."
        />
      </div>
    );
  }

  const cur = series.find((s) => s.month === month) ?? {
    income: 0, expense: 0, net: 0, savingsRate: null as number | null,
  };
  const total = slices.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="page stack">
      <PageHeader title="Auswertung" />
      <MonthSwitcher
        label={monthLabel(month)}
        onPrev={() => setMonth((m) => addMonthsToKey(m, -1))}
        onNext={() => setMonth((m) => addMonthsToKey(m, 1))}
        nextDisabled={month >= currentMonth()}
      />

      <section className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div>
            <div className="small muted">Einnahmen</div>
            <div className="num" style={{ fontWeight: 700, color: 'var(--income)' }}>+{formatCents(cur.income)}</div>
          </div>
          <div>
            <div className="small muted">Ausgaben</div>
            <div className="num" style={{ fontWeight: 700 }}>−{formatCents(cur.expense)}</div>
          </div>
          <div>
            <div className="small muted">Sparquote</div>
            <div className="num" style={{ fontWeight: 700, color: cur.savingsRate != null && cur.savingsRate < 0 ? 'var(--danger)' : undefined }}>
              {cur.savingsRate == null ? '–' : `${Math.round(cur.savingsRate * 100)} %`}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Ausgaben nach Kategorie</div>
        {total === 0 ? (
          <p className="muted small">Im {monthName(month)} gibt es keine Ausgaben.</p>
        ) : (
          <Donut
            total={total}
            slices={slices.map((s) => {
              const c = s.categoryId != null ? cats.get(s.categoryId) : undefined;
              return {
                key: String(s.categoryId ?? 'rest'),
                label: c?.name ?? 'Weitere',
                emoji: c?.emoji ?? '⋯',
                color: c?.color ?? '#9aa09d',
                value: s.amount,
              };
            })}
          />
        )}
      </section>

      <section className="card">
        <div className="card-title">Verlauf der letzten 12 Monate</div>
        <GroupedBars
          selected={month}
          onSelect={setMonth}
          series={[
            { name: 'Einnahmen', color: 'var(--income)', sign: '+' },
            { name: 'Ausgaben', color: 'var(--chart-expense)', sign: '−' },
          ]}
          groups={series.map((s) => ({
            key: s.month,
            label: monthShortLabel(s.month).slice(0, 1),
            longLabel: monthLabel(s.month),
            values: [s.income, s.expense],
          }))}
        />
      </section>

      <section className="card">
        <div className="card-title">Sparquote pro Monat</div>
        <p className="small muted" style={{ marginBottom: 10 }}>Anteil der Einnahmen, der nicht ausgegeben wurde.</p>
        <RateBars
          selected={month}
          onSelect={setMonth}
          data={series.map((s) => ({
            key: s.month,
            label: monthShortLabel(s.month).slice(0, 1),
            longLabel: monthLabel(s.month),
            rate: s.savingsRate,
          }))}
        />
      </section>
    </div>
  );
}
