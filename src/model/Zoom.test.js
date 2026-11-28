import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { NumberGoal, NumberMetric, YesNoMetric } from './Metric.js';
import {
  Aggregate,
  BarUnit,
  ZoomStep,
  ZoomWindow,
  barMonth,
  barStart,
  barStarts,
  defaultStepIndex,
  nextBarStart,
  threeMonthsStepIndex,
  zoomBars,
  zoomSteps,
} from './Zoom.js';

describe('Zoom', () => {
  // 2026-09-28 is a Monday.
  const mon = Day.of(2026, 9, 28);

  // Data from 2026-08-03 (a Monday) to 2026-09-30: 9 weeks.
  const first = Day.of(2026, 8, 3);
  const today = Day.of(2026, 9, 30);

  const month3Index = ZoomStep.entries.indexOf(ZoomStep.MONTH3);

  test('barStart and nextBarStart', () => {
    const d = Day.of(2026, 8, 13);
    expect(barStart(d, BarUnit.DAY)).toBe(d);
    expect(nextBarStart(d, BarUnit.DAY)).toBe(Day.of(2026, 8, 14));
    expect(barStart(d, BarUnit.WEEK)).toBe(Day.of(2026, 8, 10));
    expect(barStart(d, BarUnit.MONTH)).toBe(Day.of(2026, 8, 1));
    expect(barStart(d, BarUnit.QUARTER)).toBe(Day.of(2026, 7, 1));
    expect(nextBarStart(Day.of(2026, 12, 1), BarUnit.MONTH)).toBe(Day.of(2027, 1, 1));
    expect(nextBarStart(Day.of(2026, 10, 1), BarUnit.QUARTER)).toBe(Day.of(2027, 1, 1));
  });

  test('barMonth is the month of the bar in a calendar', () => {
    expect(barMonth(Day.of(2026, 8, 13), BarUnit.DAY)).toEqual({ year: 2026, month: 8 });
    // The week of Monday Sep 28 has 3 days in September and 4 days in October.
    expect(barMonth(mon, BarUnit.WEEK)).toEqual({ year: 2026, month: 10 });
    expect(barMonth(Day.of(2026, 8, 31), BarUnit.WEEK)).toEqual({ year: 2026, month: 9 });
    expect(barMonth(Day.of(2026, 8, 1), BarUnit.MONTH)).toEqual({ year: 2026, month: 8 });
    expect(barMonth(Day.of(2026, 10, 1), BarUnit.QUARTER)).toEqual({ year: 2026, month: 12 });
  });

  test('barStarts covers first to today', () => {
    expect(barStarts(mon.addDays(-8), mon.addDays(2), BarUnit.WEEK)).toEqual([mon.addDays(-14), mon.addDays(-7), mon]);
    expect(barStarts(Day.of(2026, 8, 20), mon, BarUnit.MONTH)).toEqual([Day.of(2026, 8, 1), Day.of(2026, 9, 1)]);
  });

  test('zoomSteps ends at the first step that shows all bars', () => {
    expect(zoomSteps(mon.addDays(-5), mon)).toEqual([ZoomStep.WEEK1]);
    expect(zoomSteps(mon.addDays(-20), mon)).toEqual([ZoomStep.WEEK1, ZoomStep.WEEK2, ZoomStep.MONTH1]);
    expect(zoomSteps(mon.addDays(-60), mon).at(-1)).toBe(ZoomStep.MONTH3);
    expect(zoomSteps(Day.of(2024, 10, 4), mon).at(-1)).toBe(ZoomStep.YEAR2);
  });

  test('zoomBars rate counts the days without entry as not yes, and only the days from first to today', () => {
    const starts = [mon.addDays(-7), mon];
    const values = new Map([
      [mon.addDays(-7), 1],
      [mon.addDays(-6), 0],
      [mon, 1],
      [mon.addDays(1), 1],
    ]);
    const bars = zoomBars(values, Aggregate.RATE, starts, BarUnit.WEEK, mon.addDays(-7), mon.addDays(2));
    expect(bars[0].value).toBeCloseTo(1 / 7, 9);
    expect(bars[1].value).toBeCloseTo(2 / 3, 9);
  });

  test('zoomBars sum, average, low and high', () => {
    const starts = [mon.addDays(-7), mon];
    const values = new Map([
      [mon.addDays(-7), 2],
      [mon.addDays(-5), 4],
      [mon, 3],
    ]);
    const sum = zoomBars(values, Aggregate.SUM, starts, BarUnit.WEEK, mon.addDays(-7), mon);
    expect(sum.map((b) => b.value)).toEqual([6, 3]);
    const avg = zoomBars(values, Aggregate.AVERAGE, starts, BarUnit.WEEK, mon.addDays(-7), mon);
    expect(avg.map((b) => [b.value, b.low, b.high])).toEqual([
      [3, 2, 4],
      [3, 3, 3],
    ]);
  });

  test('threeMonthsStepIndex is 3 months, or the last step if there are fewer', () => {
    expect(threeMonthsStepIndex(zoomSteps(mon.addDays(-200), mon))).toBe(month3Index);
    expect(threeMonthsStepIndex(zoomSteps(mon.addDays(-10), mon))).toBe(1);
  });

  test('defaultStepIndex is all data for a number and the score, and 3 months for the other kinds', () => {
    // 200 days: the last step, 1 year, shows all data.
    const steps = zoomSteps(mon.addDays(-200), mon);
    expect(steps.at(-1)).toBe(ZoomStep.YEAR1);
    const number = new NumberMetric({
      id: 'weight',
      name: 'Weight',
      icon: 'monitor_weight',
      goal: new NumberGoal({ target: 80, isMaximum: true }),
    });
    expect(defaultStepIndex(number, steps)).toBe(steps.length - 1);
    const count = new NumberMetric({
      id: 'water',
      name: 'Water',
      icon: 'water_drop',
      goal: new NumberGoal({ target: 8 }),
      isCount: true,
    });
    expect(defaultStepIndex(count, steps)).toBe(month3Index);
    const yesNo = new YesNoMetric({ id: 'meditate', name: 'Meditate', icon: 'self_improvement' });
    expect(defaultStepIndex(yesNo, steps)).toBe(month3Index);
    expect(defaultStepIndex(null, steps)).toBe(steps.length - 1);
  });

  test('ZoomWindow shows the newest bars from first to today', () => {
    const w = new ZoomWindow(ZoomStep.MONTH1, first, today);
    expect(w.starts).toEqual([4, 3, 2, 1, 0].map((n) => mon.addDays(-7 * n)));
    expect([w.from, w.to]).toEqual([mon.addDays(-28), today]);
    expect(w.days.length).toBe(31);
    expect([w.atStart, w.atEnd]).toEqual([false, true]);
    expect(w.showsAll).toBe(false);
  });

  test('ZoomWindow moves by bars and stops at the ends', () => {
    const w = new ZoomWindow(ZoomStep.MONTH1, first, today);
    const back = new ZoomWindow(ZoomStep.MONTH1, first, today, w.endMovedBy(-2));
    expect(back.to).toBe(mon.addDays(-14 + 6));
    expect(w.endMovedBy(3)).toBeNull();
    const oldest = new ZoomWindow(ZoomStep.MONTH1, first, today, w.endMovedBy(-100));
    expect([oldest.from, oldest.atStart]).toEqual([first, true]);
  });

  test('ZoomWindow endCenteredOn puts the day in the middle bar', () => {
    const w = new ZoomWindow(ZoomStep.MONTH1, first, today);
    const c = new ZoomWindow(ZoomStep.MONTH1, first, today, w.endCenteredOn(Day.of(2026, 8, 26)));
    expect(c.starts[2]).toBe(Day.of(2026, 8, 24));
  });

  test('a ZoomWindow with fewer bars than the step shows all bars', () => {
    const w = new ZoomWindow(ZoomStep.YEAR1, first, today);
    expect(w.starts).toEqual([Day.of(2026, 8, 1), Day.of(2026, 9, 1)]);
    expect([w.from, w.atStart, w.atEnd]).toEqual([first, true, true]);
    expect(w.showsAll).toBe(true);
  });

  test('ZoomWindow boxOn covers the first and last columns fully only at the ends of the data', () => {
    // Data from a Friday to a Wednesday: 13 week columns, from 2026-07-06 to 2026-10-04.
    const friday = Day.of(2026, 7, 10);
    const wednesday = Day.of(2026, 9, 30);
    const firstColumn = Day.of(2026, 7, 6);
    const lastColumnEnd = Day.of(2026, 10, 4);
    /**
     * @param {ZoomStep} step
     * @param {Day | null} [end]
     * @returns {ZoomWindow}
     */
    const window = (step, end = null) => new ZoomWindow(step, friday, wednesday, end);

    const all = window(/** @type {ZoomStep} */ (zoomSteps(friday, wednesday).at(-1)));
    expect([all.from, all.to]).toEqual([friday, wednesday]);
    expect(all.boxOn(BarUnit.WEEK)).toEqual({ from: firstColumn, to: lastColumnEnd });
    // Month bars start on 2026-07-01, but the box starts with the first week column.
    expect(window(ZoomStep.YEAR1).boxOn(BarUnit.WEEK)).toEqual({ from: firstColumn, to: lastColumnEnd });

    const newest = window(ZoomStep.MONTH1);
    expect(newest.boxOn(BarUnit.WEEK)).toEqual({ from: Day.of(2026, 8, 31), to: lastColumnEnd });
    const oldest = window(ZoomStep.MONTH1, newest.endMovedBy(-100));
    expect(oldest.boxOn(BarUnit.WEEK)).toEqual({ from: firstColumn, to: Day.of(2026, 8, 9) });
    const middle = window(ZoomStep.MONTH1, newest.endMovedBy(-3));
    expect(middle.boxOn(BarUnit.WEEK)).toEqual({ from: Day.of(2026, 8, 10), to: Day.of(2026, 9, 13) });
  });
});
