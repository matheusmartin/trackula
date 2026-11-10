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
