package trackula.sheets

import trackula.model.LogTable
import trackula.model.LogWrite
import trackula.model.Metric

/**
 * The data of the spreadsheet at one point in time.
 *
 * @property metrics All metrics, in sheet order.
 */
data class Snapshot(val metrics: List<Metric>, val log: LogTable, val warnings: List<String>)

/**
 * The storage of the metrics and the log. [SheetsStore] uses Google Sheets. [DemoStore] keeps sample data in memory,
 * for demo mode.
 */
abstract class Store {
    /** Sets the data validation rules of the sheet again. Nothing in demo mode. */
    abstract suspend fun refreshRules()

    /**
     * Reads the metrics and the log, and validates each row.
     *
     * [writesScores]: true if the load also writes the scores that changed in the `Score` column. Only [SheetsStore]
     * writes them. See docs/data-model.md.
     */
    abstract suspend fun load(writesScores: Boolean = true): Snapshot

    /** Writes [write]. Callers use [change] or [changeAll], which plan the write on the latest data. */
    abstract suspend fun apply(write: LogWrite)

    /**
     * Reads the latest data, writes the change of [plan] on it, and reads the data again.
     *
     * The read before the write keeps row numbers correct after manual edits in the sheet.
     */
    suspend fun change(plan: (LogTable) -> LogWrite?): Snapshot = changeAll(listOf(plan))

    /**
     * Runs [plans] one after the other, each on the latest data. So a plan sees the row that an earlier plan added
     * for the same day.
     *
     * It writes the scores once, after the last write: not after each plan. Example: the Save button of 9 Today tiles
     * writes the score of today once, not 9 times.
     */
    suspend fun changeAll(plans: List<(LogTable) -> LogWrite?>): Snapshot {
        var data = load(writesScores = false)
        // True if a write came after the last load that wrote the scores.
        var scoresStale = false
        for ((i, plan) in plans.withIndex()) {
            val write = plan(data.log) ?: continue
            apply(write)
            val isLast = i == plans.lastIndex
            data = load(writesScores = isLast)
            scoresStale = !isLast
        }
        return if (scoresStale) load() else data
    }
}
