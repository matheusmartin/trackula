package trackula.model

import kotlin.math.max

/** The header of the score column of the `Log` tab. It starts with a capital letter, so it cannot be a metric id. */
const val SCORE_HEADER = "Score"

/**
 * The score as a count metric, for the table, the calendars and the detail screen. It is not a row of the `Metrics`
 * tab, and its cells are read-only: [dayScores] calculates its values. It has no icon: the score card and the score
 * detail screen show only its name.
 */
val scoreMetric = NumberMetric(id = SCORE_HEADER, name = "Score", icon = "", unit = "points", isCount = true)

/** True if [metric] is [scoreMetric]. */
fun isScore(metric: Metric): Boolean = metric.id == SCORE_HEADER

/**
 * The points of [metric] for a day with [value]. [previous] is the value of the previous log of [metric]: the latest
 * earlier day with a value, also after missed days. Null if there is no earlier log. See docs/data-model.md.
 *
 * - Yes/no: 1 if [value] is the goal: `yes` (1), or `no` (0) for the goal `no`.
 * - Count: 1 for each step, also above the goal. Example: 3 glasses with step 1 give 3 points. 30 minutes with
 *   step 10 give 3 points. A value below 0, typed in the sheet, gives 0 points.
 * - Number: 1 if [value] reaches the goal, if it is closer to the goal than [previous], or if it is the first log.
 *   Else 0. Always 0 if the metric has no goal. Example: goal at most 80, 82.6 after 83 gives 1, 82.8 after 82.6
 *   gives 0, 79.9 gives 1.
 */
fun metricPoints(metric: Metric, value: Double, previous: Double? = null): Double = when (metric) {
    is YesNoMetric -> if ((value == 1.0) == metric.goalIsYes) 1.0 else 0.0
    is NumberMetric -> {
        val goal = metric.goal
        when {
            metric.isCount -> max(0.0, value) / metric.step
            goal == null -> 0.0
            goal.isReachedBy(value) || previous == null || goal.distanceTo(value) < goal.distanceTo(previous) -> 1.0
            else -> 0.0
        }
    }
}

/**
 * The score of each day of [log]: the sum of the points of the [metrics] on that day. It includes the count taps in
 * [pending] that are not written yet. A day without a value has no score.
 *
 * If a day has more than one row, only the last row counts, as in [LogTable.rows]. So the score is the same as the
 * `Score` cell of that row.
 */
fun dayScores(
    metrics: List<Metric>,
    log: LogTable,
    pending: Map<MetricDay, List<CountStep>> = emptyMap(),
): Map<Day, Double> {
    val byId = metrics.associateBy { it.id }
    val values = lastRowValues(byId, log).toMutableMap()
    for ((key, steps) in pending) {
        if (byId[key.metricId] !is NumberMetric) continue
        val value = applyCountSteps(values[key], steps)
        if (value != null) values[key] = value else values.remove(key)
    }
    val previous = previousValues(values)
    val points = mutableMapOf<Day, MutableList<Double>>()
    for ((key, value) in values) {
        points.getOrPut(key.day) { mutableListOf() }
            .add(metricPoints(byId.getValue(key.metricId), value, previous[key]))
    }
    return points.mapValues { (_, p) -> total(p) }
}

/** The value of each metric of [byId] on each day of [log]. If a day has more than one row, the value of its last row. */
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
fun scoreColumn(header: List<Any?>): Int? = (1 until header.size).firstOrNull { cellText(header[it]).trim() == SCORE_HEADER }

/** A cell of the score column that must change: its 1-based [row] and the new [score]. A null score clears the cell. */
data class ScoreCell(val row: Int, val score: Double?)

/**
 * The cells of the score [column] of the `Log` tab that do not show the score of their row. [rows] includes the
 * header row.
 *
 * The score of a row is the sum of the points of its values. See [metricPoints]. A row without a value, or without a
 * valid date, has no score. The previous log of a value comes from the earlier days, so a changed value can also
 * change the score of the next day with a value of that metric.
 */
fun staleScoreCells(rows: List<List<Any?>>, metrics: List<Metric>, column: Int): List<ScoreCell> {
    val byId = metrics.associateBy { it.id }
    val log = parseLog(rows, byId).table
    val previous = previousValues(lastRowValues(byId, log))
    val points = mutableMapOf<Int, MutableList<Double>>()
    for (e in log.entries) {
        val metric = byId.getValue(e.metricId)
        points.getOrPut(e.row) { mutableListOf() }.add(metricPoints(metric, e.value, previous[MetricDay(e.metricId, e.date)]))
    }
    return (1 until rows.size).mapNotNull { i ->
        val row = i + 1
        val score = points[row]?.let(::total)
        if (shows(rows[i].getOrNull(column), score)) null else ScoreCell(row, score)
    }
}

/** The sum of [points] without float noise. */
private fun total(points: List<Double>): Double = withoutFloatNoise(points.sum())

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
