import { describe, expect, it } from 'vitest';
import { addMonths, addMonthsToKey, daysBetween, formatDayHeading, lastMonths, parseDate } from './dates';

describe('dates', () => {
  it('addMonths klemmt auf Monatsende', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('Monatsschlüssel', () => {
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(lastMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
  it('parseDate', () => {
    expect(parseDate('30.09.2026')).toBe('2026-09-30');
    expect(parseDate('1.2.26')).toBe('2026-02-01');
    expect(parseDate('2026-09-30')).toBe('2026-09-30');
    expect(parseDate('31.02.2026')).toBeNull();
    expect(parseDate('foo')).toBeNull();
  });
  it('Tagesüberschrift', () => {
    expect(formatDayHeading('2026-09-30', '2026-09-30')).toBe('Heute');
    expect(formatDayHeading('2026-09-29', '2026-09-30')).toBe('Gestern');
    expect(formatDayHeading('2026-09-28', '2026-09-30')).toBe('Mo, 28. September');
  });
});
