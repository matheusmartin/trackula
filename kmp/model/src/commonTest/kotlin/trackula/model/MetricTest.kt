package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class MetricTest {
    private val water =
        NumberMetric(id = "water", name = "Water", icon = "water_drop", isCount = true, group = "habits")
    private val weight = NumberMetric(id = "weight", name = "Weight", icon = "monitor_weight", group = "body")
    private val read = YesNoMetric(id = "read", name = "Read", icon = "menu_book")

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
