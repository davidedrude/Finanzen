import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { EmptyState, Field, PageHeader, Segmented } from '../components/ui';
import { db, getMeta, setMeta } from '../db/db';
import { useAccounts, useCategories, useTransactions } from '../db/hooks';
import {
  buildRows, buildSuggestions, decodeBytes, guessMapping, markDuplicates, parseCsv, suggestCategory,
  type CsvMapping, type PreviewRow,
} from '../domain/csv';
import { formatDate } from '../domain/dates';
import { formatSigned } from '../domain/money';
import type { Transaction } from '../domain/types';

type Step = 'file' | 'map' | 'preview' | 'done';
const PAGE = 100;

interface RowChoice {
  include: boolean;
  categoryId?: number;
}

export function ImportPage() {
  const accounts = useAccounts();
  const categories = useCategories();
  const txs = useTransactions();
  const toast = useToast();

  const [step, setStep] = useState<Step>('file');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');
  const [accountId, setAccountId] = useState<number | undefined>();
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [choices, setChoices] = useState<RowChoice[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [imported, setImported] = useState(0);

  const headers = rows[headerIndex] ?? [];
  const accId = accountId ?? accounts?.[0]?.id;

  const sample = useMemo(
    () => (mapping ? buildRows(rows, headerIndex, effective(mapping, amountMode)).slice(0, 5) : []),
    [rows, headerIndex, mapping, amountMode],
  );

  if (!accounts || !categories || !txs) return null;

  const fallback = {
    expense: categories.find((c) => c.kind === 'expense' && c.name === 'Sonstiges')?.id ?? categories.find((c) => c.kind === 'expense')?.id,
    income: categories.find((c) => c.kind === 'income' && c.name === 'Sonstige Einnahmen')?.id ?? categories.find((c) => c.kind === 'income')?.id,
  };

  async function onFile(file: File) {
    const text = decodeBytes(await file.arrayBuffer());
    const parsed = parseCsv(text);
    if (parsed.rows.length < 2) {
      toast('Die Datei enthält keine erkennbaren Zeilen.');
      return;
    }
    setFileName(file.name);
    setRows(parsed.rows);
    setHeaderIndex(parsed.headerIndex);
    await applyMapping(parsed.rows[parsed.headerIndex]);
    setStep('map');
  }

  async function applyMapping(hdrs: string[]) {
    const saved = (await getMeta<Record<string, CsvMapping>>('csvMappings')) ?? {};
    const m = saved[hdrs.join('|')] ?? guessMapping(hdrs);
    setMapping(m);
    setAmountMode(m.amount == null && (m.debit != null || m.credit != null) ? 'split' : 'single');
  }

  function toPreview() {
    if (!mapping || accId == null) return;
    const built = buildRows(rows, headerIndex, effective(mapping, amountMode));
    const marked = markDuplicates(built, txs!, accId);
    const suggestions = buildSuggestions(txs!);
    setPreview(marked);
    setChoices(
      marked.map((r) => {
        const type = (r.amount ?? 0) < 0 ? 'expense' : 'income';
        const sug = suggestCategory(suggestions, type, r.text);
        return {
          include: !r.error && r.duplicate === 'none',
          categoryId: sug ?? fallback[type],
        };
      }),
    );
    setShown(PAGE);
    setStep('preview');
  }

  async function doImport() {
    if (!mapping || accId == null) return;
    const now = Date.now();
    const toAdd: Transaction[] = [];
    preview.forEach((r, i) => {
      if (!choices[i].include || r.error) return;
      toAdd.push({
        type: r.amount! < 0 ? 'expense' : 'income',
        amount: Math.abs(r.amount!),
        date: r.date!,
        categoryId: choices[i].categoryId,
        accountId: accId,
        note: r.text || undefined,
        importHash: r.hash,
        createdAt: now + i,
      });
    });
    await db.transactions.bulkAdd(toAdd);
    const saved = (await getMeta<Record<string, CsvMapping>>('csvMappings')) ?? {};
    saved[headers.join('|')] = effective(mapping, amountMode);
    await setMeta('csvMappings', saved);
    setImported(toAdd.length);
    setStep('done');
  }

  const stepIdx = ['file', 'map', 'preview', 'done'].indexOf(step);
  const selected = choices.filter((c) => c.include).length;
  const dupes = preview.filter((r) => r.duplicate !== 'none').length;
  const errors = preview.filter((r) => r.error).length;

  const colSelect = (label: string, key: keyof CsvMapping, optional = true) => (
    <Field label={label}>
      <select
        className="select"
        value={mapping?.[key] ?? ''}
        onChange={(e) => setMapping((m) => m && { ...m, [key]: e.target.value === '' ? null : Number(e.target.value) })}
      >
        {optional && <option value="">— keine —</option>}
        {headers.map((h, i) => <option key={i} value={i}>{h || `Spalte ${i + 1}`}</option>)}
      </select>
    </Field>
  );

  return (
    <div className="page">
      <PageHeader title="CSV-Import" back />
      <div className="steps" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <span key={i} className={i <= stepIdx ? 'on' : ''} />)}
      </div>

      {step === 'file' && (
        <div className="stack">
          <p className="muted">
            Exportiere im Online-Banking die Umsätze als CSV und wähle die Datei hier aus. Bekannte Buchungen werden
            erkannt, du siehst vor dem Import eine Vorschau.
          </p>
          <Field label="In welches Konto importieren?">
            <select className="select" value={accId ?? ''} onChange={(e) => setAccountId(Number(e.target.value))}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <label className="btn primary block" style={{ position: 'relative' }}>
            <Icon name="upload" size={18} /> CSV-Datei wählen
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              style={{ position: 'absolute', inset: 0, opacity: 0 }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {step === 'map' && mapping && (
        <div className="stack">
          <p className="small muted">{fileName} · {rows.length - headerIndex - 1} Zeilen</p>
          <Field label="Kopfzeile" hint="Die Zeile mit den Spaltenüberschriften.">
            <select
              className="select"
              value={headerIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setHeaderIndex(idx);
                void applyMapping(rows[idx]);
              }}
            >
              {rows.slice(0, 15).map((r, i) => (
                <option key={i} value={i}>Zeile {i + 1}: {r.slice(0, 3).join(' · ').slice(0, 50)}</option>
              ))}
            </select>
          </Field>
          {colSelect('Datum', 'date', false)}
          <Segmented
            label="Betragsformat"
            value={amountMode}
            onChange={setAmountMode}
            options={[{ value: 'single', label: 'Eine Betragsspalte' }, { value: 'split', label: 'Soll / Haben' }]}
          />
          {amountMode === 'single' ? colSelect('Betrag (mit Vorzeichen)', 'amount') : (
            <>
              {colSelect('Soll (Ausgaben)', 'debit')}
              {colSelect('Haben (Einnahmen)', 'credit')}
            </>
          )}
          {colSelect('Verwendungszweck', 'description')}
          {colSelect('Empfänger / Auftraggeber', 'counterparty')}

          <div className="section-title">Vorschau</div>
          <div className="table-wrap">
            <table className="preview">
              <thead><tr><th>Datum</th><th>Betrag</th><th>Text</th></tr></thead>
              <tbody>
                {sample.map((r) => (
                  <tr key={r.line}>
                    <td>{r.date ? formatDate(r.date) : <span className="tag danger">?</span>}</td>
                    <td className="num">{r.amount != null ? formatSigned(r.amount) : <span className="tag danger">?</span>}</td>
                    <td>{r.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            <button className="btn" onClick={() => setStep('file')}>Zurück</button>
            <button className="btn primary grow" onClick={toPreview}>Weiter</button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="stack">
          <div className="card small" style={{ padding: 14 }}>
            <div className="spread"><span className="muted">Zeilen gesamt</span><span className="num">{preview.length}</span></div>
            <div className="spread"><span className="muted">Mögliche Duplikate</span><span className="num">{dupes}</span></div>
            {errors > 0 && <div className="spread"><span className="muted">Nicht lesbar</span><span className="num">{errors}</span></div>}
            <div className="spread"><strong>Zum Import ausgewählt</strong><strong className="num">{selected}</strong></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn small grow" onClick={() => setChoices((cs) => cs.map((c, i) => ({ ...c, include: !preview[i].error })))}>Alle</button>
            <button className="btn small grow" onClick={() => setChoices((cs) => cs.map((c, i) => ({ ...c, include: !preview[i].error && preview[i].duplicate === 'none' })))}>Nur neue</button>
            <button className="btn small grow" onClick={() => setChoices((cs) => cs.map((c) => ({ ...c, include: false })))}>Keine</button>
          </div>
          <div className="list">
            {preview.slice(0, shown).map((r, i) => {
              const ch = choices[i];
              const type = (r.amount ?? 0) < 0 ? 'expense' : 'income';
              return (
                <div key={r.line} className={`import-row${ch.include ? '' : ' dim'}`}>
                  <input
                    type="checkbox"
                    checked={ch.include}
                    disabled={!!r.error}
                    aria-label={`Zeile ${r.line} importieren`}
                    onChange={(e) => setChoices((cs) => cs.map((c, j) => (j === i ? { ...c, include: e.target.checked } : c)))}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontWeight: 500 }}>{r.text || '—'}</div>
                    <div className="small muted row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {r.date ? formatDate(r.date) : `Zeile ${r.line}`}
                      {r.duplicate === 'exact' && <span className="tag warn">Bereits importiert</span>}
                      {r.duplicate === 'possible' && <span className="tag warn">Evtl. schon erfasst</span>}
                      {r.error && <span className="tag danger">{r.error}</span>}
                    </div>
                  </div>
                  <span className={`amt ${type}`}>{r.amount != null ? formatSigned(r.amount) : '–'}</span>
                  {!r.error && (
                    <select
                      className="select"
                      value={ch.categoryId ?? ''}
                      aria-label="Kategorie"
                      onChange={(e) => setChoices((cs) => cs.map((c, j) => (j === i ? { ...c, categoryId: Number(e.target.value) } : c)))}
                    >
                      {categories.filter((c) => c.kind === type && !c.archived).map((c) => (
                        <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
          {shown < preview.length && (
            <button className="btn block" onClick={() => setShown((s) => s + PAGE)}>Weitere {Math.min(PAGE, preview.length - shown)} anzeigen</button>
          )}
          <div className="row">
            <button className="btn" onClick={() => setStep('map')}>Zurück</button>
            <button className="btn primary grow" disabled={selected === 0} onClick={doImport}>
              {selected === 1 ? '1 Buchung importieren' : `${selected} Buchungen importieren`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <EmptyState
          emoji="✅"
          title="Import abgeschlossen"
          text={`${imported} Buchungen wurden importiert. Die Spaltenzuordnung ist für diese Bank gespeichert.`}
          action={
            <div className="stack" style={{ gap: 8 }}>
              <Link className="btn primary" to="/buchungen">Zu den Buchungen</Link>
              <button className="btn" onClick={() => setStep('file')}>Weitere Datei importieren</button>
            </div>
          }
        />
      )}
    </div>
  );
}

function effective(m: CsvMapping, mode: 'single' | 'split'): CsvMapping {
  return mode === 'single' ? { ...m, debit: null, credit: null } : { ...m, amount: null };
}
