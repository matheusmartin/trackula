package trackula.model

import kotlin.math.max

/**
 * The first half and the second half of [days]. With an odd number of days, the second half has one day more.
 * Example: the 14 days from 2026-10-01 to 2026-10-14 give 2026-10-01 to 2026-10-07 and 2026-10-08 to 2026-10-14.
 *
 * The score view compares the 2 halves, not the period with the days before it: at All, no day comes before.
 */
fun halves(days: List<Day>): Pair<List<Day>, List<Day>> = days.take(days.size / 2) to days.drop(days.size / 2)

/**
 * For each weekday, Monday first, the change from the average in [before] to the average in [now]. Null if one of
 * the 2 averages is null. Example: 12.5 now and 11.0 before give 1.5.
 */
fun weekdayChanges(now: List<Double?>, before: List<Double?>): List<Double?> =
    now.zip(before) { n, b -> if (n == null || b == null) null else withoutFloatNoise(n - b) }

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
 * The level of each day of [days] with a score in [values], from 0 to 1: the score divided by the highest score of
 * [days]. A score below 0 counts as 0. All levels are 0 if no score is above 0. Example: the scores 5 and 10 give the
 * levels 0.5 and 1.
 */
fun scoreLevels(values: Map<Day, Double>, days: List<Day>): Map<Day, Double> {
    val scored = days.filter { it in values }.associateWith { max(0.0, values.getValue(it)) }
    val high = scored.values.maxOrNull() ?: return emptyMap()
    return scored.mapValues { (_, v) -> if (high == 0.0) 0.0 else v / high }
}

/** The [low] and [high] value of a set of values, and their [average]. Example: the scores of all Mondays. */
data class ValueRange(val low: Double, val high: Double, val average: Double)

/**
 * The lowest, highest and average score of the days of [days] with a score in [values], for each weekday, Monday
 * first. Null for a weekday without a score. Example: 2 Mondays with 10 and 14 give low 10, high 14, average 12.
 */
fun weekdayRanges(values: Map<Day, Double>, days: List<Day>): List<ValueRange?> = (1..7).map { weekday ->
    val scores = days.filter { it.weekday == weekday }.mapNotNull { values[it] }
    if (scores.isEmpty()) null else ValueRange(scores.min(), scores.max(), withoutFloatNoise(scores.average()))
}

/**
 * The scores of the week of [today] and of the week before, Monday first: 7 values each. Null for a day without a
 * score, and for the days after [today]. Weeks start on Monday.
 */
fun thisAndLastWeek(values: Map<Day, Double>, today: Day): Pair<List<Double?>, List<Double?>> {
    val monday = today.addDays(1 - today.weekday)
    val thisWeek = (0..6).map { monday.addDays(it) }.map { if (it > today) null else values[it] }
    val lastWeek = (0..6).map { values[monday.addDays(it - 7)] }
    return thisWeek to lastWeek
}

/**
 * The last [count] days of [days], or all of them if there are fewer. Example: the last 14 days of a window.
 */
fun lastDays(days: List<Day>, count: Int): List<Day> = days.takeLast(count)

/**
 * The average score of the days of [days] with a score in [values], and how far the score of each of these days is
 * from it. Null if no day has a score. Example: the scores 10 and 14 give the average 12 and the differences −2 and
 * +2.
 */
fun differencesFromAverage(values: Map<Day, Double>, days: List<Day>): Pair<Double, Map<Day, Double>>? {
    val scored = days.filter { it in values }
    if (scored.isEmpty()) return null
    val average = withoutFloatNoise(scored.sumOf { values.getValue(it) } / scored.size)
    return average to scored.associateWith { withoutFloatNoise(values.getValue(it) - average) }
}

/**
 * The points of each metric in [points] (see `pointsByMetric`) on the days of [days], by metric id. Example: water
 * with 5 and 6 points gives 11.
 */
fun metricTotals(points: Map<String, Map<Day, Double>>, days: List<Day>): Map<String, Double> =
    points.mapValues { (_, byDay) -> withoutFloatNoise(days.sumOf { byDay[it] ?: 0.0 }) }

/**
 * The average points of each metric in [points] on each weekday, Monday first, from the days of [days] with a value
 * of that metric, by metric id. Null for a weekday without a value. Example: a yes/no habit done on 3 of 4 Mondays
 * gives 0.75 for Monday.
 */
fun metricWeekdayAverages(points: Map<String, Map<Day, Double>>, days: List<Day>): Map<String, List<Double?>> =
    points.mapValues { (_, byDay) ->
        (1..7).map { weekday ->
            val values = days.filter { it.weekday == weekday }.mapNotNull { byDay[it] }
            if (values.isEmpty()) null else withoutFloatNoise(values.average())
        }
    }

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
