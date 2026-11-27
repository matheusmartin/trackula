// The time window of the metric detail screen: bars over time, from the first value to today. A zoom step sets the
// span in view and the size of one bar. All charts of the screen show the same window.
import { Day, daysBetween } from './Day.js';
import { NumberMetric } from './Metric.js';

/** @import { Metric } from './Metric.js' */

/**
 * The days of one bar.
 * @typedef {'DAY' | 'WEEK' | 'MONTH' | 'QUARTER'} BarUnit
 */

/** The days of one bar: a day, a week, a month or a quarter. */
export const BarUnit = Object.freeze({ DAY: 'DAY', WEEK: 'WEEK', MONTH: 'MONTH', QUARTER: 'QUARTER' });

/**
 * The zoom steps, from the smallest span to the largest. A step has a fixed number of bars, so that a chart keeps its
 * shape while it moves. The shortest spans show days, short spans weeks, middle spans months, long spans quarters.
 */
export class ZoomStep {
  /**
   * @param {string} name The name, as the Kotlin enum. Example: `MONTH3`.
   * @param {string} label
   * @param {BarUnit} unit
   * @param {number} bars The number of bars in view.
   */
  constructor(name, label, unit, bars) {
    this.name = name;
    this.label = label;
    this.unit = unit;
    this.bars = bars;
    Object.freeze(this);
  }

  static WEEK1 = new ZoomStep('WEEK1', '1 week', BarUnit.DAY, 7);
  static WEEK2 = new ZoomStep('WEEK2', '2 weeks', BarUnit.DAY, 14);
  static MONTH1 = new ZoomStep('MONTH1', '1 month', BarUnit.WEEK, 5);
  static MONTH3 = new ZoomStep('MONTH3', '3 months', BarUnit.WEEK, 13);
  static MONTH6 = new ZoomStep('MONTH6', '6 months', BarUnit.WEEK, 26);
  static YEAR1 = new ZoomStep('YEAR1', '1 year', BarUnit.MONTH, 12);
  static YEAR2 = new ZoomStep('YEAR2', '2 years', BarUnit.MONTH, 24);
  static YEAR3 = new ZoomStep('YEAR3', '3 years', BarUnit.QUARTER, 12);
  static YEAR5 = new ZoomStep('YEAR5', '5 years', BarUnit.QUARTER, 20);

  /** All steps, from the smallest span to the largest. */
  static entries = [
    ZoomStep.WEEK1,
    ZoomStep.WEEK2,
    ZoomStep.MONTH1,
    ZoomStep.MONTH3,
    ZoomStep.MONTH6,
    ZoomStep.YEAR1,
    ZoomStep.YEAR2,
    ZoomStep.YEAR3,
    ZoomStep.YEAR5,
  ];
}

/**
 * How the days of a bar become its value.
 * @typedef {'RATE' | 'SUM' | 'AVERAGE'} Aggregate
 */

/**
 * How the days of a bar become its value.
 *
 * - `RATE`: the share of yes days among all days of the bar, from 0 to 1. A value of 1 is `yes`. Days without entry
 *   count as not yes, as in the rate of the period.
 * - `SUM`: the sum of the values.
 * - `AVERAGE`: the average of the values. Days without value are left out.
 */
export const Aggregate = Object.freeze({ RATE: 'RATE', SUM: 'SUM', AVERAGE: 'AVERAGE' });

/**
 * One bar: its first day, its value, and the lowest and highest value of its days. A null value draws no bar.
 * @typedef {object} ZoomBar
 * @property {Day} start
 * @property {number | null} value
 * @property {number | null} low
 * @property {number | null} high
 */

/**
 * The `low` and `high` value of a set of values, and their `average`. Example: the values of the days of one bar.
 * @typedef {object} ValueRange
 * @property {number} low
 * @property {number} high
 * @property {number} average
 */

/**
 * A span of days, from `from` to `to`. Both days are in the span.
 * @typedef {object} DayRange
 * @property {Day} from
 * @property {Day} to
 */

/**
 * The first day of the bar that holds `d`. Weeks start on Monday.
 * @param {Day} d
 * @param {BarUnit} unit
 * @returns {Day}
 */
export function barStart(d, unit) {
  switch (unit) {
    case BarUnit.DAY:
      return d;
    case BarUnit.WEEK:
      return d.addDays(1 - d.weekday);
    case BarUnit.MONTH:
      return Day.of(d.year, d.month, 1);
    case BarUnit.QUARTER:
      return Day.of(d.year, d.month - ((d.month - 1) % 3), 1);
  }
}

/**
 * The first day of the bar after the bar that starts on `start`.
 * @param {Day} start
 * @param {BarUnit} unit
 * @returns {Day}
 */
export function nextBarStart(start, unit) {
  switch (unit) {
    case BarUnit.DAY:
      return start.addDays(1);
    case BarUnit.WEEK:
      return start.addDays(7);
    case BarUnit.MONTH:
      return Day.of(start.year, start.month + 1, 1);
    case BarUnit.QUARTER:
      return Day.of(start.year, start.month + 3, 1);
  }
}

/**
 * The first days of all bars from the bar of `first` to the bar of `today`, oldest first.
 * @param {Day} first
 * @param {Day} today
 * @param {BarUnit} unit
 * @returns {Day[]}
 */
export function barStarts(first, today, unit) {
  const starts = [];
  for (let start = barStart(first, unit); !start.isAfter(today); start = nextBarStart(start, unit)) starts.push(start);
  return starts;
}

/**
 * The zoom steps for data from `first` to `today`. The list ends with the first step that shows all bars. Example: for
 * 2 months of data, 1 month and 3 months.
 * @param {Day} first
 * @param {Day} today
 * @returns {ZoomStep[]}
 */
export function zoomSteps(first, today) {
  const steps = [];
  for (const s of ZoomStep.entries) {
    steps.push(s);
    if (showsAll(s, first, today)) break;
  }
  return steps;
}

/**
 * The index in `steps` of 3 months, or of the last step if there are fewer.
 * @param {ZoomStep[]} steps
 * @returns {number}
 */
export function threeMonthsStepIndex(steps) {
  const index = steps.indexOf(ZoomStep.MONTH3);
  return index >= 0 ? index : steps.length - 1;
}

/**
 * The index in `steps` of the step that the detail screen of `metric` opens with. Kind `number` and the score: the
 * last step, that shows all data. Other kinds: {@link threeMonthsStepIndex}.
 * @param {Metric | null} metric Null for the score.
 * @param {ZoomStep[]} steps
 * @returns {number}
 */
export function defaultStepIndex(metric, steps) {
  return metric == null || (metric instanceof NumberMetric && !metric.isCount)
    ? steps.length - 1
    : threeMonthsStepIndex(steps);
}

/**
 * True if `step` shows all bars from `first` to `today`.
 * @param {ZoomStep} step
 * @param {Day} first
 * @param {Day} today
 * @returns {boolean}
 */
function showsAll(step, first, today) {
  return barStarts(first, today, step.unit).length <= step.bars;
}

/**
 * The time window in view: whole bars of `step`, from the bar of `first` to the bar of `today`.
 *
 * The window ends with the bar of `end`. Null `end`: the newest bar. The window has `step.bars` bars, or all bars if
 * there are fewer.
 */
export class ZoomWindow {
  /** The bars in view: indexes in `allStarts`, from `#fromIndex` to before `#toIndex`. */
  #fromIndex;
  #toIndex;

  /**
   * @param {ZoomStep} step
   * @param {Day} first
   * @param {Day} today
   * @param {Day | null} [end] Null by default: the newest bar.
   */
  constructor(step, first, today, end = null) {
    this.step = step;
    this.first = first;
    this.today = today;
    /** The first days of all bars, oldest first. */
    this.allStarts = barStarts(first, today, step.unit);
    const count = Math.min(step.bars, this.allStarts.length);
    this.#toIndex =
      end === null
        ? this.allStarts.length
        : coerceIn(this.allStarts.indexOf(barStart(end, step.unit)) + 1, count, this.allStarts.length);
    this.#fromIndex = this.#toIndex - count;
    Object.freeze(this);
  }

  /** @returns {BarUnit} */
  get unit() {
    return this.step.unit;
  }

  /** @returns {Day[]} The first days of the bars in view, oldest first. */
  get starts() {
    return this.allStarts.slice(this.#fromIndex, this.#toIndex);
  }

  /** @returns {Day} The first day in view: the start of the first bar, but not before `first`. */
  get from() {
    const start = this.allStarts[this.#fromIndex];
    return start.isBefore(this.first) ? this.first : start;
  }

  /** @returns {Day} The last day in view: the end of the last bar, but not after `today`. */
  get to() {
    const end = nextBarStart(this.allStarts[this.#toIndex - 1], this.unit).addDays(-1);
    return end.isAfter(this.today) ? this.today : end;
  }

  /** @returns {Day[]} All days in view, oldest first. */
  get days() {
    return daysBetween(this.from, this.to);
  }

  /** @returns {boolean} True if the window shows the newest bar. */
  get atEnd() {
    return this.#toIndex === this.allStarts.length;
  }

  /** @returns {boolean} True if the window shows the oldest bar. */
  get atStart() {
    return this.#fromIndex === 0;
  }

  /** @returns {boolean} True if the window shows all bars, from the oldest to the newest. Example: the step All. */
  get showsAll() {
    return this.atStart && this.atEnd;
  }

  /**
   * The days in view, as a box on a chart of all data with one column for each `unit` bar. At the oldest bar, the box
   * starts with the first column, not on `first`. At the newest bar, it ends with the last column, not on `today`. The
   * days before `first` and after `today` have no data, so the box can include them. Example: at All, the box covers
   * all columns.
   * @param {BarUnit} unit
   * @returns {DayRange}
   */
  boxOn(unit) {
    return {
      from: this.atStart ? barStart(this.first, unit) : this.from,
      to: this.atEnd ? nextBarStart(barStart(this.today, unit), unit).addDays(-1) : this.to,
    };
  }

  /**
   * The `end` day of the window that is `bars` bars later (or earlier, if negative). Null: the newest bar.
   * @param {number} bars
   * @returns {Day | null}
   */
  endMovedBy(bars) {
    return this.#endAt(coerceIn(this.#toIndex + bars, this.#toIndex - this.#fromIndex, this.allStarts.length));
  }

  /**
   * The `end` day of the window with its middle on `day`. Null: the newest bar.
   * @param {Day} day
   * @returns {Day | null}
   */
  endCenteredOn(day) {
    const count = this.#toIndex - this.#fromIndex;
    const index = this.allStarts.indexOf(barStart(day, this.unit));
    return this.#endAt(coerceIn(index + 1 + Math.trunc(count / 2), count, this.allStarts.length));
  }

  /**
   * The `end` day of a window that ends before the bar `last` of `allStarts`. Null: the newest bar.
   * @param {number} last
   * @returns {Day | null}
   */
  #endAt(last) {
    return last === this.allStarts.length ? null : this.allStarts[last - 1];
  }
}

/**
 * `value` in the range from `min` to `max`, as Kotlin `coerceIn`.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function coerceIn(value, min, max) {
  if (value < min) return min;
  return value > max ? max : value;
}

/**
 * One bar for each day of `starts`, from the day `values`. Days before `first` and after `today` are not part of a
 * bar.
 * @param {Map<Day, number>} values
 * @param {Aggregate} aggregate
 * @param {Day[]} starts
 * @param {BarUnit} unit
 * @param {Day} first
 * @param {Day} today
 * @returns {ZoomBar[]}
 */
export function zoomBars(values, aggregate, starts, unit, first, today) {
  /** @type {Map<Day, number[]>} */
  const byBar = new Map();
  for (const [day, v] of values) {
    if (day.isBefore(first) || day.isAfter(today)) continue;
    const start = barStart(day, unit);
    const list = byBar.get(start);
    if (list) list.push(v);
    else byBar.set(start, [v]);
  }
  return starts.map((start) => {
    // A list in byBar has at least one value.
    const barValues = byBar.get(start) ?? null;
    let value = null;
    if (aggregate === Aggregate.RATE) value = rate(barValues, start, unit, first, today);
    else if (barValues !== null) {
      const sum = barValues.reduce((total, v) => total + v, 0);
      value = aggregate === Aggregate.SUM ? sum : sum / barValues.length;
    }
    return {
      start,
      value,
      low: barValues === null ? null : barValues.reduce((low, v) => Math.min(low, v)),
      high: barValues === null ? null : barValues.reduce((high, v) => Math.max(high, v)),
    };
  });
}

/**
 * The share of yes days among the days of the bar from `first` to `today`. `values` holds 1 for each yes day.
 * @param {number[] | null} values
 * @param {Day} start
 * @param {BarUnit} unit
 * @param {Day} first
 * @param {Day} today
 * @returns {number | null}
 */
function rate(values, start, unit, first, today) {
  const from = Math.max(start.serial, first.serial);
  const to = Math.min(nextBarStart(start, unit).serial - 1, today.serial);
  const days = to - from + 1;
  if (days <= 0) return null;
  return (values?.filter((v) => v === 1).length ?? 0) / days;
}
