package trackula.model

/**
 * A change to the `Metrics` tab. The `plan` functions below make them from the latest [MetricsTable], so the row
 * numbers are correct after manual edits in the sheet.
 */
sealed class MetricsWrite

/**
 * Writes the value of each 0-based column of [cells] in the 1-based [row]. The other cells of the row do not change.
 * An empty text clears a cell. A row after the last row is a new row.
 */
data class SetMetricCells(val row: Int, val cells: Map<Int, Any>) : MetricsWrite()

/** Deletes the 1-based [row]. The rows below it move up. */
data class DeleteMetricRow(val row: Int) : MetricsWrite()

/**
 * Moves the 1-based [row] to the place before the row [before]. Both numbers are the row numbers before the move.
 * Examples: `MoveMetricRow(5, 3)` moves row 5 to row 3. `MoveMetricRow(3, 6)` moves row 3 to row 5.
 */
data class MoveMetricRow(val row: Int, val before: Int) : MetricsWrite()

/** Writes the header [names] in row 1, from the 0-based column [start]. */
data class AddMetricsColumns(val start: Int, val names: List<String>) : MetricsWrite()

/** Thrown when the `Metrics` tab has no row for a metric now, for example after a manual edit while the app is open. */
class MissingMetricException(val metricId: String) :
    Exception("The Metrics tab has no row \"$metricId\" now. Reload to see the latest data.") {
    /** The message only, without the class name. The app shows this text. */
    override fun toString(): String = message.orEmpty()
}

/** Thrown when an invalid row of the `Metrics` tab changed in the sheet after the app read it. */
class ChangedRowException(val row: Int) :
    Exception("Row $row of the Metrics tab changed in the sheet. Reload to see the latest data.") {
    /** The message only, without the class name. The app shows this text. */
    override fun toString(): String = message.orEmpty()
}

/**
 * The writes that put [metric] in the `Metrics` tab [table]: in the row with its id, or in a new row after the last
 * row. If the tab has no column of [metricsHeader], for example the `goal` column of an older sheet, the writes add
 * it first.
 */
fun planSaveMetric(table: MetricsTable, metric: Metric): List<MetricsWrite> =
    planCells(table, table.rows[metric.id] ?: (table.lastRow + 1), metricCells(metric))

/**
 * The writes that change the row of [metric] in [table]: the row with its id. Throws a [MissingMetricException] if
 * [table] has no row with the id, for example after a deletion in the sheet: a change does not add the metric again.
 */
fun planEditMetric(table: MetricsTable, metric: Metric): List<MetricsWrite> {
    if (metric.id !in table.rows) throw MissingMetricException(metric.id)
    return planSaveMetric(table, metric)
}

/**
 * The writes that replace the invalid row [old] with [metric]. The row is found by its cells, not by its number, as
 * a manual edit can move it. Throws a [ChangedRowException] if [table] has no invalid row with the cells of [old].
 */
fun planFixRow(table: MetricsTable, old: InvalidMetricRow, metric: Metric): List<MetricsWrite> =
    planCells(table, rowOf(table, old), metricCells(metric))

/** The write that deletes the row of the metric [id]. Throws a [MissingMetricException] if [table] has no such row. */
fun planDeleteMetric(table: MetricsTable, id: String): MetricsWrite =
    DeleteMetricRow(table.rows[id] ?: throw MissingMetricException(id))

/** The write that deletes the invalid row [old]. Throws a [ChangedRowException] if the row changed. See [planFixRow]. */
fun planDeleteRow(table: MetricsTable, old: InvalidMetricRow): MetricsWrite = DeleteMetricRow(rowOf(table, old))

/**
 * The write that moves the metric [id] one place up ([up]) or down: before the metric above it, or after the metric
 * below it. Other rows between the two, for example empty or invalid rows, do not move. Null if the metric is the
 * first one ([up]) or the last one. Throws a [MissingMetricException] if [table] has no row for [id].
 */
fun planMoveMetric(table: MetricsTable, id: String, up: Boolean): MetricsWrite? {
    val row = table.rows[id] ?: throw MissingMetricException(id)
    val index = table.items.indexOfFirst { it.id == id }
    val other = table.items.getOrNull(if (up) index - 1 else index + 1) ?: return null
    val otherRow = table.rows.getValue(other.id)
    return MoveMetricRow(row, if (up) otherRow else otherRow + 1)
}

/** The row of the invalid row [old] in [table], found by its cells. Throws a [ChangedRowException] if it is gone. */
private fun rowOf(table: MetricsTable, old: InvalidMetricRow): Int =
    table.invalid.firstOrNull { it.cells == old.cells }?.row ?: throw ChangedRowException(old.row)

/** Writes [cells] by header name in [row], and adds the missing columns of [metricsHeader] first. */
private fun planCells(table: MetricsTable, row: Int, cells: Map<String, Any>): List<MetricsWrite> {
    val missing = metricsHeader.filter { it !in table.columns }
    val columns = table.columns + missing.mapIndexed { i, name -> name to table.width + i }
    val write = SetMetricCells(row, cells.entries.associate { (name, value) -> columns.getValue(name) to value })
    return if (missing.isEmpty()) listOf(write) else listOf(AddMetricsColumns(table.width, missing), write)
}
