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

/** The number of weeks before the week of the window end that the week charts of the score view show. */
const val COMPARED_WEEKS = 4

/** The number of months before the month of the window end that the month table of the score view shows. */
const val COMPARED_MONTHS = 3

/**
 * The days from Monday to the weekday of [end], in the week of [end] or [weeksBefore] weeks before it. Weeks start on
 * Monday. Example: Wednesday 2026-10-07 and 1 week before give 2026-09-28 to 2026-09-30.
 */
private fun sameWeekdays(end: Day, weeksBefore: Int): List<Day> {
    val monday = barStart(end, BarUnit.WEEK).addDays(-7 * weeksBefore)
    return daysBetween(monday, monday.addDays(end.weekday - 1))
}

/** The Monday of the week of [end] and of each of the [weeks] weeks before it, oldest first. */
fun weekMondays(end: Day, weeks: Int): List<Day> = (weeks downTo 0).map { barStart(end, BarUnit.WEEK).addDays(-7 * it) }

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
    val monday = barStart(end, BarUnit.WEEK)
    val before = daysBetween(monday.addDays(-7 * weeks), monday.addDays(-1))
    return (1..7).map { weekday ->
        val scores = before.filter { it.weekday == weekday }.mapNotNull { values[it] }
        WeekdayInRange(
            score = if (weekday > end.weekday) null else values[monday.addDays(weekday - 1)],
            range = if (scores.isEmpty()) {
                null
            } else {
                ValueRange(scores.min(), scores.max(), withoutFloatNoise(scores.average()))
            },
        )
    }
}

/**
 * The points per day of each part of the score in each period of [periods], in their order, by part id. [parts]: the
 * points of each part by day, for example the score of each group or the points of each metric. Only the days with a
 * [score] count, and a day without points of a part counts as 0. A period without a day with a score has null. A part
 * without points on the days of [periods] is not in the result.
 */
private fun pointsPerPeriod(
    parts: Map<String, Map<Day, Double>>,
    score: Map<Day, Double>,
    periods: List<List<Day>>,
): Map<String, List<Double?>> {
    val scored = periods.map { days -> days.filter { it in score } }
    fun List<Day>.perDay(byDay: Map<Day, Double>) = withoutFloatNoise(sumOf { byDay[it] ?: 0.0 } / size)
    return parts
        .filterValues { byDay -> scored.flatten().any { (byDay[it] ?: 0.0) != 0.0 } }
        .mapValues { (_, byDay) -> scored.map { days -> if (days.isEmpty()) null else days.perDay(byDay) } }
}

/**
 * The points per day of each part of the score in each of the [weeks] weeks before the week of [end] and in that week,
 * oldest first, by part id. Each week has the same weekdays as the week of [end]: from Monday to the weekday of
 * [end]. [parts], [score] and the result: as in [pointsPerPeriod].
 *
 * Example: [end] is a Tuesday. Habits gives 2 and 3 points on the Monday and the Tuesday of a week: 2.5 for that week.
 */
fun weeklyPoints(
    parts: Map<String, Map<Day, Double>>,
    score: Map<Day, Double>,
    end: Day,
    weeks: Int,
): Map<String, List<Double?>> = pointsPerPeriod(parts, score, (weeks downTo 0).map { sameWeekdays(end, it) })

/** The month of [end] and each of the [months] months before it, oldest first. */
fun monthsUntil(end: Day, months: Int): List<MonthKey> = (months downTo 0).map { addMonths(monthOf(end), -it) }

/**
 * The points per day of each part of the score in each of the [months] months before the month of [end] and in that
 * month up to [end], oldest first, by part id. [parts], [score] and the result: as in [pointsPerPeriod].
 *
 * Example: [end] is 2026-11-10. Habits gives 62 points in the 31 days of October: 2 for October. The days of November
 * after the 10th do not count.
 */
fun monthlyPoints(
    parts: Map<String, Map<Day, Double>>,
    score: Map<Day, Double>,
    end: Day,
    months: Int,
): Map<String, List<Double?>> =
    pointsPerPeriod(parts, score, monthsUntil(end, months).map { month -> daysOfMonth(month).filter { it <= end } })

/**
 * The change of each of [values] from the value before it. Null for the first value, and if the value or the value
 * before it is null. Example: 5, 6.5, null, 4 give null, 1.5, null, null.
 */
fun stepChanges(values: List<Double?>): List<Double?> = values.mapIndexed { i, v ->
    val before = values.getOrNull(i - 1)
    if (v == null || before == null) null else withoutFloatNoise(v - before)
}
