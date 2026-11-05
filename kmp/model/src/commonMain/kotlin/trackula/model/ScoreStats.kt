package trackula.model

import kotlin.math.max

/**
 * The days just before [days], with the same number of days. Empty if [days] is empty. Example: the 7 days from
 * 2026-10-08 to 2026-10-14 give the 7 days from 2026-10-01 to 2026-10-07.
 */
fun previousPeriod(days: List<Day>): List<Day> {
    val first = days.firstOrNull() ?: return emptyList()
    return daysBetween(first.addDays(-days.size), first.addDays(-1))
}

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
