package trackula.app.pages

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import trackula.app.errorText
import trackula.model.Day
import trackula.model.MainView
import trackula.sheets.Snapshot
import trackula.sheets.Store

/** The reload button in the app bar calls [run]. The Today page sets it. */
class ReloadHandle {
    var run: (() -> Unit)? = null
}

/**
 * The main page: the metrics in Today tiles, a table or calendars, where the user records entries, or the score only.
 *
 * - [store]: the store of the sheet, or of demo mode.
 * - [expired]: true after the Google sign-in expired. Then [onExpired] runs instead of a store call.
 * - [view]: the view of the bottom navigation bar. The App owns it.
 * - [reload]: the reload button in the app bar calls it. The page sets it.
 * - [onBusy]: called when a load or a write starts and ends.
 *
 * This first version loads the data and shows the metric names. The views come in the next step of the port.
 */
@Composable
fun TodayPage(
    store: Store,
    today: Day,
    expired: () -> Boolean,
    onExpired: () -> Unit,
    view: MainView,
    reload: ReloadHandle,
    onBusy: (Boolean) -> Unit,
) {
    // The latest callbacks: the reload handle keeps one function for the life of the page.
    val currentExpired by rememberUpdatedState(expired)
    val currentOnExpired by rememberUpdatedState(onExpired)
    val currentOnBusy by rememberUpdatedState(onBusy)
    var data by remember(store) { mutableStateOf<Snapshot?>(null) }
    var error by remember(store) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    /** Runs [task] and shows its data. */
    fun run(task: suspend () -> Snapshot) {
        if (currentExpired()) return currentOnExpired()
        error = null
        currentOnBusy(true)
        scope.launch {
            try {
                data = task()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = errorText(e)
            } finally {
                currentOnBusy(false)
            }
        }
    }

    DisposableEffect(store, reload) {
        val run = { run { store.load() } }
        reload.run = run
        onDispose { if (reload.run === run) reload.run = null }
    }
    LaunchedEffect(store) {
        run {
            store.refreshRules()
            store.load()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        val snapshot = data ?: return@Column
        Text("${view.label}: $today", style = MaterialTheme.typography.titleMedium)
        for (metric in snapshot.metrics) Text(metric.name)
        for (warning in snapshot.warnings) Text(warning, color = MaterialTheme.colorScheme.error)
    }
}
