// The `Log` tab, its cells and the plans of the changes to it. See docs/data-model.md.
import { Day } from './Day.js';
import { YesNoMetric } from './Metric.js';
import { toFixed } from './Numbers.js';

/** @import { Metric, NumberMetric } from './Metric.js' */

/**
 * A non-empty value cell of the `Log` tab.
 * @typedef {object} LogEntry
 * @property {number} row The 1-based row number in the `Log` tab. Row 1 is the header.
 * @property {Day} date
 * @property {string} metricId
 * @property {number} value The value. For yesno metrics: 1 is `yes`, 0 is `no`.
 */

/** The `Log` tab: one row per day, one column per metric. See docs/data-model.md. */
export class LogTable {
  /**
   * @param {LogEntry[]} entries All valid, non-empty value cells.
   * @param {Map<Day, number>} rows The 1-based row number of each day. If a day has more than one row, the last row.
   * @param {Map<string, number>} columns The 0-based column index of each metric. Column 0 is `date`.
   */
  constructor(entries, rows, columns) {
    this.entries = entries;
    this.rows = rows;
    this.columns = columns;
    Object.freeze(this);
  }

  /**
   * The value of the metric `metricId` on `date`: the value in the last row of the day. Null if the cell is empty.
   * @param {string} metricId
   * @param {Day} date
   * @returns {number | null}
   */
  valueAt(metricId, date) {
    const row = this.rows.get(date);
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.row === row && entry.metricId === metricId) return entry.value;
    }
    return null;
  }
}

/**
 * A cell of a metric on a day: the key of the count taps that are not written yet. It is a text, so that `===`
 * compares two cells and a cell can be a `Map` key. Make it with {@link metricDayKey}, and read it with
 * {@link parseMetricDay}. Example: `water|2026-09-30`.
 * @typedef {string} MetricDay
 */

/**
 * The {@link MetricDay} of the metric `metricId` on `day`.
 * @param {string} metricId
 * @param {Day} day
 * @returns {MetricDay}
 */
export function metricDayKey(metricId, day) {
  return `${metricId}|${day}`;
}

/**
 * The metric id and the day of `key`.
 * @param {MetricDay} key A text from {@link metricDayKey}.
 * @returns {{ metricId: string, day: Day }}
 */
export function parseMetricDay(key) {
  // The day has no `|`, but the id of a group score can have one.
  const split = key.lastIndexOf('|');
  const day = Day.tryParse(key.slice(split + 1));
  if (split < 0 || day === null) throw new Error(`"${key}" is not a metric day.`);
  return { metricId: key.slice(0, split), day };
}

/**
 * Thrown when the `Log` tab has no column for a metric. This occurs when someone deletes the metric row in the sheet
 * while the app is open. The message is the text for the user.
 */
export class MissingColumnException extends Error {
  /** @param {string} metricId */
  constructor(metricId) {
    super(`The log tab has no column "${metricId}".`);
    this.name = 'MissingColumnException';
    this.metricId = metricId;
  }

  /** @returns {string} The message only, without the class name, as in Dart. The app shows this text. */
  toString() {
    return this.message;
  }
}

/**
 * A change to the `Log` tab: an {@link AppendRow} or a {@link SetCell}. Check the kind with `instanceof`.
 * @typedef {AppendRow | SetCell} LogWrite
 */

/** A new row for a day that has no row yet. */
export class AppendRow {
  /**
   * @param {Day} date
   * @param {number} column
   * @param {string | number} value A number, or `yes` or `no`. See {@link cellValue}.
   */
  constructor(date, column, value) {
    this.date = date;
    this.column = column;
    this.value = value;
    Object.freeze(this);
  }

  /** @returns {(string | number)[]} The row cells, from column A to `column`. */
  toCells() {
    return [this.date.toString(), ...Array(this.column - 1).fill(''), this.value];
  }
}

/** A new value for one cell. */
export class SetCell {
  /**
   * @param {number} row
   * @param {number} column
   * @param {string | number | null} value Null clears the cell. Else a number, or `yes` or `no`. See
   *   {@link cellValue}.
   */
  constructor(row, column, value) {
    this.row = row;
    this.column = column;
    this.value = value;
    Object.freeze(this);
  }
}

/**
 * The `Log` cell for a `value`: `yes` (1) or `no` (0) for yesno metrics, the number for number metrics. Null is an
 * empty cell.
 * @param {Metric} metric
 * @param {number | null} value
 * @returns {string | number | null}
 */
export function cellValue(metric, value) {
  if (value == null) return null;
  if (metric instanceof YesNoMetric) return value === 1 ? 'yes' : 'no';
  return value;
}

/**
 * Returns the change that sets `metric` to `yes` (`done`) or `no` on `date`.
 *
 * This function and the other `plan` functions throw a {@link MissingColumnException} if `log` has no column for
 * `metric`.
 * @param {YesNoMetric} metric
 * @param {Day} date
 * @param {LogTable} log
 * @param {boolean} done
 * @returns {LogWrite | null}
 */
export function planYesNo(metric, date, log, done) {
  return plan(metric, date, done ? 1 : 0, log);
}

/**
 * Returns the change that sets the value of `metric` on `date`. For amounts, it is the day total.
 * @param {NumberMetric} metric
 * @param {Day} date
 * @param {number} value
 * @param {LogTable} log
 * @returns {LogWrite | null}
 */
export function planNumber(metric, date, value, log) {
  return plan(metric, date, value, log);
}

/**
 * Returns the change that clears the value of `metric` on `date`.
 * @param {Metric} metric
 * @param {Day} date
 * @param {LogTable} log
 * @returns {LogWrite | null}
 */
export function planClear(metric, date, log) {
  return plan(metric, date, null, log);
}

/**
 * One input on a count cell: add `delta`. A negative `delta` subtracts.
 * @typedef {object} CountStep
 * @property {number} delta
 */

/**
 * Applies `steps` in order to the day value `current`. Null is an empty cell.
 *
 * A count never goes below 0, also between steps, and 0 is an empty cell. Example: an empty cell, then -1, then +1,
 * gives 1.
 * @param {number | null} current
 * @param {Iterable<CountStep>} steps
 * @returns {number | null}
 */
export function applyCountSteps(current, steps) {
  let value = current ?? 0;
  for (const step of steps) value = Math.max(0, value + step.delta);
  return value <= 0 ? null : withoutFloatNoise(value);
}

/**
 * `value` without the float noise of decimal steps. Example: 0.30000000000000004 → 0.3.
 * @param {number} value
 * @returns {number}
 */
export function withoutFloatNoise(value) {
  return Number(toFixed(value, 6));
}

/**
 * Returns the change that applies `steps` to the current value of `metric` on `date` in `log`.
 *
 * `log` must be the latest data, so taps made during an earlier write add to its result.
 * @param {NumberMetric} metric
 * @param {Day} date
 * @param {CountStep[]} steps
 * @param {LogTable} log
 * @returns {LogWrite | null}
 */
export function planCount(metric, date, steps, log) {
  return plan(metric, date, applyCountSteps(log.valueAt(metric.id, date), steps), log);
}

/**
 * Returns the change that sets `metric` to `value` on `date`. Null if the cell already has `value`: the app compares
 * the value, not the text, so `yes` and 1 are equal.
 * @param {Metric} metric
 * @param {Day} date
 * @param {number | null} value
 * @param {LogTable} log
 * @returns {LogWrite | null}
 */
function plan(metric, date, value, log) {
  const column = log.columns.get(metric.id);
  if (column === undefined) throw new MissingColumnException(metric.id);
  if (log.valueAt(metric.id, date) === value) return null;
  const row = log.rows.get(date);
  const cell = cellValue(metric, value);
  if (row !== undefined) return new SetCell(row, column, cell);
  return cell === null ? null : new AppendRow(date, column, cell);
}
