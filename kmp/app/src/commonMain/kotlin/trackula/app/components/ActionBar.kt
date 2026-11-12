package trackula.app.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * The place of the main action of a page, for example the Save button of the Today tiles. The App shows [content] above
 * the bottom navigation bar, so that the action stays in view while the page scrolls. See [ActionBar].
 */
class ActionBarHost {
    var content by mutableStateOf<(@Composable () -> Unit)?>(null)

    /** The [ActionBar] call that set [content]. Only that call removes the content when it leaves the page. */
    internal var owner: Any? = null
}

/** The [ActionBarHost] of the App. Null without the App, for example in a test of one page. */
val LocalActionBarHost = staticCompositionLocalOf<ActionBarHost?> { null }

/**
 * Shows [content] as the main action of the page. With an [ActionBarHost], it shows there, and here it shows nothing.
 * Without one, it shows here, in the page.
 */
@Composable
fun ActionBar(content: @Composable () -> Unit) {
    val host = LocalActionBarHost.current
    if (host == null) {
        content()
        return
    }
    val owner = remember { Any() }
    SideEffect {
        host.owner = owner
        host.content = content
    }
    DisposableEffect(host) {
        onDispose {
            // During the fade between two views, a new action can already show: then it stays.
            if (host.owner === owner) {
                host.owner = null
                host.content = null
            }
        }
    }
}
