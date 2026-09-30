import type { Cents } from './types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurShort = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** 123456 → "1.234,56 €" (Minus als "−" für saubere Typografie). */
export function formatCents(cents: Cents): string {
  return eur.format(cents / 100).replace('-', '−');
}

/** Mit Vorzeichen: "+1.234,56 €" / "−12,00 €". Null ohne Vorzeichen. */
export function formatSigned(cents: Cents): string {
  if (cents === 0) return formatCents(0);
  return (cents > 0 ? '+' : '−') + formatCents(Math.abs(cents));
}

/** Kompakt ohne Nachkommastellen, für Diagrammachsen. */
export function formatShort(cents: Cents): string {
  return eurShort.format(Math.round(cents / 100)).replace('-', '−');
}

/** Betrag für ein Eingabefeld: 123456 → "1234,56". */
export function centsToInput(cents: Cents): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

/**
 * Parst Beträge in deutschem wie englischem Format ohne Float-Arithmetik.
 * "1.234,56" → 123456, "-12,5" → -1250, "12.50" → 1250, "1.234" → 123400,
 * "12,34-" → -1234 (nachgestelltes Minus, z. B. in manchen Bankexporten).
 * Gibt null zurück, wenn der Text kein Betrag ist.
 */
export function parseAmount(input: string): Cents | null {
  let s = input.replace(/[\s  €]|EUR/gi, '');
  if (!s) return null;

  let negative = false;
  if (/^[-−–]/.test(s)) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (/[-−–]$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (!/^[\d.,']+$/.test(s) || !/\d/.test(s)) return null;
  s = s.replace(/'/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let intPart: string;
  let fracPart = '';

  if (lastComma >= 0 && lastDot >= 0) {
    const decIdx = Math.max(lastComma, lastDot);
    intPart = s.slice(0, decIdx).replace(/[.,]/g, '');
    fracPart = s.slice(decIdx + 1);
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    if (parts.length > 2) {
      intPart = parts.join('');
    } else {
      intPart = parts[0];
      fracPart = parts[1];
    }
  } else if (lastDot >= 0) {
    const parts = s.split('.');
    // Genau ein Punkt mit 1–2 Nachkommastellen → Dezimalpunkt, sonst Tausenderpunkte.
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      intPart = parts[0];
      fracPart = parts[1];
    } else {
      intPart = parts.join('');
    }
  } else {
    intPart = s;
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  if (intPart === '' && fracPart === '') return null;

  let cents = Number(intPart || '0') * 100;
  const frac2 = (fracPart + '00').slice(0, 2);
  cents += Number(frac2);
  // Mehr als 2 Nachkommastellen: kaufmännisch runden.
  if (fracPart.length > 2 && Number(fracPart[2]) >= 5) cents += 1;

  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Summiert Cent-Beträge (nur Integer-Addition). */
export function sum(values: Cents[]): Cents {
  let t = 0;
  for (const v of values) t += v;
  return t;
}

/** Anteil a/b in Prozent, gerundet; null wenn b = 0. */
export function percent(a: number, b: number): number | null {
  if (b === 0) return null;
  return Math.round((a / b) * 100);
}
