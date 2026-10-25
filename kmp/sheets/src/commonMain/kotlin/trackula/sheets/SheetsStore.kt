package trackula.sheets

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import trackula.model.AppendRow
import trackula.model.HeaderException
import trackula.model.LOG_TITLE
import trackula.model.LegacyCell
import trackula.model.LogWrite
import trackula.model.METRICS_TITLE
import trackula.model.Metric
import trackula.model.NumberMetric
import trackula.model.SCORE_HEADER
import trackula.model.ScoreCell
import trackula.model.SetCell
import trackula.model.TextDateRow
import trackula.model.YesNoMetric
import trackula.model.cellText
import trackula.model.columnLetter
import trackula.model.legacyYesNoCells
import trackula.model.metricsHeader
import trackula.model.parseLog
import trackula.model.parseMetrics
import trackula.model.scoreColumn
import trackula.model.staleScoreCells
import trackula.model.textDateRows

/** Rows for a new `Metrics` tab. Edit or delete them in the sheet. */
private val exampleMetrics: List<List<Any?>> = listOf(
    listOf("weight", "Weight", "number", "kg", 0.1, "body", "monitor_weight", "<= 80"),
    listOf("meditate", "Meditate", "yesno", "", "", "habits", "self_improvement", "yes"),
    listOf("water", "Water", "count", "glasses", 1, "habits", "water_drop", 8),
)

/** A tab of the spreadsheet: its ID in the Sheets API, and its number of columns. */
private data class Tab(val tabId: Int, val columnCount: Int)

/** The store of a Trackula spreadsheet in Google Sheets. See docs/data-model.md. */
class SheetsStore(private val api: SheetsClient) : Store() {
    val spreadsheetId: String get() = api.spreadsheetId

    /** True until [load] tried once to change text dates to real dates. Once is enough: the parser reads both. */
    private var mayHaveTextDates = true

    /**
     * Adds the `Metrics` and `Log` tabs to the spreadsheet if they are missing.
     *
     * A new `Metrics` tab gets its header, the example metrics and data validation. A new `Log` tab gets the `date`
     * column. [load] adds the metric columns. Existing tabs and other tabs do not change.
     */
    suspend fun ensureTabs() {
        val tabs = tabs()
        val missing = listOf(METRICS_TITLE, LOG_TITLE).filter { it !in tabs }
        if (missing.isEmpty()) return
        val newTabIds = addTabs(missing)
        writeHeaders(newTabIds.keys)
        api.batchUpdate(
            buildList {
                newTabIds[METRICS_TITLE]?.let { addAll(metricsRules(it, metricsHeader)) }
                newTabIds[LOG_TITLE]?.let { addAll(dateRules(it)) }
            },
        )
    }

    /** Adds a tab with a frozen header row for each of [titles]. Returns the ID of each new tab, by title. */
    private suspend fun addTabs(titles: List<String>): Map<String, Int> {
        val response = api.batchUpdate(
            titles.map { title ->
                buildJsonObject {
                    putJsonObject("addSheet") {
                        putJsonObject("properties") {
                            put("title", title)
                            putJsonObject("gridProperties") { put("frozenRowCount", 1) }
                        }
                    }
                }
            },
        )
        return response.getValue("replies").jsonArray.associate { reply ->
            val properties = reply.jsonObject.getValue("addSheet").jsonObject.getValue("properties").jsonObject
            properties.getValue("title").jsonPrimitive.content to properties.getValue("sheetId").jsonPrimitive.int
        }
    }

    /**
     * Writes the first rows of the new tabs [titles]: the header and the example metrics of `Metrics`, and the
     * `date` header of `Log`.
     */
    private suspend fun writeHeaders(titles: Set<String>) = api.batchUpdateValues(
        "RAW",
        buildList {
            if (METRICS_TITLE in titles) add(ValueRange("$METRICS_TITLE!A1", listOf(metricsHeader) + exampleMetrics))
            if (LOG_TITLE in titles) add(ValueRange("$LOG_TITLE!A1", listOf(listOf("date"))))
        },
    )

    /**
     * Sets the data validation rules of both tabs again, from the current headers and metric kinds. So sheets made
     * by an older app version accept new values, for example kind `count` or `yes`, and new columns get their rule.
     *
     * - `Metrics`: the rules go to the columns with the matching header names, so moved columns keep their rules.
     *   First it removes all validation rules below row 1, so a moved column leaves no old rule behind.
     * - `Log`: the date column gets its date format and rule. Each metric column gets the rule of its metric kind,
     *   so a kind change also changes the rule.
     *
     * It changes only validation rules, not data.
     */
    override suspend fun refreshRules() {
        val tabs = tabs()
        val metricsTab = tabs[METRICS_TITLE] ?: return
        val logTab = tabs[LOG_TITLE]
        val ranges = api.batchGet(listOfNotNull(METRICS_TITLE, logTab?.let { "$LOG_TITLE!1:1" }))
        val metricRows = ranges[0]
        val logHeader = if (logTab != null) ranges[1].firstOrNull().orEmpty() else emptyList()
        val header = metricRows.firstOrNull().orEmpty().map { cellText(it).trim().lowercase() }
        api.batchUpdate(
            buildList {
                add(clearRules(metricsTab.tabId))
                addAll(metricsRules(metricsTab.tabId, header))
                if (logTab != null) {
                    addAll(dateRules(logTab.tabId))
                    addAll(logValueRules(logTab.tabId, logHeader, metricsById(metricRows)))
                }
            },
        )
    }

    /**
     * Reads both tabs and validates each row.
     *
     * Before it parses the `Log` tab, it brings the tab up to date (see [migrate]). With [writesScores], it also
     * writes the scores that changed (see [staleScoreCells]). So each load after a change in the app or in the sheet,
     * for example a new goal, also updates the scores. [Store.changeAll] writes them after its last write.
     *
     * It writes the scores at most once, so a score that does not stay in the sheet cannot cause a loop.
     */
    override suspend fun load(writesScores: Boolean): Snapshot {
        val (metricRows, logRows) = api.batchGet(listOf(METRICS_TITLE, LOG_TITLE))
        val metrics = parseMetrics(metricRows)
        val byId = metrics.items.associateBy { it.id }
        if (migrate(logRows, byId)) return load(writesScores)
        val scoreWarnings = mutableListOf<String>()
        if (writesScores && writeScores(logRows, metrics.items, scoreWarnings)) return load(writesScores = false)
        val log = parseLog(logRows, byId)
        return Snapshot(metrics.items, log.table, metrics.warnings + log.warnings + scoreWarnings)
    }

    /**
     * Writes the score cells of [logRows] that do not show the score of their row. Returns true after a write: then
     * read the data again. [migrate] adds the score column before.
     *
     * The score comes from the other values, so a failed write does not stop the load. Examples: a view-only sheet, or
     * the request limit of the Sheets API. Then it adds a warning to [warnings] and returns false. The next load tries
     * again.
     */
    private suspend fun writeScores(
        logRows: List<List<Any?>>,
        metrics: List<Metric>,
        warnings: MutableList<String>,
    ): Boolean {
        val column = scoreColumn(logRows.firstOrNull().orEmpty()) ?: return false
        val cells = staleScoreCells(logRows, metrics, column)
        if (cells.isEmpty()) return false
        return try {
            writeScoreCells(cells, column)
            true
        } catch (e: SheetsApiException) {
            warnings.add("The app could not write ${cells.size} scores in the \"$SCORE_HEADER\" column: ${e.message}")
            false
        }
    }

    /** Writes the new score of each of [cells] in the score [column]. An empty string clears a cell. */
    private suspend fun writeScoreCells(cells: List<ScoreCell>, column: Int) =
        api.batchUpdateValues("RAW", cells.map { ValueRange(cell(it.row, column), listOf(listOf(it.score ?: ""))) })

    /**
     * Makes one change to bring the `Log` tab up to date, if it needs one. Returns true after a change: then read the
     * data again.
     *
     * The changes, in this order: add a column for each metric without one and the score column, change text dates to
     * real dates (see [textDateRows]), and change yesno values of old app versions to `yes` or `no` (see
     * [legacyYesNoCells]).
     */
    private suspend fun migrate(logRows: List<List<Any?>>, metrics: Map<String, Metric>): Boolean {
        val header = logRows.firstOrNull().orEmpty()
        val present = header.map { cellText(it).trim() }.toSet()
        val missing = (metrics.keys + SCORE_HEADER).filter { it !in present }
        if (missing.isNotEmpty()) {
            addColumns(missing, header.size, metrics)
            return true
        }
        val textDates = if (mayHaveTextDates) textDateRows(logRows) else emptyList()
        if (textDates.isNotEmpty()) {
            mayHaveTextDates = false
            writeRealDates(textDates)
            return true
        }
        val legacy = legacyYesNoCells(logRows, metrics)
        if (legacy.isNotEmpty()) {
            writeYesNo(legacy)
            return true
        }
        return false
    }

    /** Writes each date of [rows] again as a real date, with the date format. */
    private suspend fun writeRealDates(rows: List<TextDateRow>) {
        val logTab = tabs().getValue(LOG_TITLE)
        api.batchUpdate(listOf(dateFormat(logTab.tabId)))
        // USER_ENTERED: Sheets reads the YYYY-MM-DD text as a real date, as when you type it.
        api.batchUpdateValues(
            "USER_ENTERED",
            rows.map { ValueRange("$LOG_TITLE!A${it.row}", listOf(listOf(it.date.toString()))) },
        )
    }

    /** Writes the new `yes` or `no` value of each of [cells]. */
    private suspend fun writeYesNo(cells: List<LegacyCell>) =
        api.batchUpdateValues("RAW", cells.map { ValueRange(cell(it.row, it.column), listOf(listOf(it.value))) })

    override suspend fun apply(write: LogWrite) {
        when (write) {
            // USER_ENTERED: Sheets reads the YYYY-MM-DD text as a real date, as when you type it.
            // The other cells are numbers, or `yes` and `no`, which stay as they are.
            is AppendRow -> api.append("$LOG_TITLE!A1", listOf(write.toCells()), "USER_ENTERED")

            is SetCell -> {
                val value = write.value
                if (value == null) {
                    api.clear(cell(write.row, write.column))
                } else {
                    api.update(cell(write.row, write.column), listOf(listOf(value)), "RAW")
                }
            }
        }
    }

    /**
     * Adds a column with each of [headers] and its validation rule, after [width] columns. A header is a metric id of
     * [metrics], or [SCORE_HEADER].
     */
    private suspend fun addColumns(headers: List<String>, width: Int, metrics: Map<String, Metric>) {
        val logTab = tabs().getValue(LOG_TITLE)
        // Column A is always `date`, even if the header row is empty.
        val start = if (width == 0) 1 else width
        val needed = start + headers.size - logTab.columnCount
        api.batchUpdate(
            buildList {
                if (needed > 0) {
                    add(
                        buildJsonObject {
                            putJsonObject("appendDimension") {
                                put("sheetId", logTab.tabId)
                                put("dimension", "COLUMNS")
                                put("length", needed)
                            }
                        },
                    )
                }
                headers.forEachIndexed { i, header ->
                    logColumnRule(logTab.tabId, start + i, header, metrics)?.let(::add)
                }
            },
        )
        api.update(
            "$LOG_TITLE!${columnLetter(if (width == 0) 0 else start)}1",
            listOf((if (width == 0) listOf("date") else emptyList()) + headers),
            "RAW",
        )
    }

    /** The tabs of the spreadsheet, by title. */
    private suspend fun tabs(): Map<String, Tab> {
        val spreadsheet = api.get("sheets.properties(sheetId,title,gridProperties.columnCount)")
        return spreadsheet["sheets"]?.jsonArray.orEmpty().associate { tab ->
            val properties = tab.jsonObject.getValue("properties").jsonObject
            val columnCount = properties.getValue("gridProperties").jsonObject.getValue("columnCount")
            properties.getValue("title").jsonPrimitive.content to
                Tab(properties.getValue("sheetId").jsonPrimitive.int, columnCount.jsonPrimitive.int)
        }
    }

    private companion object {
        /**
         * The valid metrics of [metricRows], by id. Empty if the `Metrics` tab has no complete header: then [load]
         * shows the error, and the `Log` rules wait until the tab is valid.
         */
        fun metricsById(metricRows: List<List<Any?>>): Map<String, Metric> = try {
            parseMetrics(metricRows).items.associateBy { it.id }
        } catch (_: HeaderException) {
            emptyMap()
        }

        /** The A1 notation of a `Log` cell. [row] is 1-based, [column] 0-based. */
        fun cell(row: Int, column: Int): String = "$LOG_TITLE!${columnLetter(column)}$row"
    }
}

// Data validation rules. See "Layer 2" in docs/data-model.md. The Sheets API calls a tab ID `sheetId`.

/** The cells of [column] of the tab [tabId], below the header row. */
private fun columnRange(tabId: Int, column: Int): JsonObject = buildJsonObject {
    put("sheetId", tabId)
    put("startRowIndex", 1)
    put("startColumnIndex", column)
    put("endColumnIndex", column + 1)
}

/** Removes all validation rules of the tab [tabId] below the header row. */
private fun clearRules(tabId: Int): JsonObject = buildJsonObject {
    putJsonObject("setDataValidation") {
        putJsonObject("range") {
            put("sheetId", tabId)
            put("startRowIndex", 1)
        }
    }
}

private fun rule(range: JsonObject, condition: JsonObject): JsonObject = buildJsonObject {
    putJsonObject("setDataValidation") {
        put("range", range)
        putJsonObject("rule") {
            put("condition", condition)
            put("strict", true)
            put("showCustomUi", true)
        }
    }
}

private fun condition(type: String, values: List<String>): JsonObject = buildJsonObject {
    put("type", type)
    put("values", buildJsonArray { values.forEach { add(buildJsonObject { put("userEnteredValue", it) }) } })
}

private fun formula(formula: String): JsonObject = condition("CUSTOM_FORMULA", listOf(formula))

private fun oneOf(items: List<String>): JsonObject = condition("ONE_OF_LIST", items)

/** The rules of the `Metrics` tab [tabId]. [header] holds the lowercase header names. A missing column gets no rule. */
private fun metricsRules(tabId: Int, header: List<String>): List<JsonObject> {
    fun at(name: String, condition: (cell: String) -> JsonObject): JsonObject? {
        val i = header.indexOf(name)
        return if (i < 0) null else rule(columnRange(tabId, i), condition("${columnLetter(i)}2"))
    }

    return listOfNotNull(
        at("kind") { oneOf(listOf("yesno", "number", "count")) },
        // A Material Symbols name, or a short text such as an emoji. Some emojis have up to 11 characters in Sheets.
        at("icon") { c -> formula("=OR(REGEXMATCH($c, \"^[a-z0-9_]+$\"), LEN($c) <= 16)") },
        // `yes` or `no` for yesno metrics. A number, or a number after `<=` or `>=`, for number and count metrics.
        at("goal") { c ->
            formula(
                "=OR(ISNUMBER($c), REGEXMATCH(LOWER(TO_TEXT($c)), \"^ *(yes|no|(<=|>=)? *-?[0-9]+([.][0-9]+)?) *$\"))",
            )
        },
    )
}

/**
 * The `date` column of the `Log` tab [tabId]: a real date, shown as YYYY-MM-DD in every locale, and a valid-date
 * rule.
 *
 * The rule also gives a date picker in Sheets. A cell has only one rule, so Sheets does not block a second row
 * for the same day: the app warns about it.
 */
private fun dateRules(tabId: Int): List<JsonObject> = listOf(
    dateFormat(tabId),
    rule(columnRange(tabId, 0), buildJsonObject { put("type", "DATE_IS_VALID") }),
)

/** Formats `Log!A2:A` of the tab [tabId] as a date with the pattern YYYY-MM-DD. The header row stays text. */
private fun dateFormat(tabId: Int): JsonObject = buildJsonObject {
    putJsonObject("repeatCell") {
        put("range", columnRange(tabId, 0))
        putJsonObject("cell") {
            putJsonObject("userEnteredFormat") {
                putJsonObject("numberFormat") {
                    put("type", "DATE")
                    put("pattern", "yyyy-mm-dd")
                }
            }
        }
        put("fields", "userEnteredFormat.numberFormat")
    }
}

/**
 * The rules of the metric columns and of the score column of the `Log` tab [tabId], from its [header]. Other columns
 * get no rule.
 */
private fun logValueRules(tabId: Int, header: List<Any?>, metrics: Map<String, Metric>): List<JsonObject> =
    (1 until header.size).mapNotNull { c -> logColumnRule(tabId, c, cellText(header[c]).trim(), metrics) }

/**
 * The rule for the `Log` column [column] with [header]: a `yes` / `no` dropdown for yesno, a number for number
 * metrics and for the score. Null for other columns, for example of a deleted metric.
 *
 * [SheetsStore.refreshRules] sets it again each time the app opens the sheet, so it follows kind changes.
 */
private fun logColumnRule(tabId: Int, column: Int, header: String, metrics: Map<String, Metric>): JsonObject? {
    val isNumber = formula("=ISNUMBER(${columnLetter(column)}2)")
    val condition = when (metrics[header]) {
        is YesNoMetric -> oneOf(listOf("yes", "no"))
        is NumberMetric -> isNumber
        null -> if (header == SCORE_HEADER) isNumber else null
    } ?: return null
    return rule(columnRange(tabId, column), condition)
}
