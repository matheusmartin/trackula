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
        val total = mapOf(day(0) to 40.0, day(7) to 60.0, day(1) to 20.0)
        val groups = mapOf(
            "habits" to mapOf(day(0) to 30.0, day(7) to 50.0),
            "body" to mapOf(day(0) to 10.0, day(7) to 10.0, day(1) to 20.0),
        )
        val parts = groupWeekdayParts(total, groups, range(0, 14))
        assertEquals(listOf(40.0, 0.0, null, null, null, null, null), parts["habits"])
        assertEquals(listOf(10.0, 20.0, null, null, null, null, null), parts["body"])
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
    fun weekdaysInRangeGiveTheScoreOfTheWeekAndTheRangeOfTheWeeksBefore() {
        // day(28) is the Monday of the 5th week, day(30) its Wednesday. The 4 weeks before are day(0) to day(27).
        val values = mapOf(
            day(-7) to 99.0,
            day(0) to 10.0,
            day(7) to 12.0,
            day(14) to 14.0,
            day(3) to 5.0,
            day(28) to 15.0,
            day(29) to 8.0,
            day(31) to 20.0,
        )
        val weekdays = weekdaysInRange(values, day(30))
        assertEquals(7, weekdays.size)
        assertEquals(WeekdayInRange(15.0, ValueRange(10.0, 14.0, 12.0)), weekdays[0])
        assertEquals(WeekdayInRange(8.0, null), weekdays[1])
        assertEquals(WeekdayInRange(null, null), weekdays[2])
        // Thursday comes after the end: no score of the week, but the range of the weeks before.
        assertEquals(WeekdayInRange(null, ValueRange(5.0, 5.0, 5.0)), weekdays[3])
    }

    @Test
    fun weeklyAveragesGiveTheAverageScoreOfTheSameWeekdaysOfEachWeek() {
        // day(29) is the Tuesday of the 5th week: each week counts its Monday and Tuesday.
        val habits = mapOf(
            day(0) to 50.0,
            day(1) to 100.0,
            day(2) to 0.0,
            day(7) to 40.0,
            day(21) to 20.0,
            day(22) to 0.0,
            day(28) to 60.0,
        )
        val averages = weeklyAverages(mapOf("habits" to habits, "empty" to emptyMap()), day(29), 4)
        // The 3rd week has no score of habits: null. The Wednesday day(2) does not count.
        assertEquals(mapOf("habits" to listOf(75.0, 40.0, null, 10.0, 60.0)), averages)
        assertEquals(listOf(day(0), day(7), day(14), day(21), day(28)), weekMondays(day(29), 4))
    }

    @Test
    fun monthlyAveragesGiveTheAverageScoreOfEachMonthUpToTheEnd() {
        val habits = mapOf(
            Day(2026, 7, 31) to 70.0,
            Day(2026, 8, 5) to 20.0,
            Day(2026, 10, 1) to 30.0,
            Day(2026, 10, 2) to 0.0,
            Day(2026, 11, 9) to 30.0,
            Day(2026, 11, 10) to 10.0,
            Day(2026, 11, 11) to 100.0,
        )
        val averages = monthlyAverages(mapOf("habits" to habits, "empty" to emptyMap()), Day(2026, 11, 10), 3)
        // August to November. September has no score: null. November 11 is after the end.
        assertEquals(mapOf("habits" to listOf(20.0, null, 15.0, 20.0)), averages)
    }

    @Test
    fun monthsUntilCrossTheYear() {
        assertEquals(
            listOf(MonthKey(2025, 10), MonthKey(2025, 11), MonthKey(2025, 12), MonthKey(2026, 1)),
            monthsUntil(Day(2026, 1, 15), 3),
        )
    }

    @Test
    fun stepChangesAreTheChangeFromTheValueBefore() {
        assertEquals(listOf(null, 1.5, null, null), stepChanges(listOf(5.0, 6.5, null, 4.0)))
        assertEquals(emptyList(), stepChanges(emptyList()))
    }
}
