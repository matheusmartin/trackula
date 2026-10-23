package trackula.app

import trackula.model.Day
import trackula.services.Config
import trackula.sheets.DemoStore
import trackula.sheets.Store
import kotlin.time.Duration

/** A [Platform] for the UI tests. [signIn] gives a [FakeSession] with demo data. */
class FakePlatform(
    override val config: Config = Config("123-abc.apps.googleusercontent.com", "key"),
    override val isDemo: Boolean = false,
    override var savedSpreadsheetId: String? = null,
) : Platform {
    val today = Day(2026, 10, 3)
    var signIns = 0
    val session = FakeSession(today)

    override fun today(): Day = today

    override suspend fun signIn(selectAccount: Boolean): Session {
        signIns++
        return session
    }
}

/** A [Session] that picks the spreadsheet `sheet-1` and stores demo data in memory. */
class FakeSession(today: Day) : Session {
    override var expired = false
    val prepared = mutableListOf<String>()
    private val store = DemoStore(today, delay = Duration.ZERO)

    override suspend fun pickSpreadsheet(): String = "sheet-1"

    override suspend fun prepare(spreadsheetId: String) {
        prepared.add(spreadsheetId)
    }

    override fun store(spreadsheetId: String): Store = store
}
