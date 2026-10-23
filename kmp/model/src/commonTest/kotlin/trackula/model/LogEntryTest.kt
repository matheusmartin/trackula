package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class LogEntryTest {
    private val metrics = byId(weight, water, meditate)
    private val d29 = Day(2026, 9, 29)
    private val d30 = Day(2026, 9, 30)
    private val log = parseLog(
        rows(listOf("date", "weight", "meditate", "water"), listOf("2026-09-30", 82.1, 1)),
        metrics,
    ).table

    @Test
    fun yesNoCheckWritesYesUncheckWritesNoNoChangeReturnsNull() {
        assertEquals(SetCell(2, 2, "no"), planYesNo(meditate, d30, log, done = false))
        // The log has the old value 1 on 2026-09-30. It is yes, so a check changes nothing.
        assertNull(planYesNo(meditate, d30, log, done = true))
    }

    @Test
    fun aDayWithoutARowGetsANewRow() {
        assertEquals(AppendRow(d29, 2, "yes"), planYesNo(meditate, d29, log, done = true))
        assertEquals(listOf("2026-09-29", "", "yes"), AppendRow(d29, 2, "yes").toCells())
        assertEquals(
            listOf("2026-09-29", "", "no"),
            (planYesNo(meditate, d29, log, done = false) as AppendRow).toCells(),
        )
    }

    @Test
    fun cellValueGivesYesAndNoForYesNoAndTheNumberForNumberMetrics() {
        assertEquals(listOf("yes", "no", null), listOf(1.0, 0.0, null).map { cellValue(meditate, it) })
        assertEquals(listOf(81.9, null), listOf(cellValue(weight, 81.9), cellValue(water, null)))
    }

    @Test
    fun numberSetsTheCellOfTheDayRow() {
        assertEquals(SetCell(2, 1, 81.9), planNumber(weight, d30, 81.9, log))
        assertEquals(SetCell(2, 3, 5.0), planNumber(water, d30, 5.0, log))
        assertNull(planNumber(weight, d30, 82.1, log))
    }

    @Test
    fun clearEmptiesTheCellOrDoesNothing() {
        assertEquals(SetCell(2, 1, null), planClear(weight, d30, log))
        assertNull(planClear(water, d30, log))
        assertNull(planClear(weight, d29, log))
    }

    @Test
    fun countAppliesTheTapsToTheLatestValue() {
        assertEquals(SetCell(2, 3, 2.0), planCount(water, d30, listOf(CountStep(1.0), CountStep(1.0)), log))
        assertEquals(
            listOf("2026-09-29", "", "", 1.0),
            (planCount(water, d29, listOf(CountStep(1.0)), log) as AppendRow).toCells(),
        )
        assertNull(planCount(water, d29, listOf(CountStep(-1.0)), log))
    }

    @Test
    fun throwsIfTheMetricHasNoColumn() {
        val steps = NumberMetric(id = "steps", name = "Steps", icon = "footprint")
        assertFailsWith<MissingColumnException> { planNumber(steps, d30, 1.0, log) }
    }

    @Test
    fun applyCountStepsAddsAndSubtracts() {
        assertEquals(1.0, applyCountSteps(null, listOf(CountStep(1.0))))
        assertEquals(2.0, applyCountSteps(3.0, listOf(CountStep(-1.0))))
        assertEquals(4.0, applyCountSteps(3.0, listOf(CountStep(1.0), CountStep(1.0), CountStep(-1.0))))
    }

    @Test
    fun applyCountStepsGives0OrLessAsAnEmptyCellAlsoBetweenSteps() {
        assertNull(applyCountSteps(1.0, listOf(CountStep(-1.0))))
        assertNull(applyCountSteps(null, listOf(CountStep(-1.0))))
        assertEquals(1.0, applyCountSteps(null, listOf(CountStep(-1.0), CountStep(1.0))))
    }

    @Test
    fun applyCountStepsRemovesFloatNoiseFromDecimalSteps() {
        assertEquals(0.3, applyCountSteps(0.2, listOf(CountStep(0.1))))
    }
}
