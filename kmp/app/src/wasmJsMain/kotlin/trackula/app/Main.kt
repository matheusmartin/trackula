@file:OptIn(ExperimentalWasmJsInterop::class)

package trackula.app

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeViewport
import kotlinx.browser.document
import org.jetbrains.compose.resources.ExperimentalResourceApi
import org.jetbrains.compose.resources.preloadFont
import trackula.app.resources.Res
import trackula.app.resources.symbols
import trackula.model.Day
import trackula.services.Config
import trackula.services.historyBack
import trackula.services.onHistoryBack
import trackula.services.pickSpreadsheet
import trackula.services.pushHistoryEntry
import trackula.sheets.SheetsStore
import trackula.sheets.Store
import trackula.services.Session as GoogleSession
import trackula.services.today as browserToday

/**
 * Starts the app in the element `app` of index.html. The app shows after the browser loaded the icon font: before
 * that, each icon shows as its name, for example "refresh". Then it removes the element `splash`: the logo that the
 * page shows while the browser loads the app.
 */
@OptIn(ExperimentalComposeUiApi::class, ExperimentalResourceApi::class)
fun main() {
    ComposeViewport(document.getElementById("app")!!) {
        val symbols by preloadFont(Res.font.symbols)
        if (symbols != null) {
            App(BrowserPlatform)
            LaunchedEffect(Unit) { document.getElementById("splash")?.remove() }
        }
    }
}

/** The [Platform] of the browser. */
private object BrowserPlatform : Platform {
    override val config = Config.build
    override val isDemo = hasDemoParameter()

    override fun today(): Day = browserToday()

    override fun readPref(key: String): String? = trackula.services.readPref(key)

    override fun writePref(key: String, value: String?) = trackula.services.writePref(key, value)

    override val history = object : BrowserHistory {
        override fun push() = pushHistoryEntry()

        override fun back() = historyBack()

        override fun onBack(handler: () -> Unit) = onHistoryBack(handler)
    }

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
