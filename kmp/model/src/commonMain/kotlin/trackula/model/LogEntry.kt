package trackula.model

import kotlin.math.max

/**
 * A non-empty value cell of the `Log` tab.
 *
 * [row] is the 1-based row number in the `Log` tab. Row 1 is the header. [value] is the value. For yesno metrics: 1 is
 * `yes`, 0 is `no`.
 */
data class LogEntry(val row: Int, val date: Day, val metricId: String, val value: Double)

/**
 * The `Log` tab: one row per day, one column per metric. See docs/data-model.md.
 *
 * - [entries]: all valid, non-empty value cells.
 * - [rows]: the 1-based row number of each day. If a day has more than one row, the last row.
 * - [columns]: the 0-based column index of each metric. Column 0 is `date`.
 */
data class LogTable(val entries: List<LogEntry>, val rows: Map<Day, Int>, val columns: Map<String, Int>) {
    fun valueAt(metricId: String, date: Day): Double? {
        val row = rows[date]
        return entries.lastOrNull { it.row == row && it.metricId == metricId }?.value
    }
}

/** A cell of a metric on a day. The key of the count taps that are not written yet. */
data class MetricDay(val metricId: String, val day: Day)

/**
 * Thrown when the `Log` tab has no column for a metric. This occurs when someone deletes the metric row in the sheet
 * while the app is open.
 */
class MissingColumnException(val metricId: String) : Exception("The log tab has no column \"$metricId\".")

/** A change to the `Log` tab. */
sealed class LogWrite

/** A new row for a day that has no row yet. The cell [value] is a number, or `yes` or `no`. See [cellValue]. */
data class AppendRow(val date: Day, val column: Int, val value: Any) : LogWrite() {
    /** The row cells, from column A to [column]. */
    fun toCells(): List<Any> = listOf<Any>(date.toString()) + List(column - 1) { "" } + value
}

/** A new value for one cell. A null [value] clears the cell. Else it is a number, or `yes` or `no`. See [cellValue]. */
data class SetCell(val row: Int, val column: Int, val value: Any?) : LogWrite()

/**
 * The `Log` cell for a [value]: `yes` (1) or `no` (0) for yesno metrics, the number for number metrics.
 * Null is an empty cell.
 */
fun cellValue(metric: Metric, value: Double?): Any? = when {
    value == null -> null
    metric is YesNoMetric -> if (value == 1.0) "yes" else "no"
    else -> value
}

/**
 * Returns the change that sets [metric] to `yes` ([done]) or `no` on [date].
 *
 * This function and the other `plan` functions throw a [MissingColumnException] if [log] has no column for [metric].
 */
fun planYesNo(metric: YesNoMetric, date: Day, log: LogTable, done: Boolean): LogWrite? =
    plan(metric, date, if (done) 1.0 else 0.0, log)

/** Returns the change that sets the value of [metric] on [date]. For amounts, it is the day total. */
fun planNumber(metric: NumberMetric, date: Day, value: Double, log: LogTable): LogWrite? =
    plan(metric, date, value, log)

/** Returns the change that clears the value of [metric] on [date]. */
fun planClear(metric: Metric, date: Day, log: LogTable): LogWrite? = plan(metric, date, null, log)

/** One input on a count cell: add [delta]. A negative [delta] subtracts. */
data class CountStep(val delta: Double)

/**
 * Applies [steps] in order to the day value [current]. Null is an empty cell.
 *
 * A count never goes below 0, also between steps, and 0 is an empty cell.
 * Example: an empty cell, then -1, then +1, gives 1.
 */
fun applyCountSteps(current: Double?, steps: Iterable<CountStep>): Double? {
    var value = current ?: 0.0
    for (step in steps) value = max(0.0, value + step.delta)
    return if (value <= 0) null else withoutFloatNoise(value)
}

/** [value] without the float noise of decimal steps. Example: 0.30000000000000004 → 0.3. */
fun withoutFloatNoise(value: Double): Double = toFixed(value, 6).toDouble()

/**
 * Returns the change that applies [steps] to the current value of [metric] on [date] in [log].
 *
 * [log] must be the latest data, so taps made during an earlier write add to its result.
 */
fun planCount(metric: NumberMetric, date: Day, steps: List<CountStep>, log: LogTable): LogWrite? =
    plan(metric, date, applyCountSteps(log.valueAt(metric.id, date), steps), log)

/**
 * Returns the change that sets [metric] to [value] on [date]. Null if the cell already has [value]: the app compares
 * the value, not the text, so `yes` and 1 are equal.
 */
private fun plan(metric: Metric, date: Day, value: Double?, log: LogTable): LogWrite? {
    val column = log.columns[metric.id] ?: throw MissingColumnException(metric.id)
    if (log.valueAt(metric.id, date) == value) return null
    val row = log.rows[date]
    val cell = cellValue(metric, value)
    if (row != null) return SetCell(row, column, cell)
    return if (cell == null) null else AppendRow(date, column, cell)
}
