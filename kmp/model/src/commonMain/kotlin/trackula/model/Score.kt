package trackula.model

import kotlin.math.max
import kotlin.math.min

/** The header of the score column of the `Log` tab. It starts with a capital letter, so it cannot be a metric id. */
const val SCORE_HEADER = "Score"

/**
 * The score: "Goals met", the share of the day goals that a day meets, from 0 to 100 %. See [dayScores]. It is not a
 * row of the `Metrics` tab, and its cells are read-only. It has no icon: the score card and the score detail screen
 * show only its name.
 */
val scoreMetric = NumberMetric(id = SCORE_HEADER, name = "Goals met", icon = "", unit = "%")

/**
 * The score of the metrics of one [group], for the group filter. [label] is the group name that the app shows. Its id
 * starts with [SCORE_HEADER] and a colon, so it cannot be a metric id. Example: the group "habits" with the label
 * "Habits" gives the id "Score:habits" and the name "Goals met · Habits".
 */
fun groupScoreMetric(group: String, label: String): NumberMetric =
    scoreMetric.copy(id = "$SCORE_HEADER:$group", name = "${scoreMetric.name} · $label")

/** True if [metric] is [scoreMetric] or a [groupScoreMetric]. */
fun isScore(metric: Metric): Boolean = metric.id == SCORE_HEADER || metric.id.startsWith("$SCORE_HEADER:")

/**
 * How much of the day goal of [metric] a day with [value] meets, from 0 (not met) to 1 (met). A null [value] is a day
 * without a value: 0. [previous] is the value of the previous log of [metric]: the latest earlier day with a value,
 * also after missed days. Null if there is no earlier log. See docs/data-model.md.
 *
 * - Yes/no: 1 if [value] is the goal: `yes` (1), or `no` (0) for the goal `no`.
 * - Count with an "at least" goal: [value] divided by the goal, at most 1. Example: 5 of 8 glasses give 0.625.
 * - Count with an "at most" goal: 1 if [value] reaches the goal.
 * - Number with a goal: 1 if [value] reaches the goal, if it is closer to the goal than [previous], or if it is the
 *   first log. Example: goal at most 80, 82.6 after 83 gives 1, 82.8 after 82.6 gives 0, 79.9 gives 1.
 * - Without a goal: 1 for a logged value. For a count, the value must be above 0.
 */
fun goalProgress(metric: Metric, value: Double?, previous: Double? = null): Double {
    if (value == null) return 0.0
    return when (metric) {
        is YesNoMetric -> if ((value == 1.0) == metric.goalIsYes) 1.0 else 0.0

        is NumberMetric -> {
            val goal = metric.goal
            when {
                goal == null -> if (!metric.isCount || value > 0) 1.0 else 0.0

                metric.isCount && !goal.isMaximum -> if (goal.value <=
                    0
                ) {
                    1.0
                } else {
                    min(1.0, max(0.0, value) / goal.value)
                }

                goal.isReachedBy(value) -> 1.0

                metric.isCount -> 0.0

                previous == null || goal.distanceTo(value) < goal.distanceTo(previous) -> 1.0

                else -> 0.0
            }
        }
    }
}

/**
 * The score of each day of [log] that has a value: the share of the goals of the [metrics] that the day meets, in
 * percent with one decimal. It includes the count taps in [pending] that are not written yet. Each metric counts from
 * the day of its first value. A metric without a value on a later day counts as 0 on that day. A day without any
 * value has no score. Example: 4 metrics count, 3 meet their goal and one meets half: (1 + 1 + 1 + 0.5) / 4 = 87.5.
 *
 * If a day has more than one row, only the last row counts, as in [LogTable.rows]. So the score is the same as the
 * `Score` cell of that row.
 */
fun dayScores(
    metrics: List<Metric>,
    log: LogTable,
    pending: Map<MetricDay, List<CountStep>> = emptyMap(),
): Map<Day, Double> {
    val sums = mutableMapOf<Day, Double>()
    for (days in scoreParts(metrics, log, pending).values) {
        for ((day, part) in days) sums[day] = (sums[day] ?: 0.0) + part
    }
    return sums.mapValues { (_, sum) -> roundScore(sum) }
}

/**
 * The part of each metric of [metrics] in the score of each day, by metric id, in percent. The parts of a day add up
 * to its score (see [dayScores]), before rounding. Example: 4 metrics count on a day, and water meets half its goal:
 * the part of water is 0.5 / 4 × 100 = 12.5. A metric has no part on the days before its first value.
 */
fun scoreParts(
    metrics: List<Metric>,
    log: LogTable,
    pending: Map<MetricDay, List<CountStep>> = emptyMap(),
): Map<String, Map<Day, Double>> {
    val byId = metrics.associateBy { it.id }
    val values = lastRowValues(byId, log).toMutableMap()
    for ((key, steps) in pending) {
        if (byId[key.metricId] !is NumberMetric) continue
        val value = applyCountSteps(values[key], steps)
        if (value != null) values[key] = value else values.remove(key)
    }
    val previous = previousValues(values)
    val firstDays = firstValueDays(values.keys)
    val parts = metrics.associate { it.id to mutableMapOf<Day, Double>() }
    for (day in values.keys.map { it.day }.toSet()) {
        val counted = metrics.filter { m -> firstDays[m.id]?.let { it <= day } == true }
        for (m in counted) {
            val key = MetricDay(m.id, day)
            parts.getValue(m.id)[day] = goalProgress(m, values[key], previous[key]) * 100 / counted.size
        }
    }
    return parts
}

/**
 * The score of each group of [groups], from the [parts] of each metric (see [scoreParts]). For each group and day:
 * the sum of the parts of the metrics of [metrics] in the group. So the group values of a day add up to its score.
 */
fun groupScoreParts(
    metrics: List<Metric>,
    groups: List<String>,
    parts: Map<String, Map<Day, Double>>,
): Map<String, Map<Day, Double>> = groups.associateWith { group ->
    val sums = mutableMapOf<Day, Double>()
    for (m in metricsOf(metrics, group)) {
        for ((day, part) in parts[m.id].orEmpty()) sums[day] = (sums[day] ?: 0.0) + part
    }
    sums
}

/** A score in percent with one decimal, without float noise. Example: 66.6666 → 66.7. */
private fun roundScore(percent: Double): Double = withoutFloatNoise(roundHalfAwayFromZero(percent * 10) / 10)

/** The day of the first value of each metric in [keys], by metric id. */
private fun firstValueDays(keys: Collection<MetricDay>): Map<String, Day> =
    keys.groupBy { it.metricId }.mapValues { (_, k) -> k.minOf { it.day } }

/**
 * The value of each metric of [byId] on each day of [log]. If a day has more than one row, the value of its last
 * row.
 */
private fun lastRowValues(byId: Map<String, Metric>, log: LogTable): Map<MetricDay, Double> = log.entries
    .filter { it.metricId in byId && log.rows[it.date] == it.row }
    .associate { MetricDay(it.metricId, it.date) to it.value }

/**
 * For each metric and day of [values], the value of the previous log: the latest earlier day of the same metric with
 * a value. Days without an earlier log are not in the result. The rows of the `Log` tab are not sorted, so this
 * sorts the days.
 */
private fun previousValues(values: Map<MetricDay, Double>): Map<MetricDay, Double> {
    val previous = mutableMapOf<MetricDay, Double>()
    for ((id, keys) in values.keys.groupBy { it.metricId }) {
        val days = keys.map { it.day }.sorted()
        for (i in 1 until days.size) {
            previous[MetricDay(id, days[i])] = values.getValue(MetricDay(id, days[i - 1]))
        }
    }
    return previous
}

/** The 0-based index of the score column in the `Log` [header]. Null if the tab has no score column. */
fun scoreColumn(header: List<Any?>): Int? =
    (1 until header.size).firstOrNull { cellText(header[it]).trim() == SCORE_HEADER }

/**
 * A cell of the score column that must change.
 *
 * @property row The 1-based row of the cell.
 * @property score The new score. Null clears the cell.
 */
data class ScoreCell(val row: Int, val score: Double?)

/**
 * The cells of the score [column] of the `Log` tab that do not show the score of their row. [rows] includes the
 * header row.
 *
 * The score of a row is the share of the goals that its values meet, as in [dayScores]: each metric counts from the
 * day of its first value, and a metric without a value in the row counts as 0. A row without a value, or without a
 * valid date, has no score. The previous log of a value comes from the earlier days, so a changed value can also
 * change the score of the next day with a value of that metric. A new first value can also change the scores of the
 * later days, because the metric counts from that day.
 */
fun staleScoreCells(rows: List<List<Any?>>, metrics: List<Metric>, column: Int): List<ScoreCell> {
    val byId = metrics.associateBy { it.id }
    val log = parseLog(rows, byId).table
    val last = lastRowValues(byId, log)
    val previous = previousValues(last)
    val firstDays = firstValueDays(last.keys)
    val entriesByRow = log.entries.groupBy { it.row }
    return (1 until rows.size).mapNotNull { i ->
        val row = i + 1
        val entries = entriesByRow[row]
        val score = entries?.let {
            val day = it.first().date
            val values = it.associate { e -> e.metricId to e.value }
            val counted = metrics.filter { m -> firstDays[m.id]?.let { f -> f <= day } == true }
            val sum = counted.sumOf { m -> goalProgress(m, values[m.id], previous[MetricDay(m.id, day)]) }
            roundScore(sum * 100 / counted.size)
        }
        if (shows(rows[i].getOrNull(column), score)) null else ScoreCell(row, score)
    }
}

/**
 * True if the score [cell] shows [score]. An empty cell shows no score. Other text never shows a score, also a
 * number as text, so the app replaces it with a number. The `Score` rule accepts only numbers.
 */
private fun shows(cell: Any?, score: Double?): Boolean = when (cell) {
    is String -> cell.isBlank() && score == null
    is Number -> score != null && cell.toDouble() == score
    null -> score == null
    else -> false
}
