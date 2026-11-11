package trackula.model

/**
 * The value of [metric] on each day of [log] with a value, with the count taps in [pending] that are not written yet.
 * If a day has more than one row, the value of its last row, as in [LogTable.valueAt]. For a yes/no metric: 1 for
 * `yes` and 0 for `no`.
 *
 * The table, the tiles, the charts and the score all use these values, so they show the same day values.
 */
fun metricValues(
    metric: Metric,
    log: LogTable,
    pending: Map<MetricDay, List<CountStep>> = emptyMap(),
): Map<Day, Double> {
    val values = log.entries
        .filter { it.metricId == metric.id && log.rows[it.date] == it.row }
        .associate { it.date to it.value }
        .toMutableMap()
    if (metric is NumberMetric) {
        for ((key, steps) in pending) {
            if (key.metricId != metric.id) continue
            val value = applyCountSteps(values[key.day], steps)
            if (value != null) values[key.day] = value else values.remove(key.day)
        }
    }
    return values
}

/**
 * The [metricValues] of [metric] that the table and the tiles show. A yes/no metric has only its `yes` days, with 1:
 * a `no` day shows as not done, like a day without a value.
 */
fun dayValues(metric: Metric, log: LogTable, pending: Map<MetricDay, List<CountStep>> = emptyMap()): Map<Day, Double> {
    val values = metricValues(metric, log, pending)
    return if (metric is YesNoMetric) values.filterValues { it == 1.0 } else values
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
