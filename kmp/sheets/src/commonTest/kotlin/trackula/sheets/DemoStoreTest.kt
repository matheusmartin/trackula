package trackula.sheets

import kotlinx.coroutines.test.runTest
import trackula.model.Day
import trackula.model.NumberGoal
import trackula.model.NumberMetric
import trackula.model.YesNoMetric
import trackula.model.planClear
import trackula.model.planDeleteMetric
import trackula.model.planMoveMetric
import trackula.model.planNumber
import trackula.model.planSaveMetric
import trackula.model.planYesNo
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.time.Duration

class DemoStoreTest {
    private val today = Day(2026, 10, 3)

    private fun store() = DemoStore(today, delay = Duration.ZERO)

    @Test
    fun loadsTheSampleDataWithoutWarningsAndTodayHasNoValues() = runTest {
        val s = store().load()
        assertEquals(emptyList(), s.warnings)
        assertEquals(9, s.metrics.size)
        assertEquals(emptyList(), s.deleted)
        assertEquals(120, s.log.rows.size)
        assertFalse(today in s.log.rows)
    }

    @Test
    fun theSampleWaistIsOnceAWeekInStepsOfAHalfCentimeter() {
        // 187.5 half centimeters rounds away from zero, as Dart does.
        assertEquals(94.0, DemoStore.sampleWaist(70))
        assertEquals(92.0, DemoStore.sampleWaist(7))
        assertEquals(95.0, DemoStore.sampleWaist(112))
        assertNull(DemoStore.sampleWaist(8))
    }

    @Test
    fun changeAllAddsOneRowForTodayAlsoForTwoValues() = runTest {
        val st = store()
        val metrics = st.load().metrics
        val weight = metrics.first { it.id == "weight" } as NumberMetric
        val meditate = metrics.first { it.id == "meditate" } as YesNoMetric
        val s = st.changeAll(
            listOf(
                { planNumber(weight, today, 82.3, it) },
                { planYesNo(meditate, today, it, done = true) },
            ),
        )
        assertEquals(emptyList(), s.warnings)
        assertEquals(121, s.log.rows.size)
        assertEquals(82.3, s.log.valueAt("weight", today))
        assertEquals(1.0, s.log.valueAt("meditate", today))

        val cleared = st.change { planClear(weight, today, it) }
        assertNull(cleared.log.valueAt("weight", today))
    }

    @Test
    fun aNewMetricGetsALogColumnSoThatItTakesValues() = runTest {
        val st = store()
        val read =
            NumberMetric(id = "pages", name = "Pages", icon = "menu_book", goal = NumberGoal(20.0), isCount = true)
        val added = st.changeMetrics { planSaveMetric(it, read) }
        assertEquals(read, added.metrics.last())

        val s = st.change { planNumber(read, today, 12.0, it) }
        assertEquals(12.0, s.log.valueAt("pages", today))
        assertEquals(emptyList(), s.warnings)
    }

    @Test
    fun deleteAndMoveChangeTheOrderOfTheSampleMetrics() = runTest {
        val st = store()
        val moved = st.changeMetrics { listOfNotNull(planMoveMetric(it, "waist", up = true)) }
        assertEquals(listOf("waist", "weight"), moved.metrics.take(2).map { it.id })

        val deleted = st.changeMetrics { listOf(planDeleteMetric(it, "waist")) }
        assertEquals("weight", deleted.metrics.first().id)
        assertEquals(listOf("waist"), deleted.deleted.map { it.id })
    }
}
