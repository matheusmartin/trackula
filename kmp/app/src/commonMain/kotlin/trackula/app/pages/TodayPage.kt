package trackula.app.pages

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import trackula.app.components.DayLayout
import trackula.app.components.HabitTable
import trackula.app.components.ScoreChart
import trackula.app.components.Symbol
import trackula.app.components.TodayTiles
import trackula.app.components.TrendChart
import trackula.app.components.groupLabel
import trackula.app.errorText
import trackula.model.CountQueue
import trackula.model.CountStep
import trackula.model.Day
import trackula.model.LogTable
import trackula.model.LogWrite
import trackula.model.MainView
import trackula.model.Metric
import trackula.model.NumberMetric
import trackula.model.dayScores
import trackula.model.scoreMetric
import trackula.sheets.Snapshot
import trackula.sheets.Store

/** The reload button in the app bar calls [run]. The Today page sets it. */
class ReloadHandle {
    var run: (() -> Unit)? = null
}

/** The group of [m] for the group filter. A metric without a group is in "other". */
private fun groupOf(m: Metric): String = m.group ?: "other"

/**
 * The main page: the metrics in Today tiles, a table or calendars, where the user records entries, or the score only.
 *
 * - [store]: the store of the sheet, or of demo mode. The page keeps the first one.
 * - [expired]: true after the Google sign-in expired. Then [onExpired] runs instead of a store call.
 * - [view]: the view of the bottom navigation bar. The App owns it, and [onView] changes it.
 * - [reload]: the reload button in the app bar calls it. The page sets it.
 * - [onBusy]: called when a load or a write starts and ends. The app bar shows a progress circle while it is true.
 * - [onDetail]: called when a metric detail screen opens (true) or closes. The App hides the bottom navigation bar on
 *   the detail screen.
 * - [readPref], [writePref]: the group filter stays in local storage.
 */
@Composable
fun TodayPage(
    store: Store,
    today: Day,
    expired: () -> Boolean,
    onExpired: () -> Unit,
    view: MainView,
    onView: (MainView) -> Unit,
    reload: ReloadHandle,
    onBusy: (Boolean) -> Unit,
    onDetail: (Boolean) -> Unit,
    readPref: (String) -> String?,
    writePref: (String, String?) -> Unit,
) {
    // The latest callbacks: the reload handle and the coroutines keep one function for the life of the page.
    val currentExpired by rememberUpdatedState(expired)
    val currentOnExpired by rememberUpdatedState(onExpired)
    val currentOnBusy by rememberUpdatedState(onBusy)
    val currentOnView by rememberUpdatedState(onView)
    var data by remember(store) { mutableStateOf<Snapshot?>(null) }
    var busy by remember(store) { mutableStateOf(false) }
    var error by remember(store) { mutableStateOf<String?>(null) }
    val currentOnDetail by rememberUpdatedState(onDetail)
    // The id of the metric with the open detail screen. Null shows the table.
    var detailId by remember(store) { mutableStateOf<String?>(null) }
    // The selected group, or null for all groups.
    var group by remember { mutableStateOf(readPref("group")) }
    // The count taps that are not in the sheet yet. The table shows them at once. The queue is not a state object,
    // so [counts] changes after each change of the queue, to show the new taps.
    val queue = remember(store) { CountQueue() }
    var counts by remember(store) { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    lateinit var writeCounts: () -> Unit

    // Runs [task] and shows its data. [done] runs in the same update as the new data or the error. After that, the
    // count taps that came during the task get written.
    fun run(done: (() -> Unit)? = null, task: suspend () -> Snapshot): Job? {
        if (currentExpired()) {
            currentOnExpired()
            return null
        }
        busy = true
        error = null
        currentOnBusy(true)
        return scope.launch {
            try {
                data = task()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = errorText(e)
            } finally {
                // Also after an error, so that the taps of a failed write are not written again.
                busy = false
                done?.invoke()
                counts++
                currentOnBusy(false)
                // The page is gone, for example after a sign-out: no new write.
                if (currentCoroutineContext().isActive) writeCounts()
            }
        }
    }

    // Writes the queued count taps: one write for each cell, with all taps of that cell. See CountQueue. One write at
    // a time: it waits while another load or write runs. If a write fails, its taps are dropped and the error shows.
    writeCounts = {
        if (!busy && queue.hasQueued) {
            val metrics = data?.metrics.orEmpty().associateBy { it.id }
            val plans = queue.send(metrics)
            counts++
            run(done = queue::sent) { store.changeAll(plans) }
        }
    }

    fun write(plan: (LogTable) -> LogWrite?) {
        run { store.change(plan) }
    }

    // Saves the values of the Today tiles. After a successful save, the page shows the last 5 days. The app still
    // opens on the Today tiles. After an error, the Today tiles stay.
    fun writeAll(plans: List<(LogTable) -> LogWrite?>, onDone: () -> Unit) {
        // True after the save. Not the error state: a write of queued count taps can start and clear the error.
        var saved = false
        val job = run(done = onDone) { store.changeAll(plans).also { saved = true } } ?: return onDone()
        scope.launch {
            job.join()
            if (saved) currentOnView(MainView.SHORT)
        }
    }

    // Adds a count tap. The table shows it at once. The write starts when no other write runs.
    fun count(m: NumberMetric, d: Day, step: CountStep) {
        queue.add(m.id, d, step)
        counts++
        writeCounts()
    }

    // A new page (sign-out, another sheet) has no detail screen open: the App shows the bottom navigation bar again.
    DisposableEffect(store) { onDispose { if (detailId != null) currentOnDetail(false) } }
    DisposableEffect(store, reload) {
        val handle: () -> Unit = { run { store.load() } }
        reload.run = handle
        // A new page (another sheet) can already use the handle.
        onDispose { if (reload.run === handle) reload.run = null }
    }
    LaunchedEffect(store) {
        run {
            store.refreshRules()
            store.load()
        }
    }

    // Read the counter, so that a change of the queue shows.
    @Suppress("UNUSED_VARIABLE")
    val countsVersion = counts
    val pending = queue.pending
    val snapshot = data
    val metrics = snapshot?.metrics.orEmpty()
    val groups = metrics.map(::groupOf).distinct()
    val selectedGroup = group?.takeIf { it in groups }

    // The scores of all metrics, also with a group filter.
    val scores = if (snapshot == null) emptyMap() else dayScores(metrics, snapshot.log, pending)

    fun openDetail(m: Metric) {
        detailId = m.id
        currentOnDetail(true)
    }

    fun closeDetail() {
        detailId = null
        currentOnDetail(false)
    }

    @Composable
    fun detail(metric: Metric, onBack: (() -> Unit)?) = key(metric.id) {
        MetricDetail(
            metric = metric,
            log = snapshot!!.log,
            today = today,
            busy = busy,
            onWrite = ::write,
            pending = pending,
            onCount = ::count,
            scores = scores,
            onBack = onBack,
        )
    }

    // The detail screen of one metric. If the metric is gone from the sheet, the table shows again.
    val detailMetric = metrics.firstOrNull { it.id == detailId }
    if (snapshot != null && detailMetric != null) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            detail(detailMetric, ::closeDetail)
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // The score view shows all metrics: no group filter.
        if (groups.size > 1 && view != MainView.SCORE) {
            GroupChips(groups, selectedGroup) {
                group = it
                writePref("group", it)
            }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (snapshot == null) return@Column
        if (metrics.isEmpty()) {
            Text(
                "No metrics. Add rows to the \"Metrics\" tab of the sheet.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            val shown = metrics.filter { selectedGroup == null || groupOf(it) == selectedGroup }
            when (view) {
                MainView.TODAY -> TodayTiles(
                    metrics = shown,
                    log = snapshot.log,
                    today = today,
                    busy = busy,
                    onWriteAll = ::writeAll,
                    pending = pending,
                )

                MainView.SCORE -> detail(scoreMetric, onBack = null)

                MainView.SHORT, MainView.MONTH -> {
                    val days = view.daysUntil(today)
                    ScoreChart(days, scores) { currentOnView(MainView.SCORE) }
                    HabitTable(
                        metrics = shown,
                        log = snapshot.log,
                        today = today,
                        days = days,
                        layout = if (view == MainView.MONTH) DayLayout.CALENDARS else DayLayout.TABLE,
                        busy = busy,
                        onWrite = ::write,
                        pending = pending,
                        onCount = ::count,
                        onOpen = ::openDetail,
                        // Number metrics also get a line chart of the same days.
                        calendarExtra = { m, values ->
                            if (m is NumberMetric) TrendChart(days, values, m.unit, showsBars = m.isCount)
                        },
                    )
                }
            }
        }
        if (snapshot.warnings.isNotEmpty()) Warnings(snapshot.warnings)
    }
}

/** The group filter: All, and one chip for each of [groups]. [selected] is null for All. */
@Composable
private fun GroupChips(groups: List<String>, selected: String?, onSelect: (String?) -> Unit) {
    // One row that scrolls sideways.
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        GroupChip("All", selected == null) { onSelect(null) }
        for (g in groups) GroupChip(groupLabel(g), g == selected) { onSelect(g) }
    }
}

@Composable
private fun GroupChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        leadingIcon = if (selected) ({ Symbol("done", size = 18.dp) }) else null,
    )
}

/** The warnings of the sheet: invalid rows and cells. */
@Composable
private fun Warnings(warnings: List<String>) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Symbol("warning", color = MaterialTheme.colorScheme.error)
                Text("Sheet warnings", style = MaterialTheme.typography.titleMedium)
            }
            for (w in warnings) Text("• $w")
        }
    }
}
