package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class FormatTest {
    @Test
    fun shortMonthAndShortDay() {
        assertEquals(listOf("Jan", "Sep", "Dec"), listOf(shortMonth(1), shortMonth(9), shortMonth(12)))
        assertEquals("Sep 28", shortDay(Day(2026, 9, 28)))
    }

    @Test
    fun formatTrimmedRemovesZerosAtTheEndAndFloatNoise() {
        assertEquals(
            listOf("82", "2.5", "2500", "82.1", "82", "-4", "0"),
            listOf(82.0, 2.5, 2500.0, 82.10000000000001, 82.00000000000001, -3.9999999999999996, -0.0000001)
                .map(::formatTrimmed),
        )
    }

    @Test
    fun formatNumberRoundsToTheDecimals() {
        assertEquals(
            listOf("81.3", "81", "81.26", "3"),
            listOf(formatNumber(81.25), formatNumber(81.04), formatNumber(81.256, 2), formatNumber(2.9999, 3)),
        )
    }

    @Test
    fun formatCompactGivesOneDecimalAtMostAndKFrom1000() {
        assertEquals(
            listOf("82.3", "7", "12.5k", "1k", "-1.5k"),
            listOf(82.25, 7.0, 12500.0, 1000.0, -1500.0).map(::formatCompact),
        )
    }

    @Test
    fun withUnitFormatSignedAndFormatPercent() {
        assertEquals(listOf("82.1 kg", "5"), listOf(withUnit("82.1", "kg"), withUnit("5", null)))
        assertEquals(
            listOf("−1.3 kg", "+0.46", "0 kg"),
            listOf(formatSigned(-1.3, "kg"), formatSigned(0.456, null), formatSigned(0.0, "kg")),
        )
        assertEquals(listOf("76%", "0%", "100%", "3%"), listOf(0.756, 0.0, 1.0, 0.025).map(::formatPercent))
    }

    @Test
    fun formatDateRangeShowsTheYearOnceOrTwiceAcrossAYear() {
        assertEquals("Jul 6 – Oct 3, 2026", formatDateRange(Day(2026, 7, 6), Day(2026, 10, 3)))
        assertEquals("Nov 3, 2025 – Feb 1, 2026", formatDateRange(Day(2025, 11, 3), Day(2026, 2, 1)))
    }

    @Test
    fun monthTitleAndMonthPairTitle() {
        assertEquals("October 2026", monthTitle(MonthKey(2026, 10)))
        assertEquals("September – October 2026", monthPairTitle(MonthKey(2026, 9), MonthKey(2026, 10)))
        assertEquals("December 2025 – January 2026", monthPairTitle(MonthKey(2025, 12), MonthKey(2026, 1)))
    }

    @Test
    fun weekLabelsShowTheMonthOnTheFirstRowAndWhenItChanges() {
        val weeks = weekRows(daysBetween(Day(2026, 9, 2), Day(2026, 10, 6)))
        assertEquals(listOf("Sep 2", "7", "14", "21", "28", "Oct 5"), weekLabels(weeks))
    }

    @Test
    fun barLabelAndBarTitle() {
        val start = Day(2026, 9, 28)
        assertEquals("Sep 28", barLabel(start, BarUnit.WEEK))
        assertEquals(
            listOf("Sep", "Jan ’26"),
            listOf(barLabel(Day(2026, 9, 1), BarUnit.MONTH), barLabel(Day(2026, 1, 1), BarUnit.MONTH)),
        )
        assertEquals("Sep ’26", barLabel(Day(2026, 9, 1), BarUnit.MONTH, first = true))
        assertEquals("Q3 ’26", barLabel(Day(2026, 7, 1), BarUnit.QUARTER))
        assertEquals("Week of Sep 28, 2026", barTitle(start, BarUnit.WEEK))
        assertEquals("Sep 2026", barTitle(Day(2026, 9, 1), BarUnit.MONTH))
        assertEquals("Q4 2026", barTitle(Day(2026, 10, 1), BarUnit.QUARTER))
    }
}
