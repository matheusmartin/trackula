package trackula.model

/** The header of the score column of the `Log` tab. It starts with a capital letter, so it cannot be a metric id. */
const val SCORE_HEADER = "Score"

/**
 * The score as a count metric, for the table, the calendars and the detail screen. It is not a row of the `Metrics`
 * tab, and its cells are read-only: [dayScores] calculates its values, from 0 to 100. It has no icon: the score card
 * and the score detail screen show only its name.
 */
val scoreMetric = NumberMetric(id = SCORE_HEADER, name = "Score", icon = "", unit = "%", isCount = true)

/**
 * The score of the metrics of one [group], for the group filter. [label] is the group name that the app shows. Its id
 * starts with [SCORE_HEADER] and a colon, so it cannot be a metric id. Example: the group "habits" with the label
 * "Habits" gives the id "Score:habits" and the name "Score · Habits".
 */
fun groupScoreMetric(group: String, label: String): NumberMetric =
    scoreMetric.copy(id = "$SCORE_HEADER:$group", name = "${scoreMetric.name} · $label")

/** True if [metric] is [scoreMetric] or a [groupScoreMetric]. */
fun isScore(metric: Metric): Boolean = metric.id == SCORE_HEADER || metric.id.startsWith("$SCORE_HEADER:")

/**
 * True if [metric] gives points to the score: a yes/no metric, or a number or count metric with a goal. A metric
 * without a goal is only tracked: it does not change the score.
 */
fun isScored(metric: Metric): Boolean = metric !is NumberMetric || metric.goal != null

/**
 * True if [metric] counts on each day from its first value: a yes/no or a count metric. A day without a value has the
 * value 0: `no`, or a count of 0. A number metric is a measurement, not a task for each day: it counts only on the
 * days with a value.
 */
private fun countsEachDay(metric: Metric): Boolean = metric !is NumberMetric || metric.isCount

/**
 * The points of [metric] for [value], from 0 to 1. See docs/data-model.md.
 *
 * - Yes/no: 1 if [value] is the goal: `yes` (1), or `no` (0) for the goal `no`. Else 0.
 * - Number and count: the points of the goal. See [NumberGoal.points]. For a goal with a trend, [value] is the trend
 *   of the day. Example: `at least 8` and 6 give 0.75.
 * - A metric without a goal: 0. It is not in the score: see [isScored].
 */
fun metricPoints(metric: Metric, value: Double): Double = when (metric) {
    is YesNoMetric -> if ((value == 1.0) == metric.goalIsYes) 1.0 else 0.0
    is NumberMetric -> metric.goal?.points(value) ?: 0.0
}

/**
 * The points of each metric of [metrics] that gives points (see [isScored]) on each day that it counts, from 0 to 1,
 * by metric id. The values come from [metricValues], with the count taps in [pending]. A metric without points is not
 * in the result.
 *
 * - A yes/no or count metric counts on each day from its first value to [today], and on each later day with a row. A
 *   day without a value, also a day without a row, has the value 0: `no` for yes/no, and 0 for a count. Without
 *   [today], it counts only on the days with a row, as in the `Score` column.
 * - A number metric counts only on the days with a value. With a trend goal, its points come from the [trend].
 *
 * Examples: water `at least 8`, 6 glasses on Oct 1, and today Oct 2 without a value give `water` → (Oct 1 → 0.75,
 * Oct 2 → 0). Coffee `at most 2` gives 1 on a day without a value: 0 coffees.
 */
fun pointsByMetric(
    metrics: List<Metric>,
    log: LogTable,
    today: Day? = null,
    pending: Map<MetricDay, List<CountStep>> = emptyMap(),
): Map<String, Map<Day, Double>> = metrics.filter(::isScored).associate { metric ->
    val values = metricValues(metric, log, pending)
    val usesTrend = metric is NumberMetric && metric.goal?.usesTrend == true
    val points = (if (usesTrend) trend(values) else values).mapValues { (_, value) -> metricPoints(metric, value) }
    metric.id to if (countsEachDay(metric)) withEmptyDays(points, metricPoints(metric, 0.0), log, today) else points
}.filterValues { it.isNotEmpty() }

/**
 * [points] with [empty] on each day without points, after the first day of [points]: each day with a row of [log],
 * and each day up to [today].
 */
private fun withEmptyDays(points: Map<Day, Double>, empty: Double, log: LogTable, today: Day?): Map<Day, Double> {
    val first = points.keys.minOrNull() ?: return points
    val untilToday = if (today == null) emptyList() else daysBetween(first, today)
    val days = (log.rows.keys.filter { it > first } + untilToday).filter { it !in points }
    return points + days.associateWith { empty }
}

/**
 * The score of each day, from 0 to 100: the average of the [points] of the metrics that count on that day (see
 * [pointsByMetric]), as a percentage with 1 decimal. A day where no metric counts has no score. Example: the points 1,
 * 0.75 and 0 give 58.3.
 *
 * The points of the metrics of one group give the score of that group. See [pointsOf].
 */
fun dayScores(points: Map<String, Map<Day, Double>>): Map<Day, Double> {
    val byDay = mutableMapOf<Day, MutableList<Double>>()
    for (days in points.values) {
        for ((day, p) in days) byDay.getOrPut(day) { mutableListOf() }.add(p)
    }
    return byDay.mapValues { (_, p) -> roundHalfAwayFromZero(withoutFloatNoise(p.average() * 1000)) / 10 }
}

/** The [points] of the metrics of [metrics] in [group], for the group filter. Null [group]: all metrics. */
fun pointsOf(
    metrics: List<Metric>,
    group: String?,
    points: Map<String, Map<Day, Double>>,
): Map<String, Map<Day, Double>> {
    val ids = metricsOf(metrics, group).map { it.id }.toSet()
    return points.filterKeys { it in ids }
}

/**
 * The score of each group of [groups] on each day: the [dayScores] of the [points] of the metrics of [metrics] in the
 * group. A day where no metric of a group counts has no score of that group. Example: habits 1 and 0.5, body 0 give
 * habits 75 and body 0.
 */
fun groupScores(
    metrics: List<Metric>,
    groups: List<String>,
    points: Map<String, Map<Day, Double>>,
): Map<String, Map<Day, Double>> = groups.associateWith { dayScores(pointsOf(metrics, it, points)) }

/**
 * The part of each group of [groups] in the score of each day: the sum of the [points] of the metrics of the group,
 * divided by the number of metrics that count on that day, as a percentage. So the parts of a day add up to its
 * score, before the score is rounded. A day without points of a group has no part of that group.
 *
 * Example: habits 1 and 0.5, body 0 give habits 50 and body 0. The score is 50.
 */
fun groupParts(
    metrics: List<Metric>,
    groups: List<String>,
    points: Map<String, Map<Day, Double>>,
): Map<String, Map<Day, Double>> {
    val counted = mutableMapOf<Day, Int>()
    for (days in points.values) {
        for (day in days.keys) counted[day] = (counted[day] ?: 0) + 1
    }
    return groups.associateWith { group ->
        val sums = mutableMapOf<Day, Double>()
        for (days in pointsOf(metrics, group, points).values) {
            for ((day, p) in days) sums[day] = (sums[day] ?: 0.0) + p
        }
        sums.mapValues { (day, sum) -> withoutFloatNoise(100 * sum / counted.getValue(day)) }
    }
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
 * The cells of the score [column] of the `Log` tab that do not show the score of their day. [rows] includes the
 * header row.
 *
 * Each row has the score of its day: see [dayScores]. If a day has more than one row, each of these rows has the score
 * of the day, from its last row. A row without a valid date, or of a day without a score, has no score.
 *
 * A changed value can also change the score of other days. Examples: the later days of a trend, and the empty days
 * after a new first value of a yes/no or count metric.
 */
fun staleScoreCells(rows: List<List<Any?>>, metrics: List<Metric>, column: Int): List<ScoreCell> {
    val log = parseLog(rows, metrics.associateBy { it.id }).table
    val scores = dayScores(pointsByMetric(metrics, log))
    return (1 until rows.size).mapNotNull { i ->
        val score = logDate(rows[i].firstOrNull())?.let { scores[it] }
        if (shows(rows[i].getOrNull(column), score)) null else ScoreCell(i + 1, score)
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
