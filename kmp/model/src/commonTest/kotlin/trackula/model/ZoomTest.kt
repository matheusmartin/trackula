package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ZoomTest {
    // 2026-09-28 is a Monday.
    private val mon = Day(2026, 9, 28)

    // Data from 2026-08-03 (a Monday) to 2026-09-30: 9 weeks.
    private val first = Day(2026, 8, 3)
    private val today = Day(2026, 9, 30)

    @Test
    fun barStartAndNextBarStart() {
        val d = Day(2026, 8, 13)
        assertEquals(d, barStart(d, BarUnit.DAY))
        assertEquals(Day(2026, 8, 14), nextBarStart(d, BarUnit.DAY))
        assertEquals(Day(2026, 8, 10), barStart(d, BarUnit.WEEK))
        assertEquals(Day(2026, 8, 1), barStart(d, BarUnit.MONTH))
        assertEquals(Day(2026, 7, 1), barStart(d, BarUnit.QUARTER))
        assertEquals(Day(2027, 1, 1), nextBarStart(Day(2026, 12, 1), BarUnit.MONTH))
        assertEquals(Day(2027, 1, 1), nextBarStart(Day(2026, 10, 1), BarUnit.QUARTER))
    }

    @Test
    fun barStartsCoversFirstToToday() {
        assertEquals(
            listOf(mon.addDays(-14), mon.addDays(-7), mon),
            barStarts(mon.addDays(-8), mon.addDays(2), BarUnit.WEEK),
        )
        assertEquals(listOf(Day(2026, 8, 1), Day(2026, 9, 1)), barStarts(Day(2026, 8, 20), mon, BarUnit.MONTH))
    }

    @Test
    fun zoomStepsEndsAtTheFirstStepThatShowsAllBars() {
        assertEquals(listOf(ZoomStep.WEEK1), zoomSteps(mon.addDays(-5), mon))
        assertEquals(listOf(ZoomStep.WEEK1, ZoomStep.WEEK2, ZoomStep.MONTH1), zoomSteps(mon.addDays(-20), mon))
        assertEquals(ZoomStep.MONTH3, zoomSteps(mon.addDays(-60), mon).last())
        assertEquals(ZoomStep.YEAR2, zoomSteps(Day(2024, 10, 4), mon).last())
    }

    @Test
    fun zoomBarsRateCountsDaysWithoutEntryAsNotYesAndOnlyDaysFromFirstToToday() {
        val starts = listOf(mon.addDays(-7), mon)
        val values = mapOf(mon.addDays(-7) to 1.0, mon.addDays(-6) to 0.0, mon to 1.0, mon.addDays(1) to 1.0)
        val bars =
            zoomBars(values, Aggregate.RATE, starts, BarUnit.WEEK, first = mon.addDays(-7), today = mon.addDays(2))
        assertEquals(1.0 / 7, bars[0].value!!, 1e-9)
        assertEquals(2.0 / 3, bars[1].value!!, 1e-9)
    }

    @Test
    fun zoomBarsSumAverageLowAndHigh() {
        val starts = listOf(mon.addDays(-7), mon)
        val values = mapOf(mon.addDays(-7) to 2.0, mon.addDays(-5) to 4.0, mon to 3.0)
        val sum = zoomBars(values, Aggregate.SUM, starts, BarUnit.WEEK, first = mon.addDays(-7), today = mon)
        assertEquals(listOf(6.0, 3.0), sum.map { it.value })
        val avg = zoomBars(values, Aggregate.AVERAGE, starts, BarUnit.WEEK, first = mon.addDays(-7), today = mon)
        assertEquals(
            listOf(Triple(3.0, 2.0, 4.0), Triple(3.0, 3.0, 3.0)),
            avg.map { Triple(it.value, it.low, it.high) },
        )
    }

    @Test
    fun defaultStepIndexIs3MonthsOrTheLastStepIfThereAreFewer() {
        assertEquals(ZoomStep.MONTH3.ordinal, defaultStepIndex(zoomSteps(mon.addDays(-200), mon)))
        assertEquals(1, defaultStepIndex(zoomSteps(mon.addDays(-10), mon)))
    }

    @Test
    fun zoomWindowShowsTheNewestBarsFromFirstToToday() {
        val w = ZoomWindow(ZoomStep.MONTH1, first, today)
        assertEquals((4 downTo 0).map { mon.addDays(-7 * it) }, w.starts)
        assertEquals(mon.addDays(-28) to today, w.from to w.to)
        assertEquals(31, w.days.size)
        assertEquals(false to true, w.atStart to w.atEnd)
    }

    @Test
    fun zoomWindowMovesByBarsAndStopsAtTheEnds() {
        val w = ZoomWindow(ZoomStep.MONTH1, first, today)
        val back = ZoomWindow(ZoomStep.MONTH1, first, today, end = w.endMovedBy(-2))
        assertEquals(mon.addDays(-14 + 6), back.to)
        assertNull(w.endMovedBy(3))
        val oldest = ZoomWindow(ZoomStep.MONTH1, first, today, end = w.endMovedBy(-100))
        assertEquals(first to true, oldest.from to oldest.atStart)
    }

    @Test
    fun zoomWindowEndCenteredOnPutsTheDayInTheMiddleBar() {
        val w = ZoomWindow(ZoomStep.MONTH1, first, today)
        val c = ZoomWindow(ZoomStep.MONTH1, first, today, end = w.endCenteredOn(Day(2026, 8, 26)))
        assertEquals(Day(2026, 8, 24), c.starts[2])
    }

    @Test
    fun zoomWindowWithFewerBarsThanTheStepShowsAllBars() {
        val w = ZoomWindow(ZoomStep.YEAR1, first, today)
        assertEquals(listOf(Day(2026, 8, 1), Day(2026, 9, 1)), w.starts)
        assertEquals(Triple(first, true, true), Triple(w.from, w.atStart, w.atEnd))
    }

    @Test
    fun zoomWindowBoxOnCoversTheFirstAndLastColumnsFullyOnlyAtTheEndsOfTheData() {
        // Data from a Friday to a Wednesday: 13 week columns, from 2026-07-06 to 2026-10-04.
        val friday = Day(2026, 7, 10)
        val wednesday = Day(2026, 9, 30)
        val firstColumn = Day(2026, 7, 6)
        val lastColumnEnd = Day(2026, 10, 4)
        fun window(step: ZoomStep, end: Day? = null) = ZoomWindow(step, friday, wednesday, end)

        val all = window(zoomSteps(friday, wednesday).last())
        assertEquals(friday to wednesday, all.from to all.to)
        assertEquals(DayRange(firstColumn, lastColumnEnd), all.boxOn(BarUnit.WEEK))
        // Month bars start on 2026-07-01, but the box starts with the first week column.
        assertEquals(DayRange(firstColumn, lastColumnEnd), window(ZoomStep.YEAR1).boxOn(BarUnit.WEEK))

        val newest = window(ZoomStep.MONTH1)
        assertEquals(DayRange(Day(2026, 8, 31), lastColumnEnd), newest.boxOn(BarUnit.WEEK))
        val oldest = window(ZoomStep.MONTH1, newest.endMovedBy(-100))
        assertEquals(DayRange(firstColumn, Day(2026, 8, 9)), oldest.boxOn(BarUnit.WEEK))
        val middle = window(ZoomStep.MONTH1, newest.endMovedBy(-3))
        assertEquals(DayRange(Day(2026, 8, 10), Day(2026, 9, 13)), middle.boxOn(BarUnit.WEEK))
    }
}
