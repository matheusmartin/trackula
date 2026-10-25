package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SummaryTest {
    private val metrics = byId(weight, water, meditate)
    private val d28 = Day(2026, 9, 28)
    private val d29 = Day(2026, 9, 29)
    private val d30 = Day(2026, 9, 30)

    @Test
    fun dayValuesGivesTheValuesOfTheMetricAndLeavesOutANoDayLikeADayWithoutAValue() {
        val log = parseLog(
            rows(
                listOf("date", "meditate", "water"),
                listOf("2026-09-28", "yes", 8),
                listOf("2026-09-29", "no", ""),
                listOf("2026-09-30", "yes", 5),
            ),
            metrics,
        ).table
        assertEquals(mapOf(d28 to 8.0, d30 to 5.0), dayValues(water, log.entries))
        assertEquals(listOf(d28, d30), dayValues(meditate, log.entries).keys.toList())
    }

    @Test
    fun dayValuesWithPendingAddsCountTapsThatAreNotWrittenYet() {
        val p = parseLog(rows(listOf("date", "water"), listOf("2026-09-29", 8), listOf("2026-09-30", 1)), metrics)
        val pending = mapOf(
            MetricDay("water", d29) to listOf(CountStep(1.0), CountStep(1.0)),
            MetricDay("water", d30) to listOf(CountStep(-1.0)),
            MetricDay("weight", d29) to listOf(CountStep(5.0)),
        )
        assertEquals(mapOf(d29 to 10.0), dayValuesWithPending(water, p.table.entries, pending))
    }

    @Test
    fun nearestDayGivesTheNearestDayBeforeElseTheNearestDayAfter() {
        val days = listOf(d29, Day(2026, 9, 25), Day(2026, 10, 3), Day(2026, 10, 1))
        assertEquals(d29, nearestDay(days, d30))
        assertEquals(Day(2026, 9, 25), nearestDay(days, Day(2026, 9, 20)))
        assertNull(nearestDay(listOf(d30), d30))
        assertNull(nearestDay(emptyList(), d30))
    }
}
