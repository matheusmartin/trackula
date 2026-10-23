package trackula.app

import trackula.model.LogWrite
import trackula.sheets.Snapshot
import trackula.sheets.Store

/** A [Store] that counts the calls of [inner], for the UI tests. */
class CountingStore(private val inner: Store) : Store() {
    var loads = 0
    val writes = mutableListOf<LogWrite>()

    /** The data of the last load. The page loads after each write, so this has the result of the last write. */
    var last: Snapshot? = null

    override suspend fun refreshRules() = inner.refreshRules()

    override suspend fun load(writesScores: Boolean): Snapshot {
        loads++
        return inner.load(writesScores).also { last = it }
    }

    override suspend fun apply(write: LogWrite) {
        writes.add(write)
        inner.apply(write)
    }
}
