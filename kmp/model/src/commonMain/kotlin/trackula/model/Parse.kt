package trackula.model

/** The tab titles. Exact case: the app finds the tabs by title. See docs/data-model.md. */
const val METRICS_TITLE = "Metrics"
const val LOG_TITLE = "Log"

/**
 * Column names of the `Metrics` tab, in the order the app creates them. All are required, except `goal`: older sheets
 * do not have it. The app ignores other columns, for example `per_day` and `active` of older sheets.
 */
val metricsHeader = listOf("id", "name", "kind", "unit", "step", "group", "icon", "goal")

/** The columns of [metricsHeader] that a `Metrics` tab must have. */
private val requiredMetricsColumns = metricsHeader - "goal"

/** Thrown when a header row does not contain a required column. */
class HeaderException(val tab: String, val missing: List<String>) :
    Exception("Tab \"$tab\" has no column(s): ${missing.joinToString(", ")}") {
    /** The message only, without the class name, as in Dart. The app shows this text. */
    override fun toString(): String = message.orEmpty()
}

/** Thrown when a row of the `Metrics` tab is not valid. The message tells the problem, for the user. */
class InvalidMetricException(message: String) : Exception(message) {
    /** The message only, without the class name. The app shows this text. */
    override fun toString(): String = message.orEmpty()
}

private val idPattern = Regex("^[a-z0-9_-]+$")

/** True if [id] is a valid metric id: lowercase letters, digits, `_` and `-`. Example: `morning_teeth`. */
fun isValidMetricId(id: String): Boolean = idPattern.matches(id)

/** Parses the `Metrics` tab. [rows] includes the header row. Throws a [HeaderException] if a column is missing. */
fun parseMetrics(rows: List<List<Any?>>): MetricsTable {
    val columns = columns(METRICS_TITLE, rows, requiredMetricsColumns)
    val items = mutableListOf<Metric>()
    val rowOf = mutableMapOf<String, Int>()
    val invalid = mutableListOf<InvalidMetricRow>()
    val warnings = mutableListOf<String>()

    for (i in 1 until rows.size) {
        val cells = cellsByName(rows[i], columns)
        val row = MetricRow(cells)
        if (row.isEmpty) continue
        val at = "$METRICS_TITLE row ${i + 1}"

        val id = row.text("id")
        val problem = if (id == null || !isValidMetricId(id)) {
            "invalid id \"${id ?: ""}\". Use only lowercase letters, digits, \"_\" and \"-\"."
        } else if (id in rowOf) {
            "duplicate id \"$id\""
        } else {
            try {
                items.add(metric(row, id))
                rowOf[id] = i + 1
                null
            } catch (e: InvalidMetricException) {
                e.message
            }
        }
        if (problem != null) {
            warnings.add("$at: $problem")
            invalid.add(InvalidMetricRow(row = i + 1, cells = cells, problem = problem))
        }
    }
    return MetricsTable(
        items = items,
        warnings = warnings,
        rows = rowOf,
        columns = columns,
        width = rows.firstOrNull().orEmpty().size,
        invalid = invalid,
        // The Sheets API omits the empty rows at the end. A row with only unchecked checkboxes is not empty in Sheets.
        lastRow = maxOf(rows.size, 1),
    )
}

/**
 * The metric of the `Metrics` row [cells], with the id [id]. The keys of [cells] are the lowercase header names, as
 * in [metricsHeader]. Throws an [InvalidMetricException] with the problem if the row is not valid. The app checks the
 * values of its metrics form with this function, so that the form and the parser accept the same rows.
 */
fun parseMetricRow(id: String, cells: Map<String, Any?>): Metric = metric(MetricRow(cells), id)

/** The metric of [row]. [id] is valid. Throws an [InvalidMetricException] with the problem if the row is not valid. */
private fun metric(row: MetricRow, id: String): Metric {
    val name = row.text("name") ?: id
    val group = row.text("group")
    val icon = row.text("icon")
        ?: throw InvalidMetricException("no icon. Use a Material Symbols name, such as \"water_drop\", or an emoji.")
    val goal = row.cell("goal")
    return when (val kind = row.text("kind")) {
        "yesno" -> YesNoMetric(id = id, name = name, icon = icon, group = group, goalIsYes = yesNoGoal(goal))

        "number", "count" -> NumberMetric(
            id = id,
            name = name,
            icon = icon,
            unit = row.text("unit"),
            step = row.number("step")?.takeIf { it > 0 } ?: 1.0,
            isCount = kind == "count",
            goal = numberGoal(goal, isCount = kind == "count"),
            group = group,
        )

        else -> throw InvalidMetricException("invalid kind \"${kind ?: ""}\"")
    }
}

/**
 * The goal of a yesno metric in the `goal` [cell]: true for `yes`, false for `no`. An empty cell is `yes`.
 * Throws an [InvalidMetricException] for other values.
 */
private fun yesNoGoal(cell: Any?): Boolean {
    if (isEmpty(cell)) return true
    val value = yesNoValue(cell)
        ?: throw InvalidMetricException("invalid goal \"${cellText(cell)}\". For a yesno metric, use yes or no.")
    return value == 1.0
}

/**
 * The goal of a number or count metric in the `goal` [cell]. Null if the cell is empty. See [NumberGoal] and
 * docs/data-model.md.
 *
 * The cell has a direction, a target, an optional start after `from`, and an optional `trend`. Examples: `at least 8`,
 * `at most 80 from 83`, `at most 80 from 83 trend`. A number without a direction, such as `8`, is a minimum. The
 * signs `>=` and `<=` of older app versions are the same as `at least` and `at most`. Case does not matter.
 *
 * Throws an [InvalidMetricException] if the cell has a different form, if the start is not on the other side of the
 * target, or if a count metric ([isCount]) has `trend`.
 */
private fun numberGoal(cell: Any?, isCount: Boolean): NumberGoal? {
    if (isEmpty(cell)) return null
    numberOf(cell)?.let { return NumberGoal(it) }
    val text = cellText(cell)
    val match = numberGoalPattern.matchEntire(text.trim()) ?: throw InvalidMetricException(
        "invalid goal \"$text\". Use for example at least 8, at most 80, or at most 80 from 83 trend.",
    )
    val (direction, target, from, trend) = match.destructured
    val goal = NumberGoal(
        target = target.toDouble(),
        isMaximum = direction == "<=" || direction.lowercase().endsWith("most"),
        from = from.takeIf { it.isNotEmpty() }?.toDouble(),
        usesTrend = trend.isNotEmpty(),
    )
    val start = goal.from
    if (start != null && goal.isReachedBy(start)) {
        val side = if (goal.isMaximum) "above" else "below"
        throw InvalidMetricException("invalid goal \"$text\". The value after from must be $side the target.")
    }
    if (isCount && goal.usesTrend) {
        throw InvalidMetricException("invalid goal \"$text\". Only a number metric can have a trend.")
    }
    return goal
}

/** A number in a goal: an optional minus sign, digits, and optional decimals after a period. */
private const val NUMBER = """-?\d+(?:\.\d+)?"""

/**
 * A number goal as text: an optional direction, the target, an optional `from` and a start, and an optional `trend`.
 * The groups: the direction, the target, the start and `trend`. Examples: `8`, `>= 8`, `at least 8`, `<=75.5`,
 * `at most 80 from 83 trend`.
 */
private val numberGoalPattern = Regex(
    """^(at\s+least|at\s+most|>=|<=)?\s*($NUMBER)(?:\s+from\s+($NUMBER))?(\s+trend)?$""",
    RegexOption.IGNORE_CASE,
)

/** The `Log` tab and a warning for each invalid cell or row. */
data class ParsedLog(val table: LogTable, val warnings: List<String>)

/**
 * Parses the `Log` tab: column A is `date`, the other headers are metric ids. [rows] includes the header row.
 * Throws a [HeaderException] if column A is not `date`.
 */
fun parseLog(rows: List<List<Any?>>, metrics: Map<String, Metric>): ParsedLog {
    val header = rows.firstOrNull().orEmpty()
    if (header.isEmpty() || cellText(header.first()).trim().lowercase() != "date") {
        throw HeaderException(LOG_TITLE, listOf("date"))
    }

    val warnings = mutableListOf<String>()
    val columns = logColumns(header, metrics, warnings)
    val entries = mutableListOf<LogEntry>()
    val days = mutableMapOf<Day, Int>()
    for (i in 1 until rows.size) {
        val cells = rows[i]
        if (cells.all(::isEmpty)) continue
        val at = "$LOG_TITLE row ${i + 1}"
        val first = cells.firstOrNull()
        val date = logDate(first)
        if (date == null) {
            warnings.add("$at: invalid date \"${cellText(first).trim()}\"")
            continue
        }
        if (date in days) warnings.add("$at: $date has more than one row. The app uses the last row.")
        days[date] = i + 1

        for ((id, c) in columns) {
            val cell = cells.getOrNull(c)
            if (isEmpty(cell)) continue
            val metric = metrics.getValue(id)
            val value = logValue(metric, cell)
            if (value != null) {
                entries.add(LogEntry(row = i + 1, date = date, metricId = id, value = value))
            } else {
                val problem = if (metric is YesNoMetric) "yesno value must be yes or no" else "value is not a number"
                warnings.add("$at, column ${columnLetter(c)}: $problem")
            }
        }
    }
    return ParsedLog(LogTable(entries, days, columns), warnings)
}

/**
 * The 0-based column index of each metric in the `Log` [header]. Adds a warning to [warnings] for each duplicate
 * column.
 */
private fun logColumns(
    header: List<Any?>,
    metrics: Map<String, Metric>,
    warnings: MutableList<String>,
): Map<String, Int> {
    val columns = mutableMapOf<String, Int>()
    for (c in 1 until header.size) {
        val id = cellText(header[c]).trim()
        // A column with no metric, for example of a deleted metric: the app ignores the column and its values.
        if (id.isEmpty() || id !in metrics) continue
        if (id in columns) {
            warnings.add("$LOG_TITLE column ${columnLetter(c)}: duplicate column \"$id\". The app uses the first one.")
        } else {
            columns[id] = c
        }
    }
    return columns
}

/**
 * The date of a `date` cell. A real date is a serial number. Older app versions wrote the date as text: YYYY-MM-DD.
 * Null if the cell is not a valid date.
 */
internal fun logDate(cell: Any?): Day? = when (cell) {
    is Number -> Day.fromSerial(cell.toDouble())
    is String -> Day.tryParse(cell)
    else -> null
}

/** The value of a non-empty `Log` [cell] of [metric]. Null if the value is not valid for the metric kind. */
private fun logValue(metric: Metric, cell: Any?): Double? = when {
    metric is YesNoMetric -> yesNoValue(cell)
    cell is Number -> cell.toDouble()
    cell is String -> parseNumber(cell.trim())
    else -> null
}

/** A row of the `Log` tab with a date stored as text, and that date. The row is 1-based. */
data class TextDateRow(val row: Int, val date: Day)

/**
 * The `Log` rows with a date stored as text (`YYYY-MM-DD`), as older app versions wrote it, and that date.
 *
 * The app changes these cells to real dates. Real dates (serial numbers) and invalid text do not change.
 * [rows] includes the header row.
 */
fun textDateRows(rows: List<List<Any?>>): List<TextDateRow> = (1 until rows.size).mapNotNull { i ->
    val first = rows[i].firstOrNull() as? String ?: return@mapNotNull null
    Day.tryParse(first)?.let { TextDateRow(i + 1, it) }
}

/**
 * Reads a yesno cell: `yes` is 1, `no` is 0. Case and spaces do not matter.
 *
 * Old app versions wrote `1` for yes, and a checked checkbox is `TRUE`: both are yes. `0` and `FALSE` are no.
 * Returns null for other values.
 */
private fun yesNoValue(cell: Any?): Double? = when (cell) {
    true -> 1.0

    is Number -> when (cell.toDouble()) {
        1.0 -> 1.0
        0.0 -> 0.0
        else -> null
    }

    is String -> when (cell.trim().lowercase()) {
        "yes", "true", "1" -> 1.0
        "no", "false", "0" -> 0.0
        else -> null
    }

    else -> null
}

/** A `Log` cell with a yesno value of an old app version, and its new value. The row is 1-based, the column 0-based. */
data class LegacyCell(val row: Int, val column: Int, val value: String)

/**
 * The `Log` cells of yesno metrics that have a value of an old app version, and the new value of each cell.
 *
 * Old versions wrote `1` for yes. `1`, `TRUE` and `0`, also as text, become `yes` or `no`. Cells with `yes` or
 * `no`, empty cells and invalid values do not change. [rows] includes the header row.
 */
fun legacyYesNoCells(rows: List<List<Any?>>, metrics: Map<String, Metric>): List<LegacyCell> {
    if (rows.isEmpty()) return emptyList()
    val seen = mutableSetOf<String>()
    val columns = (1 until rows.first().size).filter { c ->
        val id = cellText(rows.first()[c]).trim()
        metrics[id] is YesNoMetric && seen.add(id)
    }
    fun isNew(cell: Any?) = cell is String && cell.trim().lowercase() in setOf("yes", "no")
    return (1 until rows.size).flatMap { i ->
        columns.mapNotNull { c ->
            val cell = rows[i].getOrNull(c)
            if (isEmpty(cell) || isNew(cell)) return@mapNotNull null
            yesNoValue(cell)?.let { LegacyCell(i + 1, c, if (it == 1.0) "yes" else "no") }
        }
    }
}

/** Spreadsheet column letter for a 0-based [index]. Example: 0 → A, 26 → AA. */
fun columnLetter(index: Int): String {
    var n = index + 1
    var letters = ""
    while (n > 0) {
        letters = "${'A' + (n - 1) % 26}$letters"
        n = (n - 1) / 26
    }
    return letters
}

/** Empty checkbox cells return `false`, so `false` counts as empty. */
internal fun isEmpty(cell: Any?): Boolean = cell == null || cell == false || (cell is String && cell.isBlank())

/** The text of a [cell], as Dart compiled to JavaScript gives it. A number has no ".0": 8.0 is "8". Null is "". */
fun cellText(cell: Any?): String = when (cell) {
    null -> ""
    is String -> cell
    is Number -> numberText(cell.toDouble())
    else -> cell.toString()
}

/**
 * The column index of each lowercase header name of [rows]. Throws a [HeaderException] if a [required] name is
 * missing.
 */
private fun columns(tab: String, rows: List<List<Any?>>, required: List<String>): Map<String, Int> {
    val header = rows.firstOrNull().orEmpty()
    val columns = mutableMapOf<String, Int>()
    header.forEachIndexed { i, cell -> columns[cellText(cell).trim().lowercase()] = i }
    val missing = required.filter { it !in columns }
    if (missing.isNotEmpty()) throw HeaderException(tab, missing)
    return columns
}

/**
 * The cells of a `Metrics` row by lowercase header name, for each of [columns]. The Sheets API omits empty cells at
 * the end of a row: they are null.
 */
private fun cellsByName(cells: List<Any?>, columns: Map<String, Int>): Map<String, Any?> =
    columns.filterKeys { it.isNotEmpty() }.mapValues { (_, c) -> cells.getOrNull(c) }

/** One row of the `Metrics` tab: its cells by lowercase header name. */
private class MetricRow(private val cells: Map<String, Any?>) {
    val isEmpty: Boolean get() = cells.values.all(::isEmpty)

    /** The cell in column [name]. Null if the cell is empty, or if the tab has no such column. */
    fun cell(name: String): Any? = cells[name]

    /** The trimmed text of the cell in column [name]. Null if the cell is empty. */
    fun text(name: String): String? = cell(name)?.let { cellText(it).trim() }?.takeIf { it.isNotEmpty() }

    /** The number in the cell in column [name]. Null if the cell is empty or not a number. */
    fun number(name: String): Double? = when (val cell = cell(name)) {
        is Number -> cell.toDouble()
        is String -> parseNumber(cell.trim())
        else -> null
    }
}
