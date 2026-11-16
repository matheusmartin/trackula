import { describe, expect, test } from 'vitest';
import { Day, addMonths, daysBetween, daysOfMonth, earliestDay, monthOf, sameMonth, weekRows } from './Day.js';

describe('Day', () => {
  const d30 = Day.of(2026, 9, 30);

  test('parses and formats ISO dates', () => {
    expect(Day.tryParse('2026-09-30')).toBe(d30);
    expect(d30.toString()).toBe('2026-09-30');
    expect(`${d30}`).toBe('2026-09-30');
  });

  test('gives one object for each date', () => {
    expect(Day.of(2026, 10, 1)).toBe(d30.addDays(1));
    expect(new Map([[d30, 1]]).get(Day.tryParse('2026-09-30') ?? d30)).toBe(1);
  });

  test('adds days across month ends and knows the weekday', () => {
    expect(d30.addDays(1)).toBe(Day.of(2026, 10, 1));
    expect(d30.addDays(-30)).toBe(Day.of(2026, 8, 31));
    expect(d30.weekday).toBe(3); // Wednesday.
  });

  test('converts Google Sheets date serial numbers', () => {
    expect(Day.of(2026, 10, 2).serial).toBe(46297);
    expect(Day.of(1900, 3, 1).serial).toBe(61);
    expect(Day.fromSerial(46297)).toBe(Day.of(2026, 10, 2));
    // The fraction is the time of day.
    expect(Day.fromSerial(46297.75)).toBe(Day.of(2026, 10, 2));
    expect(Day.fromSerial(0)).toBeNull();
    expect(Day.fromSerial(NaN)).toBeNull();
    expect(Day.fromSerial(1e10)).toBeNull();
    expect(Day.fromSerial(2958465.5)).toBe(Day.of(9999, 12, 31));
    for (const d of [Day.of(2024, 2, 29), Day.of(2026, 3, 29), Day.of(2026, 12, 31)]) {
      expect(Day.fromSerial(d.serial)).toBe(d);
    }
  });

  test('rejects invalid dates', () => {
    expect(Day.tryParse('2026-02-30')).toBeNull();
    expect(Day.tryParse('30/09/2026')).toBeNull();
    expect(Day.tryParse('')).toBeNull();
  });

  test('of moves values out of range into other months', () => {
    expect(Day.of(2026, 13, 1)).toBe(Day.of(2027, 1, 1));
    expect(`${Day.of(2026, 3, 0)}`).toBe('2026-02-28');
    expect(`${Day.of(2026, 0, 1)}`).toBe('2025-12-01');
    expect(`${Day.of(2024, 2, 30)}`).toBe('2024-03-01');
    expect(`${Day.of(2026, 15, 1)}`).toBe('2027-03-01');
    expect(`${Day.of(2026, -1, 30)}`).toBe('2025-11-30');
  });

  test('epoch day round trips over many years', () => {
    expect(Day.of(1970, 1, 1).epochDay).toBe(0);
    expect(Day.of(1970, 1, 1).weekday).toBe(4); // Thursday.
    expect(`${Day.fromEpochDay(-1)}`).toBe('1969-12-31');
    for (let n = -800_000; n <= 800_000; n += 997) expect(Day.fromEpochDay(n).epochDay).toBe(n);
  });

  test('compares by date', () => {
    expect(Day.of(2025, 12, 31).isBefore(Day.of(2026, 1, 1))).toBe(true);
    expect(Day.of(2026, 2, 1).isAfter(Day.of(2026, 1, 31))).toBe(true);
    expect([Day.of(2026, 2, 1), Day.of(2025, 1, 1)].sort(Day.compare).map(String)).toEqual([
      '2025-01-01',
      '2026-02-01',
    ]);
  });

  test('daysBetween gives all days oldest first, and none if the last day is before the first', () => {
    expect(daysBetween(Day.of(2026, 2, 27), Day.of(2026, 3, 2)).map(String)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(daysBetween(Day.of(2026, 3, 2), Day.of(2026, 3, 1))).toEqual([]);
  });

  test('earliestDay gives the earliest day or null', () => {
    expect(earliestDay([Day.of(2026, 3, 2), Day.of(2025, 12, 31), Day.of(2026, 1, 1)])).toBe(Day.of(2025, 12, 31));
    expect(earliestDay([])).toBeNull();
  });

  test('monthOf, addMonths and daysOfMonth', () => {
    expect(monthOf(Day.of(2026, 2, 14))).toEqual({ year: 2026, month: 2 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 });
    expect(sameMonth({ year: 2026, month: 2 }, monthOf(Day.of(2026, 2, 1)))).toBe(true);
    const february = daysOfMonth({ year: 2028, month: 2 });
    expect(february.length).toBe(29);
    expect([february[0], february[28]]).toEqual([Day.of(2028, 2, 1), Day.of(2028, 2, 29)]);
  });

  test('weekRows go Monday to Sunday with null before the first day and after the last day', () => {
    // 2026-10-01 is a Thursday.
    const weeks = weekRows(daysBetween(Day.of(2026, 10, 1), Day.of(2026, 10, 12)));
    expect(weeks.map((w) => w.map((d) => d?.day ?? null))).toEqual([
      [null, null, null, 1, 2, 3, 4],
      [5, 6, 7, 8, 9, 10, 11],
      [12, null, null, null, null, null, null],
    ]);
  });
});
