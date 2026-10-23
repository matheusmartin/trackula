package trackula.sheets

import kotlinx.coroutines.test.runTest
import trackula.model.CountStep
import trackula.model.Day
import trackula.model.LOG_TITLE
import trackula.model.NumberMetric
import trackula.model.YesNoMetric
import trackula.model.metricsHeader
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
            mutableListOf("weight", "Weight", "number", "kg", 0.1, "body", "monitor_weight", "<= 80"),
            mutableListOf("meditate", "Meditate", "yesno", "", "", "habits", "self_improvement", "yes"),
            mutableListOf("water", "Water", "count", "glasses", 1, "habits", "water_drop", 8),
        ),
        log = mutableListOf(
            mutableListOf("date", "weight", "meditate", "water"),
            // 1 (weight <= 80) + 1 (yes) + 3 (3 glasses) = 5.
            mutableListOf(d1.serial, 79.5, "yes", 3),
            // 0 + 0 = 0.
            mutableListOf(d2.serial, 82, "no"),
            // No value: no score.
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
        assertEquals(listOf(5.0, 0.0, null), fake.logColumn("Score"))
        assertEquals(5, fake.columnCounts[LOG_TITLE])
        // Only the new Score column gets a rule when the app adds it.
        assertEquals(listOf("E"), fake.numberRuleColumns)
        // The Score column is not a metric.
        assertEquals(listOf("weight", "meditate", "water"), snapshot.log.columns.keys.toList())
        assertEquals(1, fake.scoreWrites.size)
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
    fun writesOnlyTheStaleScoreCellsAndClearsTheScoreOfARowWithoutValues() = runTest {
        val fake = sheetWithoutScore()
        fake.log[0].add("Score")
        fake.log[1].add(5)
        fake.log[2].addAll(listOf(null, 7))
        fake.log[3].addAll(listOf(null, null, null, 4))
        fake.columnCounts[LOG_TITLE] = 5

        fake.store.load()
        assertEquals(listOf(listOf("Log!E3", "Log!E4")), fake.scoreWrites)
        assertEquals(listOf(5.0, 0.0, null), fake.logColumn("Score"))
    }

    @Test
    fun afterAGoalChangeInTheMetricsTabTheNextLoadWritesTheNewScores() = runTest {
        val fake = sheetWithoutScore()
        fake.store.load()
        fake.scoreWrites.clear()

        // Goal `no` for meditate: row 2 loses 1 point, row 3 gets 1 point.
        fake.metrics[2][7] = "no"
        fake.store.load()
        assertEquals(listOf(4.0, 1.0, null), fake.logColumn("Score"))
        assertEquals(listOf(listOf("Log!E2", "Log!E3")), fake.scoreWrites)

        // A maximum of 85 for weight: 82 kg reaches it.
        fake.metrics[1][7] = "<= 85"
        fake.store.load()
        assertEquals(listOf(4.0, 2.0, null), fake.logColumn("Score"))

        // No goal for weight: no points.
        fake.metrics[1][7] = ""
        fake.store.load()
        assertEquals(listOf(3.0, 1.0, null), fake.logColumn("Score"))
    }

    @Test
    fun afterAChangeOfAPastValueInTheSheetTheNextLoadWritesOnlyThatScore() = runTest {
        val fake = sheetWithoutScore()
        fake.store.load()
        fake.scoreWrites.clear()

        fake.log[1][3] = 6
        fake.store.load()
        assertEquals(listOf(listOf("Log!E2")), fake.scoreWrites)
        assertEquals(listOf(8.0, 0.0, null), fake.logColumn("Score"))
    }

    @Test
    fun aDeletedMetricRowOrAnInvalidGoalRemovesThePointsOfThatMetric() = runTest {
        val fake = sheetWithoutScore()
        fake.store.load()

        fake.metrics[3][7] = "lots"
        val snapshot = fake.store.load()
        assertTrue("invalid goal" in snapshot.warnings.single())
        assertEquals(listOf(2.0, 0.0, null), fake.logColumn("Score"))
    }

    @Test
    fun aWriteInTheAppAlsoWritesTheScoreOfItsRow() = runTest {
        val fake = sheetWithoutScore()
        val water = fake.metric("water") as NumberMetric

        // A new row for d3 + 1 day.
        val d4 = Day(2026, 10, 2)
        val snapshot = fake.store.change { planCount(water, d4, listOf(CountStep(1.0), CountStep(1.0)), it) }
        assertEquals(2.0, snapshot.log.valueAt("water", d4))
        assertEquals(listOf(5.0, 0.0, null, 2.0), fake.logColumn("Score"))

        // A change in a past row.
        fake.store.change { planCount(water, d2, listOf(CountStep(1.0)), it) }
        assertEquals(listOf(5.0, 1.0, null, 2.0), fake.logColumn("Score"))
    }

    @Test
    fun aSheetWithoutTheGoalColumnGetsScoresWithTheDefaultGoals() = runTest {
        val fake = sheetWithoutScore()
        for (row in fake.metrics) row.removeAt(row.lastIndex)
        fake.store.load()
        // Weight has no goal (0), meditate has the goal yes, water is a count.
        assertEquals(listOf(4.0, 0.0, null), fake.logColumn("Score"))
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
        assertEquals(listOf(5.0, 0.0, 3.0), fake.logColumn("Score"))
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
        assertEquals(listOf(5.0, 4.0, null), fake.logColumn("Score"))
    }

    @Test
    fun aFailedScoreWriteGivesAWarningAndDoesNotStopTheLoadOrTheChange() = runTest {
        val fake = sheetWithoutScore()
        val water = fake.metric("water") as NumberMetric
        fake.failsScoreWrites = true

        val snapshot = fake.store.change { planCount(water, d1, listOf(CountStep(1.0)), it) }
        assertEquals(4.0, snapshot.log.valueAt("water", d1))
        assertTrue("could not write 1 scores" in snapshot.warnings.single())
        assertTrue("The caller does not have permission" in snapshot.warnings.single())
        assertEquals(listOf(5.0, 0.0, null), fake.logColumn("Score"))

        // The next load tries again.
        fake.failsScoreWrites = false
        val next = fake.store.load()
        assertEquals(emptyList(), next.warnings)
        assertEquals(listOf(6.0, 0.0, null), fake.logColumn("Score"))
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
