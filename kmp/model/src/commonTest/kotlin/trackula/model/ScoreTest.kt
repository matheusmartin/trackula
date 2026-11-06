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

    private val coffee = NumberMetric(
        id = "coffee",
        name = "Coffee",
        icon = "coffee",
        isCount = true,
        goal = NumberGoal(2.0, isMaximum = true),
    )

    @Test
    fun goalProgressYesNoIs1IfTheValueIsTheGoalAnd0WithoutValue() {
        assertEquals(listOf(1.0, 0.0, 0.0), listOf(1.0, 0.0, null).map { goalProgress(meditate, it) })
        assertEquals(listOf(0.0, 1.0, 0.0), listOf(1.0, 0.0, null).map { goalProgress(smoke, it) })
    }

    @Test
    fun goalProgressCountIsThePartOfAnAtLeastGoalAtMost1() {
        assertEquals(listOf(0.5, 1.0, 1.0, 0.0, 0.0), listOf(1.0, 2.0, 3.0, 0.0, -3.0).map { goalProgress(water, it) })
    }

    @Test
    fun goalProgressCountWithAnAtMostGoalIs1IfItReachesTheGoal() {
        assertEquals(listOf(1.0, 1.0, 0.0), listOf(0.0, 2.0, 3.0).map { goalProgress(coffee, it) })
    }

    @Test
    fun goalProgressWithoutGoalIs1ForALoggedValue() {
        assertEquals(listOf(1.0, 0.0, 0.0), listOf(30.0, 0.0, null).map { goalProgress(walk, it) })
        assertEquals(listOf(1.0, 0.0), listOf(90.0, null).map { goalProgress(waist, it) })
    }

    @Test
    fun goalProgressNumberIs1IfTheValueReachesTheGoalOrIsCloserThanThePreviousLogOrIsTheFirstLog() {
        assertEquals(1.0, goalProgress(weight, 80.0, previous = 79.0))
        assertEquals(1.0, goalProgress(weight, 82.6, previous = 83.0))
        assertEquals(0.0, goalProgress(weight, 82.8, previous = 82.6))
        assertEquals(0.0, goalProgress(weight, 82.6, previous = 82.6))
        assertEquals(1.0, goalProgress(weight, 90.0))
        assertEquals(1.0, goalProgress(reading, 15.0, previous = 10.0))
        assertEquals(0.0, goalProgress(reading, 10.0, previous = 15.0))
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
            mapOf(Day(2026, 9, 28) to 100.0, d29 to 100.0, Day(2026, 10, 2) to 0.0, Day(2026, 10, 3) to 100.0),
            dayScores(listOf(weight), log),
        )
    }

    @Test
    fun aChangedPastValueAlsoChangesTheScoreOfTheNextLog() {
        val rows = mutableListOf(
            listOf("date", "weight", "Score"),
            listOf("2026-09-28", 83, 100),
            listOf("2026-09-29", 82.6, 100),
            listOf<Any?>("2026-09-30", 82.4, 100),
        )
        assertEquals(emptyList(), staleScoreCells(rows, listOf(weight), 2))
        rows[2] = listOf("2026-09-29", 82.2, 100)
        assertEquals(listOf(ScoreCell(4, 0.0)), staleScoreCells(rows, listOf(weight), 2))
        rows[2] = listOf("2026-09-29", "", 100)
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
    fun dayScoresIsThePercentOfTheGoalsThatTheDayMeetsAndAMetricWithoutValueCountsAs0() {
        // Sep 30: weight 81 is farther from 80 than 79.5, water and smoke have no value, meditate is no.
        assertEquals(mapOf(d29 to 100.0, d30 to 0.0), dayScores(dayMetrics, dayLog))
    }

    @Test
    fun aMetricCountsFromTheDayOfItsFirstValue() {
        val log = parseLog(
            rows(
                listOf("date", "water", "meditate"),
                listOf("2026-09-28", "", "yes"),
                listOf("2026-09-29", 1, "yes"),
                listOf("2026-09-30", 2, ""),
            ),
            byId(water, meditate),
        ).table
        assertEquals(
            mapOf(Day(2026, 9, 28) to 100.0, d29 to 75.0, d30 to 50.0),
            dayScores(listOf(water, meditate), log),
        )
    }

    @Test
    fun dayScoresGivesNoScoreToADayWithoutAValue() {
        assertFalse(Day(2026, 9, 28) in dayScores(dayMetrics, dayLog))
    }

    @Test
    fun dayScoresHasOneDecimal() {
        val log = parseLog(
            rows(listOf("date", "water", "meditate", "smoke"), listOf("2026-09-29", 2, "yes", "yes")),
            byId(water, meditate, smoke),
        ).table
        assertEquals(mapOf(d29 to 66.7), dayScores(listOf(water, meditate, smoke), log))
    }

    @Test
    fun dayScoresIncludesCountTapsThatAreNotWrittenYet() {
        val pending = mapOf(
            MetricDay("water", d30) to listOf(CountStep(1.0), CountStep(1.0)),
            MetricDay("water", d29) to listOf(CountStep(-1.0)),
        )
        assertEquals(mapOf(d29 to 100.0, d30 to 25.0), dayScores(dayMetrics, dayLog, pending))
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
        assertEquals(mapOf(d29 to 0.0, d30 to 100.0), dayScores(listOf(meditateNo), dayLog))
    }

    @Test
    fun aDayWithMoreThanOneRowCountsOnlyTheLastRowAsForItsScoreCell() {
        val rows = rows(
            listOf("date", "weight", "meditate", "Score"),
            listOf("2026-09-29", 79, "yes", 100),
            listOf("2026-09-29", "", "yes", 100),
        )
        val duplicate = parseLog(rows, byId(*dayMetrics.toTypedArray())).table
        assertEquals(mapOf(d29 to 100.0), dayScores(dayMetrics, duplicate))
        assertEquals(emptyList(), staleScoreCells(rows, dayMetrics, 3))
    }

    @Test
    fun scorePartsAddUpToTheDayScoresAndGroupScorePartsSumThePartsOfEachGroup() {
        val metrics = listOf(
            weight.copy(group = "body"),
            water.copy(group = "habits"),
            meditate.copy(group = "habits"),
            smoke.copy(group = "habits"),
        )
        val parts = scoreParts(metrics, dayLog)
        assertEquals(mapOf(d29 to 25.0, d30 to 0.0), parts["water"])
        val groups = groupScoreParts(metrics, listOf("body", "habits"), parts)
        assertEquals(mapOf(d29 to 25.0, d30 to 0.0), groups["body"])
        assertEquals(mapOf(d29 to 75.0, d30 to 0.0), groups["habits"])
        val sums = groups.getValue("body").mapValues { (d, v) -> v + groups.getValue("habits").getValue(d) }
        assertEquals(dayScores(metrics, dayLog), sums)
    }

    @Test
    fun dayScoresOfTheMetricsOfAGroupArePercentsOfTheGoalsOfThatGroup() {
        val metrics = listOf(weight.copy(group = "body"), water.copy(group = "habits"), meditate.copy(group = "habits"))
        assertEquals(mapOf(d29 to 100.0, d30 to 0.0), dayScores(metricsOf(metrics, "habits"), dayLog))
    }

    @Test
    fun staleScoreCellsFindsTheScoreCellsThatDoNotShowTheScoreOfTheirRow() {
        val cells = staleScoreCells(
            rows(
                listOf("date", "water", "meditate", "Score"),
                listOf("2026-09-27", 3, "yes", 4),
                listOf("2026-09-28", 3, "yes", 100),
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
                ScoreCell(2, 100.0),
                ScoreCell(4, 50.0),
                ScoreCell(5, null),
                ScoreCell(6, 0.0),
                ScoreCell(7, 25.0),
                ScoreCell(8, null),
            ),
            cells,
        )
    }

    @Test
    fun aPastValueOrAGoalChangeInTheSheetMakesTheScoreStale() {
        val metrics = listOf(water, meditate)
        val header = listOf("date", "water", "meditate", "Score")
        val rows = rows(header, listOf("2026-09-29", 3, "yes", 100))
        assertEquals(emptyList(), staleScoreCells(rows, metrics, 3))

        val edited = rows(header, listOf("2026-09-29", 3, "no", 100))
        assertEquals(listOf(ScoreCell(2, 50.0)), staleScoreCells(edited, metrics, 3))

        assertEquals(listOf(ScoreCell(2, 50.0)), staleScoreCells(rows, listOf(water, meditateNo), 3))
    }

    @Test
    fun staleScoreCellsReplacesAScoreStoredAsTextWithTheNumber() {
        assertEquals(
            listOf(ScoreCell(2, 100.0)),
            staleScoreCells(
                rows(listOf("date", "water", "Score"), listOf("2026-09-29", 3, "100"), listOf("2026-09-30", "", " ")),
                listOf(water, meditate),
                2,
            ),
        )
    }

    @Test
    fun staleScoreCellsReplacesACheckboxValueWithTheScore() {
        assertEquals(
            listOf(ScoreCell(2, null), ScoreCell(3, 100.0)),
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
    fun groupScoreMetricIsAScoreWithTheGroupInItsIdAndName() {
        val habits = groupScoreMetric("habits", "Habits")
        assertEquals("Score:habits" to "Goals met · Habits", habits.id to habits.name)
        assertTrue(isScore(habits))
        assertEquals(scoreMetric.unit to scoreMetric.isCount, habits.unit to habits.isCount)
    }

    @Test
    fun scoreMetricHasNoIcon() {
        assertTrue(scoreMetric.icon.isEmpty())
    }
}
