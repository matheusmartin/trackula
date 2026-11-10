package trackula.model

/**
 * The first half and the second half of [days]. With an odd number of days, the second half has one day more.
 * Example: the 14 days from 2026-10-01 to 2026-10-14 give 2026-10-01 to 2026-10-07 and 2026-10-08 to 2026-10-14.
 *
 * The score view compares the 2 halves, not the period with the days before it: at All, no day comes before.
 */
fun halves(days: List<Day>): Pair<List<Day>, List<Day>> = days.take(days.size / 2) to days.drop(days.size / 2)

/**
 * The part of each group in the weekday averages of the score. For each group of [groups] and each weekday, Monday
 * first: the sum of the group score on the days of [days] with a [total] score on that weekday, divided by the number
 * of these days. A day without a group score counts as 0. So the parts of a weekday add up to the weekday average of
 * [total]. Null if no day of the weekday has a score.
 *
 * Example: 2 Mondays with the total 4 and 6. The group "habits" has 3 and 5, the group "body" 1 and 1. The parts of
 * Monday are 4 for "habits" and 1 for "body". Their sum is 5, the average of the total.
 */
fun groupWeekdayParts(
    total: Map<Day, Double>,
    groups: Map<String, Map<Day, Double>>,
    days: List<Day>,
): Map<String, List<Double?>> {
    val scored = days.filter { it in total }
    return groups.mapValues { (_, scores) ->
        (1..7).map { weekday ->
            val onWeekday = scored.filter { it.weekday == weekday }
            if (onWeekday.isEmpty()) null else withoutFloatNoise(onWeekday.sumOf { scores[it] ?: 0.0 } / onWeekday.size)
        }
    }
}

/**
 * The points of each metric in [points] (see `pointsByMetric`) on the days of [days], by metric id. Example: water
 * with 5 and 6 points gives 11.
 */
fun metricTotals(points: Map<String, Map<Day, Double>>, days: List<Day>): Map<String, Double> =
    points.mapValues { (_, byDay) -> withoutFloatNoise(days.sumOf { byDay[it] ?: 0.0 }) }

/** The fewest days with and without points of a metric that [habitLinks] needs to compare them. */
const val MIN_LINK_DAYS = 5

/**
 * For each metric in [points], how many more points the other metrics give on the days when the metric gives points
 * than on the days when it gives none, by metric id. Only the days of [days] with a [score] count. The metric's own
 * points are removed from the score, so that they do not count twice. A metric needs [MIN_LINK_DAYS] days of each
 * kind, else it is not in the result. This is a link, not a cause.
 *
 * Example: on the days with meditate, the other metrics give 15 points on average, on the other days 13. The result
 * for meditate is +2.
 */
fun habitLinks(points: Map<String, Map<Day, Double>>, score: Map<Day, Double>, days: List<Day>): Map<String, Double> {
    val scored = days.filter { it in score }
    val links = mutableMapOf<String, Double>()
    for ((id, byDay) in points) {
        val rest = { d: Day -> score.getValue(d) - (byDay[d] ?: 0.0) }
        val (with, without) = scored.partition { (byDay[it] ?: 0.0) > 0 }
        if (with.size < MIN_LINK_DAYS || without.size < MIN_LINK_DAYS) continue
        links[id] = withoutFloatNoise(with.map(rest).average() - without.map(rest).average())
    }
    return links
}

/** The number of weeks before the week of the window end that the week charts of the score view compare with. */
const val COMPARED_WEEKS = 4

/**
 * The days of the week of [end], from Monday to [end], and all days of the [weeks] weeks before that week, oldest
 * first. Weeks start on Monday. Example: Wednesday 2026-10-07 and 4 weeks give 2026-10-05 to 2026-10-07, and
 * 2026-09-07 to 2026-10-04.
 */
private fun weekAndBefore(end: Day, weeks: Int): Pair<List<Day>, List<Day>> {
    val monday = barStart(end, BarUnit.WEEK)
    return daysBetween(monday, end) to daysBetween(monday.addDays(-7 * weeks), monday.addDays(-1))
}

/** One weekday of [weekdaysInRange]: its [score] in the week, and its [range] in the weeks before. */
data class WeekdayInRange(val score: Double?, val range: ValueRange?)

/**
 * For each weekday, Monday first: the score of that weekday in the week of [end], and the lowest, highest and average
 * score of that weekday in the [weeks] weeks before. Only the days with a score in [values] count. A weekday after
 * [end] or without a score has a null score. A weekday without a score in the weeks before has a null range.
 *
 * Example: the Mondays of the weeks before have 10, 12 and 14, and the Monday of the week has 15. Monday gets the
 * score 15 and the range 10 to 14, with the average 12.
 */
fun weekdaysInRange(values: Map<Day, Double>, end: Day, weeks: Int = COMPARED_WEEKS): List<WeekdayInRange> {
    val (week, before) = weekAndBefore(end, weeks)
    return (1..7).map { weekday ->
        val scores = before.filter { it.weekday == weekday }.mapNotNull { values[it] }
        WeekdayInRange(
            score = week.firstOrNull { it.weekday == weekday }?.let { values[it] },
            range = if (scores.isEmpty()) {
                null
            } else {
                ValueRange(scores.min(), scores.max(), withoutFloatNoise(scores.average()))
            },
        )
    }
}

/**
 * The change of each part of the score from the [weeks] weeks before the week of [end] to that week, by part id: the
 * average points per day of the part in the week, from Monday to [end], minus its average points per day on the same
 * weekdays of the weeks before. [parts]: the points of each part by day, for example the score of each group or the
 * points of each metric. Only the days with a [score] count, and a day without points of a part counts as 0.
 *
 * A part without points on these days is not in the result. If the week or the weeks before have no day with a score,
 * the result is empty.
 *
 * Example: [end] is a Wednesday. Habits gives 3 points per day from Monday to Wednesday, and 2.5 points per day on the
 * Mondays to Wednesdays of the weeks before. The change of habits is +0.5.
 */
fun weekChanges(
    parts: Map<String, Map<Day, Double>>,
    score: Map<Day, Double>,
    end: Day,
    weeks: Int = COMPARED_WEEKS,
): Map<String, Double> {
    val (week, before) = weekAndBefore(end, weeks)
    val now = week.filter { it in score }
    val earlier = before.filter { it.weekday <= end.weekday && it in score }
    if (now.isEmpty() || earlier.isEmpty()) return emptyMap()
    fun List<Day>.perDay(byDay: Map<Day, Double>) = sumOf { byDay[it] ?: 0.0 } / size
    return parts
        .filterValues { byDay -> (now + earlier).any { (byDay[it] ?: 0.0) != 0.0 } }
        .mapValues { (_, byDay) -> withoutFloatNoise(now.perDay(byDay) - earlier.perDay(byDay)) }
}
