import { addDays, addMonths, parts } from './dates';
import type { ISODate, Interval, Recurring } from './types';

const MONTHS: Record<Exclude<Interval, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export const intervalLabel: Record<Interval, string> = {
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  yearly: 'Jährlich',
};

/**
 * Nächster Termin nach `date`. Bei Monatsintervallen bleibt der Ankertag erhalten:
 * Start 31.01. → 28./29.02. → 31.03.
 */
export function nextOccurrence(date: ISODate, interval: Interval, anchorDay: number): ISODate {
  if (interval === 'weekly') return addDays(date, 7);
  return addMonths(date, MONTHS[interval], anchorDay);
}

/** Alle fälligen, noch nicht angelegten Termine bis einschließlich `today`. */
export function dueOccurrences(rec: Recurring, today: ISODate, max = 500): ISODate[] {
  if (!rec.active) return [];
  const anchor = parts(rec.startDate)[2];
  const out: ISODate[] = [];
  let d = rec.nextDue;
  while (d <= today && (!rec.endDate || d <= rec.endDate) && out.length < max) {
    out.push(d);
    d = nextOccurrence(d, rec.interval, anchor);
  }
  return out;
}

/** Neuer `nextDue` nach dem Anlegen der übergebenen Termine. */
export function advanceNextDue(rec: Recurring, created: ISODate[]): ISODate {
  if (created.length === 0) return rec.nextDue;
  const anchor = parts(rec.startDate)[2];
  return nextOccurrence(created[created.length - 1], rec.interval, anchor);
}

/** Beendet: Enddatum überschritten. */
export function isFinished(rec: Recurring): boolean {
  return rec.endDate != null && rec.nextDue > rec.endDate;
}
