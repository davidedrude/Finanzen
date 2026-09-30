import { describe, expect, it } from 'vitest';
import { goalCurrent, goalProgress, monthsUntil } from './goals';
import type { Goal } from './types';

const goal = (p: Partial<Goal> = {}): Goal => ({
  name: 'Urlaub', emoji: '✈️', targetAmount: 120_000, targetDate: '2026-12-31',
  startDate: '2026-01-01', startAmount: 0, manualAmount: 0, ...p,
});

describe('Sparziele', () => {
  it('monthsUntil', () => {
    expect(monthsUntil('2026-09-30', '2026-12-31')).toBe(3);
    expect(monthsUntil('2026-09-30', '2026-10-15')).toBe(0);
    expect(monthsUntil('2026-09-01', '2027-09-01')).toBe(12);
  });

  it('nötige Rate pro Monat (aufgerundet auf Cent)', () => {
    const p = goalProgress(goal(), 30_000, '2026-09-30');
    expect(p.remaining).toBe(90_000);
    expect(p.monthsLeft).toBe(3);
    expect(p.perMonth).toBe(30_000);
    expect(goalProgress(goal({ targetAmount: 100_000 }), 0, '2026-09-30').perMonth).toBe(33_334);
  });

  it('im Plan nach linearem Verlauf', () => {
    // Hälfte der Zeit ~ 2026-07-02 → erwartet ~60.000
    const mid = goalProgress(goal(), 60_000, '2026-07-02');
    expect(mid.expected).toBeGreaterThan(59_000);
    expect(mid.expected).toBeLessThan(61_000);
    expect(goalProgress(goal(), 61_000, '2026-07-02').onTrack).toBe(true);
    expect(goalProgress(goal(), 40_000, '2026-07-02').onTrack).toBe(false);
  });

  it('berücksichtigt den Startstand', () => {
    const g = goal({ startAmount: 60_000 });
    expect(goalProgress(g, 60_000, '2026-01-01').expected).toBe(60_000);
    expect(goalProgress(g, 60_000, '2026-01-01').onTrack).toBe(true);
  });

  it('erreicht und überfällig', () => {
    const r = goalProgress(goal(), 130_000, '2026-09-30');
    expect(r.reached).toBe(true);
    expect(r.perMonth).toBe(0);
    expect(r.ratio).toBe(1);
    const o = goalProgress(goal(), 100_000, '2027-01-15');
    expect(o.overdue).toBe(true);
    expect(o.perMonth).toBe(20_000);
  });

  it('Letzter Monat: mindestens 1 Monat', () => {
    expect(goalProgress(goal(), 0, '2026-12-20').monthsLeft).toBe(1);
  });

  it('Stand aus verknüpftem Konto oder manuell', () => {
    const balances = new Map([[7, 55_500]]);
    expect(goalCurrent(goal({ accountId: 7 }), balances)).toBe(55_500);
    expect(goalCurrent(goal({ manualAmount: 1_234 }), balances)).toBe(1_234);
  });
});
