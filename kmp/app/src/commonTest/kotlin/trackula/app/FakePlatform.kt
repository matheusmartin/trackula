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
    savedSpreadsheetId: String? = null,
) : Platform {
    /** The local storage. */
    val prefs = mutableMapOf<String, String>().apply { savedSpreadsheetId?.let { put("spreadsheetId", it) } }

    override fun readPref(key: String): String? = prefs[key]

    override fun writePref(key: String, value: String?) {
        if (value == null) prefs.remove(key) else prefs[key] = value
    }

    override val history = FakeHistory()

    val today = Day(2026, 10, 3)

    /** The selectAccount argument of each sign-in. */
    val signIns = mutableListOf<Boolean>()
    val session = FakeSession(today)

    override fun today(): Day = today

    override suspend fun signIn(selectAccount: Boolean): Session {
        signIns.add(selectAccount)
        return session
    }
}

/**
 * A [BrowserHistory] in memory. [entries] is the number of entries that the app added and that are still there.
 * [userBack] is the Back button of the browser.
 */
class FakeHistory : BrowserHistory {
    var entries = 0
    private var handler: () -> Unit = {}

    override fun push() {
        entries++
    }

    override fun back() {
        if (entries == 0) return
        entries--
        handler()
    }

    override fun onBack(handler: () -> Unit) {
        this.handler = handler
    }

    /** The user presses the Back button of the browser. */
    fun userBack() = back()
}

/** A [Session] that picks the spreadsheet `sheet-1` and stores demo data in memory. */
class FakeSession(today: Day) : Session {
    override var expired = false
    val prepared = mutableListOf<String>()
    val store = CountingStore(DemoStore(today, delay = Duration.ZERO))

    override suspend fun pickSpreadsheet(): String = "sheet-1"

    override suspend fun prepare(spreadsheetId: String) {
        prepared.add(spreadsheetId)
    }

    override fun store(spreadsheetId: String): Store = store
}
