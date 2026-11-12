@file:OptIn(ExperimentalWasmJsInterop::class)

package trackula.services

import kotlinx.browser.window

/**
 * Adds an entry with the same URL to the history of the browser tab. Then the Back button of the browser, or the back
 * gesture of a phone, stays in the app: the browser removes this entry and calls the function of [onHistoryBack].
 */
fun pushHistoryEntry() = pushState()

/** Goes one entry back in the history of the browser tab, as the Back button does. */
fun historyBack() = window.history.back()

/** Calls [handler] each time the browser goes back or forward in the history of the tab. */
fun onHistoryBack(handler: () -> Unit) {
    window.addEventListener("popstate") { handler() }
}

private fun pushState(): Unit = js("window.history.pushState(null, '')")
