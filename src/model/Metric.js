// The metrics of the `Metrics` tab, their goals and their groups. See docs/data-model.md.

/**
 * A row of the `Metrics` tab: a {@link YesNoMetric} or a {@link NumberMetric}. See docs/data-model.md. Check the kind
 * with `instanceof`. Both kinds have the fields `id`, `name`, `icon` and `group`.
 * @typedef {YesNoMetric | NumberMetric} Metric
 */

/**
 * The fields of a {@link YesNoMetric}.
 * @typedef {object} YesNoMetricFields
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string | null} [group] Null by default.
 * @property {boolean} [goalIsYes] True by default.
 */

/** A habit that is done or not done. One value per day: `yes` or `no`. */
export class YesNoMetric {
  /** @param {YesNoMetricFields} fields */
  constructor({ id, name, icon, group = null, goalIsYes = true }) {
    this.id = id;
    this.name = name;
    /** A Material Symbols name, such as `water_drop`, or an emoji. Required. */
    this.icon = icon;
    this.group = group;
    /** True if the goal is `yes`. False if the goal is `no`: a habit to stop, for example smoking. */
    this.goalIsYes = goalIsYes;
    Object.freeze(this);
  }

  /**
   * A copy of this metric with other values in `changes`.
   * @param {Partial<YesNoMetricFields>} changes
   * @returns {YesNoMetric}
   */
  copy(changes) {
    return new YesNoMetric({ ...this, ...changes });
  }
}

/**
 * The fields of a {@link NumberMetric}.
 * @typedef {object} NumberMetricFields
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {NumberGoal} goal
 * @property {string | null} [unit] Null by default.
 * @property {number} [step] 1 by default.
 * @property {boolean} [isCount] False by default.
 * @property {string | null} [group] Null by default.
 */

/** A quantity or a measurement. Kinds `number` and `count`. One value per day, for example a weight or a day total. */
export class NumberMetric {
  /** @param {NumberMetricFields} fields */
  constructor({ id, name, icon, goal, unit = null, step = 1, isCount = false, group = null }) {
    this.id = id;
    this.name = name;
    /** A Material Symbols name, such as `water_drop`, or an emoji. Required. */
    this.icon = icon;
    /** The day goal. Required: it gives the points of the metric in the score. */
    this.goal = goal;
    this.unit = unit;
    this.step = step;
    /**
     * True if the metric is kind `count`: the same as `number`, but the chart shows bars from 0 instead of a line.
     */
    this.isCount = isCount;
    this.group = group;
    Object.freeze(this);
  }

  /**
   * A copy of this metric with other values in `changes`.
   * @param {Partial<NumberMetricFields>} changes
   * @returns {NumberMetric}
   */
  copy(changes) {
    return new NumberMetric({ ...this, ...changes });
  }
}

/**
 * The fields of a {@link NumberGoal}.
 * @typedef {object} NumberGoalFields
 * @property {number} target
 * @property {boolean} [isMaximum] False by default.
 * @property {number | null} [from] Null by default.
 * @property {boolean} [usesTrend] False by default.
 */

/**
 * The goal of a {@link NumberMetric}: at least `target`, or at most `target` if `isMaximum`. It gives the points of a
 * day, from 0 to 1. See {@link NumberGoal#points} and docs/data-model.md. Example: the goal cell
 * `at most 80 from 83 trend` gives the target 80, a maximum, the start 83 and the trend.
 */
export class NumberGoal {
  /** @param {NumberGoalFields} fields */
  constructor({ target, isMaximum = false, from = null, usesTrend = false }) {
    this.target = target;
    /** True if the goal is a maximum, for example a weight of at most 80 kg. Else it is a minimum. */
    this.isMaximum = isMaximum;
    /**
     * The value of 0 points, after `from` in the goal cell. It is below `target` for a minimum and above it for a
     * maximum. Null if the cell has no `from`: see {@link NumberGoal#start}.
     */
    this.from = from;
    /**
     * True if the points come from the trend of the values, not from the value of the day. For values that change
     * much from day to day, for example a weight. See `trend` in `Stats.js`.
     */
    this.usesTrend = usesTrend;
    Object.freeze(this);
  }

  /**
   * @returns {number | null} The value of 0 points: `from`, or 0 for a minimum above 0. Null for the other goals
   *   without `from`: they give 1 or 0 points.
   */
  get start() {
    return this.from ?? (!this.isMaximum && this.target > 0 ? 0 : null);
  }

  /**
   * True if `value` reaches the goal. The target itself reaches it.
   * @param {number} value
   * @returns {boolean}
   */
  isReachedBy(value) {
    return this.isMaximum ? value <= this.target : value >= this.target;
  }

  /**
   * The points of `value`, from 0 to 1. A value that reaches the goal gives 1. Else the points are the part of the way
   * from {@link NumberGoal#start} to the target, or 0 if there is no start.
   *
   * Examples: `at least 8` (from 0): 6 gives 0.75. `at most 80 from 83`: 82.1 gives 0.3, 84 gives 0. `at most 80`:
   * 82.1 gives 0.
   * @param {number} value
   * @returns {number}
   */
  points(value) {
    if (this.isReachedBy(value)) return 1;
    const start = this.start;
    if (start === null) return 0;
    // At the start of a maximum, the part is -0. Math.max gives 0.
    return Math.max(0, Math.min(1, (value - start) / (this.target - start)));
  }

  /**
   * A copy of this goal with other values in `changes`.
   * @param {Partial<NumberGoalFields>} changes
   * @returns {NumberGoal}
   */
  copy(changes) {
    return new NumberGoal({ ...this, ...changes });
  }
}

/**
 * The mark of a day value on a Today tile. See {@link goalMark}.
 * @typedef {'NONE' | 'REACHED' | 'OVER_LIMIT'} GoalMark
 */

/**
 * The marks of a day value on a Today tile. `NONE`: no mark. `REACHED`: the value reaches a target, the goal `yes` or
 * `at least`, and the tile shows a check mark. `OVER_LIMIT`: the value is over a limit, the goal `no` or `at most`,
 * and the tile shows a warning sign.
 */
export const GoalMark = Object.freeze({ NONE: 'NONE', REACHED: 'REACHED', OVER_LIMIT: 'OVER_LIMIT' });

/**
 * The {@link GoalMark} of `value`, the value of a day of `metric`. Null is no value. The goal `yes` or `at least` is a
 * target, and the goal `no` or `at most` is a limit. A value within a limit gets no mark: the day is not over.
 *
 * Examples: Water `at least 8`: 8 gives `REACHED`, 5 gives `NONE`. Coffee `no`: `yes` (1) gives `OVER_LIMIT`. Coffee
 * `at most 2`: 1 gives `NONE`, 3 gives `OVER_LIMIT`.
 * @param {Metric} metric
 * @param {number | null} value
 * @returns {GoalMark}
 */
export function goalMark(metric, value) {
  if (value == null) return GoalMark.NONE;
  // Only a `yes` day has a mark: `yes` reaches the goal `yes`, and is over the limit `no`.
  if (metric instanceof YesNoMetric) {
    if (value !== 1) return GoalMark.NONE;
    return metric.goalIsYes ? GoalMark.REACHED : GoalMark.OVER_LIMIT;
  }
  const goal = metric.goal;
  if (goal.isMaximum && !goal.isReachedBy(value)) return GoalMark.OVER_LIMIT;
  if (!goal.isMaximum && goal.isReachedBy(value)) return GoalMark.REACHED;
  return GoalMark.NONE;
}

/** The group of the metrics without a group. */
export const OTHER_GROUP = 'other';

/**
 * The group of `metric`, for the group filter. A metric without a group is in {@link OTHER_GROUP}.
 * @param {Metric} metric
 * @returns {string}
 */
export function groupOf(metric) {
  return metric.group ?? OTHER_GROUP;
}

/**
 * The metrics of `metrics` in `group`, in the same order. Null `group`: all metrics. Example: the group "habits" gives
 * the metrics that the group filter shows, and that give the points of the group score.
 * @param {Metric[]} metrics
 * @param {string | null} group
 * @returns {Metric[]}
 */
export function metricsOf(metrics, group) {
  return group === null ? metrics : metrics.filter((m) => groupOf(m) === group);
}
