import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { withoutFloatNoise } from './LogEntry.js';
import { parseLog } from './Parse.js';
import {
  HISTOGRAM_BINS,
  STRENGTH_WEIGHT,
  TREND_WEIGHT,
  bestWeekday,
  countStats,
  numberStats,
  streakLengths,
  strength,
  trend,
  yesNoStates,
  yesNoStats,
} from './Stats.js';
import { byId, meditate, rows } from './testing/Fixtures.js';

describe('Stats', () => {
  // 2026-09-28 is a Monday.
  const mon = Day.of(2026, 9, 28);
  /**
   * @param {number} i
   * @returns {Day}
   */
  const day = (i) => mon.addDays(i);
  /**
   * @param {number} n
   * @returns {Day[]}
   */
  const range = (n) => Array.from({ length: n }, (_, i) => day(i));

  // Mo yes, Tu yes, We no, Th (none), Fr yes, Sa yes, Su yes.
  const states = new Map([
    [day(0), true],
    [day(1), true],
    [day(2), false],
    [day(4), true],
    [day(5), true],
    [day(6), true],
  ]);

  test('yesNoStats counts yes, no and the days without entry', () => {
    const s = yesNoStats(states, range(7), day(6));
    expect([s.yes, s.no, s.none, s.days]).toEqual([5, 1, 1, 7]);
    expect(s.rate).toBeCloseTo(5 / 7, 9);
  });

  test('yesNoStats streaks: current, longest and all runs', () => {
    const s = yesNoStats(states, range(7), day(6));
    expect([s.currentStreak, s.longestStreak]).toEqual([3, 3]);
    expect(s.streaks).toEqual([2, 3]);
    // Today without entry yet: the current streak counts up to yesterday.
    expect(yesNoStats(states, range(8), day(7)).currentStreak).toBe(3);
  });

  test('yesNoStats weekday rates', () => {
    expect(yesNoStats(states, range(7), day(6)).weekdayRates).toEqual([1, 1, 0, 0, 1, 1, 1]);
  });

  test('yesNoStats strength grows with yes and goes down without', () => {
    const s = yesNoStats(states, range(7), day(6));
    expect(s.strength[0]).toBeCloseTo(STRENGTH_WEIGHT, 9);
    expect(s.strength[2]).toBeLessThan(s.strength[1]);
    expect(s.strength[6]).toBeGreaterThan(s.strength[3]);
  });

  test('yesNoStats strength starts at the first entry before the period', () => {
    const s = yesNoStats(new Map([[day(0), true]]), [day(1)], day(1));
    expect(s.strength.length).toBe(1);
    expect(s.strength[0]).toBeCloseTo(STRENGTH_WEIGHT * (1 - STRENGTH_WEIGHT), 9);
    expect(yesNoStats(new Map(), range(2), day(1)).strength).toEqual([0, 0]);
  });

  test('strength moves to the value of each day and stays the same on a day without a value', () => {
    const s = strength(
      new Map([
        [day(-1), 1],
        [day(0), 0.5],
        [day(2), 0],
      ]),
      range(3),
    );
    const afterDay0 = STRENGTH_WEIGHT + STRENGTH_WEIGHT * (0.5 - STRENGTH_WEIGHT);
    expect(s[0]).toBeCloseTo(afterDay0, 9);
    expect(s[1]).toBeCloseTo(afterDay0, 9);
    expect(s[2]).toBeCloseTo(afterDay0 * (1 - STRENGTH_WEIGHT), 9);
    // Before the first value, the strength is 0.
    expect(strength(new Map([[day(5), 1]]), range(2))).toEqual([0, 0]);
  });

  test('yesNoStats with no days has no strength', () => {
    expect(yesNoStats(states, [], day(6)).strength).toEqual([]);
  });

  test('yesNoStates reads yes as true and no as false from the last row of a day', () => {
    const log = parseLog(
      rows(
        ['date', 'meditate'],
        ['2026-09-28', 'yes'],
        ['2026-09-29', 'yes'],
        ['2026-09-29', 'no'],
        ['2026-09-30', 'yes'],
        ['2026-09-30', ''],
      ),
      byId(meditate),
    ).table;
    expect(yesNoStates(meditate, log)).toEqual(
      new Map([
        [day(0), true],
        [day(1), false],
      ]),
    );
  });

  const counts = new Map([
    [day(0), 3],
    [day(1), 5],
    [day(3), 5],
    [day(7), 2],
  ]);

  test('countStats: total, average, best day and days recorded', () => {
    const s = countStats(counts, range(8));
    expect([s.total, s.logged, s.average]).toEqual([15, 4, 3.75]);
    expect(s.best).toEqual({ day: day(1), value: 5 });
  });

  test('countStats: weekday averages, distribution and running total', () => {
    const s = countStats(counts, range(8));
    expect(s.weekdayAverages).toEqual([2.5, 5, null, 5, null, null, null]);
    expect(s.distribution).toEqual([
      { value: 2, days: 1 },
      { value: 3, days: 1 },
      { value: 5, days: 2 },
    ]);
    expect(s.running).toEqual([3, 8, 8, 13, 13, 13, 13, 15]);
  });

  test('countStats rounds a half away from zero in the distribution, and the first highest day is best', () => {
    const s = countStats(
      new Map([
        [day(0), 2.5],
        [day(1), -2.5],
        [day(2), 2.5],
      ]),
      range(3),
    );
    expect(s.distribution).toEqual([
      { value: -3, days: 1 },
      { value: 3, days: 2 },
    ]);
    expect(s.best).toEqual({ day: day(0), value: 2.5 });
  });

  test('bestWeekday is the first weekday with the highest average', () => {
    expect(bestWeekday([2.5, 5, null, 5, null, null, null])).toBe(2);
    expect(bestWeekday([null, null, null, null, null, 0, 1])).toBe(7);
    expect(bestWeekday(Array(7).fill(null))).toBeNull();
  });

  test('countStats with no values', () => {
    const s = countStats(new Map(), range(3));
    expect([s.total, s.average, s.best]).toEqual([0, null, null]);
    expect(s.distribution).toEqual([]);
  });

  const numbers = new Map([
    [day(0), 82],
    [day(2), 81],
    [day(3), 80.5],
    [day(8), 80],
  ]);

  test('numberStats: latest, change, lowest, highest and average', () => {
    const s = numberStats(numbers, range(9));
    expect(s.latest).toEqual({ day: day(8), value: 80 });
    expect(s.change).toBe(-2);
    expect([s.low?.value, s.high?.value]).toEqual([80, 82]);
    expect(s.average).toBeCloseTo(80.875, 9);
  });

  test('numberStats trend is a moving average that keeps its value on empty days', () => {
    const s = numberStats(numbers, range(9));
    expect(s.trend[0]).toBe(82);
    expect(s.trend[1]).toBe(82);
    expect(s.trend[2]).toBe(82 + TREND_WEIGHT * (81 - 82));
  });

  test('the trend moves a quarter of the way to each new value', () => {
    const t = trend(
      new Map([
        [day(9), 82],
        [day(1), 82.4],
        [day(2), 82],
      ]),
    );
    expect([...t.keys()]).toEqual([day(1), day(2), day(9)]);
    expect([...t.values()].map(withoutFloatNoise)).toEqual([82.4, 82.3, 82.225]);
  });

  test('numberStats trend also uses the values before the period', () => {
    const s = numberStats(
      new Map([
        [day(-1), 84],
        [day(0), 80],
      ]),
      range(2),
    );
    expect(s.trend).toEqual([83, 83]);
  });

  test('numberStats histogram', () => {
    const s = numberStats(numbers, range(9));
    expect(s.histogram.length).toBe(HISTOGRAM_BINS);
    expect(s.histogram.reduce((sum, bin) => sum + bin.days, 0)).toBe(4);
  });

  test('numberStats gives the first day of a tie and puts the highest value in the last range', () => {
    const s = numberStats(
      new Map([
        [day(0), 0],
        [day(1), -0],
        [day(2), 8],
        [day(3), 8],
      ]),
      range(4),
    );
    expect([s.low?.day, s.high?.day]).toEqual([day(0), day(2)]);
    expect(s.histogram.map((bin) => bin.days)).toEqual([2, 0, 0, 0, 0, 0, 0, 2]);
    expect(s.histogram.at(-1)).toEqual({ from: 7, to: 8, days: 2 });
  });

  test('numberStats with one value has no change and one histogram range', () => {
    const s = numberStats(new Map([[day(0), 70]]), range(3));
    expect(s.change).toBeNull();
    expect(s.histogram.length).toBe(1);
  });

  test('streakLengths', () => {
    expect(streakLengths([1, 2, 2, 5, 40])).toEqual([1, 2, 0, 1, 0, 0, 1]);
  });
});
