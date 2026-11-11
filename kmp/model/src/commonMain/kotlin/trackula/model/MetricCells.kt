package trackula.model

/** The `kind` cell of [metric]: `yesno`, `number` or `count`. */
fun kindText(metric: Metric): String = when (metric) {
    is YesNoMetric -> "yesno"
    is NumberMetric -> if (metric.isCount) "count" else "number"
}

/**
 * The text of [goal] in a `goal` cell, as the app writes it. [parseMetricRow] reads it back as the same goal.
 * Examples: `at least 8`, `at most 80 from 83 trend`.
 */
fun goalText(goal: NumberGoal): String = buildString {
    append(if (goal.isMaximum) "at most " else "at least ")
    append(formatTrimmed(goal.target))
    goal.from?.let { append(" from ${formatTrimmed(it)}") }
    if (goal.usesTrend) append(" trend")
}

/**
 * The cells of the `Metrics` row of [metric], by the header names of [metricsHeader]. An empty text is an empty
 * cell: a write clears it. [parseMetricRow] reads the cells back as the same metric.
 *
 * Example: the metric Water of kind `count` with the goal at least 8 gives `id` = `water`, `kind` = `count`,
 * `step` = 1.0 and `goal` = `at least 8`.
 */
fun metricCells(metric: Metric): Map<String, Any> {
    val common = mapOf(
        "id" to metric.id,
        "name" to metric.name,
        "kind" to kindText(metric),
        "group" to metric.group.orEmpty(),
        "icon" to metric.icon,
    )
    return common + when (metric) {
        is YesNoMetric -> mapOf("unit" to "", "step" to "", "goal" to if (metric.goalIsYes) "yes" else "no")

        is NumberMetric -> mapOf(
            "unit" to metric.unit.orEmpty(),
            "step" to metric.step,
            "goal" to (metric.goal?.let(::goalText) ?: ""),
        )
    }
}
