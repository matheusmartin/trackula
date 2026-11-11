package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class DeletedMetricTest {
    @Test
    fun aLogColumnWithoutAMetricIsADeletedMetric() {
        val log = rows(
            listOf("date", "weight", "steps", "read", "Score", "", "Notes"),
            listOf(Day(2026, 9, 29).serial.toDouble(), 82.4, 9000, "yes", 50),
            listOf(Day(2026, 9, 30).serial.toDouble(), 82.1, "", "No", 60),
            listOf(Day(2026, 9, 28).serial.toDouble(), "", 7000, false),
        )
        assertEquals(
            listOf(
                DeletedMetric("steps", values = 2, lastDay = Day(2026, 9, 29), isYesNo = false),
                DeletedMetric("read", values = 2, lastDay = Day(2026, 9, 30), isYesNo = true),
            ),
            deletedMetrics(log, setOf("weight")),
        )
    }

    @Test
    fun aDeletedMetricWithoutValuesIsNotYesNoAndADuplicateColumnCountsOnce() {
        val log = rows(listOf("date", "walk", "walk"), listOf(Day(2026, 9, 29).serial.toDouble(), "", "yes"))
        assertEquals(listOf(DeletedMetric("walk", 0, null, isYesNo = false)), deletedMetrics(log, emptySet()))
    }

    @Test
    fun anEmptyLogHasNoDeletedMetrics() {
        assertEquals(emptyList(), deletedMetrics(emptyList(), emptySet()))
    }
}
