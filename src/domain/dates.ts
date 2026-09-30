import type { ISODate, MonthKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function parts(date: ISODate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

export function makeISO(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function currentMonth(): MonthKey {
  return monthOf(todayISO());
}

export function addMonthsToKey(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/**
 * Addiert Monate und klemmt den Tag auf das Monatsende.
 * `anchorDay` erlaubt, den ursprünglichen Tag (z. B. 31.) über kurze Monate zu retten.
 */
export function addMonths(date: ISODate, delta: number, anchorDay?: number): ISODate {
  const [y, m, d] = parts(date);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return makeISO(ny, nm, day);
}

export function addDays(date: ISODate, delta: number): ISODate {
  const [y, m, d] = parts(date);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Ganze Tage von a nach b (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Die letzten n Monatsschlüssel bis einschließlich `end`, aufsteigend. */
export function lastMonths(end: MonthKey, n: number): MonthKey[] {
  return Array.from({ length: n }, (_, i) => addMonthsToKey(end, i - n + 1));
}

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const monthShort = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const weekdayShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function monthName(key: MonthKey): string {
  return monthNames[Number(key.slice(5, 7)) - 1];
}

export function monthLabel(key: MonthKey): string {
  return `${monthName(key)} ${key.slice(0, 4)}`;
}

export function monthShortLabel(key: MonthKey): string {
  return monthShort[Number(key.slice(5, 7)) - 1];
}

/** "30.09.2026" */
export function formatDate(date: ISODate): string {
  const [y, m, d] = parts(date);
  return `${pad(d)}.${pad(m)}.${y}`;
}

/** "Heute", "Gestern" oder "Mo, 28. September" (Jahr nur, wenn nicht aktuell). */
export function formatDayHeading(date: ISODate, today = todayISO()): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (diff === -1) return 'Morgen';
  const [y, m, d] = parts(date);
  const wd = weekdayShort[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const year = y === parts(today)[0] ? '' : ` ${y}`;
  return `${wd}, ${d}. ${monthNames[m - 1]}${year}`;
}

/** Kurzform für Chips: "Heute", "Gestern" oder "28.09." */
export function formatDateChip(date: ISODate, today = todayISO()): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  const [y, m, d] = parts(date);
  return y === parts(today)[0] ? `${pad(d)}.${pad(m)}.` : formatDate(date);
}

/**
 * Datum aus Kontoauszügen: "30.09.2026", "30.09.26", "2026-09-30", "30/09/2026".
 */
export function parseDate(input: string): ISODate | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/);
  if (m) {
    let y = Number(m[3]);
    if (m[3].length === 2) y += y >= 70 ? 1900 : 2000;
    return valid(y, Number(m[2]), Number(m[1]));
  }
  return null;
}

function valid(y: number, m: number, d: number): ISODate | null {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return makeISO(y, m, d);
}
