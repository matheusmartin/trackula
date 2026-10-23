package trackula.model

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
 * [goalIsYes] is true if the goal is `yes`, the default. It is false if the goal is `no`: a habit to stop, for example
 * smoking.
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
 * [isCount] is true if the metric is kind `count`: the same as `number`, but the chart shows bars from 0 instead of a
 * line. [goal] is the day goal. Null if the metric has no goal.
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
 * The day goal of a [NumberMetric]: at least [value], or at most [value] if [isMaximum].
 *
 * [isMaximum] is true if the goal is a maximum, for example a weight of at most 75 kg. Else it is a minimum.
 */
data class NumberGoal(val value: Double, val isMaximum: Boolean = false) {
    /** True if [dayValue] reaches the goal. The goal value itself reaches it. */
    fun isReachedBy(dayValue: Double): Boolean = if (isMaximum) dayValue <= value else dayValue >= value

    /** How far [dayValue] is from the goal: 0 if it reaches the goal. Example: goal at most 80, 82.5 → 2.5. */
    fun distanceTo(dayValue: Double): Double = if (isReachedBy(dayValue)) 0.0 else kotlin.math.abs(dayValue - value)
}
