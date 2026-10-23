package trackula.app.components

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class TileRowsTest {
    private fun rows(pattern: String, columns: Int) = tileRows(pattern.toList(), columns) { it == 'W' }

    @Test
    fun smallItemsFillTheRowsInOrder() {
        assertEquals(listOf(listOf(0, 1), listOf(2, 3), listOf(4)), rows("sssss", 2))
    }

    @Test
    fun aWideItemTakesAFullRowAndALaterSmallItemFillsTheGapBeforeIt() {
        assertEquals(listOf(listOf(0, 2), listOf(1)), rows("sWs", 3))
        assertEquals(listOf(listOf(0, 2), listOf(1), listOf(3, 4)), rows("sWsss", 2))
    }

    @Test
    fun wideItemsKeepTheirOrder() {
        assertEquals(listOf(listOf(0), listOf(1), listOf(2, 3)), rows("WWss", 4))
    }

    @Test
    fun noItemsGiveNoRowsAndAGridNeedsAColumn() {
        assertEquals(emptyList(), rows("", 2))
        assertFailsWith<IllegalArgumentException> { rows("s", 0) }
    }

    @Test
    fun groupLabelStartsWithACapitalLetter() {
        assertEquals(listOf("Habits", "Body", "", "Ärger"), listOf("habits", "Body", "", "ärger").map(::groupLabel))
    }
}
