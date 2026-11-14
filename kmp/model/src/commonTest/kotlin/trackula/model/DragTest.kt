package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals

class DragTest {
    private val heights = listOf(50f, 50f, 50f)

    @Test
    fun theItemGoesPastAnotherItemAfterItsMiddle() {
        assertEquals(0, dropIndex(from = 0, offset = 20f, heights = heights))
        assertEquals(1, dropIndex(from = 0, offset = 30f, heights = heights))
        assertEquals(2, dropIndex(from = 0, offset = 80f, heights = heights))
        assertEquals(1, dropIndex(from = 2, offset = -30f, heights = heights))
        assertEquals(0, dropIndex(from = 2, offset = -80f, heights = heights))
    }

    @Test
    fun theItemStaysInTheList() {
        assertEquals(2, dropIndex(from = 0, offset = 500f, heights = heights))
        assertEquals(0, dropIndex(from = 1, offset = -500f, heights = heights))
        assertEquals(1, dropIndex(from = 1, offset = 0f, heights = heights))
    }

    @Test
    fun itemsOfDifferentHeightsUseTheirOwnMiddle() {
        // The item 1 is 100 high: the item 0 goes past it after 50.
        val mixed = listOf(40f, 100f, 40f)
        assertEquals(0, dropIndex(from = 0, offset = 45f, heights = mixed))
        assertEquals(1, dropIndex(from = 0, offset = 55f, heights = mixed))
    }

    @Test
    fun theItemsBetweenThePlacesMakeSpace() {
        // Down: the items after the dragged item move up.
        assertEquals(listOf(0f, -50f, -50f, 0f), (0..3).map { dragShift(it, from = 0, to = 2, height = 50f) })
        // Up: the items before the dragged item move down.
        assertEquals(listOf(0f, 40f, 40f, 0f), (0..3).map { dragShift(it, from = 3, to = 1, height = 40f) })
        // Not moved: nothing moves.
        assertEquals(listOf(0f, 0f, 0f), (0..2).map { dragShift(it, from = 1, to = 1, height = 50f) })
    }
}
