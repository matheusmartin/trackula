// The time window of the metric detail screen: bars over time, from the first value to today. A zoom step sets the
// span in view and the size of one bar. All charts of the screen show the same window.
package trackula.model

import kotlin.math.max
import kotlin.math.min

/** The days of one bar. */
enum class BarUnit { DAY, WEEK, MONTH, QUARTER }

/**
 * The zoom steps, from the smallest span to the largest. A step has a fixed number of bars, so that a chart keeps its
 * shape while it moves. The shortest spans show days, short spans weeks, middle spans months, long spans quarters.
 */
enum class ZoomStep(val label: String, val unit: BarUnit, /** The number of bars in view. */ val bars: Int) {
    WEEK1("1 week", BarUnit.DAY, 7),
    WEEK2("2 weeks", BarUnit.DAY, 14),
    MONTH1("1 month", BarUnit.WEEK, 5),
    MONTH3("3 months", BarUnit.WEEK, 13),
    MONTH6("6 months", BarUnit.WEEK, 26),
    YEAR1("1 year", BarUnit.MONTH, 12),
    YEAR2("2 years", BarUnit.MONTH, 24),
    YEAR3("3 years", BarUnit.QUARTER, 12),
    YEAR5("5 years", BarUnit.QUARTER, 20),
}

/** How the days of a bar become its value. */
enum class Aggregate {
    /**
     * The share of yes days among all days of the bar, from 0 to 1. A value of 1 is `yes`. Days without entry count
     * as not yes, as in the rate of the period.
     */
    RATE,

    /** The sum of the values. */
    SUM,

    /** The average of the values. Days without value are left out. */
    AVERAGE,
}

/** One bar: its first day, its value, and the lowest and highest value of its days. A null value draws no bar. */
data class ZoomBar(val start: Day, val value: Double?, val low: Double?, val high: Double?)

/** A span of days, from [from] to [to]. Both days are in the span. */
data class DayRange(val from: Day, val to: Day)

/** The first day of the bar that holds [d]. Weeks start on Monday. */
fun barStart(d: Day, unit: BarUnit): Day = when (unit) {
    BarUnit.DAY -> d
    BarUnit.WEEK -> d.addDays(1 - d.weekday)
    BarUnit.MONTH -> Day(d.year, d.month, 1)
    BarUnit.QUARTER -> Day(d.year, d.month - (d.month - 1) % 3, 1)
}

/** The first day of the bar after the bar that starts on [start]. */
fun nextBarStart(start: Day, unit: BarUnit): Day = when (unit) {
    BarUnit.DAY -> start.addDays(1)
    BarUnit.WEEK -> start.addDays(7)
    BarUnit.MONTH -> Day.of(start.year, start.month + 1, 1)
    BarUnit.QUARTER -> Day.of(start.year, start.month + 3, 1)
}

/** The first days of all bars from the bar of [first] to the bar of [today], oldest first. */
fun barStarts(first: Day, today: Day, unit: BarUnit): List<Day> =
    generateSequence(barStart(first, unit)) { nextBarStart(it, unit) }.takeWhile { it <= today }.toList()

/**
 * The zoom steps for data from [first] to [today]. The list ends with the first step that shows all bars. Example:
 * for 2 months of data, 1 month and 3 months.
 */
fun zoomSteps(first: Day, today: Day): List<ZoomStep> {
    val steps = mutableListOf<ZoomStep>()
    for (s in ZoomStep.entries) {
        steps.add(s)
        if (showsAll(s, first, today)) break
    }
    return steps
}

/** The index in [steps] of the step that the detail screen opens with: 3 months, or the last step if there are fewer. */
fun defaultStepIndex(steps: List<ZoomStep>): Int = steps.indexOf(ZoomStep.MONTH3).takeIf { it >= 0 } ?: steps.lastIndex

/** True if [step] shows all bars from [first] to [today]. */
private fun showsAll(step: ZoomStep, first: Day, today: Day): Boolean =
    barStarts(first, today, step.unit).size <= step.bars

/**
 * The time window in view: whole bars of [step], from the bar of [first] to the bar of [today].
 *
 * The window ends with the bar of [end]. Null [end]: the newest bar. The window has [ZoomStep.bars] bars, or all bars
 * if there are fewer.
 */
class ZoomWindow(val step: ZoomStep, val first: Day, val today: Day, end: Day? = null) {
    /** The first days of all bars, oldest first. */
    val allStarts: List<Day> = barStarts(first, today, step.unit)

    /** The bars in view: indexes in [allStarts], from [fromIndex] to before [toIndex]. */
    private val toIndex: Int
    private val fromIndex: Int

    init {
        val count = min(step.bars, allStarts.size)
        toIndex = if (end == null) {
            allStarts.size
        } else {
            (allStarts.indexOf(barStart(end, step.unit)) + 1).coerceIn(count, allStarts.size)
        }
        fromIndex = toIndex - count
    }

    val unit: BarUnit get() = step.unit

    /** The first days of the bars in view, oldest first. */
    val starts: List<Day> get() = allStarts.subList(fromIndex, toIndex)

    /** The first day in view: the start of the first bar, but not before [first]. */
    val from: Day get() = maxOf(allStarts[fromIndex], first)

    /** The last day in view: the end of the last bar, but not after [today]. */
    val to: Day get() = minOf(nextBarStart(allStarts[toIndex - 1], unit).addDays(-1), today)

    /** All days in view, oldest first. */
    val days: List<Day> get() = daysBetween(from, to)

    /** True if the window shows the newest bar. */
    val atEnd: Boolean get() = toIndex == allStarts.size

    /** True if the window shows the oldest bar. */
    val atStart: Boolean get() = fromIndex == 0

    /**
     * The days in view, as a box on a chart of all data with one column for each [unit] bar. At the oldest bar, the box
     * starts with the first column, not on [first]. At the newest bar, it ends with the last column, not on [today].
     * The days before [first] and after [today] have no data, so the box can include them. Example: at All, the box
     * covers all columns.
     */
    fun boxOn(unit: BarUnit): DayRange = DayRange(
        from = if (atStart) barStart(first, unit) else from,
        to = if (atEnd) nextBarStart(barStart(today, unit), unit).addDays(-1) else to,
    )

    /** The `end` day of the window that is [bars] bars later (or earlier, if negative). Null: the newest bar. */
    fun endMovedBy(bars: Int): Day? = endAt((toIndex + bars).coerceIn(toIndex - fromIndex, allStarts.size))

    /** The `end` day of the window with its middle on [day]. Null: the newest bar. */
    fun endCenteredOn(day: Day): Day? {
        val count = toIndex - fromIndex
        return endAt((allStarts.indexOf(barStart(day, unit)) + 1 + count / 2).coerceIn(count, allStarts.size))
    }

    /** The `end` day of a window that ends before the bar [last] of [allStarts]. Null: the newest bar. */
    private fun endAt(last: Int): Day? = if (last == allStarts.size) null else allStarts[last - 1]
}

/**
 * One bar for each day of [starts], from the day [values]. Days before [first] and after [today] are not part of a
 * bar.
 */
fun zoomBars(
    values: Map<Day, Double>,
    aggregate: Aggregate,
    starts: List<Day>,
    unit: BarUnit,
    first: Day,
    today: Day,
): List<ZoomBar> {
    val byBar = mutableMapOf<Day, MutableList<Double>>()
    for ((day, v) in values) {
        if (day < first || day > today) continue
        byBar.getOrPut(barStart(day, unit)) { mutableListOf() }.add(v)
    }
    return starts.map { start ->
        // A list in byBar has at least one value.
        val barValues = byBar[start]
        val value = when (aggregate) {
            Aggregate.RATE -> rate(barValues, start, unit, first, today)
            Aggregate.SUM -> barValues?.sum()
            Aggregate.AVERAGE -> barValues?.average()
        }
        ZoomBar(start, value, barValues?.min(), barValues?.max())
    }
}

/** The share of yes days among the days of the bar from [first] to [today]. [values] holds 1 for each yes day. */
private fun rate(values: List<Double>?, start: Day, unit: BarUnit, first: Day, today: Day): Double? {
    val from = max(start.serial, first.serial)
    val to = min(nextBarStart(start, unit).serial - 1, today.serial)
    val days = to - from + 1
    if (days <= 0) return null
    return (values?.count { it == 1.0 } ?: 0).toDouble() / days
}
