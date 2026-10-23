package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DayTest {
    private val d30 = Day(2026, 9, 30)

    @Test
    fun parsesAndFormatsIsoDates() {
        assertEquals(d30, Day.tryParse("2026-09-30"))
        assertEquals("2026-09-30", d30.toString())
    }

    @Test
    fun addsDaysAcrossMonthEndsAndKnowsTheWeekday() {
        assertEquals(Day(2026, 10, 1), d30.addDays(1))
        assertEquals(Day(2026, 8, 31), d30.addDays(-30))
        assertEquals(3, d30.weekday) // Wednesday.
    }

    @Test
    fun convertsGoogleSheetsDateSerialNumbers() {
        assertEquals(46297, Day(2026, 10, 2).serial)
        assertEquals(61, Day(1900, 3, 1).serial)
        assertEquals(Day(2026, 10, 2), Day.fromSerial(46297.0))
        // The fraction is the time of day.
        assertEquals(Day(2026, 10, 2), Day.fromSerial(46297.75))
        assertNull(Day.fromSerial(0.0))
        assertNull(Day.fromSerial(Double.NaN))
        assertNull(Day.fromSerial(1e10))
        assertEquals(Day(9999, 12, 31), Day.fromSerial(2958465.5))
        for (d in listOf(Day(2024, 2, 29), Day(2026, 3, 29), Day(2026, 12, 31))) {
            assertEquals(d, Day.fromSerial(d.serial.toDouble()))
        }
    }

    @Test
    fun rejectsInvalidDates() {
        assertNull(Day.tryParse("2026-02-30"))
        assertNull(Day.tryParse("30/09/2026"))
        assertNull(Day.tryParse(""))
    }

    @Test
    fun ofMovesValuesOutOfRangeIntoOtherMonths() {
        assertEquals(Day(2027, 1, 1), Day.of(2026, 13, 1))
        assertEquals(Day(2026, 2, 28), Day.of(2026, 3, 0))
        assertEquals(Day(2025, 12, 1), Day.of(2026, 0, 1))
        assertEquals(Day(2024, 3, 1), Day.of(2024, 2, 30))
        assertEquals(Day(2027, 3, 1), Day(2026, 15, 1).addDays(0))
        assertEquals(Day(2025, 11, 30), Day.of(2026, -1, 30))
    }

    @Test
    fun epochDayRoundTripsOverManyYears() {
        assertEquals(0, Day(1970, 1, 1).epochDay)
        assertEquals(4, Day(1970, 1, 1).weekday) // Thursday.
        assertEquals(Day(1969, 12, 31), Day.fromEpochDay(-1))
        for (n in -800_000..800_000 step 997) assertEquals(n, Day.fromEpochDay(n).epochDay)
    }

    @Test
    fun comparesByDate() {
        assertTrue(Day(2025, 12, 31) < Day(2026, 1, 1))
        assertTrue(Day(2026, 2, 1) > Day(2026, 1, 31))
    }

    @Test
    fun daysBetweenGivesAllDaysOldestFirstAndEmptyIfTheLastDayIsBeforeTheFirst() {
        assertEquals(
            listOf("2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"),
            daysBetween(Day(2026, 2, 27), Day(2026, 3, 2)).map { "$it" },
        )
        assertEquals(emptyList(), daysBetween(Day(2026, 3, 2), Day(2026, 3, 1)))
    }

    @Test
    fun earliestDayGivesTheEarliestDayOrNull() {
        assertEquals(Day(2025, 12, 31), earliestDay(listOf(Day(2026, 3, 2), Day(2025, 12, 31), Day(2026, 1, 1))))
        assertNull(earliestDay(emptyList()))
    }

    @Test
    fun monthOfAddMonthsAndDaysOfMonth() {
        assertEquals(MonthKey(2026, 2), monthOf(Day(2026, 2, 14)))
        assertEquals(MonthKey(2025, 12), addMonths(MonthKey(2026, 1), -1))
        assertEquals(MonthKey(2027, 2), addMonths(MonthKey(2026, 11), 3))
        val february = daysOfMonth(MonthKey(2028, 2))
        assertEquals(Triple(29, Day(2028, 2, 1), Day(2028, 2, 29)), Triple(february.size, february.first(), february.last()))
    }

    @Test
    fun weekRowsGoMondayToSundayWithNullBeforeTheFirstDayAndAfterTheLastDay() {
        // 2026-10-01 is a Thursday.
        val weeks = weekRows(daysBetween(Day(2026, 10, 1), Day(2026, 10, 12)))
        assertEquals(
            listOf(
                listOf(null, null, null, 1, 2, 3, 4),
                listOf(5, 6, 7, 8, 9, 10, 11),
                listOf(12, null, null, null, null, null, null),
            ),
            weeks.map { w -> w.map { it?.day } },
        )
    }
}
