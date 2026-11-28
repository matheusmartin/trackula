// The bars of the day strip of the period panel: one bar for each day of all data, or one for each week when the
// strip is too narrow for days.
import { daysBetween } from './Day.js';
import { BarUnit, barStart } from './Zoom.js';

/** @import { Day } from './Day.js' */

/** How the bars of a strip show their days. See {@link dayBars}. */
export const StripKind = Object.freeze({ YES_NO: 'YES_NO', COUNT: 'COUNT', NUMBER: 'NUMBER', SCORE: 'SCORE' });

/** @typedef {'YES_NO' | 'COUNT' | 'NUMBER' | 'SCORE'} StripKindName */

/**
 * One bar of the day strip.
 * @typedef {object} DayBar
 * @property {Day} start The first day of the bar.
 * @property {Day} end The last day of the bar.
 * @property {number | null} height From 0 to 1 of the strip. Null: no value.
 * @property {number | null} points From 0 to 1: the color of the bar. Null with a height: a `no` of a yes/no metric.
 * @property {boolean} weekend True for the bar of a Saturday or a Sunday.
 */

/** The height of the bar of a `no`, from 0 to 1. */
const NO_HEIGHT = 0.3;

/** The smallest height of a bar with a value, from 0 to 1, so that a small value shows. */
const MIN_HEIGHT = 0.06;

/**
 * One bar for each day from `first` to `today`. The height and the color of a bar:
 *
 * - Yes/no (`values` 1 for yes, 0 for no): a yes is a full bar with 1 point. A no is a short bar without points.
 * - Count: the height is the count, from 0 to the highest count. The color is the points of the day.
 * - Number: the height is the value, from a little below the lowest value to the highest. The color is the points.
 * - Score (`values` from 0 to 100): the height and the color are the score.
 *
 * A day without a value has no height.
 * @param {StripKindName} kind
 * @param {Map<Day, number>} values
 * @param {Map<Day, number>} points The points of each day, from 0 to 1. Not used for yes/no and the score.
 * @param {Day} first
 * @param {Day} today
 * @returns {DayBar[]}
 */
export function dayBars(kind, values, points, first, today) {
  const all = [...values.values()];
  const high = all.length === 0 ? 1 : Math.max(...all);
  const low = all.length === 0 ? 0 : Math.min(...all);
  // Numbers: the bars start a little below the lowest value, so that the changes show.
  const floor = high === low ? low - 1 : low - (high - low) * 0.15;
  /**
   * @param {number} v
   * @returns {number}
   */
  const height = (v) => {
    switch (kind) {
      case StripKind.YES_NO:
        return v === 1 ? 1 : NO_HEIGHT;
      case StripKind.COUNT:
        return high <= 0 ? MIN_HEIGHT : Math.max(MIN_HEIGHT, v / high);
      case StripKind.NUMBER:
        return Math.max(MIN_HEIGHT, (v - floor) / (high - floor));
      default:
        return Math.max(MIN_HEIGHT, Math.min(1, v / 100));
    }
  };
  /**
   * @param {Day} d
   * @param {number} v
   * @returns {number | null}
   */
  const pointsOf = (d, v) => {
    switch (kind) {
      case StripKind.YES_NO:
        return v === 1 ? 1 : null;
      case StripKind.SCORE:
        return Math.max(0, Math.min(1, v / 100));
      default:
        return points.get(d) ?? 0;
    }
  };
  return daysBetween(first, today).map((d) => {
    const v = values.get(d);
    return {
      start: d,
      end: d,
      height: v == null ? null : height(v),
      points: v == null ? null : pointsOf(d, v),
      weekend: d.weekday >= 6,
    };
  });
}

/**
 * The day bars `bars` as one bar for each week, Monday to Sunday: for a strip that is too narrow for one bar for each
 * day. The height and the points of a week are the averages of its days with a value. A `no` counts as 0 points.
 * @param {DayBar[]} bars One bar for each day, oldest first.
 * @returns {DayBar[]}
 */
export function weekBars(bars) {
  /** @type {DayBar[][]} */
  const weeks = [];
  for (const bar of bars) {
    const week = weeks[weeks.length - 1];
    if (week != null && barStart(bar.start, BarUnit.WEEK) === barStart(week[0].start, BarUnit.WEEK)) week.push(bar);
    else weeks.push([bar]);
  }
  return weeks.map((week) => {
    const valued = week.flatMap((b) => (b.height == null ? [] : [b]));
    const average = (/** @type {number[]} */ xs) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
    return {
      start: week[0].start,
      end: week[week.length - 1].end,
      height: valued.length === 0 ? null : average(valued.map((b) => /** @type {number} */ (b.height))),
      points: valued.length === 0 ? null : average(valued.map((b) => b.points ?? 0)),
      weekend: false,
    };
  });
}
