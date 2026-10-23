package trackula.app

import trackula.model.LogWrite
import trackula.sheets.Snapshot
import trackula.sheets.Store

/** A [Store] that counts the calls of [inner], for the UI tests. */
class CountingStore(private val inner: Store) : Store() {
    var loads = 0
    val writes = mutableListOf<LogWrite>()

    override suspend fun refreshRules() = inner.refreshRules()

    override suspend fun load(writesScores: Boolean): Snapshot {
        loads++
        return inner.load(writesScores)
    }

    override suspend fun apply(write: LogWrite) {
        writes.add(write)
        inner.apply(write)
    }
}
