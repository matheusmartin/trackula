package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class ScoreStatsTest {
    // 2026-09-28 is a Monday.
    private val mon = Day(2026, 9, 28)
    private fun day(i: Int) = mon.addDays(i)
    private fun range(from: Int, n: Int) = (from until from + n).map(::day)

    @Test
    fun halvesSplitTheDaysAndTheSecondHalfHasTheExtraDay() {
        assertEquals(range(0, 7) to range(7, 7), halves(range(0, 14)))
        assertEquals(range(0, 3) to range(3, 4), halves(range(0, 7)))
        assertEquals(emptyList<Day>() to listOf(day(0)), halves(listOf(day(0))))
        assertEquals(emptyList<Day>() to emptyList(), halves(emptyList()))
    }

    @Test
    fun groupWeekdayPartsAddUpToTheWeekdayAverageOfTheTotal() {
        val total = mapOf(day(0) to 4.0, day(7) to 6.0, day(1) to 2.0)
        val groups = mapOf(
            "habits" to mapOf(day(0) to 3.0, day(7) to 5.0),
            "body" to mapOf(day(0) to 1.0, day(7) to 1.0, day(1) to 2.0),
        )
        val parts = groupWeekdayParts(total, groups, range(0, 14))
        assertEquals(listOf(4.0, 0.0, null, null, null, null, null), parts["habits"])
        assertEquals(listOf(1.0, 2.0, null, null, null, null, null), parts["body"])
        val average = countStats(total, range(0, 14)).weekdayAverages
        for (i in 0..1) assertEquals(average[i], parts.values.sumOf { it[i]!! })
    }

    @Test
    fun groupWeekdayPartsUseOnlyTheDaysOfThePeriod() {
        val total = mapOf(day(0) to 4.0, day(7) to 6.0)
        val parts = groupWeekdayParts(total, mapOf("habits" to total), range(7, 7))
        assertEquals(6.0, parts.getValue("habits")[0])
    }

    private val points = mapOf(
        "water" to mapOf(day(0) to 5.0, day(7) to 6.0, day(1) to 2.0),
        "meditate" to mapOf(day(0) to 1.0, day(7) to 0.0),
        "waist" to emptyMap(),
    )

    @Test
    fun metricTotalsAddThePointsOfThePeriod() {
        assertEquals(mapOf("water" to 13.0, "meditate" to 1.0, "waist" to 0.0), metricTotals(points, range(0, 14)))
        assertEquals(6.0, metricTotals(points, range(7, 7))["water"])
    }

    @Test
    fun habitLinksCompareTheOtherPointsOnDaysWithAndWithoutTheMetric() {
        // 6 days with meditate (other points 15) and 6 days without (other points 13).
        val days = range(0, 12)
        val meditate = days.associateWith { if (it.weekday <= 3) 1.0 else 0.0 }
        val withDays = days.filter { meditate.getValue(it) > 0 }
        assertEquals(6, withDays.size)
        val score = days.associateWith { if (meditate.getValue(it) > 0) 16.0 else 13.0 }
        val links = habitLinks(mapOf("meditate" to meditate, "waist" to emptyMap()), score, days)
        assertEquals(mapOf("meditate" to 2.0), links)
    }

    @Test
    fun habitLinksNeedEnoughDaysOfEachKind() {
        val days = range(0, 7)
        val score = days.associateWith { 10.0 }
        assertEquals(emptyMap(), habitLinks(mapOf("x" to days.associateWith { 1.0 }), score, days))
        assertEquals(emptyMap(), habitLinks(mapOf("x" to mapOf(day(0) to 1.0)), score, days))
    }
}
