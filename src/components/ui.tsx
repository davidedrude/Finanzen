import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCents, formatSigned, parseAmount, centsToInput } from '../domain/money';
import type { Cents, TxType } from '../domain/types';
import { Icon, type IconName } from './Icon';

export function PageHeader({ title, back, action }: { title: string; back?: boolean; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <button className="back" onClick={() => navigate(-1)} aria-label="Zurück">
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      {action}
    </header>
  );
}

export function EmptyState({
  emoji, title, text, action,
}: { emoji: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="emoji" aria-hidden="true">{emoji}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}

/** Betrag mit Vorzeichen und Pfeil – Einnahme/Ausgabe nie nur über Farbe. */
export function Amount({ cents, type, className = '' }: { cents: Cents; type: TxType; className?: string }) {
  const text = type === 'transfer' ? formatCents(cents) : formatSigned(type === 'income' ? cents : -cents);
  return <span className={`amt ${type} ${className}`}>{text}</span>;
}

export function Progress({ ratio, state = 'ok', label }: { ratio: number; state?: 'ok' | 'warn' | 'over'; label: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      className={`progress ${state}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatusBadge({ state }: { state: 'ok' | 'warn' | 'over' }) {
  if (state === 'ok') return null;
  return (
    <span className={`status ${state}`}>
      <Icon name="alert" size={14} stroke={2.4} />
      {state === 'warn' ? 'Fast erreicht' : 'Überschritten'}
    </span>
  );
}

export function Sheet({
  title, onClose, children,
}: { title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

/** Freies Betragsfeld (für Formulare außerhalb der Schnelleingabe). */
export function AmountInput({
  value, onChange, allowNegative = false, id, autoFocus,
}: {
  value: Cents | null;
  onChange: (v: Cents | null) => void;
  allowNegative?: boolean;
  id?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : centsToInput(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value == null ? '' : centsToInput(value));
      last.current = value;
    }
  }, [value]);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        className="input num"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="0,00"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          let v = parseAmount(e.target.value);
          if (v != null && !allowNegative) v = Math.abs(v);
          last.current = v;
          onChange(v);
        }}
        onBlur={() => value != null && setText(centsToInput(value))}
        style={{ paddingRight: 36 }}
      />
      <span className="faint" style={{ position: 'absolute', right: 14, top: 14 }}>€</span>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: IconName }[]; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={16} stroke={2.4} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Farbe">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className="swatch"
          style={{ background: c }}
          aria-pressed={value === c}
          aria-label={`Farbe ${c}`}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export function CategoryBubble({ emoji, color, round }: { emoji: string; color: string; round?: boolean }) {
  return (
    <span
      className={`icon-bubble${round ? ' round' : ''}`}
      style={{ background: `color-mix(in srgb, ${color} 16%, var(--surface))` }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}

export function MonthSwitcher({ label, onPrev, onNext, nextDisabled }: {
  label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean;
}) {
  return (
    <div className="spread" style={{ marginBottom: 12 }}>
      <button className="icon-btn" onClick={onPrev} aria-label="Vorheriger Monat">
        <Icon name="left" />
      </button>
      <strong>{label}</strong>
      <button className="icon-btn" onClick={onNext} aria-label="Nächster Monat" disabled={nextDisabled}
        style={nextDisabled ? { opacity: 0.3 } : undefined}>
        <Icon name="right" />
      </button>
    </div>
  );
}

export function Delta({ current, previous, invert }: { current: Cents; previous: Cents; invert?: boolean }) {
  if (previous === 0) return <span className="delta muted">Kein Vergleich zum Vormonat</span>;
  const diff = current - previous;
  const pct = Math.round((Math.abs(diff) / previous) * 100);
  const up = diff > 0;
  // Bei Ausgaben ist "mehr" schlecht (invert).
  const good = invert ? !up : up;
  return (
    <span className="delta" style={{ color: diff === 0 ? 'var(--text-2)' : good ? 'var(--income)' : 'var(--text)' }}>
      <Icon name={up ? 'up' : 'down'} size={15} stroke={2.4} />
      {pct} % {up ? 'mehr' : 'weniger'} als im Vormonat
    </span>
  );
}
