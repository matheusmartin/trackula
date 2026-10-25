package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class StatsTest {
    // 2026-09-28 is a Monday.
    private val mon = Day(2026, 9, 28)
    private fun day(i: Int) = mon.addDays(i)
    private fun range(n: Int) = (0 until n).map(::day)

    // Mo yes, Tu yes, We no, Th (none), Fr yes, Sa yes, Su yes.
    private val states =
        mapOf(day(0) to true, day(1) to true, day(2) to false, day(4) to true, day(5) to true, day(6) to true)

    @Test
    fun yesNoStatsCountsYesNoAndDaysWithoutEntry() {
        val s = yesNoStats(states, range(7), day(6))
        assertEquals(listOf(5, 1, 1, 7), listOf(s.yes, s.no, s.none, s.days))
        assertEquals(5.0 / 7, s.rate, 1e-9)
    }

    @Test
    fun yesNoStatsStreaksCurrentLongestAndAllRuns() {
        val s = yesNoStats(states, range(7), day(6))
        assertEquals(3 to 3, s.currentStreak to s.longestStreak)
        assertEquals(listOf(2, 3), s.streaks)
        // Today without entry yet: the current streak counts up to yesterday.
        assertEquals(3, yesNoStats(states, range(8), day(7)).currentStreak)
    }

    @Test
    fun yesNoStatsWeekdayRates() {
        assertEquals(listOf(1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0), yesNoStats(states, range(7), day(6)).weekdayRates)
    }

    @Test
    fun yesNoStatsStrengthGrowsWithYesAndGoesDownWithout() {
        val s = yesNoStats(states, range(7), day(6))
        assertEquals(STRENGTH_WEIGHT, s.strength.first(), 1e-9)
        assertTrue(s.strength[2] < s.strength[1])
        assertTrue(s.strength.last() > s.strength[3])
    }

    @Test
    fun yesNoStatsStrengthStartsAtTheFirstEntryBeforeThePeriod() {
        val s = yesNoStats(mapOf(day(0) to true), listOf(day(1)), day(1))
        assertEquals(STRENGTH_WEIGHT * (1 - STRENGTH_WEIGHT), s.strength.single(), 1e-9)
        assertEquals(listOf(0.0, 0.0), yesNoStats(emptyMap(), range(2), day(1)).strength)
    }

    @Test
    fun yesNoStatsWithNoDaysHasNoStrength() {
        assertEquals(emptyList(), yesNoStats(states, emptyList(), day(6)).strength)
    }

    @Test
    fun yesNoStatesReadsYesAsTrueAndNoAsFalse() {
        val entries = listOf(
            LogEntry(row = 2, date = day(0), metricId = "m", value = 1.0),
            LogEntry(row = 3, date = day(1), metricId = "m", value = 0.0),
            LogEntry(row = 3, date = day(1), metricId = "other", value = 1.0),
        )
        assertEquals(mapOf(day(0) to true, day(1) to false), yesNoStates("m", entries))
    }

    private val counts = mapOf(day(0) to 3.0, day(1) to 5.0, day(3) to 5.0, day(7) to 2.0)

    @Test
    fun countStatsTotalAverageBestDayAndDaysLogged() {
        val s = countStats(counts, range(8))
        assertEquals(Triple(15.0, 4, 3.75), Triple(s.total, s.logged, s.average))
        assertEquals(DayValue(day(1), 5.0), s.best)
    }

    @Test
    fun countStatsWeekdayAveragesDistributionRunningTotal() {
        val s = countStats(counts, range(8))
        assertEquals(listOf(2.5, 5.0, null, 5.0, null, null, null), s.weekdayAverages)
        assertEquals(listOf(ValueDays(2, 1), ValueDays(3, 1), ValueDays(5, 2)), s.distribution)
        assertEquals(listOf(3.0, 8.0, 8.0, 13.0, 13.0, 13.0, 13.0, 15.0), s.running)
    }

    @Test
    fun countStatsRoundsAHalfAwayFromZeroInTheDistributionAndTheFirstHighestDayIsBest() {
        val s = countStats(mapOf(day(0) to 2.5, day(1) to -2.5, day(2) to 2.5), range(3))
        assertEquals(listOf(ValueDays(-3, 1), ValueDays(3, 2)), s.distribution)
        assertEquals(DayValue(day(0), 2.5), s.best)
    }

    @Test
    fun countStatsWithNoValues() {
        val s = countStats(emptyMap(), range(3))
        assertEquals(Triple(0.0, null, null), Triple(s.total, s.average, s.best))
        assertEquals(emptyList(), s.distribution)
    }

    private val numbers = mapOf(day(0) to 82.0, day(2) to 81.0, day(3) to 80.5, day(8) to 80.0)

    @Test
    fun numberStatsLatestChangeLowestHighestAverage() {
        val s = numberStats(numbers, range(9))
        assertEquals(DayValue(day(8), 80.0), s.latest)
        assertEquals(-2.0, s.change)
        assertEquals(80.0 to 82.0, s.low?.value to s.high?.value)
        assertEquals(80.875, s.average!!, 1e-9)
    }

    @Test
    fun numberStatsTrendIsAMovingAverageThatKeepsItsValueOnEmptyDays() {
        val s = numberStats(numbers, range(9))
        assertEquals(82.0, s.trend[0])
        assertEquals(82.0, s.trend[1])
        assertEquals(82 + TREND_WEIGHT * (81 - 82), s.trend[2])
    }

    @Test
    fun numberStatsHistogram() {
        val s = numberStats(numbers, range(9))
        assertEquals(HISTOGRAM_BINS, s.histogram.size)
        assertEquals(4, s.histogram.sumOf { it.days })
    }

    @Test
    fun numberStatsGivesTheFirstDayOfATieAndPutsTheHighestValueInTheLastRange() {
        val s = numberStats(mapOf(day(0) to 0.0, day(1) to -0.0, day(2) to 8.0, day(3) to 8.0), range(4))
        assertEquals(day(0) to day(2), s.low?.day to s.high?.day)
        assertEquals(listOf(2, 0, 0, 0, 0, 0, 0, 2), s.histogram.map { it.days })
        assertEquals(Bin(7.0, 8.0, 2), s.histogram.last())
    }

    @Test
    fun numberStatsWithOneValueHasNoChangeAndOneHistogramRange() {
        val s = numberStats(mapOf(day(0) to 70.0), range(3))
        assertNull(s.change)
        assertEquals(1, s.histogram.size)
    }

    @Test
    fun streakLengths() {
        assertEquals(listOf(1, 2, 0, 1, 0, 0, 1), streakLengths(listOf(1, 2, 2, 5, 40)))
    }
}
