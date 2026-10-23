package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class NumberInputTest {
    @Test
    fun parseDecimalReadsAPeriodOrACommaAndRejectsOtherText() {
        assertEquals(
            listOf(81.9, 81.9, 82.0, 81.0, 0.5, 0.0),
            listOf("81.9", "81,9", " 82 ", "81.", ",5", "0").map(::parseDecimal),
        )
        for (text in listOf("", "abc", "-1", "1.2.3", "8 1")) assertNull(parseDecimal(text), text)
    }

    @Test
    fun stepDecimals() {
        assertEquals(listOf(1, 2, 0, 0, 0), listOf(0.1, 0.25, 5.0, 1.0, 250.0).map(::stepDecimals))
    }

    @Test
    fun roundToStepRemovesFloatNoiseSnapsToTheStepAndIsNeverBelow0() {
        assertEquals(0.3, roundToStep(0.1 + 0.2, 0.1))
        assertEquals(81.9, roundToStep(81.93, 0.1, snap = true))
        assertEquals(1250.0, roundToStep(1237.0, 250.0, snap = true))
        assertEquals(0.0, roundToStep(-0.3, 0.1))
    }

    @Test
    fun formatStep() {
        assertEquals(
            listOf("82.0", "1250", "90.5"),
            listOf(formatStep(82.0, 0.1), formatStep(1250.0, 250.0), formatStep(90.5, 0.5)),
        )
    }
}
