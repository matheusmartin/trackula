package trackula.model

import kotlin.math.max
import kotlin.math.min

/** A row of the `Metrics` tab. See docs/data-model.md. */
sealed class Metric {
    abstract val id: String
    abstract val name: String

    /** A Material Symbols name, such as `water_drop`, or an emoji. Required. */
    abstract val icon: String
    abstract val group: String?
}

/**
 * A habit that is done or not done. One value per day: `yes` or `no`.
 *
 * @property goalIsYes True if the goal is `yes`, the default. False if the goal is `no`: a habit to stop, for example
 *   smoking.
 */
data class YesNoMetric(
    override val id: String,
    override val name: String,
    override val icon: String,
    override val group: String? = null,
    val goalIsYes: Boolean = true,
) : Metric()

/**
 * A quantity or a measurement. Kinds `number` and `count`. One value per day, for example a weight or a day total.
 *
 * @property isCount True if the metric is kind `count`: the same as `number`, but the chart shows bars from 0 instead
 *   of a line.
 * @property goal The day goal. Null if the metric has no goal.
 */
data class NumberMetric(
    override val id: String,
    override val name: String,
    override val icon: String,
    val unit: String? = null,
    val step: Double = 1.0,
    val isCount: Boolean = false,
    val goal: NumberGoal? = null,
    override val group: String? = null,
) : Metric()

/**
 * The goal of a [NumberMetric]: at least [target], or at most [target] if [isMaximum]. It gives the points of a day,
 * from 0 to 1. See [points] and docs/data-model.md. Example: the goal cell `at most 80 from 83 trend` gives the
 * target 80, a maximum, the start 83 and the trend.
 *
 * @property isMaximum True if the goal is a maximum, for example a weight of at most 80 kg. Else it is a minimum.
 * @property from The value of 0 points, after `from` in the goal cell. It is below [target] for a minimum and above
 *   it for a maximum. Null if the cell has no `from`: see [start].
 * @property usesTrend True if the points come from the trend of the values, not from the value of the day. For
 *   values that change much from day to day, for example a weight. See [trend].
 */
data class NumberGoal(
    val target: Double,
    val isMaximum: Boolean = false,
    val from: Double? = null,
    val usesTrend: Boolean = false,
) {
    /**
     * The value of 0 points: [from], or 0 for a minimum above 0. Null for the other goals without `from`: they give
     * 1 or 0 points.
     */
    val start: Double? get() = from ?: if (!isMaximum && target > 0) 0.0 else null

    /** True if [value] reaches the goal. The target itself reaches it. */
    fun isReachedBy(value: Double): Boolean = if (isMaximum) value <= target else value >= target

    /**
     * The points of [value], from 0 to 1. A value that reaches the goal gives 1. Else the points are the part of the
     * way from [start] to the target, or 0 if there is no start.
     *
     * Examples: `at least 8` (from 0): 6 gives 0.75. `at most 80 from 83`: 82.1 gives 0.3, 84 gives 0. `at most 80`:
     * 82.1 gives 0.
     */
    fun points(value: Double): Double {
        if (isReachedBy(value)) return 1.0
        val start = start ?: return 0.0
        // max() and not coerceIn(): at the start of a maximum, the part is -0.0, and max() gives 0.0.
        return max(0.0, min(1.0, (value - start) / (target - start)))
    }
}

/** The group of the metrics without a group. */
const val OTHER_GROUP = "other"

/** The group of [metric], for the group filter. A metric without a group is in [OTHER_GROUP]. */
fun groupOf(metric: Metric): String = metric.group ?: OTHER_GROUP

/**
 * The metrics of [metrics] in [group], in the same order. Null [group]: all metrics. Example: the group "habits" gives
 * the metrics that the group filter shows, and that give the points of the group score.
 */
fun metricsOf(metrics: List<Metric>, group: String?): List<Metric> =
    if (group == null) metrics else metrics.filter { groupOf(it) == group }
