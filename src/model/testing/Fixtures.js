// Metrics and helpers that many model tests use.
import { NumberGoal, NumberMetric, YesNoMetric } from '../Metric.js';

/** @import { Metric } from '../Metric.js' */
/** @import { Cell } from '../Parse.js' */

export const weight = new NumberMetric({
  id: 'weight',
  name: 'Weight',
  icon: 'monitor_weight',
  goal: new NumberGoal({ target: 80, isMaximum: true }),
  unit: 'kg',
  step: 0.1,
});

export const water = new NumberMetric({
  id: 'water',
  name: 'Water',
  icon: 'water_drop',
  goal: new NumberGoal({ target: 8 }),
  unit: 'glasses',
});

export const meditate = new YesNoMetric({ id: 'meditate', name: 'Meditate', icon: 'self_improvement' });

/**
 * The metrics by id.
 * @param {...Metric} metrics
 * @returns {Map<string, Metric>}
 */
export function byId(...metrics) {
  return new Map(metrics.map((m) => [m.id, m]));
}

/**
 * Sheet rows, as the Sheets API gives them.
 * @param {...Cell[]} rows
 * @returns {Cell[][]}
 */
export function rows(...rows) {
  return rows;
}
