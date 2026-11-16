// The day values of a metric, for the table, the tiles, the charts and the score.
import { applyCountSteps, parseMetricDay } from './LogEntry.js';
import { NumberMetric, YesNoMetric } from './Metric.js';

/** @import { Day } from './Day.js' */
/** @import { CountStep, LogTable, MetricDay } from './LogEntry.js' */
/** @import { Metric } from './Metric.js' */

/**
 * The value of `metric` on each day of `log` with a value, with the count taps in `pending` that are not written yet.
 * If a day has more than one row, the value of its last row, as in {@link LogTable#valueAt}. For a yes/no metric: 1
 * for `yes` and 0 for `no`.
 *
 * The table, the tiles, the charts and the score all use these values, so they show the same day values.
 * @param {Metric} metric
 * @param {LogTable} log
 * @param {Map<MetricDay, CountStep[]>} [pending] Empty by default.
 * @returns {Map<Day, number>}
 */
export function metricValues(metric, log, pending = new Map()) {
  /** @type {Map<Day, number>} */
  const values = new Map();
  for (const entry of log.entries) {
    if (entry.metricId === metric.id && log.rows.get(entry.date) === entry.row) values.set(entry.date, entry.value);
  }
  if (metric instanceof NumberMetric) {
    for (const [key, steps] of pending) {
      const { metricId, day } = parseMetricDay(key);
      if (metricId !== metric.id) continue;
      const value = applyCountSteps(values.get(day) ?? null, steps);
      if (value !== null) values.set(day, value);
      else values.delete(day);
    }
  }
  return values;
}

/**
 * The {@link metricValues} of `metric` that the table and the tiles show. A yes/no metric has only its `yes` days,
 * with 1: a `no` day shows as not done, like a day without a value.
 * @param {Metric} metric
 * @param {LogTable} log
 * @param {Map<MetricDay, CountStep[]>} [pending] Empty by default.
 * @returns {Map<Day, number>}
 */
export function dayValues(metric, log, pending = new Map()) {
  const values = metricValues(metric, log, pending);
  if (!(metric instanceof YesNoMetric)) return values;
  return new Map([...values].filter(([, value]) => value === 1));
}

/**
 * The day of `days` that is nearest before `day`, else the nearest after it. Null if `days` has no other day.
 *
 * The number editor of an empty day starts at the value of this day.
 * @param {Iterable<Day>} days
 * @param {Day} day
 * @returns {Day | null}
 */
export function nearestDay(days, day) {
  /** @type {Day | null} */
  let before = null;
  /** @type {Day | null} */
  let after = null;
  for (const d of days) {
    if (d.isBefore(day) && (before === null || d.isAfter(before))) before = d;
    if (d.isAfter(day) && (after === null || d.isBefore(after))) after = d;
  }
  return before ?? after;
}
