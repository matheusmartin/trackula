import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { metricDayKey } from './LogEntry.js';
import { parseLog } from './Parse.js';
import { dayValues, metricValues, nearestDay } from './Summary.js';
import { byId, meditate, rows, water, weight } from './testing/Fixtures.js';

describe('Summary', () => {
  const metrics = byId(weight, water, meditate);
  const d28 = Day.of(2026, 9, 28);
  const d29 = Day.of(2026, 9, 29);
  const d30 = Day.of(2026, 9, 30);

  test('dayValues gives the values of the metric and leaves out a no day like a day without a value', () => {
    const log = parseLog(
      rows(['date', 'meditate', 'water'], ['2026-09-28', 'yes', 8], ['2026-09-29', 'no', ''], ['2026-09-30', 'yes', 5]),
      metrics,
    ).table;
    expect(dayValues(water, log)).toEqual(
      new Map([
        [d28, 8],
        [d30, 5],
      ]),
    );
    expect([...dayValues(meditate, log).keys()]).toEqual([d28, d30]);
    expect(metricValues(meditate, log)).toEqual(
      new Map([
        [d28, 1],
        [d29, 0],
        [d30, 1],
      ]),
    );
  });

  test('metricValues gives the value of the last row of a day, also if its cell is empty', () => {
    const log = parseLog(
      rows(['date', 'water'], ['2026-09-28', 8], ['2026-09-28', 5], ['2026-09-29', 3], ['2026-09-29', '']),
      metrics,
    ).table;
    expect(metricValues(water, log)).toEqual(new Map([[d28, 5]]));
    expect(metricValues(water, log).get(d29) ?? null).toBe(log.valueAt('water', d29));
  });

  test('dayValues adds the count taps that are not written yet', () => {
    const p = parseLog(rows(['date', 'water'], ['2026-09-29', 8], ['2026-09-30', 1]), metrics);
    const pending = new Map([
      [metricDayKey('water', d29), [{ delta: 1 }, { delta: 1 }]],
      [metricDayKey('water', d30), [{ delta: -1 }]],
      [metricDayKey('weight', d29), [{ delta: 5 }]],
    ]);
    expect(dayValues(water, p.table, pending)).toEqual(new Map([[d29, 10]]));
  });

  test('nearestDay gives the nearest day before, else the nearest day after', () => {
    const days = [d29, Day.of(2026, 9, 25), Day.of(2026, 10, 3), Day.of(2026, 10, 1)];
    expect(nearestDay(days, d30)).toBe(d29);
    expect(nearestDay(days, Day.of(2026, 9, 20))).toBe(Day.of(2026, 9, 25));
    expect(nearestDay([d30], d30)).toBeNull();
    expect(nearestDay([], d30)).toBeNull();
  });
});
