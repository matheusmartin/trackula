import { describe, expect, test } from 'vitest';
import { chartBars, chartPoints } from './Chart.js';
import { Day } from './Day.js';

describe('Chart', () => {
  const pointDays = Array.from({ length: 5 }, (_, i) => Day.of(2026, 9, 26).addDays(i));
  const barDays = Array.from({ length: 4 }, (_, i) => Day.of(2026, 9, 27).addDays(i));

  test('chartPoints places the values between the padding and the height, and skips the empty days', () => {
    const days = pointDays;
    const values = new Map([
      [days[0], 80],
      [days[2], 90],
      [days[4], 85],
    ]);
    const p = chartPoints(days, values, { width: 100, height: 40, padding: 4 });
    expect(p.map((point) => [point.x, point.y])).toEqual([
      [0, 36],
      [50, 4],
      [100, 20],
    ]);
  });

  test('chartPoints puts equal values in the middle', () => {
    const days = pointDays;
    const values = new Map([
      [days[1], 5],
      [days[3], 5],
    ]);
    expect(chartPoints(days, values, { height: 40 }).map((point) => point.y)).toEqual([20, 20]);
  });

  test('chartPoints from zero starts the scale at 0 at the bottom', () => {
    const days = pointDays;
    /**
     * @param {[number, number][]} values The index of the day and the value.
     * @returns {number[]}
     */
    const ys = (values) =>
      chartPoints(days, new Map(values.map(([i, v]) => [days[i], v])), { height: 40, padding: 4, fromZero: true }).map(
        (point) => point.y,
      );
    expect(
      ys([
        [0, 10],
        [4, 5],
      ]),
    ).toEqual([4, 20]);
    expect(
      ys([
        [1, 5],
        [3, 5],
      ]),
    ).toEqual([4, 4]);
    expect(
      ys([
        [1, 0],
        [3, 0],
      ]),
    ).toEqual([36, 36]);
  });

  test('chartPoints gives no points without values', () => {
    expect(chartPoints(pointDays, new Map())).toEqual([]);
  });

  test('chartBars gives each day an equal slot and starts the bars at 0', () => {
    const days = barDays;
    const values = new Map([
      [days[0], 8],
      [days[3], 4],
    ]);
    const b = chartBars(days, values, { width: 100, height: 40, padding: 4, fill: 0.5 });
    expect(b.map((bar) => [bar.x, bar.w, bar.y])).toEqual([
      [6.25, 12.5, 4],
      [81.25, 12.5, 22],
    ]);
  });

  test('chartBars draws zero values with no height', () => {
    const bars = chartBars(barDays, new Map([[barDays[1], 0]]), { height: 40 });
    expect(bars.length).toBe(1);
    expect(bars[0].y).toBe(40);
  });
});
