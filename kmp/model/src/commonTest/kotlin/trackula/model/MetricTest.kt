package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class MetricTest {
    private val goal8 = NumberGoal(8.0)
    private val water =
        NumberMetric(id = "water", name = "Water", icon = "water_drop", goal = goal8, isCount = true, group = "habits")
    private val weight =
        NumberMetric(id = "weight", name = "Weight", icon = "monitor_weight", goal = goal8, group = "body")
    private val read = YesNoMetric(id = "read", name = "Read", icon = "menu_book")

    @Test
    fun numberGoalGives1IfTheValueReachesTheTarget() {
        assertEquals(listOf(1.0, 1.0), listOf(8.0, 12.0).map(NumberGoal(8.0)::points))
        assertEquals(listOf(1.0, 1.0), listOf(80.0, 79.5).map(NumberGoal(80.0, isMaximum = true)::points))
    }

    @Test
    fun numberGoalGivesThePartOfTheWayFromTheStartToTheTarget() {
        val weight = NumberGoal(80.0, isMaximum = true, from = 83.0)
        assertEquals(listOf(0.3, 0.0, 0.0), listOf(82.1, 83.0, 84.0).map { withoutFloatNoise(weight.points(it)) })
        val sleep = NumberGoal(7.0, from = 5.0)
        assertEquals(listOf(0.5, 0.0), listOf(6.0, 4.0).map(sleep::points))
    }

    @Test
    fun aMinimumAbove0WithoutFromStartsAt0AndTheOtherGoalsGive1Or0() {
        assertEquals(0.0, NumberGoal(8.0).start)
        assertEquals(listOf(0.75, 0.0), listOf(6.0, -1.0).map(NumberGoal(8.0)::points))
        assertNull(NumberGoal(80.0, isMaximum = true).start)
        assertEquals(0.0, NumberGoal(80.0, isMaximum = true).points(80.1))
        assertNull(NumberGoal(-5.0).start)
        assertEquals(0.0, NumberGoal(-5.0).points(-6.0))
    }

    @Test
    fun groupOfIsOtherForAMetricWithoutGroup() {
        assertEquals(listOf("habits", "body", OTHER_GROUP), listOf(water, weight, read).map(::groupOf))
    }

    @Test
    fun metricsOfGivesTheMetricsOfTheGroupOrAllMetricsForNull() {
        val all = listOf(water, weight, read)
        assertEquals(listOf(weight), metricsOf(all, "body"))
        assertEquals(listOf(read), metricsOf(all, OTHER_GROUP))
        assertEquals(emptyList(), metricsOf(all, "sleep"))
        assertEquals(all, metricsOf(all, null))
    }
}
