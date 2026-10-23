package trackula.model

import kotlin.math.abs

/** The month names, January first. */
val monthNames = listOf(
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)

/** The short weekday names, Monday first. The first letter is the weekday letter of the charts. */
val weekdayNames = listOf("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")

/** The first 3 letters of the name of [month]. Example: 9 → "Sep". */
fun shortMonth(month: Int): String = monthNames[month - 1].substring(0, 3)

/** The short month and the day of [day]. Example: "Sep 28". */
fun shortDay(day: Day): String = "${shortMonth(day.month)} ${day.day}"

/**
 * [value] without zeros at the end. Examples: 82.0 → "82", 2.5 → "2.5".
 *
 * This also removes float noise, for example 82.10000000000001 → "82.1" and 82.00000000000001 → "82". For values of
 * about 1e9 and more with decimals, the last decimals can be different from Dart, which gives the shortest text.
 */
fun formatTrimmed(value: Double): String {
    val text = toFixed(value, 6).trimEnd('0').trimEnd('.')
    return if (text == "-0") "0" else text
}

/** [value] with at most [decimals] decimals and no zeros at the end. Example: 81.25 → "81.3". */
fun formatNumber(value: Double, decimals: Int = 1): String = formatTrimmed(toFixed(value, decimals).toDouble())

/** Short text for a small cell: 1 decimal at most, and "k" from 1000. Examples: 82.25 → "82.3", 12500 → "12.5k". */
fun formatCompact(value: Double): String =
    if (abs(value) >= 1000) "${formatNumber(value / 1000)}k" else formatNumber(value)

/** [text] and the [unit] after a space. Only [text] if [unit] is null. Example: ("82.1", "kg") → "82.1 kg". */
fun withUnit(text: String, unit: String?): String = if (unit == null) text else "$text $unit"

/** [value] with its sign, at most 2 decimals and the [unit]. Examples: −1.3 → "−1.3 kg", 0.5 → "+0.5 kg", 0 → "0 kg". */
fun formatSigned(value: Double, unit: String?): String {
    val sign = if (value > 0) "+" else if (value < 0) "−" else ""
    return "$sign${withUnit(formatNumber(abs(value), 2), unit)}"
}

/** A [rate] from 0 to 1 as a whole percentage. Example: 0.756 → "76%". */
fun formatPercent(rate: Double): String = "${roundHalfAwayFromZero(rate * 100).toLong()}%"

/** The days from [from] to [to]. Examples: "Jul 6 – Oct 3, 2026", or "Nov 3, 2025 – Feb 1, 2026" across a year. */
fun formatDateRange(from: Day, to: Day): String = if (from.year == to.year) {
    "${shortDay(from)} – ${shortDay(to)}, ${to.year}"
} else {
    "${shortDay(from)}, ${from.year} – ${shortDay(to)}, ${to.year}"
}

/** The name and the year of [month]. Example: "October 2026". */
fun monthTitle(month: MonthKey): String = "${monthNames[month.month - 1]} ${month.year}"

/**
 * The names of [first] and the month after it, [second]. Examples: "September – October 2026", or
 * "December 2025 – January 2026" across a year.
 */
fun monthPairTitle(first: MonthKey, second: MonthKey): String = if (first.year == second.year) {
    "${monthNames[first.month - 1]} – ${monthTitle(second)}"
} else {
    "${monthTitle(first)} – ${monthTitle(second)}"
}

/**
 * The labels of [weeks], the rows of [weekRows]: the first day of each row, with the month on the first row and when
 * the month changes. Example: "Sep 2", "7", "14", "21", "28", "Oct 5".
 */
fun weekLabels(weeks: List<List<Day?>>): List<String> {
    var month: Int? = null
    return weeks.map { week ->
        val d = week.filterNotNull().first()
        if (d.month != month) {
            month = d.month
            "${shortMonth(d.month)} ${d.day}"
        } else {
            "${d.day}"
        }
    }
}

/** The quarter of [month], from 1 to 4. */
fun quarterOf(month: Int): Int = (month + 2) / 3

/**
 * The label under a bar that starts on [start]. Examples: "Sep 28" (week), "Sep" or "Jan ’26" (month), "Q3 ’26"
 * (quarter). A month shows its year in January and on the [first] bar. The apostrophe tells a year from a day:
 * "Feb ’24" is not "Feb 24".
 */
fun barLabel(start: Day, unit: BarUnit, first: Boolean = false): String = when (unit) {
    BarUnit.DAY, BarUnit.WEEK -> shortDay(start)
    BarUnit.MONTH ->
        if (start.month == 1 || first) "${shortMonth(start.month)} ’${start.year.mod(100)}" else shortMonth(start.month)
    BarUnit.QUARTER -> "Q${quarterOf(start.month)} ’${start.year.mod(100)}"
}

/** The name of a bar that starts on [start], for a tooltip. Examples: "Week of Sep 28, 2026", "Sep 2026", "Q3 2026". */
fun barTitle(start: Day, unit: BarUnit): String = when (unit) {
    BarUnit.DAY -> "${shortDay(start)}, ${start.year}"
    BarUnit.WEEK -> "Week of ${shortDay(start)}, ${start.year}"
    BarUnit.MONTH -> "${shortMonth(start.month)} ${start.year}"
    BarUnit.QUARTER -> "Q${quarterOf(start.month)} ${start.year}"
}
