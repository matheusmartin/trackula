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
        goal = NumberGoal(80.0, isMaximum = true, from = 83.0),
    )
    private val weightTrend = weight.copy(goal = NumberGoal(80.0, isMaximum = true, from = 83.0, usesTrend = true))
    private val water =
        NumberMetric(id = "water", name = "Water", icon = "water_drop", isCount = true, goal = NumberGoal(8.0))
    private val smoke = YesNoMetric(id = "smoke", name = "Smoke", icon = "smoking_rooms", goalIsYes = false)
    private val meditateNo = meditate.copy(goalIsYes = false)
    private val d28 = Day(2026, 9, 28)
    private val d29 = Day(2026, 9, 29)
    private val d30 = Day(2026, 9, 30)
    private val oct1 = Day(2026, 10, 1)
    private val oct2 = Day(2026, 10, 2)

    @Test
    fun metricPointsYesNoGives1IfTheValueIsTheGoal() {
        assertEquals(1.0, metricPoints(meditate, 1.0))
        assertEquals(0.0, metricPoints(meditate, 0.0))
        assertEquals(1.0, metricPoints(smoke, 0.0))
        assertEquals(0.0, metricPoints(smoke, 1.0))
    }

    @Test
    fun metricPointsNumberAndCountGiveThePointsOfTheGoal() {
        assertEquals(listOf(0.75, 1.0, 0.0), listOf(6.0, 12.0, -3.0).map { metricPoints(water, it) })
        assertEquals(listOf(0.3, 1.0), listOf(82.1, 79.5).map { withoutFloatNoise(metricPoints(weight, it)) })
    }

    /** Sep 29: weight 82.1, water 6, meditate yes, smoke no. Sep 30: weight 81, meditate no. */
    private val dayMetrics = listOf(weight, water, meditate, smoke)
    private val dayLog = parseLog(
        rows(
            listOf("date", "weight", "water", "meditate", "smoke"),
            listOf("2026-09-29", 82.1, 6, "yes", "no"),
            listOf("2026-09-30", 81, "", "no"),
        ),
        byId(*dayMetrics.toTypedArray()),
    ).table

    @Test
    fun pointsByMetricGivesTheYesNoAndCountMetricsPointsFromTheirFirstValueToToday() {
        val points = pointsByMetric(dayMetrics, dayLog, today = oct2)
        assertEquals(mapOf(d29 to 0.75, d30 to 0.0, oct1 to 0.0, oct2 to 0.0), points["water"])
        assertEquals(mapOf(d29 to 1.0, d30 to 0.0, oct1 to 0.0, oct2 to 0.0), points["meditate"])
        // Without today, only the days with a row. Smoke has the goal no: the day without a value is a no day.
        assertEquals(mapOf(d29 to 1.0, d30 to 1.0), pointsByMetric(dayMetrics, dayLog)["smoke"])
    }

    @Test
    fun aDayWithoutAValueHasTheValue0NoForYesNoAnd0ForACount() {
        val coffee = NumberMetric(
            id = "coffee",
            name = "Coffee",
            icon = "coffee",
            isCount = true,
            goal = NumberGoal(2.0, isMaximum = true),
        )
        val log = parseLog(
            rows(
                listOf("date", "coffee", "smoke"),
                listOf("2026-09-28", 1, "no"),
                listOf("2026-09-29"),
                listOf("2026-09-30", 3, "yes"),
            ),
            byId(coffee, smoke),
        ).table
        // 0 coffees on Sep 29 reach the goal at most 2. 3 coffees do not.
        val points = pointsByMetric(listOf(coffee, smoke), log, today = d30)
        assertEquals(mapOf(d28 to 1.0, d29 to 1.0, d30 to 0.0), points["coffee"])
        assertEquals(mapOf(d28 to 1.0, d29 to 1.0, d30 to 0.0), points["smoke"])
        val from4 = coffee.copy(goal = NumberGoal(2.0, isMaximum = true, from = 4.0))
        assertEquals(mapOf(d28 to 1.0, d29 to 1.0, d30 to 0.5), pointsByMetric(listOf(from4), log)["coffee"])
    }

    @Test
    fun aRowAfterTodayCountsButTheDaysBeforeItDoNot() {
        val log = parseLog(
            rows(listOf("date", "meditate"), listOf("2026-09-29", "yes"), listOf("2026-10-10")),
            byId(meditate),
        ).table
        assertEquals(
            mapOf(d29 to 1.0, d30 to 0.0, oct1 to 0.0, Day(2026, 10, 10) to 0.0),
            pointsByMetric(listOf(meditate), log, today = oct1)["meditate"],
        )
    }

    @Test
    fun pointsByMetricLeavesOutAMetricWithAGoalButWithoutValues() {
        val log = parseLog(rows(listOf("date", "meditate"), listOf("2026-09-29", "yes")), byId(meditate, water)).table
        assertEquals(setOf("meditate"), pointsByMetric(listOf(water, meditate), log, today = oct1).keys)
    }

    @Test
    fun pointsByMetricCountsANumberMetricOnlyOnTheDaysWithAValue() {
        val points = pointsByMetric(dayMetrics, dayLog, today = oct2).getValue("weight")
        assertEquals(listOf(d29, d30), points.keys.toList())
        assertEquals(listOf(0.3, 0.666667), points.values.map(::withoutFloatNoise))
    }

    @Test
    fun pointsByMetricUsesTheTrendForAGoalWithTrend() {
        val log = parseLog(
            rows(listOf("date", "weight"), listOf("2026-09-28", 83), listOf("2026-09-29", 81)),
            byId(weightTrend),
        ).table
        // The trend of Sep 29 is 82.5, not 81.
        assertEquals(mapOf(d28 to 0.0, d29 to 0.166667), pointsByMetric(listOf(weightTrend), log)["weight"]?.rounded())
    }

    @Test
    fun aTrendGoalUsesTheSameTrendAsTheNumberCharts() {
        val log = parseLog(
            rows(
                listOf("date", "weight"),
                listOf("2026-09-28", 83),
                listOf("2026-09-29", 81),
                // The last row of Sep 29 has no value: Sep 29 has no value.
                listOf("2026-09-29", ""),
                listOf("2026-09-30", 81),
            ),
            byId(weightTrend),
        ).table
        val chartTrend = numberStats(metricValues(weightTrend, log), listOf(d28, d29, d30)).trend
        val points = pointsByMetric(listOf(weightTrend), log).getValue("weight")
        assertEquals(listOf(d28, d30), points.keys.toList())
        assertEquals(weightTrend.goal.points(chartTrend.last()!!), points[d30])
    }

    @Test
    fun dayScoresIsTheAverageOfThePointsAsAPercentageWith1Decimal() {
        val points = mapOf(
            "a" to mapOf(d29 to 1.0, d30 to 0.0),
            "b" to mapOf(d29 to 0.75),
            "c" to mapOf(d29 to 0.0),
        )
        assertEquals(mapOf(d29 to 58.3, d30 to 0.0), dayScores(points))
        // Weight 0.3, water 0.75, meditate 1 and smoke 1. Then weight 0.67, smoke 1 (no value is no) and 0 for the
        // others.
        assertEquals(mapOf(d29 to 76.3, d30 to 41.7), dayScores(pointsByMetric(dayMetrics, dayLog)))
    }

    @Test
    fun aDayWithoutARowHasTheScore0AfterTheFirstValue() {
        val log = parseLog(rows(listOf("date", "meditate"), listOf("2026-09-29", "yes")), byId(meditate)).table
        val scores = dayScores(pointsByMetric(listOf(meditate), log, today = oct1))
        assertEquals(mapOf(d29 to 100.0, d30 to 0.0, oct1 to 0.0), scores)
        assertFalse(d28 in scores)
    }

    @Test
    fun dayScoresIncludesCountTapsThatAreNotWrittenYet() {
        val pending = mapOf(
            MetricDay("water", d30) to listOf(CountStep(1.0), CountStep(1.0)),
            MetricDay("water", d29) to listOf(CountStep(-1.0)),
        )
        // Water 5 (0.625) on Sep 29 and 2 (0.25) on Sep 30.
        assertEquals(mapOf(d29 to 73.1, d30 to 47.9), dayScores(pointsByMetric(dayMetrics, dayLog, pending = pending)))
    }

    @Test
    fun dayScoresIgnoresTapsOnAYesNoMetricAndRemovesADayThatTheTapsEmpty() {
        val pending = mapOf(
            MetricDay("meditate", d30) to listOf(CountStep(1.0)),
            MetricDay("water", d29) to listOf(CountStep(-3.0)),
        )
        val log = parseLog(rows(listOf("date", "water"), listOf("2026-09-29", 3)), byId(water, meditate)).table
        assertEquals(emptyMap(), dayScores(pointsByMetric(listOf(water, meditate), log, pending = pending)))
    }

    @Test
    fun aGoalChangeChangesTheScore() {
        assertEquals(mapOf(d29 to 0.0, d30 to 100.0), dayScores(pointsByMetric(listOf(meditateNo), dayLog)))
    }

    @Test
    fun aDayWithMoreThanOneRowCountsOnlyTheLastRow() {
        val duplicate = parseLog(
            rows(
                listOf("date", "weight", "meditate"),
                listOf("2026-09-29", 79, "yes"),
                listOf("2026-09-29", "", "yes"),
            ),
            byId(*dayMetrics.toTypedArray()),
        ).table
        assertEquals(mapOf(d29 to 100.0), dayScores(pointsByMetric(dayMetrics, duplicate)))
    }

    private val grouped = listOf(
        weight.copy(group = "body"),
        water.copy(group = "habits"),
        meditate.copy(group = "habits"),
        smoke.copy(group = "habits"),
    )

    @Test
    fun pointsOfGivesThePointsOfTheMetricsOfAGroup() {
        val points = pointsByMetric(grouped, dayLog)
        assertEquals(setOf("weight"), pointsOf(grouped, "body", points).keys)
        assertEquals(points, pointsOf(grouped, null, points))
    }

    @Test
    fun groupScoresAreTheScoresOfTheMetricsOfEachGroup() {
        val groups = groupScores(grouped, listOf("body", "habits"), pointsByMetric(grouped, dayLog))
        assertEquals(mapOf(d29 to 30.0, d30 to 66.7), groups["body"])
        assertEquals(mapOf(d29 to 91.7, d30 to 33.3), groups["habits"])
    }

    @Test
    fun groupPartsAddUpToTheScoreOfTheDay() {
        val parts = groupParts(grouped, listOf("body", "habits"), pointsByMetric(grouped, dayLog))
        assertEquals(mapOf(d29 to 7.5, d30 to 16.666667), parts["body"])
        assertEquals(mapOf(d29 to 68.75, d30 to 25.0), parts["habits"])
        assertEquals(76.25, parts.values.sumOf { it.getValue(d29) })
    }

    @Test
    fun staleScoreCellsFindsTheScoreCellsThatDoNotShowTheScoreOfTheirDay() {
        val cells = staleScoreCells(
            rows(
                listOf("date", "water", "meditate", "Score"),
                listOf("2026-09-26", "", "", ""),
                listOf("2026-09-27", 4, "yes", 75),
                listOf("2026-09-28", 8, "yes", 3),
                listOf("2026-09-29", 2, "no"),
                listOf("2026-09-30", "", "", 5),
                listOf("2026-10-01", "", "no", ""),
                listOf("2026-10-02", 4, "", "x"),
                listOf("bad date", 1, "yes", 2),
                listOf("2026-10-03"),
            ),
            listOf(water, meditate),
            3,
        )
        // Sep 26 is before the first value: no score. Sep 30 and Oct 3 have only a date: 0.
        assertEquals(
            listOf(
                ScoreCell(4, 100.0),
                ScoreCell(5, 12.5),
                ScoreCell(6, 0.0),
                ScoreCell(7, 0.0),
                ScoreCell(8, 25.0),
                ScoreCell(9, null),
                ScoreCell(10, 0.0),
            ),
            cells,
        )
    }

    @Test
    fun aPastValueOrAGoalChangeInTheSheetMakesTheScoreStale() {
        val metrics = listOf(water, meditate)
        val header = listOf("date", "water", "meditate", "Score")
        val rows = rows(header, listOf("2026-09-29", 4, "yes", 75))
        assertEquals(emptyList(), staleScoreCells(rows, metrics, 3))

        val edited = rows(header, listOf("2026-09-29", 8, "yes", 75))
        assertEquals(listOf(ScoreCell(2, 100.0)), staleScoreCells(edited, metrics, 3))

        assertEquals(listOf(ScoreCell(2, 25.0)), staleScoreCells(rows, listOf(water, meditateNo), 3))
    }

    @Test
    fun aChangedValueAlsoChangesTheScoreOfTheLaterDaysOfATrend() {
        val rows = mutableListOf(
            listOf("date", "weight", "Score"),
            listOf("2026-09-28", 83, 0),
            listOf<Any?>("2026-09-29", 81, 16.7),
        )
        assertEquals(emptyList(), staleScoreCells(rows, listOf(weightTrend), 2))
        rows[1] = listOf("2026-09-28", 84, 0)
        assertEquals(listOf(ScoreCell(3, 0.0)), staleScoreCells(rows, listOf(weightTrend), 2))
    }

    @Test
    fun eachRowOfADayWithMoreThanOneRowGetsTheScoreOfTheDay() {
        assertEquals(
            listOf(ScoreCell(2, 50.0), ScoreCell(3, 50.0)),
            staleScoreCells(
                rows(listOf("date", "water", "Score"), listOf("2026-09-29", 8, ""), listOf("2026-09-29", 4, "")),
                listOf(water),
                2,
            ),
        )
    }

    @Test
    fun staleScoreCellsReplacesAScoreStoredAsTextWithTheNumber() {
        assertEquals(
            listOf(ScoreCell(2, 50.0), ScoreCell(3, 0.0)),
            staleScoreCells(
                rows(listOf("date", "water", "Score"), listOf("2026-09-29", 4, "50"), listOf("2026-09-30", "", " ")),
                listOf(water, meditate),
                2,
            ),
        )
    }

    @Test
    fun staleScoreCellsReplacesACheckboxValueWithTheScore() {
        assertEquals(
            listOf(ScoreCell(2, null), ScoreCell(3, 50.0)),
            staleScoreCells(
                rows(listOf("date", "water", "Score"), listOf("2026-09-29", "", false), listOf("2026-09-30", 4, true)),
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
        assertEquals("Score:habits" to "Score · Habits", habits.id to habits.name)
        assertTrue(isScore(habits))
        assertEquals("%" to true, habits.unit to habits.isCount)
    }

    @Test
    fun scoreMetricHasNoIcon() {
        assertTrue(scoreMetric.icon.isEmpty())
    }

    /** The values without float noise. */
    private fun Map<Day, Double>.rounded(): Map<Day, Double> = mapValues { withoutFloatNoise(it.value) }
}
