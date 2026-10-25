package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScoreTest {
    private val weight = NumberMetric(
        id = "weight",
        name = "Weight",
        icon = "monitor_weight",
        unit = "kg",
        step = 0.1,
        goal = NumberGoal(80.0, isMaximum = true),
    )
    private val reading = NumberMetric(id = "reading", name = "Reading", icon = "menu_book", goal = NumberGoal(20.0))
    private val waist = NumberMetric(id = "waist", name = "Waist", icon = "straighten")
    private val water =
        NumberMetric(id = "water", name = "Water", icon = "water_drop", isCount = true, goal = NumberGoal(2.0))
    private val walk = NumberMetric(id = "walk", name = "Walk", icon = "directions_walk", isCount = true, step = 10.0)
    private val smoke = YesNoMetric(id = "smoke", name = "Smoke", icon = "smoking_rooms", goalIsYes = false)
    private val meditateNo = meditate.copy(goalIsYes = false)
    private val d29 = Day(2026, 9, 29)
    private val d30 = Day(2026, 9, 30)

    @Test
    fun metricPointsYesNoGives1IfTheValueIsTheGoal() {
        assertEquals(1.0, metricPoints(meditate, 1.0))
        assertEquals(0.0, metricPoints(meditate, 0.0))
        assertEquals(1.0, metricPoints(smoke, 0.0))
        assertEquals(0.0, metricPoints(smoke, 1.0))
    }

    @Test
    fun metricPointsCountGives1ForEachStepAlsoAboveTheGoalAndA0ForAValueBelow0() {
        assertEquals(3.0, metricPoints(water, 3.0))
        assertEquals(3.0, metricPoints(walk, 30.0))
        assertEquals(0.0, metricPoints(water, -3.0))
    }

    @Test
    fun metricPointsNumberGives1IfTheValueReachesTheGoalAlsoAfterAValueAtTheGoal() {
        assertEquals(1.0, metricPoints(weight, 80.0, previous = 79.0))
        assertEquals(1.0, metricPoints(weight, 79.5, previous = 79.5))
        assertEquals(1.0, metricPoints(reading, 25.0, previous = 30.0))
    }

    @Test
    fun metricPointsNumberGives1IfTheValueIsCloserToTheGoalThanThePreviousLogElse0() {
        assertEquals(1.0, metricPoints(weight, 82.6, previous = 83.0))
        assertEquals(0.0, metricPoints(weight, 82.8, previous = 82.6))
        assertEquals(0.0, metricPoints(weight, 82.6, previous = 82.6))
        assertEquals(1.0, metricPoints(reading, 15.0, previous = 10.0))
        assertEquals(0.0, metricPoints(reading, 10.0, previous = 15.0))
    }

    @Test
    fun metricPointsNumberGives1ForTheFirstLogAndAlways0WithoutGoal() {
        assertEquals(1.0, metricPoints(weight, 90.0))
        assertEquals(0.0, metricPoints(waist, 90.0))
        assertEquals(0.0, metricPoints(waist, 89.0, previous = 90.0))
    }

    @Test
    fun thePreviousLogIsTheLatestEarlierDayWithAValueAlsoAfterMissedDaysAndInUnsortedRows() {
        val log = parseLog(
            rows(
                listOf("date", "weight"),
                listOf("2026-10-02", 82.8),
                listOf("2026-09-28", 83),
                listOf("2026-10-03", 79.9),
                listOf("2026-09-29", 82.6),
                // 2026-09-30 and 2026-10-01 are missed. 2026-10-02 compares with 2026-09-29.
            ),
            byId(weight),
        ).table
        assertEquals(
            mapOf(Day(2026, 9, 28) to 1.0, d29 to 1.0, Day(2026, 10, 2) to 0.0, Day(2026, 10, 3) to 1.0),
            dayScores(listOf(weight), log),
        )
    }

    @Test
    fun aChangedPastValueAlsoChangesTheScoreOfTheNextLog() {
        val rows = mutableListOf(
            listOf("date", "weight", "Score"),
            listOf("2026-09-28", 83, 1),
            listOf("2026-09-29", 82.6, 1),
            listOf<Any?>("2026-09-30", 82.4, 1),
        )
        assertEquals(emptyList(), staleScoreCells(rows, listOf(weight), 2))
        rows[2] = listOf("2026-09-29", 82.2, 1)
        assertEquals(listOf(ScoreCell(4, 0.0)), staleScoreCells(rows, listOf(weight), 2))
        rows[2] = listOf("2026-09-29", "", 1)
        assertEquals(listOf(ScoreCell(3, null)), staleScoreCells(rows, listOf(weight), 2))
    }

    private val dayMetrics = listOf(weight, water, meditate, smoke)
    private val dayLog = parseLog(
        rows(
            listOf("date", "weight", "water", "meditate", "smoke"),
            listOf("2026-09-29", 79.5, 3, "yes", "no"),
            listOf("2026-09-30", 81, "", "no"),
        ),
        byId(*dayMetrics.toTypedArray()),
    ).table

    @Test
    fun dayScoresAddsThePointsOfAllMetricsOfEachDay() {
        assertEquals(mapOf(d29 to 6.0, d30 to 0.0), dayScores(dayMetrics, dayLog))
    }

    @Test
    fun dayScoresGivesNoScoreToADayWithoutAValue() {
        assertFalse(Day(2026, 9, 28) in dayScores(dayMetrics, dayLog))
    }

    @Test
    fun dayScoresIncludesCountTapsThatAreNotWrittenYet() {
        val pending = mapOf(
            MetricDay("water", d30) to listOf(CountStep(1.0), CountStep(1.0)),
            MetricDay("water", d29) to listOf(CountStep(-1.0)),
        )
        assertEquals(mapOf(d29 to 5.0, d30 to 2.0), dayScores(dayMetrics, dayLog, pending))
    }

    @Test
    fun dayScoresIgnoresTapsOnAYesNoMetricAndRemovesADayThatTheTapsEmpty() {
        val pending = mapOf(
            MetricDay("meditate", d30) to listOf(CountStep(1.0)),
            MetricDay("water", d29) to listOf(CountStep(-3.0)),
        )
        val log = parseLog(rows(listOf("date", "water"), listOf("2026-09-29", 3)), byId(water, meditate)).table
        assertEquals(emptyMap(), dayScores(listOf(water, meditate), log, pending))
    }

    @Test
    fun aGoalChangeChangesTheScore() {
        assertEquals(mapOf(d29 to 0.0, d30 to 1.0), dayScores(listOf(meditateNo), dayLog))
    }

    @Test
    fun aDayWithMoreThanOneRowCountsOnlyTheLastRowAsForItsScoreCell() {
        val duplicate = parseLog(
            rows(
                listOf("date", "weight", "meditate"),
                listOf("2026-09-29", 79, "yes"),
                listOf("2026-09-29", "", "yes"),
            ),
            byId(*dayMetrics.toTypedArray()),
        ).table
        assertEquals(mapOf(d29 to 1.0), dayScores(dayMetrics, duplicate))
    }

    @Test
    fun dayScoresRemovesFloatNoiseOfDecimalSteps() {
        val sips = NumberMetric(id = "water", name = "Sips", icon = "water_drop", isCount = true, step = 0.1)
        val sipLog = parseLog(rows(listOf("date", "water"), listOf("2026-09-29", 0.3)), byId(sips)).table
        assertEquals(mapOf(d29 to 3.0), dayScores(listOf(sips), sipLog))
    }

    @Test
    fun staleScoreCellsFindsTheScoreCellsThatDoNotShowTheScoreOfTheirRow() {
        val cells = staleScoreCells(
            rows(
                listOf("date", "water", "meditate", "Score"),
                listOf("2026-09-27", 3, "yes", 4),
                listOf("2026-09-28", 3, "yes", 3),
                listOf("2026-09-29", 2, "no"),
                listOf("2026-09-30", "", "", 5),
                listOf("2026-10-01", "", "no", ""),
                listOf("2026-10-02", 1, "", "x"),
                listOf("bad date", 1, "yes", 2),
                listOf("2026-10-03"),
            ),
            listOf(water, meditate),
            3,
        )
        assertEquals(
            listOf(
                ScoreCell(3, 4.0),
                ScoreCell(4, 2.0),
                ScoreCell(5, null),
                ScoreCell(6, 0.0),
                ScoreCell(7, 1.0),
                ScoreCell(8, null),
            ),
            cells,
        )
    }

    @Test
    fun aPastValueOrAGoalChangeInTheSheetMakesTheScoreStale() {
        val metrics = listOf(water, meditate)
        val header = listOf("date", "water", "meditate", "Score")
        val rows = rows(header, listOf("2026-09-29", 3, "yes", 4))
        assertEquals(emptyList(), staleScoreCells(rows, metrics, 3))

        val edited = rows(header, listOf("2026-09-29", 5, "yes", 4))
        assertEquals(listOf(ScoreCell(2, 6.0)), staleScoreCells(edited, metrics, 3))

        assertEquals(listOf(ScoreCell(2, 3.0)), staleScoreCells(rows, listOf(water, meditateNo), 3))
    }

    @Test
    fun staleScoreCellsReplacesAScoreStoredAsTextWithTheNumber() {
        assertEquals(
            listOf(ScoreCell(2, 3.0)),
            staleScoreCells(
                rows(listOf("date", "water", "Score"), listOf("2026-09-29", 3, "3"), listOf("2026-09-30", "", " ")),
                listOf(water, meditate),
                2,
            ),
        )
    }

    @Test
    fun staleScoreCellsReplacesACheckboxValueWithTheScore() {
        assertEquals(
            listOf(ScoreCell(2, null), ScoreCell(3, 3.0)),
            staleScoreCells(
                rows(listOf("date", "water", "Score"), listOf("2026-09-29", "", false), listOf("2026-09-30", 3, true)),
                listOf(water),
                2,
            ),
        )
    }

    @Test
    fun scoreColumnFindsTheScoreHeaderNotAMetricId() {
        assertEquals(2, scoreColumn(listOf("date", "score", " Score ")))
        assertNull(scoreColumn(listOf("date", "water")))
    }

    @Test
    fun scoreMetricIsNotAValidMetricIdSoNoMetricCanBeTheScore() {
        val p = parseMetrics(rows(metricsHeader, listOf(SCORE_HEADER, "Score", "count", "", "", "", "star")))
        assertEquals(emptyList(), p.items)
        assertTrue(isScore(scoreMetric))
        assertFalse(isScore(water))
    }

    @Test
    fun scoreMetricHasNoIcon() {
        assertTrue(scoreMetric.icon.isEmpty())
    }
}
