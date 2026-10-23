package trackula.sheets

import io.ktor.client.HttpClient
import io.ktor.client.request.parameter
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.content.TextContent
import io.ktor.http.encodeURLPathPart
import io.ktor.http.isSuccess
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** Thrown when the Sheets API answers with an error. Example: HTTP 403 on a view-only sheet. */
class SheetsApiException(val status: Int, message: String) : Exception(message) {
    /** The message only, as the Dart `ApiRequestError`. The app shows this text. */
    override fun toString(): String = message.orEmpty()
}

/**
 * The calls of the Google Sheets API v4 that the app uses, for one spreadsheet. See
 * https://developers.google.com/workspace/sheets/api/reference/rest.
 *
 * [http] must send the access token. Example: a `defaultRequest` with `bearerAuth`. Each call throws a
 * [SheetsApiException] if the API answers with an error.
 */
class SheetsClient(private val http: HttpClient, val spreadsheetId: String) {
    private val base = "https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId.encodeURLPathPart()}"

    /** `spreadsheets.get` with only the [fields]. */
    suspend fun get(fields: String): JsonObject = call(HttpMethod.Get, base, mapOf("fields" to listOf(fields)))

    /** `spreadsheets.batchUpdate`: sends [requests] in one batch. */
    suspend fun batchUpdate(requests: List<JsonObject>): JsonObject = call(
        HttpMethod.Post,
        "$base:batchUpdate",
        body = buildJsonObject { put("requests", JsonArray(requests)) },
    )

    /** `values.batchGet` with unformatted values: the cells of each of [ranges]. Each row omits empty cells at its end. */
    suspend fun batchGet(ranges: List<String>): List<List<List<Any?>>> {
        val response = call(
            HttpMethod.Get,
            "$base/values:batchGet",
            mapOf("ranges" to ranges, "valueRenderOption" to listOf("UNFORMATTED_VALUE")),
        )
        return response.getValue("valueRanges").jsonArray.map { range ->
            range.jsonObject["values"]?.jsonArray?.map { row -> row.jsonArray.map(::cellOf) }.orEmpty()
        }
    }

    /** `values.batchUpdate`: writes each [ValueRange] of [data]. [inputOption] is `RAW` or `USER_ENTERED`. */
    suspend fun batchUpdateValues(inputOption: String, data: List<ValueRange>) {
        call(
            HttpMethod.Post,
            "$base/values:batchUpdate",
            body = buildJsonObject {
                put("valueInputOption", inputOption)
                put("data", JsonArray(data.map { it.toJson() }))
            },
        )
    }

    /** `values.update`: writes [values] from the top-left cell of [range]. */
    suspend fun update(range: String, values: List<List<Any?>>, inputOption: String) {
        call(
            HttpMethod.Put,
            "$base/values/${range.encodeURLPathPart()}",
            mapOf("valueInputOption" to listOf(inputOption)),
            buildJsonObject { put("values", valuesJson(values)) },
        )
    }

    /** `values.append`: adds [values] as new rows after the table of [range]. */
    suspend fun append(range: String, values: List<List<Any?>>, inputOption: String) {
        call(
            HttpMethod.Post,
            "$base/values/${range.encodeURLPathPart()}:append",
            mapOf("valueInputOption" to listOf(inputOption), "insertDataOption" to listOf("INSERT_ROWS")),
            buildJsonObject { put("values", valuesJson(values)) },
        )
    }

    /** `values.clear`: removes the values of [range]. The format and the rules stay. */
    suspend fun clear(range: String) {
        call(HttpMethod.Post, "$base/values/${range.encodeURLPathPart()}:clear", body = JsonObject(emptyMap()))
    }

    private suspend fun call(
        method: HttpMethod,
        url: String,
        parameters: Map<String, List<String>> = emptyMap(),
        body: JsonObject? = null,
    ): JsonObject {
        val response = http.request(url) {
            this.method = method
            for ((name, values) in parameters) values.forEach { parameter(name, it) }
            if (body != null) setBody(TextContent(body.toString(), ContentType.Application.Json))
        }
        val text = response.bodyAsText()
        if (!response.status.isSuccess()) {
            val message = runCatching {
                Json.parseToJsonElement(text).jsonObject["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content
            }.getOrNull()
            throw SheetsApiException(response.status.value, message ?: "HTTP ${response.status}")
        }
        return if (text.isBlank()) JsonObject(emptyMap()) else Json.parseToJsonElement(text).jsonObject
    }
}

/** The values of a range in A1 notation, for [SheetsClient.batchUpdateValues]. */
data class ValueRange(val range: String, val values: List<List<Any?>>) {
    internal fun toJson(): JsonObject = buildJsonObject {
        put("range", range)
        put("values", valuesJson(values))
    }
}

/** A cell of a response, as the model reads it: a [String], a [Double], a [Boolean] or null. */
internal fun cellOf(element: JsonElement): Any? {
    if (element !is JsonPrimitive || element is JsonNull) return null
    return when {
        element.isString -> element.content
        else -> element.booleanOrNull ?: element.doubleOrNull
    }
}

/** The JSON of [cells] for a request. A whole number has no fraction, so the sheet shows 5 and not 5.0. */
internal fun cellJson(cell: Any?): JsonElement = when (cell) {
    null -> JsonNull

    is String -> JsonPrimitive(cell)

    is Boolean -> JsonPrimitive(cell)

    is Number -> {
        val d = cell.toDouble()
        if (d == kotlin.math.floor(d) && kotlin.math.abs(d) < 1e15) JsonPrimitive(d.toLong()) else JsonPrimitive(d)
    }

    else -> JsonPrimitive(cell.toString())
}

private fun valuesJson(values: List<List<Any?>>): JsonArray = buildJsonArray {
    for (row in values) add(JsonArray(row.map(::cellJson)))
}
