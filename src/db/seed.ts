import type { Category, CategoryKind } from '../domain/types';

/** Gedämpfte Farbpalette für Kategorien und Konten. */
export const PALETTE = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
  '#1f6f6b', '#8a6d3b', '#6b7280', '#0e7490',
];

const c = (name: string, emoji: string, color: string, kind: CategoryKind, order: number): Category => ({
  name, emoji, color, kind, order, archived: false, lastUsedAt: 0,
});

export function defaultCategories(): Category[] {
  const expense: [string, string, string][] = [
    ['Lebensmittel', '🛒', '#1baf7a'],
    ['Restaurant & Café', '☕', '#eb6834'],
    ['Wohnen', '🏠', '#2a78d6'],
    ['Nebenkosten', '⚡', '#eda100'],
    ['Mobilität', '🚆', '#0e7490'],
    ['Gesundheit', '💊', '#e34948'],
    ['Versicherungen', '🛡️', '#4a3aa7'],
    ['Abos & Medien', '📺', '#e87ba4'],
    ['Kleidung', '👕', '#8a6d3b'],
    ['Freizeit', '🎟️', '#008300'],
    ['Reisen', '✈️', '#1f6f6b'],
    ['Haushalt', '🧺', '#6b7280'],
    ['Geschenke', '🎁', '#e87ba4'],
    ['Bildung', '📚', '#4a3aa7'],
    ['Sonstiges', '📦', '#6b7280'],
  ];
  const income: [string, string, string][] = [
    ['Gehalt', '💼', '#1f6f6b'],
    ['Nebeneinkünfte', '💶', '#1baf7a'],
    ['Erstattungen', '↩️', '#2a78d6'],
    ['Zinsen & Dividenden', '📈', '#008300'],
    ['Sonstige Einnahmen', '➕', '#6b7280'],
  ];
  return [
    ...expense.map(([n, e, col], i) => c(n, e, col, 'expense', i)),
    ...income.map(([n, e, col], i) => c(n, e, col, 'income', i)),
  ];
}

export const EMOJI_CHOICES = [
  '🛒', '☕', '🍽️', '🍕', '🏠', '⚡', '💧', '📱', '🌐', '🚆', '🚗', '⛽', '🚲', '💊', '🩺', '🛡️',
  '📺', '🎵', '🎮', '👕', '👟', '💇', '🎟️', '🏋️', '✈️', '🏖️', '🧺', '🔧', '🎁', '📚', '🎓', '🐶',
  '👶', '💝', '🏦', '💳', '📦', '💼', '💶', '📈', '↩️', '➕', '🧾', '🚬', '🍷', '💻', '🪴', '⭐',
];
