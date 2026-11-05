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
    fun weekdayChangesIsNowMinusBeforeAndNullIfOneIsMissing() {
        val now = listOf(12.5, 3.0, null, 1.0, 0.3, null, 2.0)
        val before = listOf(11.0, 4.0, 1.0, null, 0.1, null, 2.0)
        assertEquals(listOf(1.5, -1.0, null, null, 0.2, null, 0.0), weekdayChanges(now, before))
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

    @Test
    fun scoreLevelsDivideByTheHighestScoreOfThePeriod() {
        val values = mapOf(day(0) to 5.0, day(1) to 10.0, day(2) to -1.0, day(9) to 20.0)
        assertEquals(mapOf(day(0) to 0.5, day(1) to 1.0, day(2) to 0.0), scoreLevels(values, range(0, 7)))
        assertEquals(mapOf(day(0) to 0.0), scoreLevels(mapOf(day(0) to 0.0), range(0, 7)))
        assertEquals(emptyMap(), scoreLevels(values, range(3, 3)))
    }
}
