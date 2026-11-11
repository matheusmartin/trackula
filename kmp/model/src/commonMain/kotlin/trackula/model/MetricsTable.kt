package trackula.model

/**
 * The `Metrics` tab: the valid metrics, and where each row and column is. See docs/data-model.md.
 *
 * @property items The valid metrics, in row order.
 * @property warnings One warning for each row in [invalid].
 * @property rows The 1-based row number of each metric, by id.
 * @property columns The 0-based column index of each lowercase header name. The app ignores the columns that are not
 *   in [metricsHeader], but they can be in this map.
 * @property width The number of cells of the header row. A new column goes after them.
 * @property invalid The rows that the app does not show, with their problem. Examples: no icon, an invalid goal.
 * @property lastRow The 1-based number of the last row with a value. 1 if the tab has only the header. A new metric
 *   goes in the row after it.
 */
data class MetricsTable(
    val items: List<Metric>,
    val warnings: List<String> = emptyList(),
    val rows: Map<String, Int> = emptyMap(),
    val columns: Map<String, Int> = emptyMap(),
    val width: Int = 0,
    val invalid: List<InvalidMetricRow> = emptyList(),
    val lastRow: Int = 1,
)

/**
 * A row of the `Metrics` tab that is not valid, so the app does not show it.
 *
 * @property row The 1-based row number.
 * @property cells The cells of the row, by lowercase header name. An empty cell is null or an empty text.
 * @property problem The problem, for the user. Example: `no icon. Use a Material Symbols name …`.
 */
data class InvalidMetricRow(val row: Int, val cells: Map<String, Any?>, val problem: String) {
    /** The text in the `id` cell, trimmed. Empty if the cell is empty. */
    val id: String get() = cellText(cells["id"]).trim()
}
