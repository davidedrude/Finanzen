import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, formatSigned, parseAmount } from './money';

describe('parseAmount', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['12,5', 1250],
    ['12.50', 1250],
    ['1.234', 123400],
    ['1.234.567,89', 123456789],
    ['1,234.56', 123456],
    ['-12,34', -1234],
    ['−12,34 €', -1234],
    ['12,34-', -1234],
    ['+5', 500],
    ['0,01', 1],
    ['1.234,565', 123457],
    ['  3 000,00 EUR ', 300000],
    [',5', 50],
  ])('%s → %i', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '12a', '-', '1,2,3x'])('ungültig: %s', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it('kennt keine Float-Fehler (0,1 + 0,2)', () => {
    expect(parseAmount('0,1')! + parseAmount('0,2')!).toBe(30);
    expect(parseAmount('19,99')! * 3).toBe(5997);
  });
});

describe('Formatierung', () => {
  it('formatiert deutsch', () => {
    expect(formatCents(123456).replace(/ /g, ' ')).toBe('1.234,56 €');
    expect(formatCents(-5).replace(/ /g, ' ')).toBe('−0,05 €');
    expect(formatSigned(1000).replace(/ /g, ' ')).toBe('+10,00 €');
    expect(formatSigned(-1000).replace(/ /g, ' ')).toBe('−10,00 €');
  });
  it('Eingabeformat', () => {
    expect(centsToInput(123456)).toBe('1234,56');
    expect(centsToInput(-5)).toBe('-0,05');
  });
});
