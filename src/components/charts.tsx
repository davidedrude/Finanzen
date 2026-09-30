import { useState } from 'react';
import { formatCents, formatShort } from '../domain/money';

/* ---------- Donut ---------- */

export interface DonutSlice {
  key: string;
  label: string;
  emoji?: string;
  color: string;
  value: number;
}

export function Donut({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);
  const size = 220;
  const r = 84;
  const stroke = 28;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0; // 2px Flächen-Abstand zwischen Segmenten
  let offset = 0;
  const activeSlice = slices.find((s) => s.key === active);

  return (
    <div className="chart">
      <div style={{ position: 'relative', maxWidth: size, margin: '0 auto' }}>
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Ausgaben nach Kategorie, gesamt ${formatCents(total)}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
          {slices.map((s) => {
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.key ? stroke + 6 : stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                opacity={active && active !== s.key ? 0.35 : 1}
                style={{ transition: 'opacity .15s, stroke-width .15s', cursor: 'pointer' }}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive((a) => (a === s.key ? null : s.key))}
              >
                <title>{`${s.label}: ${formatCents(s.value)}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </svg>
        <div
          style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            textAlign: 'center', pointerEvents: 'none', padding: 50,
          }}
        >
          <div>
            <div className="small muted ellipsis" style={{ maxWidth: 110 }}>
              {activeSlice ? `${activeSlice.emoji ?? ''} ${activeSlice.label}` : 'Ausgaben'}
            </div>
            <div className="num" style={{ fontWeight: 700, fontSize: 19 }}>
              {formatCents(activeSlice?.value ?? total)}
            </div>
            {activeSlice && (
              <div className="small muted">{Math.round((activeSlice.value / total) * 100)} %</div>
            )}
          </div>
        </div>
      </div>
      <div className="legend">
        {slices.map((s) => (
          <button
            key={s.key}
            type="button"
            className="legend-row"
            aria-pressed={active === s.key}
            onClick={() => setActive((a) => (a === s.key ? null : s.key))}
          >
            <span className="legend-swatch" style={{ background: s.color }} />
            <span className="grow ellipsis">
              {s.emoji} {s.label}
            </span>
            <span className="faint small num">{Math.round((s.value / total) * 100)} %</span>
            <span className="num" style={{ minWidth: 92, textAlign: 'right' }}>{formatCents(s.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Gruppierte Balken (Einnahmen/Ausgaben über 12 Monate) ---------- */

export interface BarGroup {
  key: string;
  label: string;
  longLabel: string;
  values: number[];
}

export interface Series {
  name: string;
  color: string;
  sign?: string;
}

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * exp;
}

export function GroupedBars({
  groups, series, selected, onSelect,
}: { groups: BarGroup[]; series: Series[]; selected?: string; onSelect?: (key: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340;
  const H = 180;
  const padL = 44;
  const padB = 22;
  const padT = 8;
  const plotW = W - padL;
  const plotH = H - padB - padT;
  const max = niceMax(Math.max(...groups.flatMap((g) => g.values), 0));
  const slot = plotW / groups.length;
  const barW = Math.min(9, (slot - 6) / series.length - 2);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Einnahmen und Ausgaben der letzten 12 Monate">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--text-3)' : 'var(--grid)'} strokeWidth={t === 0 ? 1 : 0.5} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end">{formatShort(t)}</text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const x0 = padL + gi * slot + (slot - series.length * (barW + 2)) / 2;
          const isSel = selected === g.key;
          return (
            <g key={g.key}>
              {(isSel || hover === gi) && (
                <rect x={padL + gi * slot + 1} y={padT} width={slot - 2} height={plotH} rx={6} fill="var(--surface-2)" />
              )}
              {g.values.map((v, si) => {
                const h = Math.max(0, (v / max) * plotH);
                const x = x0 + si * (barW + 2);
                const r = Math.min(4, barW / 2, h);
                // Oben abgerundet, unten an der Grundlinie gerade
                const top = padT + plotH - h;
                const d = h <= 0 ? '' :
                  `M${x},${padT + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${padT + plotH} Z`;
                return d ? <path key={si} d={d} fill={series[si].color} /> : null;
              })}
              <text
                x={padL + gi * slot + slot / 2}
                y={H - 6}
                textAnchor="middle"
                style={isSel ? { fill: 'var(--text)', fontWeight: 600 } : undefined}
              >
                {g.label}
              </text>
              <rect
                className="bar-hit"
                x={padL + gi * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(gi)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(g.key)}
              >
                <title>{`${g.longLabel}: ${series.map((s, i) => `${s.name} ${formatCents(g.values[i])}`).join(', ')}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="tooltip"
          style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%`, top: 0 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{groups[hover].longLabel}</div>
          {series.map((s, i) => (
            <div key={s.name} className="row" style={{ gap: 6 }}>
              <span className="legend-swatch" style={{ background: s.color }} />
              {s.name}: <span className="num">{s.sign}{formatCents(groups[hover].values[i])}</span>
            </div>
          ))}
        </div>
      )}
      <div className="row small muted" style={{ gap: 16, marginTop: 8, justifyContent: 'center' }}>
        {series.map((s) => (
          <span key={s.name} className="row" style={{ gap: 6 }}>
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Sparquote pro Monat (positiv/negativ um die Nulllinie) ---------- */

export function RateBars({
  data, selected, onSelect,
}: {
  data: { key: string; label: string; longLabel: string; rate: number | null }[];
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340;
  const H = 150;
  const padL = 44;
  const padB = 22;
  const padT = 8;
  const plotH = H - padB - padT;
  const rates = data.map((d) => d.rate ?? 0);
  const maxPos = Math.max(0.5, ...rates.map((r) => Math.min(r, 1)));
  const maxNeg = Math.max(0, ...rates.map((r) => Math.min(-r, 1)));
  const span = maxPos + maxNeg;
  const zeroY = padT + (maxPos / span) * plotH;
  const slot = (W - padL) / data.length;
  const barW = Math.min(14, slot - 8);
  const yOf = (r: number) => zeroY - (Math.max(-1, Math.min(1, r)) / span) * plotH;
  const pct = (r: number) => `${Math.round(r * 100)} %`;
  const ticks = [maxPos, 0, ...(maxNeg > 0 ? [-maxNeg] : [])];

  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sparquote der letzten 12 Monate">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? 'var(--text-3)' : 'var(--grid)'} strokeWidth={t === 0 ? 1 : 0.5} />
            <text x={padL - 6} y={yOf(t) + 4} textAnchor="end">{pct(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + i * slot + slot / 2;
          const isSel = selected === d.key;
          const r = d.rate;
          return (
            <g key={d.key}>
              {(isSel || hover === i) && (
                <rect x={padL + i * slot + 1} y={padT} width={slot - 2} height={plotH} rx={6} fill="var(--surface-2)" />
              )}
              {r != null && r !== 0 && (
                <rect
                  x={cx - barW / 2}
                  y={Math.min(yOf(r), zeroY)}
                  width={barW}
                  height={Math.abs(yOf(r) - zeroY)}
                  rx={3}
                  fill={r >= 0 ? 'var(--accent)' : 'var(--danger)'}
                />
              )}
              {r == null && <text x={cx} y={zeroY - 4} textAnchor="middle">–</text>}
              <text x={cx} y={H - 6} textAnchor="middle" style={isSel ? { fill: 'var(--text)', fontWeight: 600 } : undefined}>
                {d.label}
              </text>
              <rect
                className="bar-hit"
                x={padL + i * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(d.key)}
              >
                <title>{`${d.longLabel}: ${r == null ? 'keine Einnahmen' : pct(r)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%`, top: 0 }}>
          <div style={{ fontWeight: 600 }}>{data[hover].longLabel}</div>
          <div className="num">
            {data[hover].rate == null ? 'Keine Einnahmen' : `Sparquote ${pct(data[hover].rate!)}`}
          </div>
        </div>
      )}
    </div>
  );
}
