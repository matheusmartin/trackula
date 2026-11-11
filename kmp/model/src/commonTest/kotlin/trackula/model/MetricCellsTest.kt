package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class MetricCellsTest {
    private val samples = listOf(
        NumberMetric(
            id = "weight",
            name = "Weight",
            icon = "monitor_weight",
            unit = "kg",
            step = 0.1,
            goal = NumberGoal(80.0, isMaximum = true, from = 84.0, usesTrend = true),
            group = "Health",
        ),
        NumberMetric(id = "waist", name = "Waist", icon = "straighten", unit = "cm", step = 0.5),
        NumberMetric(id = "water", name = "Water", icon = "💧", isCount = true, goal = NumberGoal(8.0)),
        NumberMetric(id = "sugar", name = "Sugar", icon = "cake", isCount = true, goal = NumberGoal(-2.5, true, -1.0)),
        YesNoMetric(id = "teeth", name = "Morning teeth", icon = "dentistry", group = "Hygiene"),
        YesNoMetric(id = "smoke", name = "=1+1", icon = "smoking_rooms", goalIsYes = false),
    )

    @Test
    fun goalTextGivesTheWordsOfTheGoal() {
        assertEquals("at least 8", goalText(NumberGoal(8.0)))
        assertEquals("at least 7 from 5", goalText(NumberGoal(7.0, from = 5.0)))
        assertEquals("at most 75.5", goalText(NumberGoal(75.5, isMaximum = true)))
        assertEquals("at most 80 from 83 trend", goalText(NumberGoal(80.0, true, 83.0, usesTrend = true)))
    }

    @Test
    fun theParserReadsTheCellsOfEachMetricBackAsTheSameMetric() {
        for (m in samples) assertEquals(m, parseMetricRow(m.id, metricCells(m)), m.id)
    }

    @Test
    fun aYesNoMetricHasNoUnitAndNoStepAndAMetricWithoutGoalHasAnEmptyGoal() {
        assertEquals(
            mapOf(
                "id" to "teeth",
                "name" to "Morning teeth",
                "kind" to "yesno",
                "group" to "Hygiene",
                "icon" to "dentistry",
                "unit" to "",
                "step" to "",
                "goal" to "yes",
            ),
            metricCells(samples[4]),
        )
        assertEquals("", metricCells(samples[1])["goal"])
        assertEquals("number", metricCells(samples[1])["kind"])
        assertEquals("count", metricCells(samples[2])["kind"])
    }
}
