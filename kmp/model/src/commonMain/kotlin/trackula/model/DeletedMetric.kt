package trackula.model

/**
 * A `Log` column without a metric: the column of a deleted metric. Its values stay in the sheet, so the app can show
 * the metric again. See docs/data-model.md.
 *
 * @property id The column header: the id of the deleted metric.
 * @property values The number of cells with a value.
 * @property lastDay The last day with a value. Null if the column has no values.
 * @property isYesNo True if the column has values and all of them are `yes` or `no`: the metric was of kind `yesno`.
 */
data class DeletedMetric(val id: String, val values: Int, val lastDay: Day?, val isYesNo: Boolean)

/**
 * The deleted metrics of the `Log` tab: the columns whose header is a valid id that is not in [metricIds]. [rows]
 * includes the header row. A duplicate column counts once: the first one. The `date` and `Score` columns are not
 * metrics.
 *
 * Example: a `Log` header `date, weight, steps, Score` and the metric `weight` give the deleted metric `steps`.
 */
fun deletedMetrics(rows: List<List<Any?>>, metricIds: Set<String>): List<DeletedMetric> {
    val header = rows.firstOrNull().orEmpty()
    val seen = mutableSetOf<String>()
    val columns = (1 until header.size).filter { c ->
        val id = cellText(header[c]).trim()
        isValidMetricId(id) && id !in metricIds && seen.add(id)
    }
    return columns.map { c ->
        val cells = rows.drop(1).filter { row -> !isEmpty(row.getOrNull(c)) }
        DeletedMetric(
            id = cellText(header[c]).trim(),
            values = cells.size,
            lastDay = cells.mapNotNull { logDate(it.firstOrNull()) }.maxOrNull(),
            isYesNo = cells.isNotEmpty() && cells.all { cellText(it[c]).trim().lowercase() in setOf("yes", "no") },
        )
    }
}
