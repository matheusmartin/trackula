package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class NumbersTest {
    @Test
    fun toFixedRoundsAHalfAwayFromZeroAsJavaScript() {
        assertEquals(
            listOf("81.3", "82.0", "2.67", "-3", "1250", "-0.00", "0.00", "0.300000"),
            listOf(
                toFixed(81.25, 1), toFixed(82.0, 1), toFixed(2.675, 2), toFixed(-2.5, 0), toFixed(1250.0, 0),
                toFixed(-0.001, 2), toFixed(-0.0, 2), toFixed(0.1 + 0.2, 6),
            ),
        )
    }

    @Test
    fun toFixedSpellsNaNAndInfinityAsJavaScript() {
        assertEquals(
            listOf("NaN", "Infinity", "-Infinity"),
            listOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY).map { toFixed(it, 2) },
        )
    }

    @Test
    fun roundHalfAwayFromZero() {
        assertEquals(
            listOf(3.0, -3.0, 2.0, -2.0, 0.0),
            listOf(2.5, -2.5, 2.4999, -1.5, 0.4).map(::roundHalfAwayFromZero),
        )
    }

    @Test
    fun parseNumberReadsOnlyDecimalNumbers() {
        assertEquals(listOf(8.0, -1500.0, 0.5, 5.0), listOf("8", "-1.5e3", ".5", "+5").map(::parseNumber))
        for (text in listOf("", "0x10", "NaN", "Infinity", "5d", "1,5", " 8")) assertNull(parseNumber(text), text)
    }

    @Test
    fun numberOfReadsEachNumberType() {
        assertEquals(listOf(1.0, 2.0, 2.5, null, null), listOf<Any?>(1, 2L, 2.5, "1", null).map(::numberOf))
    }
}
