package trackula.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CountQueueTest {
    private val water = NumberMetric(id = "water", name = "Water", icon = "water_drop", isCount = true)
    private val walk = NumberMetric(id = "walk", name = "Walk", icon = "directions_walk", step = 10.0, isCount = true)
    private val metrics = byId(water, walk, meditate)
    private val d30 = Day(2026, 9, 30)
    private val d01 = Day(2026, 10, 1)
    private val plus = CountStep(1.0)
    private val minus = CountStep(-1.0)

    /** The deltas of each cell of [pending], to compare them with `assertEquals`. */
    private fun deltas(pending: Map<MetricDay, List<CountStep>>): Map<MetricDay, List<Double>> =
        pending.mapValues { (_, steps) -> steps.map { it.delta } }

    private fun log(vararg rows: List<Any?>): LogTable =
        parseLog(listOf(listOf("date", "water", "walk", "meditate")) + rows, metrics).table

    @Test
    fun aNewQueueHasNoTaps() {
        val queue = CountQueue()
        assertFalse(queue.hasQueued)
        assertFalse(queue.isSending)
        assertEquals(emptyMap(), queue.pending)
        assertEquals(emptyList(), queue.send(metrics))
    }

    @Test
    fun addKeepsTapsInTapOrderPerCell() {
        val queue = CountQueue().apply {
            add("water", d30, plus)
            add("water", d30, minus)
            add("water", d01, plus)
        }
        assertTrue(queue.hasQueued)
        assertEquals(
            mapOf(MetricDay("water", d30) to listOf(1.0, -1.0), MetricDay("water", d01) to listOf(1.0)),
            deltas(queue.pending),
        )
    }

    @Test
    fun sendGivesOnePlanForEachCellWithAllTapsOfThatCell() {
        val queue = CountQueue().apply {
            add("water", d30, plus)
            add("water", d30, plus)
            add("walk", d30, CountStep(10.0))
        }
        val plans = queue.send(metrics)
        assertFalse(queue.hasQueued)
        assertTrue(queue.isSending)

        val current = log(listOf("2026-09-30", 3, 20))
        assertEquals(listOf(SetCell(2, 1, 5.0), SetCell(2, 2, 30.0)), plans.map { it(current) })
    }

    @Test
    fun aPlanAddsTheTapsToTheLatestValueNotToTheValueAtTheTap() {
        val queue = CountQueue().apply { add("water", d30, plus) }
        val plan = queue.send(metrics).single()
        // Another device wrote 6 after the tap.
        assertEquals(SetCell(2, 1, 7.0), plan(log(listOf("2026-09-30", 6))))
    }

    @Test
    fun tapsDuringAWriteWaitForTheNextWriteAndPendingShowsBoth() {
        val queue = CountQueue().apply { add("water", d30, plus) }
        queue.send(metrics)
        queue.add("water", d30, plus)
        queue.add("water", d01, plus)
        assertTrue(queue.hasQueued)
        assertEquals(
            mapOf(MetricDay("water", d30) to listOf(1.0, 1.0), MetricDay("water", d01) to listOf(1.0)),
            deltas(queue.pending),
        )

        queue.sent()
        assertFalse(queue.isSending)
        assertEquals(
            mapOf(MetricDay("water", d30) to listOf(1.0), MetricDay("water", d01) to listOf(1.0)),
            deltas(queue.pending),
        )
        assertEquals(2, queue.send(metrics).size)
    }

    @Test
    fun aTapAfterSendDoesNotChangeThePlanOfTheWriteThatRuns() {
        val queue = CountQueue().apply { add("water", d30, plus) }
        val plan = queue.send(metrics).single()
        queue.add("water", d30, plus)
        assertEquals(SetCell(2, 1, 4.0), plan(log(listOf("2026-09-30", 3))))
    }

    @Test
    fun sendDuringAWriteThrowsSoTwoWritesCannotOverwriteEachOther() {
        val queue = CountQueue().apply { add("water", d30, plus) }
        queue.send(metrics)
        queue.add("water", d30, plus)
        assertFailsWith<IllegalStateException> { queue.send(metrics) }
    }

    @Test
    fun sentDropsTheTapsOfTheWriteAlsoAfterAFailedWrite() {
        val queue = CountQueue().apply { add("water", d30, plus) }
        queue.send(metrics)
        queue.sent()
        assertEquals(emptyMap(), queue.pending)
        assertFalse(queue.hasQueued)
    }

    @Test
    fun aMetricThatIsGoneOrNotANumberMetricGetsNoPlanAndSentDropsItsTaps() {
        val queue = CountQueue().apply {
            add("gone", d30, plus)
            add("meditate", d30, plus)
            add("water", d30, plus)
        }
        assertEquals(1, queue.send(metrics).size)
        queue.sent()
        assertEquals(emptyMap(), queue.pending)
    }

    @Test
    fun aDayWithoutARowGetsANewRow() {
        val queue = CountQueue().apply { add("walk", d01, CountStep(10.0)) }
        val plan = queue.send(metrics).single()
        assertEquals(listOf("2026-10-01", "", 10.0), (plan(log()) as AppendRow).toCells())
    }
}
