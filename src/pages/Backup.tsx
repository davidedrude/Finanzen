import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { PageHeader, Sheet } from '../components/ui';
import { BackupError, exportBackup, restoreBackup, validateBackup, wipeAll, type BackupFile } from '../db/backup';
import { useMeta, useTransactions } from '../db/hooks';

export function BackupPage() {
  const lastBackup = useMeta<number>('lastBackupAt');
  const txs = useTransactions();
  const toast = useToast();
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
    }).catch(() => {});
  }, []);

  async function onExport() {
    const r = await exportBackup();
    if (r !== 'cancelled') toast('Backup erstellt');
  }

  async function onFile(file: File) {
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      setPending(backup);
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'Die Datei konnte nicht gelesen werden.');
    }
  }

  const days = lastBackup ? Math.floor((Date.now() - lastBackup) / 86_400_000) : null;

  return (
    <div className="page stack">
      <PageHeader title="Backup & Daten" back />

      <section className="card stack" style={{ gap: 12 }}>
        <div>
          <strong>Backup exportieren</strong>
          <p className="small muted" style={{ marginTop: 4 }}>
            Speichert alle Konten, Buchungen, Kategorien, Budgets und Sparziele als JSON-Datei. Auf dem iPhone
            wählst du danach „In Dateien sichern“.
          </p>
        </div>
        <p className={`small ${days != null && days >= 30 ? 'status warn' : 'muted'}`}>
          {days != null && days >= 30 && <Icon name="alert" size={14} stroke={2.4} />}
          {lastBackup == null
            ? 'Noch kein Backup erstellt.'
            : days === 0 ? 'Letztes Backup: heute' : `Letztes Backup: vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`}
        </p>
        <button className="btn primary block" onClick={onExport}>
          <Icon name="download" size={18} /> Backup speichern
        </button>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <div>
          <strong>Backup wiederherstellen</strong>
          <p className="small muted" style={{ marginTop: 4 }}>Ersetzt alle aktuellen Daten durch den Stand aus der Datei.</p>
        </div>
        <label className="btn block" style={{ position: 'relative' }}>
          <Icon name="upload" size={18} /> Backup-Datei wählen
          <input
            type="file"
            accept="application/json,.json"
            style={{ position: 'absolute', inset: 0, opacity: 0 }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = '';
            }}
          />
        </label>
      </section>

      <section className="card stack" style={{ gap: 8 }}>
        <strong>Speicher</strong>
        <div className="spread small"><span className="muted">Buchungen</span><span className="num">{txs?.length ?? '–'}</span></div>
        {usage && <div className="spread small"><span className="muted">Belegter Speicher</span><span className="num">{usage}</span></div>}
        <div className="spread small">
          <span className="muted">Dauerhafter Speicher</span>
          <span>{persisted == null ? '–' : persisted ? 'Ja' : 'Nein'}</span>
        </div>
        {persisted === false && (
          <p className="hint">
            Der Browser darf die Daten bei Speicherknappheit löschen. Installiere die App über „Zum Home-Bildschirm“ und
            erstelle regelmäßig Backups.
          </p>
        )}
      </section>

      <button className="btn danger block" onClick={() => setConfirmWipe(true)}>
        <Icon name="trash" size={18} /> Alle Daten löschen
      </button>

      {pending && (
        <Sheet title="Backup wiederherstellen?" onClose={() => setPending(null)}>
          <div className="stack">
            <p className="muted">
              Backup vom {new Date(pending.exportedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} mit{' '}
              {pending.data.transactions.length} Buchungen und {pending.data.accounts.length} Konten. Alle aktuellen Daten
              auf diesem Gerät werden ersetzt.
            </p>
            <button
              className="btn primary block"
              onClick={async () => {
                await restoreBackup(pending);
                setPending(null);
                toast('Backup wiederhergestellt');
              }}
            >
              Ja, ersetzen
            </button>
            <button className="btn block" onClick={() => setPending(null)}>Abbrechen</button>
          </div>
        </Sheet>
      )}

      {confirmWipe && (
        <Sheet title="Wirklich alles löschen?" onClose={() => setConfirmWipe(false)}>
          <div className="stack">
            <p className="muted">
              Alle Konten, Buchungen und Einstellungen werden unwiderruflich von diesem Gerät entfernt. Erstelle vorher
              ein Backup, wenn du die Daten behalten möchtest.
            </p>
            <button
              className="btn danger block"
              onClick={async () => {
                await wipeAll();
                location.reload();
              }}
            >
              Endgültig löschen
            </button>
            <button className="btn block" onClick={() => setConfirmWipe(false)}>Abbrechen</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
