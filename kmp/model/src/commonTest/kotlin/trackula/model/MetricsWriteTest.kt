package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class MetricsWriteTest {
    /** Rows 2 and 3 are metrics, row 4 is empty, row 5 has no icon, row 6 is a metric. A `notes` column is last. */
    private val table = parseMetrics(
        rows(
            metricsHeader + "notes",
            listOf("weight", "Weight", "number", "kg", 0.1, "", "monitor_weight", "", "mine"),
            listOf("meditate", "Meditate", "yesno", "", "", "", "self_improvement"),
            listOf(),
            listOf("walk", "Walk", "yesno"),
            listOf("water", "Water", "count", "glasses", 1, "", "water_drop", "at least 8"),
        ),
    )

    @Test
    fun saveWritesTheKnownColumnsInTheRowOfTheMetric() {
        val write = planSaveMetric(table, water.copy(name = "Drinks", isCount = true)).single()
        write as SetMetricCells
        assertEquals(6, write.row)
        assertEquals("Drinks", write.cells[1])
        assertEquals("count", write.cells[2])
        assertEquals("", write.cells[7])
        // The other columns do not change.
        assertEquals(setOf(0, 1, 2, 3, 4, 5, 6, 7), write.cells.keys)
    }

    @Test
    fun saveOfANewMetricWritesTheRowAfterTheLastRow() {
        val write = planSaveMetric(table, YesNoMetric("read", "Read", "menu_book")).single() as SetMetricCells
        assertEquals(7, write.row)
        assertEquals("read", write.cells[0])
    }

    @Test
    fun saveAddsTheGoalColumnOfAnOlderSheetFirst() {
        val old = parseMetrics(rows(metricsHeader - "goal", listOf("read", "Read", "yesno", "", "", "", "menu_book")))
        val writes = planSaveMetric(old, YesNoMetric("read", "Read", "menu_book", goalIsYes = false))
        assertEquals(AddMetricsColumns(7, listOf("goal")), writes[0])
        assertEquals("no", (writes[1] as SetMetricCells).cells[7])
    }

    @Test
    fun aFixWritesTheInvalidRowThatHasTheSameCells() {
        val walk = table.invalid.single()
        val write = planFixRow(table, walk, YesNoMetric("walk", "Walk", "directions_walk")).single() as SetMetricCells
        assertEquals(5, write.row)
        assertEquals(DeleteMetricRow(5), planDeleteRow(table, walk))

        val changed = walk.copy(cells = walk.cells + ("name" to "Run"))
        assertFailsWith<ChangedRowException> { planFixRow(table, changed, YesNoMetric("walk", "Walk", "x")) }
    }

    @Test
    fun deleteGivesTheRowOfTheMetricAndAMissingMetricThrows() {
        assertEquals(DeleteMetricRow(3), planDeleteMetric(table, "meditate"))
        assertFailsWith<MissingMetricException> { planDeleteMetric(table, "steps") }
    }

    @Test
    fun aMoveGoesPastTheEmptyAndInvalidRowsToTheNextMetric() {
        assertEquals(MoveMetricRow(6, 3), planMoveMetric(table, "water", up = true))
        assertEquals(MoveMetricRow(3, 7), planMoveMetric(table, "meditate", up = false))
        assertEquals(MoveMetricRow(2, 4), planMoveMetric(table, "weight", up = false))
    }

    @Test
    fun theFirstMetricDoesNotMoveUpAndTheLastDoesNotMoveDown() {
        assertNull(planMoveMetric(table, "weight", up = true))
        assertNull(planMoveMetric(table, "water", up = false))
        assertFailsWith<MissingMetricException> { planMoveMetric(table, "steps", up = true) }
    }
}
