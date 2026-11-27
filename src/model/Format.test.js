import { describe, expect, test } from 'vitest';
import { Day, daysBetween, weekRows } from './Day.js';
import {
  barLabel,
  barTitle,
  formatCompact,
  formatDateRange,
  formatDays,
  formatFixed,
  formatNumber,
  formatPercent,
  formatScore,
  formatScoreChange,
  formatSigned,
  formatTrimmed,
  formatValue,
  formatValueChange,
  monthPairTitle,
  monthTitle,
  shortDay,
  shortMonth,
  weekLabels,
  withUnit,
} from './Format.js';
import { BarUnit } from './Zoom.js';

describe('Format', () => {
  test('formatNumber uses the minus sign, and a comma between the thousands from 10,000', () => {
    expect([-2, 9500, 12500, -12500.25, 1234567].map((v) => formatNumber(v))).toEqual([
      '−2',
      '9500',
      '12,500',
      '−12,500.3',
      '1,234,567',
    ]);
  });

  test('formatFixed keeps the zeros at the end, and a value that rounds to 0 has no sign', () => {
    expect(formatFixed(82, 1)).toBe('82.0');
    expect(formatFixed(12500, 0)).toBe('12,500');
    expect(formatFixed(-0.04, 1)).toBe('0.0');
  });

  test('a value has the decimals of the step of its metric, and its change has a sign', () => {
    expect(formatValue(82, 0.1, 'kg')).toBe('82.0 kg');
    expect(formatValue(12500, 1, 'steps')).toBe('12,500 steps');
    expect(formatValue(1.25, 0.25, null)).toBe('1.25');
    expect(formatValueChange(-1.4, 0.1, 'kg')).toBe('−1.4 kg');
    expect(formatValueChange(2, 1, 'glasses')).toBe('+2 glasses');
    expect(formatValueChange(0.04, 0.1, 'kg')).toBe('0.0 kg');
  });

  test('a score has 1 decimal, and its change has a sign', () => {
    expect(formatScore(57)).toBe('57.0%');
    expect(formatScoreChange(4)).toBe('+4.0%');
    expect(formatScoreChange(-1.25)).toBe('−1.3%');
    expect(formatScoreChange(0.02)).toBe('0.0%');
  });

  test('formatDays gives the word day or days', () => {
    expect([1, 0, 105].map(formatDays)).toEqual(['1 day', '0 days', '105 days']);
  });

  test('shortMonth and shortDay', () => {
    expect([shortMonth(1), shortMonth(9), shortMonth(12)]).toEqual(['Jan', 'Sep', 'Dec']);
    expect(shortDay(Day.of(2026, 9, 28))).toBe('Sep 28');
  });

  test('formatTrimmed removes the zeros at the end and the float noise', () => {
    expect(
      [82, 2.5, 2500, 82.10000000000001, 82.00000000000001, -3.9999999999999996, -0.0000001].map(formatTrimmed),
    ).toEqual(['82', '2.5', '2500', '82.1', '82', '-4', '0']);
  });

  test('formatNumber rounds to the decimals', () => {
    expect([formatNumber(81.25), formatNumber(81.04), formatNumber(81.256, 2), formatNumber(2.9999, 3)]).toEqual([
      '81.3',
      '81',
      '81.26',
      '3',
    ]);
  });

  test('formatCompact gives one decimal at most, and k from 1000', () => {
    expect([82.25, 7, 12500, 1000, -1500].map(formatCompact)).toEqual(['82.3', '7', '12.5k', '1k', '−1.5k']);
  });

  test('withUnit, formatSigned and formatPercent', () => {
    expect([withUnit('82.1', 'kg'), withUnit('5', null), withUnit('73', '%')]).toEqual(['82.1 kg', '5', '73%']);
    expect(formatSigned(5.2, '%')).toBe('+5.2%');
    expect([formatSigned(-1.3, 'kg'), formatSigned(0.456, null), formatSigned(0, 'kg')]).toEqual([
      '−1.3 kg',
      '+0.46',
      '0 kg',
    ]);
    expect([0.756, 0, 1, 0.025].map(formatPercent)).toEqual(['76%', '0%', '100%', '3%']);
  });

  test('formatDateRange shows the year once, or twice across a year', () => {
    expect(formatDateRange(Day.of(2026, 7, 6), Day.of(2026, 10, 3))).toBe('Jul 6 – Oct 3, 2026');
    expect(formatDateRange(Day.of(2025, 11, 3), Day.of(2026, 2, 1))).toBe('Nov 3, 2025 – Feb 1, 2026');
  });

  test('monthTitle and monthPairTitle', () => {
    expect(monthTitle({ year: 2026, month: 10 })).toBe('October 2026');
    expect(monthPairTitle({ year: 2026, month: 9 }, { year: 2026, month: 10 })).toBe('September – October 2026');
    expect(monthPairTitle({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBe('December 2025 – January 2026');
  });

  test('weekLabels show the month on the first row and when it changes', () => {
    const weeks = weekRows(daysBetween(Day.of(2026, 9, 2), Day.of(2026, 10, 6)));
    expect(weekLabels(weeks)).toEqual(['Sep 2', '7', '14', '21', '28', 'Oct 5']);
  });

  test('barLabel and barTitle', () => {
    const start = Day.of(2026, 9, 28);
    expect(barLabel(start, BarUnit.WEEK)).toBe('Sep 28');
    expect([barLabel(Day.of(2026, 9, 1), BarUnit.MONTH), barLabel(Day.of(2026, 1, 1), BarUnit.MONTH)]).toEqual([
      'Sep',
      'Jan ’26',
    ]);
    expect(barLabel(Day.of(2026, 9, 1), BarUnit.MONTH, true)).toBe('Sep ’26');
    expect(barLabel(Day.of(2026, 7, 1), BarUnit.QUARTER)).toBe('Q3 ’26');
    expect(barTitle(start, BarUnit.WEEK)).toBe('Week of Sep 28, 2026');
    expect(barTitle(Day.of(2026, 9, 1), BarUnit.MONTH)).toBe('Sep 2026');
    expect(barTitle(Day.of(2026, 10, 1), BarUnit.QUARTER)).toBe('Q4 2026');
  });
});
