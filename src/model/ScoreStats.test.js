import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import {
  groupWeekdayParts,
  halves,
  monthlyAverages,
  monthsUntil,
  stepChanges,
  weekMondays,
  weeklyAverages,
} from './ScoreStats.js';
import { countStats } from './Stats.js';

describe('ScoreStats', () => {
  // 2026-09-28 is a Monday.
  const mon = Day.of(2026, 9, 28);
  /**
   * @param {number} i
   * @returns {Day}
   */
  const day = (i) => mon.addDays(i);
  /**
   * @param {number} from
   * @param {number} n
   * @returns {Day[]}
   */
  const range = (from, n) => Array.from({ length: n }, (_, i) => day(from + i));

  test('halves split the days, and the second half has the extra day', () => {
    expect(halves(range(0, 14))).toEqual([range(0, 7), range(7, 7)]);
    expect(halves(range(0, 7))).toEqual([range(0, 3), range(3, 4)]);
    expect(halves([day(0)])).toEqual([[], [day(0)]]);
    expect(halves([])).toEqual([[], []]);
  });

  test('groupWeekdayParts add up to the weekday average of the total', () => {
    const total = new Map([
      [day(0), 40],
      [day(7), 60],
      [day(1), 20],
    ]);
    const groups = new Map([
      [
        'habits',
        new Map([
          [day(0), 30],
          [day(7), 50],
        ]),
      ],
      [
        'body',
        new Map([
          [day(0), 10],
          [day(7), 10],
          [day(1), 20],
        ]),
      ],
    ]);
    const parts = groupWeekdayParts(total, groups, range(0, 14));
    expect(parts.get('habits')).toEqual([40, 0, null, null, null, null, null]);
    expect(parts.get('body')).toEqual([10, 20, null, null, null, null, null]);
    const average = countStats(total, range(0, 14)).weekdayAverages;
    for (const i of [0, 1]) {
      expect([...parts.values()].reduce((sum, p) => sum + /** @type {number} */ (p[i]), 0)).toBe(average[i]);
    }
  });

  test('groupWeekdayParts use only the days of the period', () => {
    const total = new Map([
      [day(0), 4],
      [day(7), 6],
    ]);
    const parts = groupWeekdayParts(total, new Map([['habits', total]]), range(7, 7));
    expect(parts.get('habits')?.[0]).toBe(6);
  });

  test('weeklyAverages give the average score of the same weekdays of each week', () => {
    // day(29) is the Tuesday of the 5th week: each week counts its Monday and Tuesday.
    const habits = new Map([
      [day(0), 50],
      [day(1), 100],
      [day(2), 0],
      [day(7), 40],
      [day(21), 20],
      [day(22), 0],
      [day(28), 60],
    ]);
    const averages = weeklyAverages(
      new Map([
        ['habits', habits],
        ['empty', new Map()],
      ]),
      day(29),
      4,
    );
    // The 3rd week has no score of habits: null. The Wednesday day(2) does not count.
    expect(averages).toEqual(new Map([['habits', [75, 40, null, 10, 60]]]));
    expect(weekMondays(day(29), 4)).toEqual([day(0), day(7), day(14), day(21), day(28)]);
  });

  test('monthlyAverages give the average score of each month up to the end', () => {
    const habits = new Map([
      [Day.of(2026, 7, 31), 70],
      [Day.of(2026, 8, 5), 20],
      [Day.of(2026, 10, 1), 30],
      [Day.of(2026, 10, 2), 0],
      [Day.of(2026, 11, 9), 30],
      [Day.of(2026, 11, 10), 10],
      [Day.of(2026, 11, 11), 100],
    ]);
    const averages = monthlyAverages(
      new Map([
        ['habits', habits],
        ['empty', new Map()],
      ]),
      Day.of(2026, 11, 10),
      3,
    );
    // August to November. September has no score: null. November 11 is after the end.
    expect(averages).toEqual(new Map([['habits', [20, null, 15, 20]]]));
  });

  test('monthsUntil crosses the year', () => {
    expect(monthsUntil(Day.of(2026, 1, 15), 3)).toEqual([
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ]);
  });

  test('stepChanges are the changes from the value before', () => {
    expect(stepChanges([5, 6.5, null, 4])).toEqual([null, 1.5, null, null]);
    expect(stepChanges([])).toEqual([]);
  });
});
