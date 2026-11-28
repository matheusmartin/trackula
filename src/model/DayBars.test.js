import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { StripKind, dayBars, weekBars } from './DayBars.js';

// 2026-09-28 is a Monday.
const mon = Day.of(2026, 9, 28);

describe('DayBars', () => {
  test('a yes is a full bar with 1 point, a no a short bar without points, and a day without a value has no bar', () => {
    const values = new Map([
      [mon, 1],
      [mon.addDays(1), 0],
    ]);
    const bars = dayBars(StripKind.YES_NO, values, new Map(), mon, mon.addDays(2));
    expect(bars.map((b) => [b.height, b.points])).toEqual([
      [1, 1],
      [0.3, null],
      [null, null],
    ]);
  });

  test('a count goes from 0 to the highest count, and its color is the points of the day', () => {
    const values = new Map([
      [mon, 4],
      [mon.addDays(1), 8],
      [mon.addDays(2), 0],
    ]);
    const points = new Map([
      [mon, 0.5],
      [mon.addDays(1), 1],
    ]);
    const bars = dayBars(StripKind.COUNT, values, points, mon, mon.addDays(2));
    expect(bars.map((b) => b.height)).toEqual([0.5, 1, 0.06]);
    expect(bars.map((b) => b.points)).toEqual([0.5, 1, 0]);
  });

  test('a number starts a little below the lowest value, and a score goes from 0 to 100', () => {
    const numbers = dayBars(
      StripKind.NUMBER,
      new Map([
        [mon, 80],
        [mon.addDays(1), 84],
      ]),
      new Map(),
      mon,
      mon.addDays(1),
    );
    // The floor is 80 - 0.6 = 79.4: 80 is 0.6 of 4.6.
    expect(numbers[0].height).toBeCloseTo(0.6 / 4.6);
    expect(numbers[1].height).toBe(1);
    const scores = dayBars(StripKind.SCORE, new Map([[mon, 64]]), new Map(), mon, mon);
    expect([scores[0].height, scores[0].points]).toEqual([0.64, 0.64]);
  });

  test('Saturday and Sunday are weekend days', () => {
    const bars = dayBars(StripKind.SCORE, new Map(), new Map(), mon, mon.addDays(6));
    expect(bars.map((b) => b.weekend)).toEqual([false, false, false, false, false, true, true]);
  });

  test('week bars average the days with a value, and a no counts as 0 points', () => {
    const values = new Map([
      [mon.addDays(-1), 1],
      [mon, 1],
      [mon.addDays(1), 0],
    ]);
    const weeks = weekBars(dayBars(StripKind.YES_NO, values, new Map(), mon.addDays(-1), mon.addDays(8)));
    expect(weeks.map((w) => [w.start, w.end])).toEqual([
      [mon.addDays(-1), mon.addDays(-1)],
      [mon, mon.addDays(6)],
      [mon.addDays(7), mon.addDays(8)],
    ]);
    expect(weeks[1].height).toBeCloseTo(0.65);
    expect(weeks[1].points).toBe(0.5);
    expect(weeks[2].height).toBeNull();
    expect(weeks.every((w) => !w.weekend)).toBe(true);
  });
});
