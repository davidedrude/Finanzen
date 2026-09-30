import { describe, expect, it } from 'vitest';
import { advanceNextDue, dueOccurrences, nextOccurrence } from './recurring';
import type { Recurring } from './types';

const rec = (p: Partial<Recurring>): Recurring => ({
  type: 'expense', amount: 1_000, accountId: 1, interval: 'monthly',
  startDate: '2026-01-31', nextDue: '2026-01-31', active: true, ...p,
});

describe('Wiederkehrende Buchungen', () => {
  it('Monatsende bleibt erhalten', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(nextOccurrence('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
  });
  it('Intervalle', () => {
    expect(nextOccurrence('2026-09-28', 'weekly', 28)).toBe('2026-10-05');
    expect(nextOccurrence('2026-09-15', 'quarterly', 15)).toBe('2026-12-15');
    expect(nextOccurrence('2028-02-29', 'yearly', 29)).toBe('2029-02-28');
  });
  it('holt verpasste Termine nach', () => {
    const r = rec({});
    const due = dueOccurrences(r, '2026-04-29');
    expect(due).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(advanceNextDue(r, due)).toBe('2026-04-30');
    expect(dueOccurrences({ ...r, nextDue: '2026-04-30' }, '2026-04-30')).toEqual(['2026-04-30']);
  });
  it('nichts in der Zukunft, respektiert Enddatum und Pause', () => {
    expect(dueOccurrences(rec({ nextDue: '2026-10-01', startDate: '2026-10-01' }), '2026-09-30')).toEqual([]);
    expect(dueOccurrences(rec({ endDate: '2026-02-28' }), '2026-12-31')).toHaveLength(2);
    expect(dueOccurrences(rec({ active: false }), '2026-12-31')).toEqual([]);
  });
});
