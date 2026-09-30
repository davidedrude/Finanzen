import { daysBetween, parts } from './dates';
import type { Cents, Goal, ISODate } from './types';

export interface GoalProgress {
  current: Cents;
  target: Cents;
  remaining: Cents;
  /** 0..1 */
  ratio: number;
  /** Verbleibende Monate bis zum Zieldatum (mind. 1, solange nicht überfällig). */
  monthsLeft: number;
  /** Nötige Sparrate pro Monat, um das Ziel pünktlich zu erreichen. */
  perMonth: Cents;
  /** Linear erwarteter Stand zum heutigen Tag. */
  expected: Cents;
  onTrack: boolean;
  reached: boolean;
  overdue: boolean;
}

/**
 * Verbleibende Monate: Zieldatum 31.12. ab 30.09. → Okt, Nov, Dez = 3.
 * Liegt der Zieltag vor dem heutigen Tag im Monat, zählt der angebrochene Monat nicht.
 */
export function monthsUntil(today: ISODate, target: ISODate): number {
  const [y, m, d] = parts(today);
  const [ty, tm, td] = parts(target);
  let diff = ty * 12 + tm - (y * 12 + m);
  if (td < d) diff -= 1;
  return diff;
}

export function goalProgress(goal: Goal, current: Cents, today: ISODate): GoalProgress {
  const target = goal.targetAmount;
  const remaining = Math.max(0, target - current);
  const reached = current >= target;
  const overdue = !reached && today > goal.targetDate;
  const monthsLeft = overdue ? 0 : Math.max(1, monthsUntil(today, goal.targetDate));
  const perMonth = reached ? 0 : overdue ? remaining : Math.ceil(remaining / monthsLeft);

  const total = daysBetween(goal.startDate, goal.targetDate);
  const elapsed = daysBetween(goal.startDate, today);
  const fraction = total <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / total));
  const expected = Math.round(goal.startAmount + (target - goal.startAmount) * fraction);

  return {
    current,
    target,
    remaining,
    ratio: target > 0 ? Math.min(1, Math.max(0, current / target)) : 1,
    monthsLeft,
    perMonth,
    expected,
    onTrack: reached || current >= expected,
    reached,
    overdue,
  };
}

/** Aktueller Stand eines Ziels: Kontosaldo bei Verknüpfung, sonst manueller Stand. */
export function goalCurrent(goal: Goal, balances: Map<number, Cents>): Cents {
  if (goal.accountId != null) return balances.get(goal.accountId) ?? 0;
  return goal.manualAmount;
}
