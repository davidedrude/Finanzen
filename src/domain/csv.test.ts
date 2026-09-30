import { describe, expect, it } from 'vitest';
import {
  buildRows, buildSuggestions, decodeBytes, guessMapping, markDuplicates, parseCsv, suggestCategory, suggestionKeys,
} from './csv';
import type { Transaction } from './types';

const SPARKASSE = `"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Betrag";"Waehrung"
"DE00123";"29.09.26";"29.09.26";"KARTENZAHLUNG";"REWE SAGT DANKE 123";"REWE Markt GmbH";"-23,45";"EUR"
"DE00123";"29.09.26";"29.09.26";"KARTENZAHLUNG";"Kaffee";"Café Klein";"-3,20";"EUR"
"DE00123";"29.09.26";"29.09.26";"KARTENZAHLUNG";"Kaffee";"Café Klein";"-3,20";"EUR"
"DE00123";"30.09.26";"30.09.26";"GEHALT";"Gehalt September";"Firma AG";"2.850,00";"EUR"
`;

const DKB = `"Kontonummer:";"DE00 1234";
"Von:";"01.09.2026";
"Kontostand vom:";"30.09.2026";"1.000,00 EUR";

"Buchungstag";"Wertstellung";"Buchungstext";"Auftraggeber / Begünstigter";"Verwendungszweck";"Betrag (EUR)";
"28.09.2026";"28.09.2026";"Lastschrift";"Netflix";"Abo";"-12,99";
"27.09.2026";"27.09.2026";"Gutschrift";"Max";"Miete Anteil";"400,00";
`;

describe('CSV-Import', () => {
  it('erkennt Spalten (Sparkasse)', () => {
    const p = parseCsv(SPARKASSE);
    expect(p.headerIndex).toBe(0);
    const m = guessMapping(p.rows[0]);
    expect(m.date).toBe(1);
    expect(m.amount).toBe(6);
    expect(m.description).toBe(4);
    expect(m.counterparty).toBe(5);
    const rows = buildRows(p.rows, p.headerIndex, m);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ date: '2026-09-29', amount: -2345, text: 'REWE Markt GmbH · REWE SAGT DANKE 123' });
    expect(rows[3].amount).toBe(285_000);
  });

  it('überspringt Vorspann (DKB)', () => {
    const p = parseCsv(DKB);
    expect(p.rows[p.headerIndex][0]).toBe('Buchungstag');
    const m = guessMapping(p.rows[p.headerIndex]);
    const rows = buildRows(p.rows, p.headerIndex, m);
    expect(rows.map((r) => r.amount)).toEqual([-1299, 40_000]);
    expect(rows[0].text).toBe('Netflix · Abo');
  });

  it('Soll/Haben-Spalten', () => {
    const csv = 'Datum;Text;Soll;Haben\n01.09.2026;Miete;800,00;\n02.09.2026;Lohn;;2000,00\n';
    const p = parseCsv(csv);
    const m = guessMapping(p.rows[0]);
    expect(m.amount).toBeNull();
    const rows = buildRows(p.rows, 0, m);
    expect(rows.map((r) => r.amount)).toEqual([-80_000, 200_000]);
  });

  it('meldet fehlerhafte Zeilen', () => {
    const p = parseCsv('Datum;Betrag;Zweck\nxx;1,00;a\n01.09.2026;abc;b\n');
    const rows = buildRows(p.rows, 0, guessMapping(p.rows[0]));
    expect(rows[0].error).toMatch(/Datum/);
    expect(rows[1].error).toMatch(/Betrag/);
  });

  it('Duplikate: erneuter Import und manuelle Buchungen', () => {
    const p = parseCsv(SPARKASSE);
    const rows = buildRows(p.rows, 0, guessMapping(p.rows[0]));
    const first = markDuplicates(rows, [], 1);
    expect(first.every((r) => r.duplicate === 'none')).toBe(true);
    // Zwei identische Kaffees bekommen unterschiedliche Hashes
    expect(first[1].hash).not.toBe(first[2].hash);

    const imported: Transaction[] = first.map((r, i) => ({
      type: r.amount! < 0 ? 'expense' : 'income', amount: Math.abs(r.amount!), date: r.date!,
      accountId: 1, importHash: r.hash, createdAt: i,
    }));
    const again = markDuplicates(rows, imported, 1);
    expect(again.every((r) => r.duplicate === 'exact')).toBe(true);

    const manual: Transaction[] = [{ type: 'expense', amount: 2345, date: '2026-09-29', accountId: 1, createdAt: 0 }];
    const withManual = markDuplicates(rows, manual, 1);
    expect(withManual.map((r) => r.duplicate)).toEqual(['possible', 'none', 'none', 'none']);
    // Anderes Konto → kein Duplikat
    expect(markDuplicates(rows, manual, 2)[0].duplicate).toBe('none');
  });

  it('Windows-1252 wird erkannt', () => {
    const bytes = new Uint8Array([0x42, 0xfc, 0x72, 0x6f]); // "Büro" in cp1252
    expect(decodeBytes(bytes)).toBe('Büro');
    expect(decodeBytes(new TextEncoder().encode('﻿Büro'))).toBe('Büro');
  });

  it('Kategorievorschläge', () => {
    expect(suggestionKeys('REWE Markt GmbH · 123')).toEqual(['rewe markt', 'rewe']);
    const s = buildSuggestions([
      { type: 'expense', amount: 1, date: '2026-01-01', accountId: 1, categoryId: 5, note: 'REWE Markt GmbH', createdAt: 1 },
      { type: 'expense', amount: 1, date: '2026-01-02', accountId: 1, categoryId: 7, note: 'Netflix', createdAt: 2 },
    ]);
    expect(suggestCategory(s, 'expense', 'REWE Markt GmbH · REWE SAGT DANKE')).toBe(5);
    expect(suggestCategory(s, 'expense', 'REWE City')).toBe(5);
    expect(suggestCategory(s, 'expense', 'NETFLIX.COM Abo')).toBe(7);
    expect(suggestCategory(s, 'income', 'REWE')).toBeUndefined();
  });
});
