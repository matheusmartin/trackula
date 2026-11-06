package trackula.model

import kotlin.math.max
import kotlin.math.min

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
 * The level of each day of [days] with a score in [values], from 0 to 1: the score in percent divided by 100.
 * Example: the scores 50 and 100 give the levels 0.5 and 1.
 */
fun scoreLevels(values: Map<Day, Double>, days: List<Day>): Map<Day, Double> =
    days.filter { it in values }.associateWith { min(1.0, max(0.0, values.getValue(it) / 100)) }

/**
 * The number of days of [days] with a score in [values] in each range of 10 percent: 0 to 9.9, 10 to 19.9, … 90 to
 * 99.9, and 100. The result has 11 counts. Example: the scores 5, 95 and 100 give 1 in the first, the tenth and the
 * last range.
 */
fun scoreRanges(values: Map<Day, Double>, days: List<Day>): List<Int> {
    val counts = MutableList(11) { 0 }
    for (d in days) {
        val v = values[d] ?: continue
        counts[min(10, max(0, (v / 10).toInt()))]++
    }
    return counts
}
