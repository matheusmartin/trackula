// The score: the points of each metric on each day, and the score of each day. See docs/data-model.md.
import { daysBetween, earliestDay } from './Day.js';
import { withoutFloatNoise } from './LogEntry.js';
import { NumberMetric, YesNoMetric, metricsOf } from './Metric.js';
import { roundHalfAwayFromZero } from './Numbers.js';
import { cellText, logDate, parseLog } from './Parse.js';
import { trend } from './Stats.js';
import { metricValues } from './Summary.js';

/** @import { Day } from './Day.js' */
/** @import { CountStep, LogTable, MetricDay } from './LogEntry.js' */
/** @import { Metric } from './Metric.js' */
/** @import { Cell } from './Parse.js' */

/** The header of the score column of the `Log` tab. It starts with a capital letter, so it cannot be a metric id. */
export const SCORE_HEADER = 'Score';

/**
 * True if `metric` counts on each day from its first value: a yes/no or a count metric. A day without a value has the
 * value 0: `no`, or a count of 0. A number metric is a measurement, not a task for each day: it counts only on the days
 * with a value.
 * @param {Metric} metric
 * @returns {boolean}
 */
function countsEachDay(metric) {
  return !(metric instanceof NumberMetric) || metric.isCount;
}

/**
 * The points of `metric` for `value`, from 0 to 1. See docs/data-model.md.
 *
 * - Yes/no: 1 if `value` is the goal: `yes` (1), or `no` (0) for the goal `no`. Else 0.
 * - Number and count: the points of the goal. See {@link NumberGoal#points}. For a goal with a trend, `value` is the
 *   trend of the day. Example: `at least 8` and 6 give 0.75.
 * @param {Metric} metric
 * @param {number} value
 * @returns {number}
 */
export function metricPoints(metric, value) {
  if (metric instanceof YesNoMetric) return (value === 1) === metric.goalIsYes ? 1 : 0;
  return metric.goal.points(value);
}

/**
 * The points of each metric of `metrics` on each day that it counts, from 0 to 1, by metric id. Each metric has a goal,
 * so each metric gives points. The values come from {@link metricValues}, with the count taps in `pending`. A metric
 * without points, for example without values, is not in the result.
 *
 * - A yes/no or count metric counts on each day from its first value to `today`, and on each later day with a row. A
 *   day without a value, also a day without a row, has the value 0: `no` for yes/no, and 0 for a count. Without
 *   `today`, it counts only on the days with a row, as in the `Score` column.
 * - A number metric counts only on the days with a value. With a trend goal, its points come from the
 *   {@link trend}.
 *
 * Examples: water `at least 8`, 6 glasses on Oct 1, and today Oct 2 without a value give `water` → (Oct 1 → 0.75,
 * Oct 2 → 0). Coffee `at most 2` gives 1 on a day without a value: 0 coffees.
 * @param {Metric[]} metrics
 * @param {LogTable} log
 * @param {Day | null} [today] Null by default.
 * @param {Map<MetricDay, CountStep[]>} [pending] Empty by default.
 * @returns {Map<string, Map<Day, number>>}
 */
export function pointsByMetric(metrics, log, today = null, pending = new Map()) {
  /** @type {Map<string, Map<Day, number>>} */
  const byMetric = new Map();
  for (const metric of metrics) {
    const values = metricValues(metric, log, pending);
    const usesTrend = metric instanceof NumberMetric && metric.goal.usesTrend;
    /** @type {Map<Day, number>} */
    const points = new Map();
    for (const [day, value] of usesTrend ? trend(values) : values) points.set(day, metricPoints(metric, value));
    byMetric.set(
      metric.id,
      countsEachDay(metric) ? withEmptyDays(points, metricPoints(metric, 0), log, today) : points,
    );
  }
  return new Map([...byMetric].filter(([, points]) => points.size > 0));
}

/**
 * `points` with `empty` on each day without points, after the first day of `points`: each day with a row of `log`,
 * and each day up to `today`.
 * @param {Map<Day, number>} points
 * @param {number} empty
 * @param {LogTable} log
 * @param {Day | null} today
 * @returns {Map<Day, number>}
 */
function withEmptyDays(points, empty, log, today) {
  const first = earliestDay(points.keys());
  if (first === null) return points;
  const untilToday = today === null ? [] : daysBetween(first, today);
  const days = [...[...log.rows.keys()].filter((d) => d.isAfter(first)), ...untilToday].filter((d) => !points.has(d));
  const result = new Map(points);
  for (const day of days) result.set(day, empty);
  return result;
}

/**
 * The score of each day, from 0 to 100: the average of the `points` of the metrics that count on that day (see
 * {@link pointsByMetric}), as a percentage with 1 decimal. A day where no metric counts has no score. Example: the
 * points 1, 0.75 and 0 give 58.3.
 *
 * The points of the metrics of one group give the score of that group. See {@link pointsOf}.
 * @param {Map<string, Map<Day, number>>} points
 * @returns {Map<Day, number>}
 */
export function dayScores(points) {
  /** @type {Map<Day, number[]>} */
  const byDay = new Map();
  for (const days of points.values()) {
    for (const [day, p] of days) {
      const list = byDay.get(day);
      if (list) list.push(p);
      else byDay.set(day, [p]);
    }
  }
  return new Map(
    [...byDay].map(([day, p]) => [day, roundHalfAwayFromZero(withoutFloatNoise(averageOf(p) * 1000)) / 10]),
  );
}

/**
 * The `points` of the metrics of `metrics` in `group`, for the group filter. Null `group`: all metrics.
 * @param {Metric[]} metrics
 * @param {string | null} group
 * @param {Map<string, Map<Day, number>>} points
 * @returns {Map<string, Map<Day, number>>}
 */
export function pointsOf(metrics, group, points) {
  const ids = new Set(metricsOf(metrics, group).map((m) => m.id));
  return new Map([...points].filter(([id]) => ids.has(id)));
}

/**
 * The score of each group of `groups` on each day: the {@link dayScores} of the `points` of the metrics of `metrics`
 * in the group. A day where no metric of a group counts has no score of that group. Example: habits 1 and 0.5, body 0
 * give habits 75 and body 0.
 * @param {Metric[]} metrics
 * @param {string[]} groups
 * @param {Map<string, Map<Day, number>>} points
 * @returns {Map<string, Map<Day, number>>}
 */
export function groupScores(metrics, groups, points) {
  return new Map(groups.map((group) => [group, dayScores(pointsOf(metrics, group, points))]));
}

/**
 * The part of each group of `groups` in the score of each day: the sum of the `points` of the metrics of the group,
 * divided by the number of metrics that count on that day, as a percentage. So the parts of a day add up to its score,
 * before the score is rounded. A day without points of a group has no part of that group.
 *
 * Example: habits 1 and 0.5, body 0 give habits 50 and body 0. The score is 50.
 * @param {Metric[]} metrics
 * @param {string[]} groups
 * @param {Map<string, Map<Day, number>>} points
 * @returns {Map<string, Map<Day, number>>}
 */
export function groupParts(metrics, groups, points) {
  /** @type {Map<Day, number>} */
  const counted = new Map();
  for (const days of points.values()) {
    for (const day of days.keys()) counted.set(day, (counted.get(day) ?? 0) + 1);
  }
  return new Map(
    groups.map((group) => {
      /** @type {Map<Day, number>} */
      const sums = new Map();
      for (const days of pointsOf(metrics, group, points).values()) {
        for (const [day, p] of days) sums.set(day, (sums.get(day) ?? 0) + p);
      }
      const parts = new Map(
        [...sums].map(([day, sum]) => [day, withoutFloatNoise((100 * sum) / /** @type {number} */ (counted.get(day)))]),
      );
      return [group, parts];
    }),
  );
}

/**
 * The 0-based index of the score column in the `Log` `header`. Null if the tab has no score column.
 * @param {Cell[]} header
 * @returns {number | null}
 */
export function scoreColumn(header) {
  for (let c = 1; c < header.length; c++) if (cellText(header[c]).trim() === SCORE_HEADER) return c;
  return null;
}

/**
 * A cell of the score column that must change.
 * @typedef {object} ScoreCell
 * @property {number} row The 1-based row of the cell.
 * @property {number | null} score The new score. Null clears the cell.
 */

/**
 * The cells of the score `column` of the `Log` tab that do not show the score of their day. `rows` includes the
 * header row.
 *
 * Each row has the score of its day: see {@link dayScores}. If a day has more than one row, each of these rows has the
 * score of the day, from its last row. A row without a valid date, or of a day without a score, has no score.
 *
 * A changed value can also change the score of other days. Examples: the later days of a trend, and the empty days
 * after a new first value of a yes/no or count metric.
 * @param {Cell[][]} rows
 * @param {Metric[]} metrics
 * @param {number} column
 * @returns {ScoreCell[]}
 */
export function staleScoreCells(rows, metrics, column) {
  const log = parseLog(rows, new Map(metrics.map((m) => [m.id, m]))).table;
  const scores = dayScores(pointsByMetric(metrics, log));
  /** @type {ScoreCell[]} */
  const cells = [];
  for (let i = 1; i < rows.length; i++) {
    const date = logDate(rows[i][0] ?? null);
    const score = date === null ? null : (scores.get(date) ?? null);
    if (!shows(rows[i][column] ?? null, score)) cells.push({ row: i + 1, score });
  }
  return cells;
}

/**
 * True if the score `cell` shows `score`. An empty cell shows no score. Other text never shows a score, also a number
 * as text, so the app replaces it with a number. The `Score` rule accepts only numbers.
 * @param {Cell} cell
 * @param {number | null} score
 * @returns {boolean}
 */
function shows(cell, score) {
  if (typeof cell === 'string') return cell.trim() === '' && score === null;
  if (typeof cell === 'number') return score !== null && cell === score;
  if (cell === null) return score === null;
  return false;
}

/**
 * The average of `values`, as Kotlin `average()`: the sum in order, divided by the number of values.
 * @param {number[]} values
 * @returns {number}
 */
function averageOf(values) {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
