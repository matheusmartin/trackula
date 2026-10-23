package trackula.model

/**
 * The count taps that are not in the sheet yet, per cell.
 *
 * A tap goes to the queue first. [send] moves all queued taps to the write that runs now, and [sent] removes them
 * when that write ends. Taps that come during the write stay in the queue for the next write. So only one write runs
 * at a time, and two writes cannot overwrite each other.
 */
class CountQueue {
    /** Taps that wait for a write, per cell, in tap order. */
    private val queued = mutableMapOf<MetricDay, MutableList<CountStep>>()

    /** Taps in the write that runs now. The app shows them until the new data arrives. */
    private val sending = mutableMapOf<MetricDay, MutableList<CountStep>>()

    /** True if taps wait for a write. */
    val hasQueued: Boolean get() = queued.isNotEmpty()

    /** True while a write of taps runs: after [send] and before [sent]. */
    val isSending: Boolean get() = sending.isNotEmpty()

    /** All taps that are not in the sheet yet, per cell. The taps of the write that runs now come first. */
    val pending: Map<MetricDay, List<CountStep>>
        get() = (sending.keys + queued.keys).associateWith { sending[it].orEmpty() + queued[it].orEmpty() }

    /** Adds a tap of [step] on the cell of [metricId] on [day]. */
    fun add(metricId: String, day: Day, step: CountStep) {
        queued.getOrPut(MetricDay(metricId, day)) { mutableListOf() }.add(step)
    }

    /**
     * Moves the queued taps to the write that runs now. Returns one plan for each cell with all taps of that cell.
     *
     * Each plan adds the taps to the latest value in the sheet. A cell of a metric that is not a number metric of
     * [metrics], for example a metric that is gone from the sheet, gets no plan: [sent] drops its taps.
     * Throws an [IllegalStateException] if a write runs: call [sent] first.
     */
    fun send(metrics: Map<String, Metric>): List<(LogTable) -> LogWrite?> {
        check(!isSending) { "A write of count taps runs. Call sent() first." }
        sending.putAll(queued)
        queued.clear()
        return sending.mapNotNull { (key, steps) ->
            val metric = metrics[key.metricId] as? NumberMetric ?: return@mapNotNull null
            val taps = steps.toList()
            val plan: (LogTable) -> LogWrite? = { log -> planCount(metric, key.day, taps, log) }
            plan
        }
    }

    /**
     * Removes the taps of the write that ran. Call it when the write ends, also after an error: so the taps of a failed
     * write are not written again.
     */
    fun sent() = sending.clear()
}
