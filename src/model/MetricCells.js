// The cells of the `Metrics` row of a metric, as the app writes them. See docs/data-model.md.
import { formatTrimmed } from './Format.js';
import { YesNoMetric } from './Metric.js';

/** @import { Metric, NumberGoal } from './Metric.js' */

/**
 * The `kind` cell of `metric`: `yesno`, `number` or `count`.
 * @param {Metric} metric
 * @returns {string}
 */
export function kindText(metric) {
  if (metric instanceof YesNoMetric) return 'yesno';
  return metric.isCount ? 'count' : 'number';
}

/**
 * The text of `goal` in a `goal` cell, as the app writes it. `parseMetricRow` reads it back as the same goal. Examples:
 * `at least 8`, `at most 80 from 83 trend`.
 * @param {NumberGoal} goal
 * @returns {string}
 */
export function goalText(goal) {
  let text = `${goal.isMaximum ? 'at most' : 'at least'} ${formatTrimmed(goal.target)}`;
  if (goal.from !== null) text += ` from ${formatTrimmed(goal.from)}`;
  if (goal.usesTrend) text += ' trend';
  return text;
}

/**
 * The cells of the `Metrics` row of `metric`, by the header names of `metricsHeader`. An empty text is an empty cell:
 * a write clears it. `parseMetricRow` reads the cells back as the same metric.
 *
 * Example: the metric Water of kind `count` with the goal at least 8 gives `id` = `water`, `kind` = `count`,
 * `step` = 1 and `goal` = `at least 8`.
 * @param {Metric} metric
 * @returns {Map<string, string | number>}
 */
export function metricCells(metric) {
  /** @type {Map<string, string | number>} */
  const cells = new Map([
    ['id', metric.id],
    ['name', metric.name],
    ['kind', kindText(metric)],
    ['group', metric.group ?? ''],
    ['icon', metric.icon],
  ]);
  if (metric instanceof YesNoMetric) {
    cells.set('unit', '');
    cells.set('step', '');
    cells.set('goal', metric.goalIsYes ? 'yes' : 'no');
  } else {
    cells.set('unit', metric.unit ?? '');
    cells.set('step', metric.step);
    cells.set('goal', goalText(metric.goal));
  }
  return cells;
}
