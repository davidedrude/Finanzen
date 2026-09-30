import Papa from 'papaparse';
import { parseDate } from './dates';
import { parseAmount } from './money';
import type { Cents, ISODate, Transaction } from './types';

/** Bytes → Text. Viele deutsche Banken exportieren in Windows-1252 statt UTF-8. */
export function decodeBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(view).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(view);
  }
}

export interface ParsedCsv {
  /** Alle Zeilen (inkl. evtl. Vorspann). */
  rows: string[][];
  /** Vermutete Kopfzeile (Index in rows). */
  headerIndex: number;
}

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', delimitersToGuess: [';', ',', '\t', '|'] });
  const rows = result.data.map((r) => r.map((c) => (c ?? '').trim()));
  return { rows, headerIndex: guessHeaderIndex(rows) };
}

/**
 * Kopfzeile = erste Zeile mit der häufigsten Spaltenzahl (≥ 3).
 * So werden Vorspannzeilen wie "Kontonummer: …" (z. B. bei DKB) übersprungen.
 */
export function guessHeaderIndex(rows: string[][]): number {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  let modal = 0;
  let best = -1;
  for (const [len, n] of counts) {
    if (len >= 3 && (n > best || (n === best && len > modal))) {
      modal = len;
      best = n;
    }
  }
  const idx = rows.findIndex((r) => r.length === modal);
  return idx < 0 ? 0 : idx;
}

export interface CsvMapping {
  date: number;
  /** Eine Betragsspalte mit Vorzeichen … */
  amount: number | null;
  /** … oder getrennte Soll-/Haben-Spalten. */
  debit: number | null;
  credit: number | null;
  description: number | null;
  counterparty: number | null;
}

/** Probiert die Muster der Reihe nach – das erste Muster hat Vorrang. */
const find = (headers: string[], ...patterns: RegExp[]) => {
  for (const re of patterns) {
    const i = headers.findIndex((h) => re.test(h.toLowerCase()));
    if (i >= 0) return i;
  }
  return null;
};

/** Spaltenzuordnung anhand typischer Überschriften deutscher Banken raten. */
export function guessMapping(headers: string[]): CsvMapping {
  const amount = find(headers, /betrag|umsatz|amount/);
  const debit = amount == null ? find(headers, /^soll|belastung|ausgang/) : null;
  const credit = amount == null ? find(headers, /^haben|gutschrift|eingang/) : null;
  return {
    date: find(headers, /buchungstag|buchungsdatum/, /^datum|date/, /valuta|wertstellung/) ?? 0,
    amount,
    debit,
    credit,
    description: find(headers, /verwendungszweck/, /beschreibung|zweck|memo|description|details/, /buchungstext|text/),
    counterparty: find(
      headers,
      /empf(ä|ae)nger|auftraggeber|zahlungspflichtige|beg(ü|ue)nstigter|name|payee|gegenkonto.*name/,
    ),
  };
}

export interface ImportRow {
  line: number;
  date: ISODate | null;
  /** Vorzeichenbehaftet: negativ = Ausgabe. */
  amount: Cents | null;
  text: string;
  error?: string;
}

export function buildRows(rows: string[][], headerIndex: number, m: CsvMapping): ImportRow[] {
  const out: ImportRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => c === '')) continue;
    const date = parseDate(r[m.date] ?? '');
    let amount: Cents | null = null;
    if (m.amount != null) {
      amount = parseAmount(r[m.amount] ?? '');
    } else {
      const d = m.debit != null ? parseAmount(r[m.debit] ?? '') : null;
      const c = m.credit != null ? parseAmount(r[m.credit] ?? '') : null;
      if (d != null || c != null) amount = (c ?? 0) - Math.abs(d ?? 0);
    }
    const parts = [m.counterparty, m.description]
      .filter((x): x is number => x != null)
      .map((idx) => r[idx] ?? '')
      .filter(Boolean);
    const text = [...new Set(parts)].join(' · ').replace(/\s+/g, ' ').trim();
    const row: ImportRow = { line: i + 1, date, amount, text };
    if (!date) row.error = 'Datum nicht erkannt';
    else if (amount == null) row.error = 'Betrag nicht erkannt';
    else if (amount === 0) row.error = 'Betrag ist 0';
    out.push(row);
  }
  return out;
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function baseHash(date: ISODate, amount: Cents, text: string): string {
  return `${date}|${amount}|${normalizeText(text)}`;
}

/**
 * Hashes mit Vorkommenszähler: Zwei identische Buchungen am selben Tag
 * (z. B. zweimal Kaffee) bleiben erhalten, ein erneuter Import desselben
 * Auszugs erkennt aber beide als Duplikat.
 */
export function withOccurrence(bases: string[]): string[] {
  const seen = new Map<string, number>();
  return bases.map((b) => {
    const n = (seen.get(b) ?? 0) + 1;
    seen.set(b, n);
    return `${b}#${n}`;
  });
}

export type DuplicateKind = 'none' | 'exact' | 'possible';

export interface PreviewRow extends ImportRow {
  hash: string;
  duplicate: DuplicateKind;
}

/**
 * Markiert Duplikate:
 * - exact: gleicher Import-Hash existiert bereits (Auszug schon importiert)
 * - possible: auf dem Zielkonto gibt es eine manuelle Buchung mit gleichem Datum und Betrag
 */
export function markDuplicates(rows: ImportRow[], existing: Transaction[], accountId: number): PreviewRow[] {
  const valid = rows.filter((r) => !r.error);
  const hashes = withOccurrence(valid.map((r) => baseHash(r.date!, r.amount!, r.text)));
  const existingHashes = new Set(existing.map((t) => t.importHash).filter(Boolean));

  const manual = new Map<string, number>();
  for (const t of existing) {
    if (t.importHash || t.accountId !== accountId || t.type === 'transfer') continue;
    const signed = t.type === 'income' ? t.amount : -t.amount;
    const k = `${t.date}|${signed}`;
    manual.set(k, (manual.get(k) ?? 0) + 1);
  }

  let vi = 0;
  return rows.map((r) => {
    if (r.error) return { ...r, hash: '', duplicate: 'none' as const };
    const hash = hashes[vi++];
    let duplicate: DuplicateKind = 'none';
    if (existingHashes.has(hash)) duplicate = 'exact';
    else {
      const k = `${r.date}|${r.amount}`;
      const n = manual.get(k) ?? 0;
      if (n > 0) {
        duplicate = 'possible';
        manual.set(k, n - 1);
      }
    }
    return { ...r, hash, duplicate };
  });
}

/** Schlüssel für Kategorievorschläge: erst die ersten zwei, dann das erste aussagekräftige Wort. */
export function suggestionKeys(text: string): string[] {
  const words = normalizeText(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  const keys: string[] = [];
  if (words.length >= 2) keys.push(words.slice(0, 2).join(' '));
  if (words.length >= 1) keys.push(words[0]);
  return keys;
}

/** Lernt aus bisherigen Buchungen: Schlüssel → zuletzt verwendete Kategorie. */
export function buildSuggestions(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  const sorted = [...txs].sort((a, b) => a.createdAt - b.createdAt);
  for (const t of sorted) {
    if (!t.note || t.categoryId == null || t.type === 'transfer') continue;
    for (const k of suggestionKeys(t.note)) map.set(`${t.type}:${k}`, t.categoryId);
  }
  return map;
}

/** Bester Kategorievorschlag für einen Buchungstext. */
export function suggestCategory(
  suggestions: Map<string, number>,
  type: 'income' | 'expense',
  text: string,
): number | undefined {
  for (const k of suggestionKeys(text)) {
    const id = suggestions.get(`${type}:${k}`);
    if (id != null) return id;
  }
  return undefined;
}
