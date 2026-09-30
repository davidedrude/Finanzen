import { todayISO } from '../domain/dates';
import { db, setMeta, TABLES } from './db';

export const BACKUP_FORMAT = 'finanzen-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export async function createBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) data[t] = await db.table(t).toArray();
  });
  // Backup-Zeitpunkt nicht mitsichern – er gehört zum Gerät.
  data.meta = (data.meta as { key: string }[]).filter((m) => m.key !== 'lastBackupAt');
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(): string {
  return `finanzen-backup-${todayISO()}.json`;
}

/** Speichert das Backup: auf Mobilgeräten über das Teilen-Menü (→ "In Dateien sichern"), sonst als Download. */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const backup = await createBackup();
  const json = JSON.stringify(backup);
  const name = backupFileName();
  const file = new File([json], name, { type: 'application/json' });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Finanzen-Backup' });
      await setMeta('lastBackupAt', Date.now());
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await setMeta('lastBackupAt', Date.now());
  return 'downloaded';
}

export class BackupError extends Error {}

export function validateBackup(raw: unknown): BackupFile {
  const b = raw as BackupFile;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) {
    throw new BackupError('Diese Datei ist kein Finanzen-Backup.');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('Das Backup stammt aus einer neueren App-Version.');
  }
  for (const t of TABLES) {
    if (!Array.isArray(b.data?.[t])) throw new BackupError(`Im Backup fehlt der Bereich „${t}“.`);
  }
  for (const tx of b.data.transactions as Record<string, unknown>[]) {
    if (!Number.isInteger(tx.amount) || typeof tx.date !== 'string') {
      throw new BackupError('Das Backup enthält ungültige Buchungen.');
    }
  }
  return b;
}

/** Ersetzt alle Daten durch das Backup (atomar). */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(backup.data[t]);
    }
  });
  await setMeta('lastBackupAt', Date.now());
}

/** Löscht die komplette Datenbank. Danach muss die App neu geladen werden. */
export async function wipeAll(): Promise<void> {
  await db.delete();
}
