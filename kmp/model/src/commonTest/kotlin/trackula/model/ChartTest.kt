package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ChartTest {
    private val pointDays = (0 until 5).map { Day(2026, 9, 26).addDays(it) }
    private val barDays = (0 until 4).map { Day(2026, 9, 27).addDays(it) }

    @Test
    fun chartPointsPlacesValuesBetweenPaddingAndHeightSkippingEmptyDays() {
        val days = pointDays
        val p = chartPoints(days, mapOf(days[0] to 80.0, days[2] to 90.0, days[4] to 85.0), 100.0, 40.0, 4.0)
        assertEquals(listOf(0.0 to 36.0, 50.0 to 4.0, 100.0 to 20.0), p.map { it.x to it.y })
    }

    @Test
    fun chartPointsPutsEqualValuesInTheMiddle() {
        val days = pointDays
        val p = chartPoints(days, mapOf(days[1] to 5.0, days[3] to 5.0), height = 40.0)
        assertEquals(listOf(20.0, 20.0), p.map { it.y })
    }

    @Test
    fun chartPointsFromZeroStartsTheScaleAt0AtTheBottom() {
        val days = pointDays
        fun ys(values: Map<Day, Double>) = chartPoints(days, values, height = 40.0, padding = 4.0, fromZero = true)
            .map { it.y }
        assertEquals(listOf(4.0, 20.0), ys(mapOf(days[0] to 10.0, days[4] to 5.0)))
        assertEquals(listOf(4.0, 4.0), ys(mapOf(days[1] to 5.0, days[3] to 5.0)))
        assertEquals(listOf(36.0, 36.0), ys(mapOf(days[1] to 0.0, days[3] to 0.0)))
    }

    @Test
    fun chartPointsReturnsNoPointsWithoutValues() {
        assertTrue(chartPoints(pointDays, emptyMap()).isEmpty())
    }

    @Test
    fun chartBarsGivesEachDayAnEqualSlotAndStartsBarsAt0() {
        val days = barDays
        val b = chartBars(days, mapOf(days[0] to 8.0, days[3] to 4.0), 100.0, 40.0, 4.0, fill = 0.5)
        assertEquals(listOf(Triple(6.25, 12.5, 4.0), Triple(81.25, 12.5, 22.0)), b.map { Triple(it.x, it.w, it.y) })
    }

    @Test
    fun chartBarsDrawsZeroValuesWithNoHeight() {
        assertEquals(40.0, chartBars(barDays, mapOf(barDays[1] to 0.0), height = 40.0).single().y)
    }
}
