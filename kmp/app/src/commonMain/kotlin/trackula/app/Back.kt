package trackula.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * The history of the browser tab, for the Back button of the browser and the back gesture of a phone. `BrowserPlatform`
 * uses the History API. The UI tests use a fake.
 */
interface BrowserHistory {
    /** Adds an entry for the current page. A later back removes it and calls the function of [onBack]. */
    fun push()

    /** Goes one entry back, as the Back button does. The function of [onBack] also runs. */
    fun back()

    /** Sets the function that runs after each back of the browser. */
    fun onBack(handler: () -> Unit)
}

/**
 * Sends the Back button of the browser to the screen on top: a detail screen, the metrics screen or a form. Without
 * it, Back leaves the app, also from a detail screen of the installed app on a phone.
 *
 * Each screen that can close adds a handler while it shows (see [OnBack]). Each handler has one entry in the browser
 * history. Back removes the entry of the newest handler: the dispatcher adds the entry again and calls the handler. If
 * the handler closes its screen, the screen removes the handler, and the dispatcher removes the entry. If the handler
 * keeps its screen open, for example to ask about unsaved changes, the entry stays for the next Back.
 */
class BackDispatcher(private val history: BrowserHistory) {
    private val handlers = mutableListOf<() -> Unit>()

    /** The number of backs that the dispatcher started itself. Their events do not call a handler. */
    private var ownBacks = 0

    init {
        history.onBack {
            when {
                ownBacks > 0 -> ownBacks--

                handlers.isNotEmpty() -> {
                    history.push()
                    handlers.last().invoke()
                }
            }
        }
    }

    /** Adds [handler] as the newest handler. Back calls only the newest handler. */
    fun add(handler: () -> Unit) {
        handlers.add(handler)
        history.push()
    }

    /** Removes [handler] and its history entry. Call it when the screen closes. */
    fun remove(handler: () -> Unit) {
        if (!handlers.remove(handler)) return
        ownBacks++
        history.back()
    }
}

/** The [BackDispatcher] of the App. Null without the App, for example in a test of one page. */
val LocalBackDispatcher = staticCompositionLocalOf<BackDispatcher?> { null }

/**
 * While [enabled], the Back button of the browser calls [onBack] and does not leave the app. Use it on a screen that
 * has its own back or close button, with the same function.
 */
@Composable
fun OnBack(enabled: Boolean = true, onBack: () -> Unit) {
    val dispatcher = LocalBackDispatcher.current ?: return
    val current by rememberUpdatedState(onBack)
    DisposableEffect(dispatcher, enabled) {
        if (!enabled) return@DisposableEffect onDispose {}
        val handler: () -> Unit = { current() }
        dispatcher.add(handler)
        onDispose { dispatcher.remove(handler) }
    }
}
