package trackula.sheets

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.decodeURLPart
import io.ktor.http.headersOf
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import trackula.model.Day
import trackula.model.LOG_TITLE
import trackula.model.METRICS_TITLE
import trackula.model.columnLetter

/**
 * An in-memory spreadsheet behind a Ktor mock engine, for the calls of [SheetsStore].
 *
 * It keeps the `Metrics` and `Log` tabs as rows of cells. It returns the values as the Sheets API does with
 * `UNFORMATTED_VALUE`: empty cells at the end of a row and empty rows at the end are not in the response.
 */
class FakeSheets(
    val metrics: MutableList<MutableList<Any?>>,
    val log: MutableList<MutableList<Any?>>,
    logColumns: Int,
) {
    val columnCounts = mutableMapOf(METRICS_TITLE to 26, LOG_TITLE to logColumns)

    /** False: the `Score` column does not keep a written value, as if something in the sheet changes it back. */
    var keepsScores = true

    /** True: a write to the `Score` column fails with HTTP 403, as on a view-only sheet. */
    var failsScoreWrites = false

    /** The method and the last part of the path of each call. Example: `GET values:batchGet`. */
    val calls = mutableListOf<String>()

    /** The ranges of each `values:batchUpdate` call that writes to the `Score` column. */
    val scoreWrites = mutableListOf<List<String>>()

    /** The letters of the `Log` columns that got the number rule `=ISNUMBER(…)`, in the order of the requests. */
    val numberRuleColumns = mutableListOf<String>()

    val store = SheetsStore(SheetsClient(HttpClient(MockEngine { handle(it) }), "sheet-id"))

    private val tabIds = mapOf(METRICS_TITLE to 1, LOG_TITLE to 2)

    private fun tab(title: String): MutableList<MutableList<Any?>> = when (title) {
        METRICS_TITLE -> metrics
        LOG_TITLE -> log
        else -> throw IllegalArgumentException(title)
    }

    /** The values of the [header] column of the `Log` tab, below the header row. Null for an empty cell. */
    fun logColumn(header: String): List<Double?> {
        val c = log[0].indexOf(header)
        return log.drop(1).map { row -> (orNull(row.getOrNull(c)) as Number?)?.toDouble() }
    }

    private val scoreColumn: Int get() = if (log.isEmpty()) -1 else log[0].indexOf("Score")

    private fun MockRequestHandleScope.handle(request: HttpRequestData): HttpResponseData {
        val path = request.url.encodedPath.decodeURLPart().removePrefix("/v4/spreadsheets/sheet-id")
        val text = (request.body as? TextContent)?.text.orEmpty()
        val body = if (text.isEmpty()) JsonObject(emptyMap()) else Json.parseToJsonElement(text).jsonObject
        calls.add("${request.method.value} ${path.split('/').last()}")
        return try {
            json(response(request, path, body))
        } catch (_: Forbidden) {
            val error = buildJsonObject {
                putJsonObject("error") {
                    put("code", 403)
                    put("message", "The caller does not have permission")
                }
            }
            json(error, HttpStatusCode.Forbidden)
        }
    }

    private fun MockRequestHandleScope.json(body: JsonElement, status: HttpStatusCode = HttpStatusCode.OK) =
        respond(body.toString(), status, headersOf(HttpHeaders.ContentType, "application/json; charset=utf-8"))

    private fun response(request: HttpRequestData, path: String, body: JsonObject): JsonElement {
        val inputOption = request.url.parameters["valueInputOption"]
        val method = request.method.value
        return when {
            method == "GET" && path == "" -> spreadsheet()

            method == "POST" && path == ":batchUpdate" -> batchUpdate(body)

            method == "GET" && path == "/values:batchGet" -> batchGet(request.url.parameters.getAll("ranges")!!)

            method == "POST" && path == "/values:batchUpdate" -> valuesBatchUpdate(body)

            method == "PUT" && path.startsWith("/values/") ->
                write(path.removePrefix("/values/"), body.getValue("values"), inputOption == "USER_ENTERED")

            method == "POST" && path.endsWith(":append") -> append(body.getValue("values").jsonArray.single())

            method == "POST" && path.endsWith(":clear") -> clear(path.removePrefix("/values/").removeSuffix(":clear"))

            else -> throw UnsupportedOperationException("$method $path")
        }
    }

    private fun spreadsheet(): JsonElement = buildJsonObject {
        put(
            "sheets",
            buildJsonArray {
                for ((title, id) in tabIds) {
                    add(
                        buildJsonObject {
                            putJsonObject("properties") {
                                put("sheetId", id)
                                put("title", title)
                                putJsonObject("gridProperties") { put("columnCount", columnCounts[title]) }
                            }
                        },
                    )
                }
            },
        )
    }

    private fun batchUpdate(body: JsonObject): JsonElement {
        for (request in body.getValue("requests").jsonArray.map { it.jsonObject }) {
            request["appendDimension"]?.jsonObject?.let { append ->
                val title = tabIds.entries.first { it.value == append.getValue("sheetId").jsonPrimitive.int }.key
                columnCounts[title] = columnCounts.getValue(title) + append.getValue("length").jsonPrimitive.int
            }
            request["setDataValidation"]?.jsonObject?.let { validation ->
                val range = validation.getValue("range").jsonObject
                val condition = validation["rule"]?.jsonObject?.get("condition").toString()
                if (range.getValue("sheetId").jsonPrimitive.int == tabIds[LOG_TITLE] && "ISNUMBER" in condition) {
                    numberRuleColumns.add(columnLetter(range.getValue("startColumnIndex").jsonPrimitive.int))
                }
            }
        }
        return buildJsonObject { put("replies", JsonArray(emptyList())) }
    }

    private fun batchGet(ranges: List<String>): JsonElement = buildJsonObject {
        put(
            "valueRanges",
            buildJsonArray {
                for (range in ranges) {
                    add(
                        buildJsonObject {
                            put("range", range)
                            values(range)?.let { rows ->
                                put("values", buildJsonArray { rows.forEach { add(JsonArray(it.map(::cellJson))) } })
                            }
                        },
                    )
                }
            },
        )
    }

    /** The values of [range], a tab title or `Log!1:1`, without empty cells at the end. Null if there are no values. */
    private fun values(range: String): List<List<Any?>>? {
        val parts = range.split('!')
        var rows: List<List<Any?>> = tab(parts[0])
        if (parts.getOrNull(1) == "1:1") rows = rows.take(1)
        val trimmed = rows.map { row ->
            row.take(row.indexOfLast { orNull(it) != null } + 1).map { orNull(it) ?: "" }
        }.toMutableList()
        while (trimmed.isNotEmpty() && trimmed.last().isEmpty()) trimmed.removeAt(trimmed.lastIndex)
        return trimmed.ifEmpty { null }
    }

    private fun valuesBatchUpdate(body: JsonObject): JsonElement {
        val data = body.getValue("data").jsonArray.map { it.jsonObject }
        val ranges = data.map { it.getValue("range").jsonPrimitive.content }
        val scoreLetter = if (scoreColumn < 0) null else columnLetter(scoreColumn)
        if (scoreLetter != null && ranges.any { it.startsWith("$LOG_TITLE!$scoreLetter") }) {
            if (failsScoreWrites) throw Forbidden()
            scoreWrites.add(ranges)
        }
        val userEntered = body["valueInputOption"]?.jsonPrimitive?.content == "USER_ENTERED"
        for (d in data) write(d.getValue("range").jsonPrimitive.content, d.getValue("values"), userEntered)
        return JsonObject(emptyMap())
    }

    /** Writes [values] from the top-left cell of [range], for example `Log!E1`. */
    private fun write(range: String, values: JsonElement, userEntered: Boolean): JsonElement {
        val (title, row, column) = cell(range)
        val rows = tab(title)
        values.jsonArray.forEachIndexed { i, cells ->
            cells.jsonArray.forEachIndexed { j, element ->
                val c = column + j
                if (keepsScores || title != LOG_TITLE || row + i == 0 || c != scoreColumn) {
                    val value = cellOf(element)
                    set(rows, row + i, c, if (userEntered) userEntered(value) else value)
                }
            }
        }
        return JsonObject(emptyMap())
    }

    /** Adds a row after the last row with values. Sheets reads `YYYY-MM-DD` as a date: USER_ENTERED. */
    private fun append(values: JsonElement): JsonElement {
        val row = values(LOG_TITLE)?.size ?: 0
        values.jsonArray.forEachIndexed { j, element -> set(log, row, j, userEntered(cellOf(element))) }
        return JsonObject(emptyMap())
    }

    private fun clear(range: String): JsonElement {
        val (title, row, column) = cell(range)
        set(tab(title), row, column, null)
        return JsonObject(emptyMap())
    }

    private class Forbidden : Exception()

    private companion object {
        fun set(rows: MutableList<MutableList<Any?>>, row: Int, column: Int, value: Any?) {
            while (rows.size <= row) rows.add(mutableListOf())
            val cells = rows[row]
            while (cells.size <= column) cells.add(null)
            cells[column] = value
        }

        /** The tab, the 0-based row and the 0-based column of the top-left cell of [range], for example `Log!E1`. */
        fun cell(range: String): Triple<String, Int, Int> {
            val match = Regex("""^(\w+)!([A-Z]+)(\d+)""").find(range)!!
            val column = match.groupValues[2].fold(0) { n, letter -> n * 26 + (letter - 'A' + 1) }
            return Triple(match.groupValues[1], match.groupValues[3].toInt() - 1, column - 1)
        }

        /** A value as Sheets stores it with USER_ENTERED: a `YYYY-MM-DD` text is a date serial number. */
        fun userEntered(value: Any?): Any? = (value as? String)?.let(Day::tryParse)?.serial?.toDouble() ?: value

        /** Null for an empty cell: null or an empty text. */
        fun orNull(cell: Any?): Any? = if (cell == "") null else cell
    }
}
