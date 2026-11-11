package trackula.model

import kotlin.math.floor
import kotlin.math.min

/** A value on a day, for example the best day of a count. */
data class DayValue(val day: Day, val value: Double)

/** The yes/no states of [metricId] in [entries]: true for `yes`, false for `no`. Days without entry are left out. */
fun yesNoStates(metricId: String, entries: List<LogEntry>): Map<Day, Boolean> =
    entries.filter { it.metricId == metricId }.associate { it.date to (it.value == 1.0) }

/**
 * The numbers and charts of a yes/no metric in a period.
 *
 * @property days The number of days in the period.
 * @property yes The number of `yes` days in the period.
 * @property no Missed days: `no`.
 * @property currentStreak Consecutive `yes` days up to today. If today has no `yes` yet, up to yesterday.
 * @property streaks The lengths of the runs of `yes` days in the period, oldest first.
 * @property weekdayRates The share of `yes` days for each weekday, Monday first. Null if the period has no such
 *   weekday.
 * @property strength The habit strength of each day of the period, from 0 to 1: a `yes` day is 1, all other days
 *   from the first entry are 0. See [strength].
 */
data class YesNoStats(
    val days: Int,
    val yes: Int,
    val no: Int,
    val currentStreak: Int,
    val streaks: List<Int>,
    val weekdayRates: List<Double?>,
    val strength: List<Double>,
) {
    /** Days without entry. */
    val none: Int get() = days - yes - no

    /** The share of `yes` days in the period, from 0 to 1. */
    val rate: Double get() = if (days == 0) 0.0 else yes.toDouble() / days

    /** The longest run of `yes` days in the period. */
    val longestStreak: Int get() = streaks.maxOrNull() ?: 0
}

/**
 * The habit strength grows with each good day and goes down slowly on other days, as in Loop Habit Tracker. It is an
 * exponential moving average with this weight for each new day. See [strength].
 */
const val STRENGTH_WEIGHT = 0.05

/** The yes/no numbers of [states] for the period [days]. [today] is the last day of the period. */
fun yesNoStats(states: Map<Day, Boolean>, days: List<Day>, today: Day): YesNoStats = YesNoStats(
    days = days.size,
    yes = days.count { states[it] == true },
    no = days.count { states[it] == false },
    currentStreak = currentStreak(states, today),
    streaks = streaks(states, days),
    weekdayRates = (1..7).map { weekdayRate(states, days, it) },
    strength = strength(yesDays(states, days.lastOrNull()), days),
)

/** The lengths of the runs of `yes` days in [days], oldest first. */
private fun streaks(states: Map<Day, Boolean>, days: List<Day>): List<Int> {
    val streaks = mutableListOf<Int>()
    var run = 0
    for (d in days) {
        if (states[d] == true) {
            run++
        } else if (run > 0) {
            streaks.add(run)
            run = 0
        }
    }
    if (run > 0) streaks.add(run)
    return streaks
}

/** Consecutive `yes` days up to [today]. If [today] has no `yes` yet, up to the day before. */
private fun currentStreak(states: Map<Day, Boolean>, today: Day): Int {
    var streak = 0
    var d = if (states[today] == true) today else today.addDays(-1)
    while (states[d] == true) {
        streak++
        d = d.addDays(-1)
    }
    return streak
}

/** The share of `yes` days among the days of [days] on [weekday]. Null if [days] has no such weekday. */
private fun weekdayRate(states: Map<Day, Boolean>, days: List<Day>, weekday: Int): Double? {
    val onWeekday = days.filter { it.weekday == weekday }
    if (onWeekday.isEmpty()) return null
    return onWeekday.count { states[it] == true }.toDouble() / onWeekday.size
}

/** 1 for each `yes` day of [states] and 0 for each other day, from the first entry to [last]. */
private fun yesDays(states: Map<Day, Boolean>, last: Day?): Map<Day, Double> {
    val first = earliestDay(states.keys)
    if (first == null || last == null) return emptyMap()
    return daysBetween(first, last).associateWith { if (states[it] == true) 1.0 else 0.0 }
}

/**
 * The strength of each day of [days], from 0 to 1. [values]: the result of each day, from 0 (bad) to 1 (good), also
 * before [days]. Each day with a value moves the strength [STRENGTH_WEIGHT] of the way to the value. A day without a
 * value does not change it. Before the first value, the strength is 0. So a long period does not start with many
 * empty days at 0.
 *
 * Example: 1 on 20 days gives 0.64 (1 − 0.95^20). Then 0 on one day gives 0.61.
 */
fun strength(values: Map<Day, Double>, days: List<Day>): List<Double> {
    val sorted = values.entries.sortedBy { it.key }
    var strength = 0.0
    var next = 0
    return days.map { day ->
        while (next < sorted.size && sorted[next].key <= day) {
            strength += STRENGTH_WEIGHT * (sorted[next].value - strength)
            next++
        }
        strength
    }
}

/** The number of [days] with a [value], rounded to a whole number. */
data class ValueDays(val value: Int, val days: Int)

/**
 * The numbers and charts of a count metric in a period.
 *
 * @property total The sum of the values in the period.
 * @property logged The number of days with a value.
 * @property best The day with the highest value. Null if no day has a value.
 * @property weekdayAverages The average of the days with a value for each weekday, Monday first. Null if no such day
 *   has a value.
 * @property distribution For each value (rounded to a whole number), the number of days with it, from the lowest value.
 * @property running The total up to each day of the period.
 */
data class CountStats(
    val total: Double,
    val logged: Int,
    val best: DayValue?,
    val weekdayAverages: List<Double?>,
    val distribution: List<ValueDays>,
    val running: List<Double>,
) {
    /** The average of the days with a value. Null if no day has a value. */
    val average: Double? get() = if (logged == 0) null else total / logged
}

/** The count numbers of [values] for the period [days]. */
fun countStats(values: Map<Day, Double>, days: List<Day>): CountStats {
    val present = present(values, days)
    var total = 0.0
    val running = days.map { d ->
        total += values[d] ?: 0.0
        total
    }
    val counts = mutableMapOf<Int, Int>()
    for (p in present) {
        val key = roundHalfAwayFromZero(p.value).toInt()
        counts[key] = (counts[key] ?: 0) + 1
    }
    return CountStats(
        total = total,
        logged = present.size,
        best = highest(present),
        weekdayAverages = (1..7).map { weekday -> average(present.filter { it.day.weekday == weekday }) },
        distribution = counts.map { (value, n) -> ValueDays(value, n) }.sortedBy { it.value },
        running = running,
    )
}

/**
 * A range of values and the number of days in it.
 *
 * @property from The lowest value of the range.
 * @property to The end of the range. The last range of a histogram includes it.
 * @property days The number of days with a value in the range.
 */
data class Bin(val from: Double, val to: Double, val days: Int)

/**
 * The numbers and charts of a number metric in a period.
 *
 * @property latest The last value of the period. Null if no day has a value.
 * @property change The last value minus the first value of the period. Null with fewer than 2 values.
 * @property low The first day with the lowest value. Null if no day has a value.
 * @property high The first day with the highest value. Null if no day has a value.
 * @property values The value of each day of the period. Null if the day has no value.
 * @property trend The trend of each day, also from the values before the period. Null before the first value. See
 *   [trend].
 * @property histogram The values in [HISTOGRAM_BINS] ranges of the same width, from the lowest value.
 */
data class NumberStats(
    val latest: DayValue?,
    val change: Double?,
    val low: DayValue?,
    val high: DayValue?,
    val values: List<Double?>,
    val trend: List<Double?>,
    val histogram: List<Bin>,
) {
    /** The number of days with a value. */
    val logged: Int get() = values.count { it != null }

    /** The average of the days with a value. Null if no day has a value. */
    val average: Double? get() = if (logged == 0) null else values.filterNotNull().sum() / logged
}

/** The weight of each new value in the trend: a 7-day smoothing, as in the Libra weight app (2 / (7 + 1)). */
const val TREND_WEIGHT = 0.25

/**
 * The trend of [values] on each day of [values]: an exponential moving average. The trend of the first day is its
 * value. Each later value moves the trend [TREND_WEIGHT] of the way to it. The number charts show it as a line, and a
 * goal with `trend` gives its points from it (see [NumberGoal.usesTrend]).
 *
 * Example: the trend 82.4 and the next value 82.0 give 82.3.
 */
fun trend(values: Map<Day, Double>): Map<Day, Double> {
    var trend: Double? = null
    return values.keys.sorted().associateWith { day ->
        val value = values.getValue(day)
        (trend?.let { it + TREND_WEIGHT * (value - it) } ?: value).also { trend = it }
    }
}

/** The number of ranges in [NumberStats.histogram]. */
const val HISTOGRAM_BINS = 8

/** The numbers of a number metric: [values] in the period [days]. */
fun numberStats(values: Map<Day, Double>, days: List<Day>): NumberStats {
    val present = present(values, days)
    return NumberStats(
        latest = present.lastOrNull(),
        change = if (present.size < 2) null else present.last().value - present.first().value,
        low = lowest(present),
        high = highest(present),
        values = days.map { values[it] },
        trend = trend(values, days),
        histogram = histogram(present),
    )
}

/** The trend of each day of [days]: the [trend] of the last day with a value. See [NumberStats.trend]. */
private fun trend(values: Map<Day, Double>, days: List<Day>): List<Double?> {
    val trends = trend(values).entries.toList()
    var next = 0
    var current: Double? = null
    return days.map { day ->
        while (next < trends.size && trends[next].key <= day) current = trends[next++].value
        current
    }
}

/**
 * The values of [present] in [HISTOGRAM_BINS] ranges. One range if all values are equal. Empty if [present] is
 * empty.
 */
private fun histogram(present: List<DayValue>): List<Bin> {
    if (present.isEmpty()) return emptyList()
    val low = present.minOf { it.value }
    val high = present.maxOf { it.value }
    val width = if (high == low) 1.0 else (high - low) / HISTOGRAM_BINS
    val counts = IntArray(if (high == low) 1 else HISTOGRAM_BINS)
    for (p in present) counts[min(counts.size - 1, floor((p.value - low) / width).toInt())]++
    return counts.mapIndexed { i, n -> Bin(low + i * width, low + (i + 1) * width, n) }
}

/** The days of [days] that have a value in [values], oldest first. */
private fun present(values: Map<Day, Double>, days: List<Day>): List<DayValue> =
    days.mapNotNull { d -> values[d]?.let { DayValue(d, it) } }

/** The first day with the highest value of [values]. Null if [values] is empty. */
private fun highest(values: List<DayValue>): DayValue? =
    values.fold(null as DayValue?) { high, p -> if (high == null || p.value > high.value) p else high }

/**
 * The first day with the lowest value of [values]. Null if [values] is empty. It compares with `<`, as Dart does, so
 * -0.0 and 0.0 are equal.
 */
private fun lowest(values: List<DayValue>): DayValue? =
    values.fold(null as DayValue?) { low, p -> if (low == null || p.value < low.value) p else low }

/** The average of [values]. Null if [values] is empty. */
private fun average(values: List<DayValue>): Double? =
    if (values.isEmpty()) null else values.sumOf { it.value } / values.size

/** A range of streak lengths in days. A null [to] has no end. */
data class StreakRange(val from: Int, val to: Int?)

/** The ranges of streak lengths in days, for [streakLengths]. The last range has no end. */
val streakRanges = listOf(
    StreakRange(1, 1),
    StreakRange(2, 2),
    StreakRange(3, 3),
    StreakRange(4, 6),
    StreakRange(7, 13),
    StreakRange(14, 29),
    StreakRange(30, null),
)

/** The number of [streaks] in each range of [streakRanges]. Example: streaks 1, 2, 2, 5 → 1, 2, 0, 1, 0, 0, 0. */
fun streakLengths(streaks: List<Int>): List<Int> = streakRanges.map { (from, to) ->
    streaks.count { it >= from && (to == null || it <= to) }
}

/**
 * The weekday with the highest of [averages], Monday first: 1 is Monday, 7 is Sunday. Null if no weekday has a value.
 * If 2 weekdays have the same average, the first one. Example: [CountStats.weekdayAverages] of the score.
 */
fun bestWeekday(averages: List<Double?>): Int? {
    val high = averages.filterNotNull().maxOrNull() ?: return null
    return averages.indexOf(high) + 1
}
