package trackula.app

import kotlinx.coroutines.CompletableDeferred
import trackula.model.LogWrite
import trackula.sheets.Snapshot
import trackula.sheets.Store

/**
 * A [Store] that counts the calls of [inner], for the UI tests. With [failWrites], each write fails at once, as
 * without a network. With a [gate], each write waits until the test completes the gate, and then fails if [failWrites].
 */
class CountingStore(private val inner: Store) : Store() {
    var loads = 0
    val writes = mutableListOf<LogWrite>()

    /** The data of the last load. The page loads after each write, so this has the result of the last write. */
    var last: Snapshot? = null
    var failWrites = false

    /** True: only the next write fails. */
    var failOnce = false
    var gate: CompletableDeferred<Unit>? = null

    override suspend fun refreshRules() = inner.refreshRules()

    override suspend fun load(writesScores: Boolean): Snapshot {
        loads++
        return inner.load(writesScores).also { last = it }
    }

    override suspend fun apply(write: LogWrite) {
        gate?.await()
        if (failOnce) {
            failOnce = false
            throw IllegalStateException("No network.")
        }
        if (failWrites) throw IllegalStateException("No network.")
        writes.add(write)
        inner.apply(write)
    }
}
