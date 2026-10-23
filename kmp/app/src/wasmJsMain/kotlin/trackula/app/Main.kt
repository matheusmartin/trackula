@file:OptIn(ExperimentalWasmJsInterop::class)

package trackula.app

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeViewport
import kotlinx.browser.document
import trackula.model.Day
import trackula.services.Config
import trackula.services.pickSpreadsheet
import trackula.sheets.SheetsStore
import trackula.sheets.Store
import trackula.services.Session as GoogleSession
import trackula.services.today as browserToday

/** Starts the app in the `<body>` of index.html. */
@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    ComposeViewport(document.body!!) {
        App(BrowserPlatform)
    }
}

/** The [Platform] of the browser. */
private object BrowserPlatform : Platform {
    override val config = Config.build
    override val isDemo = hasDemoParameter()

    override fun today(): Day = browserToday()

    override fun readPref(key: String): String? = trackula.services.readPref(key)

    override fun writePref(key: String, value: String?) = trackula.services.writePref(key, value)

    override suspend fun signIn(selectAccount: Boolean): Session =
        BrowserSession(GoogleSession.signIn(selectAccount, config))
}

/** A [Session] with the Google access token of [google]. */
private class BrowserSession(private val google: GoogleSession) : Session {
    override val expired: Boolean get() = google.expired

    override suspend fun pickSpreadsheet(): String? = pickSpreadsheet(google.accessToken)

    override suspend fun prepare(spreadsheetId: String) = (store(spreadsheetId) as SheetsStore).ensureTabs()

    override fun store(spreadsheetId: String): Store = google.store(spreadsheetId)
}

/** True if the URL of the page has the parameter `demo`, for example `?demo`. */
private fun hasDemoParameter(): Boolean = js("new URLSearchParams(window.location.search).has('demo')")
