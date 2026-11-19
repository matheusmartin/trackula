// The places of the points and bars of the small charts, in chart units.

/** @import { Day } from './Day.js' */

/**
 * A point of a line chart, in chart units: x from 0 to the chart width, y from 0 (top) to the chart height.
 * @typedef {object} ChartPoint
 * @property {Day} day
 * @property {number} value
 * @property {number} x
 * @property {number} y
 */

/**
 * The size of a line chart, and its scale.
 * @typedef {object} ChartPointsOptions
 * @property {number} [width] 100 by default.
 * @property {number} [height] 40 by default.
 * @property {number} [padding] 4 by default.
 * @property {boolean} [fromZero] False by default.
 */

/**
 * Places each day of `days` that has a value in `values` on a `width` × `height` chart.
 *
 * - x: the position of the day in `days`. The first day is at 0, the last at `width`.
 * - y: the value between the lowest and highest value. The highest is at `padding`, the lowest at `height` −
 *   `padding`. If all values are equal, they are in the middle. With `fromZero`, the lowest is 0: 0 is always at
 *   `height` − `padding`.
 * - Days without a value get no point, so the line connects the days before and after them.
 * @param {Day[]} days
 * @param {Map<Day, number>} values
 * @param {ChartPointsOptions} [options]
 * @returns {ChartPoint[]}
 */
export function chartPoints(days, values, { width = 100, height = 40, padding = 4, fromZero = false } = {}) {
  const present = presentDays(days, values);
  if (present.length === 0) return [];
  const low = present.reduce((min, p) => Math.min(min, p.value), fromZero ? 0 : Infinity);
  const high = present.reduce((max, p) => Math.max(max, p.value), -Infinity);
  const span = Math.max(1, days.length - 1);
  return present.map((p) => {
    let y;
    if (high !== low) y = padding + ((height - 2 * padding) * (high - p.value)) / (high - low);
    else if (fromZero) y = height - padding;
    else y = height / 2;
    return { day: p.day, value: p.value, x: (width * p.index) / span, y };
  });
}

/**
 * A bar of a bar chart, in chart units: from x to x + w, and from y (top) to the chart height.
 * @typedef {object} ChartBar
 * @property {Day} day
 * @property {number} value
 * @property {number} x
 * @property {number} w
 * @property {number} y
 */

/**
 * The size of a bar chart, and the width of its bars.
 * @typedef {object} ChartBarsOptions
 * @property {number} [width] 100 by default.
 * @property {number} [height] 40 by default.
 * @property {number} [padding] 4 by default.
 * @property {number} [fill] 0.6 by default.
 */

/**
 * Places a bar for each day of `days` that has a value in `values` on a `width` × `height` chart.
 *
 * - Each day gets an equal slot. The bar fills `fill` of its slot, in the middle.
 * - Bars start at 0 at the bottom. The highest value reaches `padding` from the top.
 * - Negative values count as 0.
 * @param {Day[]} days
 * @param {Map<Day, number>} values
 * @param {ChartBarsOptions} [options]
 * @returns {ChartBar[]}
 */
export function chartBars(days, values, { width = 100, height = 40, padding = 4, fill = 0.6 } = {}) {
  const present = presentDays(days, values);
  if (present.length === 0) return [];
  const high = present.reduce((max, b) => Math.max(max, b.value), 0);
  const slot = width / days.length;
  return present.map((b) => {
    const y = high <= 0 ? height : height - ((height - padding) * Math.max(0, b.value)) / high;
    return { day: b.day, value: b.value, x: slot * b.index + (slot * (1 - fill)) / 2, w: slot * fill, y };
  });
}

/**
 * The days of `days` that have a value in `values`, with their index in `days`.
 * @param {Day[]} days
 * @param {Map<Day, number>} values
 * @returns {{ index: number, day: Day, value: number }[]}
 */
function presentDays(days, values) {
  const result = [];
  for (const [index, day] of days.entries()) {
    const value = values.get(day);
    if (value !== undefined) result.push({ index, day, value });
  }
  return result;
}
