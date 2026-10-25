package trackula.model

/**
 * Returns the value of [metric] for each day that has an entry.
 *
 * - [YesNoMetric]: 1 for `yes`. Days with `no` are left out, like days without a value: both show as not done.
 * - Number: the value of the cell.
 */
fun dayValues(metric: Metric, log: List<LogEntry>): Map<Day, Double> {
    val values = mutableMapOf<Day, Double>()
    for (e in log) {
        if (e.metricId != metric.id) continue
        if (metric is YesNoMetric && e.value != 1.0) continue
        values[e.date] = e.value
    }
    return values
}

/** [dayValues] of [metric], with the count taps in [pending] that are not written yet. */
fun dayValuesWithPending(
    metric: Metric,
    log: List<LogEntry>,
    pending: Map<MetricDay, List<CountStep>>,
): Map<Day, Double> {
    val values = dayValues(metric, log).toMutableMap()
    for ((key, steps) in pending) {
        if (key.metricId != metric.id) continue
        val value = applyCountSteps(values[key.day], steps)
        if (value != null) values[key.day] = value else values.remove(key.day)
    }
    return values
}

/**
 * The day of [days] that is nearest before [day], else the nearest after it. Null if [days] has no other day.
 *
 * The number editor of an empty day starts at the value of this day.
 */
fun nearestDay(days: Iterable<Day>, day: Day): Day? {
    var before: Day? = null
    var after: Day? = null
    for (d in days) {
        if (d < day && (before == null || d > before)) before = d
        if (d > day && (after == null || d < after)) after = d
    }
    return before ?: after
}
