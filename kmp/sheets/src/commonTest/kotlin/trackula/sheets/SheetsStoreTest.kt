package trackula.sheets

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import trackula.model.CountStep
import trackula.model.Day
import trackula.model.LOG_TITLE
import trackula.model.METRICS_TITLE
import trackula.model.NumberMetric
import trackula.model.YesNoMetric
import trackula.model.metricsHeader
import trackula.model.parseMetrics
import trackula.model.planCount
import trackula.model.planYesNo
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SheetsStoreTest {
    private val d1 = Day(2026, 9, 29)
    private val d2 = Day(2026, 9, 30)
    private val d3 = Day(2026, 10, 1)

    /** A sheet with goals and a `Log` tab without the `Score` column. The `Log` tab has no free column. */
    private fun sheetWithoutScore() = FakeSheets(
        metrics = mutableListOf(
            metricsHeader.toMutableList(),
            mutableListOf("weight", "Weight", "number", "kg", 0.1, "body", "monitor_weight", "at most 80"),
            mutableListOf("meditate", "Meditate", "yesno", "", "", "habits", "self_improvement", "yes"),
            mutableListOf("water", "Water", "count", "glasses", 1, "habits", "water_drop", 4),
        ),
        log = mutableListOf(
            mutableListOf("date", "weight", "meditate", "water"),
            // Weight 1 (at most 80), meditate 1 (yes), water 0.5 (2 of 4): 2.5 / 3 = 83.3.
            mutableListOf(d1.serial, 79.5, "yes", 2),
            // Weight 0, meditate 0, water 0 (no value after the first value): 0.
            mutableListOf(d2.serial, 82, "no"),
            // Only a date: meditate 0 and water 0. Weight has no value, so it does not count: 0.
            mutableListOf(d3.serial),
        ),
        logColumns = 4,
    )

    private suspend fun FakeSheets.metric(id: String) = store.load().metrics.first { it.id == id }

    @Test
    fun addsAMissingScoreColumnWithItsRuleAndWritesTheScores() = runTest {
        val fake = sheetWithoutScore()
        val snapshot = fake.store.load()

        assertEquals(emptyList(), snapshot.warnings)
        assertEquals(listOf<Any?>("date", "weight", "meditate", "water", "Score"), fake.log[0])
        assertEquals(listOf(83.3, 0.0, 0.0), fake.logColumn("Score"))
        assertEquals(5, fake.columnCounts[LOG_TITLE])
        // Only the new Score column gets a rule when the app adds it.
        assertEquals(listOf("E"), fake.numberRuleColumns)
        // The Score column is not a metric.
        assertEquals(listOf("weight", "meditate", "water"), snapshot.log.columns.keys.toList())
        assertEquals(1, fake.scoreWrites.size)
    }

    @Test
    fun theLoadGivesTheMetricRowsAndTheLogColumnsOfDeletedMetrics() = runTest {
        val fake = sheetWithoutScore()
        fake.metrics.removeAt(2)
        val snapshot = fake.store.load()

        assertEquals(mapOf("weight" to 2, "water" to 3), snapshot.metricsTable.rows)
        val meditate = snapshot.deleted.single()
        assertEquals("meditate", meditate.id)
        assertEquals(2, meditate.values)
        assertEquals(d2, meditate.lastDay)
        assertTrue(meditate.isYesNo)
    }

    @Test
    fun theGoalRuleAcceptsTheSameGoalsAsTheParser() {
        val rule = Regex(goalRulePattern)
        val goals = listOf(
            "yes", "No", "8", "-5", "at least 8", "At  Most 2 from 4", ">= 7 from 5", "<=75.5",
            "at most 80 from 83.5 trend", "maybe", "< 75", "trend", "at least", "8 from", "at most 80 trend from 83",
            "8.", "at least 8 trends",
        )
        for (goal in goals) {
            val parsed = listOf("yesno", "number").any { kind ->
                parseMetrics(
                    listOf(metricsHeader, listOf("x", "X", kind, "", "", "", "check", goal)),
                ).items.isNotEmpty()
            }
            assertEquals(parsed, rule.matches(goal.lowercase()), goal)
        }
    }

    @Test
    fun aSecondLoadWritesNothing() = runTest {
        val fake = sheetWithoutScore()
        fake.store.load()
        fake.calls.clear()
        fake.scoreWrites.clear()

        fake.store.load()
        assertEquals(emptyList(), fake.scoreWrites)
        assertEquals(listOf("GET values:batchGet"), fake.calls)
    }

    @Test
    fun writesOnlyTheStaleScoreCellsAndClearsTheScoreOfARowBeforeTheFirstValue() = runTest {
        val fake = sheetWithoutScore()
        fake.log[0].add("Score")
        fake.log[1].add(83.3)
        fake.log[2].addAll(listOf(null, 7))
        fake.log[3].addAll(listOf(null, null, null, 0))
        fake.log.add(mutableListOf(Day(2026, 9, 28).serial, null, null, null, 4))
        fake.columnCounts[LOG_TITLE] = 5

        fake.store.load()
        assertEquals(listOf(listOf("Log!E3", "Log!E5")), fake.scoreWrites)
        assertEquals(listOf(83.3, 0.0, 0.0, null), fake.logColumn("Score"))
    }

    @Test
    fun afterAGoalChangeInTheMetricsTabTheNextLoadWritesTheNewScores() = runTest {
        val fake = sheetWithoutScore()
        fake.store.load()
        fake.scoreWrites.clear()

        // Goal `no` for meditate: row 2 loses 1 point, rows 3 and 4 get 1 point. Row 4 has no value: a no day.
        fake.metrics[2][7] = "no"
        fake.store.load()
        assertEquals(listOf(50.0, 33.3, 50.0), fake.logColumn("Score"))
        assertEquals(listOf(listOf("Log!E2", "Log!E3", "Log!E4")), fake.scoreWrites)

        // A maximum of 85 for weight: 82 kg reaches it.
        fake.metrics[1][7] = "<= 85"
        fake.store.load()
        assertEquals(listOf(50.0, 66.7, 50.0), fake.logColumn("Score"))

        // From 85 to 80: 82 kg is 0.6 of the way.
        fake.metrics[1][7] = "at most 80 from 85"
        fake.store.load()
        assertEquals(listOf(50.0, 53.3, 50.0), fake.logColumn("Score"))

        // No goal for weight: it does not count.
        fake.metrics[1][7] = ""
        fake.store.load()
        assertEquals(listOf(25.0, 50.0, 50.0), fake.logColumn("Score"))
    }

    @Test
    fun afterAChangeOfAPastValueInTheSheetTheNextLoadWritesOnlyThatScore() = runTest {
        val fake = sheetWithoutScore()
        fake.store.load()
        fake.scoreWrites.clear()

        fake.log[1][3] = 6
        fake.store.load()
        assertEquals(listOf(listOf("Log!E2")), fake.scoreWrites)
        assertEquals(listOf(100.0, 0.0, 0.0), fake.logColumn("Score"))
    }

    @Test
    fun aDeletedMetricRowOrAnInvalidGoalRemovesThePointsOfThatMetric() = runTest {
        val fake = sheetWithoutScore()
        fake.store.load()

        fake.metrics[3][7] = "lots"
        val snapshot = fake.store.load()
        assertTrue("invalid goal" in snapshot.warnings.single())
        assertEquals(listOf(100.0, 0.0, 0.0), fake.logColumn("Score"))
    }

    @Test
    fun aWriteInTheAppAlsoWritesTheScoreOfItsRow() = runTest {
        val fake = sheetWithoutScore()
        val water = fake.metric("water") as NumberMetric

        // A new row for d3 + 1 day.
        val d4 = Day(2026, 10, 2)
        val snapshot = fake.store.change { planCount(water, d4, listOf(CountStep(1.0), CountStep(1.0)), it) }
        assertEquals(2.0, snapshot.log.valueAt("water", d4))
        // Meditate 0 and water 0.5: 25.
        assertEquals(listOf(83.3, 0.0, 0.0, 25.0), fake.logColumn("Score"))

        // A change in a past row.
        fake.store.change { planCount(water, d2, listOf(CountStep(1.0)), it) }
        assertEquals(listOf(83.3, 8.3, 0.0, 25.0), fake.logColumn("Score"))
    }

    @Test
    fun aSheetWithoutTheGoalColumnGetsScoresWithTheDefaultGoals() = runTest {
        val fake = sheetWithoutScore()
        for (row in fake.metrics) row.removeAt(row.lastIndex)
        fake.store.load()
        // Weight and water have no goal: they do not count. Meditate has the goal yes.
        assertEquals(listOf(100.0, 0.0, 0.0), fake.logColumn("Score"))
    }

    @Test
    fun aLogTabWithOnlyTheDateHeaderGetsTheMetricColumnsAndTheScoreColumnInOneChange() = runTest {
        val fake = sheetWithoutScore()
        fake.log.clear()
        fake.log.add(mutableListOf("date"))
        fake.columnCounts[LOG_TITLE] = 26
        fake.store.load()
        assertEquals(listOf<Any?>("date", "weight", "meditate", "water", "Score"), fake.log[0])
        // Weight (B), water (D) and Score (E). Meditate (C) gets the yes / no dropdown.
        assertEquals(listOf("B", "D", "E"), fake.numberRuleColumns)
        assertEquals(1, fake.calls.count { it == "PUT Log!B1" })
        assertEquals(emptyList(), fake.scoreWrites)
    }

    @Test
    fun refreshRulesGivesTheScoreColumnTheNumberRule() = runTest {
        val fake = sheetWithoutScore()
        fake.store.load()
        fake.numberRuleColumns.clear()

        fake.store.refreshRules()
        assertEquals(listOf("B", "D", "E"), fake.numberRuleColumns)
    }

    @Test
    fun changeAllWritesTheScoresOnceAfterTheLastWrite() = runTest {
        val fake = sheetWithoutScore()
        val water = fake.metric("water") as NumberMetric
        val meditate = fake.metric("meditate") as YesNoMetric
        fake.scoreWrites.clear()

        fake.store.changeAll(
            listOf(
                { planCount(water, d3, listOf(CountStep(2.0)), it) },
                { planYesNo(meditate, d3, it, done = true) },
            ),
        )
        assertEquals(listOf(listOf("Log!E4")), fake.scoreWrites)
        // Meditate 1 and water 0.5: 75.
        assertEquals(listOf(83.3, 0.0, 75.0), fake.logColumn("Score"))
    }

    @Test
    fun changeAllWritesTheScoresAlsoIfItsLastPlanWritesNothing() = runTest {
        val fake = sheetWithoutScore()
        val water = fake.metric("water") as NumberMetric
        val meditate = fake.metric("meditate") as YesNoMetric

        fake.store.changeAll(
            listOf(
                { planCount(water, d2, listOf(CountStep(4.0)), it) },
                // Row 3 has `no` already: no write.
                { planYesNo(meditate, d2, it, done = false) },
            ),
        )
        assertEquals(listOf(83.3, 33.3, 0.0), fake.logColumn("Score"))
    }

    @Test
    fun aFailedScoreWriteGivesAWarningAndDoesNotStopTheLoadOrTheChange() = runTest {
        val fake = sheetWithoutScore()
        val water = fake.metric("water") as NumberMetric
        fake.failsScoreWrites = true

        val snapshot = fake.store.change { planCount(water, d1, listOf(CountStep(1.0)), it) }
        assertEquals(3.0, snapshot.log.valueAt("water", d1))
        assertTrue("could not write 1 scores" in snapshot.warnings.single())
        assertTrue("The caller does not have permission" in snapshot.warnings.single())
        assertEquals(listOf(83.3, 0.0, 0.0), fake.logColumn("Score"))

        // The next load tries again.
        fake.failsScoreWrites = false
        val next = fake.store.load()
        assertEquals(emptyList(), next.warnings)
        assertEquals(listOf(91.7, 0.0, 0.0), fake.logColumn("Score"))
    }

    @Test
    fun noEndlessLoopIfTheScoreCellsDoNotKeepTheWrittenValues() = runTest {
        val fake = sheetWithoutScore()
        fake.keepsScores = false
        fake.store.load()
        assertEquals(1, fake.scoreWrites.size)

        // Each load writes the scores again, but only once.
        fake.scoreWrites.clear()
        fake.store.load()
        assertEquals(1, fake.scoreWrites.size)
        assertEquals(listOf<Double?>(null, null, null), fake.logColumn("Score"))
    }
}

/**
 * The JSON of the `:batchUpdate` requests, field by field. The Dart app used the typed classes of the googleapis
 * package. The Kotlin code writes the JSON itself, so these tests find a wrong field name before the real API does.
 * The expected JSON is in the form of the Sheets API v4 reference.
 */
class SheetsRequestsTest {
    private fun json(text: String) = Json.parseToJsonElement(text)

    /** The rule of [column] of the tab [tabId] with [condition]. */
    private fun rule(tabId: Int, column: Int, condition: String) = """
        {"setDataValidation": {
            "range": {"sheetId": $tabId, "startRowIndex": 1, "startColumnIndex": $column, "endColumnIndex": ${column + 1}},
            "rule": {"condition": $condition, "strict": true, "showCustomUi": true}}}
    """

    private fun formula(formula: String) =
        """{"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": ${Json.encodeToString(formula)}}]}"""

    private val metricsRules = listOf(
        rule(
            1,
            2,
            """{"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "yesno"}, {"userEnteredValue": "number"},
            {"userEnteredValue": "count"}]}""",
        ),
        rule(1, 6, formula("""=OR(REGEXMATCH(G2, "^[a-z0-9_]+$"), LEN(G2) <= 16)""")),
        rule(
            1,
            7,
            formula(
                "=OR(ISNUMBER(H2), REGEXMATCH(LOWER(TO_TEXT(H2)), \"^ *(yes|no|(at +least|at +most|<=|>=)? *" +
                    "-?[0-9]+([.][0-9]+)?( +from +-?[0-9]+([.][0-9]+)?)?( +trend)?) *$\"))",
            ),
        ),
    )

    private val dateRules = listOf(
        """{"repeatCell": {
            "range": {"sheetId": 2, "startRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": 1},
            "cell": {"userEnteredFormat": {"numberFormat": {"type": "DATE", "pattern": "yyyy-mm-dd"}}},
            "fields": "userEnteredFormat.numberFormat"}}""",
        rule(2, 0, """{"type": "DATE_IS_VALID"}"""),
    )

    @Test
    fun ensureTabsAddsBothTabsWithTheirHeadersAndRules() = runTest {
        val fake = FakeSheets(mutableListOf(), mutableListOf(), logColumns = 26, tabs = mutableSetOf())
        fake.store.ensureTabs()

        val addSheet = { title: String ->
            """{"addSheet": {"properties": {"title": "$title", "gridProperties": {"frozenRowCount": 1}}}}"""
        }
        assertEquals(
            (listOf(addSheet(METRICS_TITLE), addSheet(LOG_TITLE)) + metricsRules + dateRules).map(::json),
            fake.requests,
        )
        assertEquals<List<Any?>>(metricsHeader, fake.metrics[0])
        assertEquals(4, fake.metrics.size)
        assertEquals(listOf<Any?>("date"), fake.log.single())

        // The new tabs load without warnings, and the load adds the metric columns and the Score column.
        assertEquals(emptyList(), fake.store.load().warnings)
        assertEquals(listOf<Any?>("date", "weight", "meditate", "water", "Score"), fake.log[0])
    }

    @Test
    fun ensureTabsChangesNothingIfBothTabsAreThere() = runTest {
        val fake = FakeSheets(mutableListOf(), mutableListOf(), logColumns = 26)
        fake.store.ensureTabs()
        assertEquals(emptyList(), fake.requests)
        assertEquals(listOf("GET "), fake.calls)
    }

    @Test
    fun refreshRulesSendsTheRulesOfBothTabs() = runTest {
        val fake = FakeSheets(
            metrics = mutableListOf(
                metricsHeader.toMutableList(),
                mutableListOf("weight", "Weight", "number", "kg", 0.1, "body", "monitor_weight", "<= 80"),
                mutableListOf("meditate", "Meditate", "yesno", "", "", "habits", "self_improvement", "yes"),
            ),
            log = mutableListOf(mutableListOf("date", "meditate", "weight", "gone", "Score")),
            logColumns = 5,
        )
        fake.store.refreshRules()

        val clearRules = """{"setDataValidation": {"range": {"sheetId": 1, "startRowIndex": 1}}}"""
        val yesNo = """{"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "yes"}, {"userEnteredValue": "no"}]}"""
        assertEquals(
            (
                listOf(clearRules) + metricsRules + dateRules +
                    listOf(
                        rule(2, 1, yesNo),
                        rule(2, 2, formula("=ISNUMBER(C2)")),
                        // Column D has no metric: no rule.
                        rule(2, 4, formula("=ISNUMBER(E2)")),
                    )
                ).map(::json),
            fake.requests,
        )
    }

    @Test
    fun aNewColumnAppendsTheDimensionThatTheLogTabNeeds() = runTest {
        val fake = FakeSheets(
            metrics = mutableListOf(
                metricsHeader.toMutableList(),
                mutableListOf("water", "Water", "count", "glasses", 1, "habits", "water_drop", 8),
            ),
            log = mutableListOf(mutableListOf("date")),
            logColumns = 1,
        )
        fake.store.load()

        assertEquals(
            listOf(
                """{"appendDimension": {"sheetId": 2, "dimension": "COLUMNS", "length": 2}}""",
                rule(2, 1, formula("=ISNUMBER(B2)")),
                rule(2, 2, formula("=ISNUMBER(C2)")),
            ).map(::json),
            fake.requests,
        )
    }
}
