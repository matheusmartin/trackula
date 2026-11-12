package trackula.app.pages

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import trackula.app.OnBack
import trackula.app.components.DayLayout
import trackula.app.components.HabitTable
import trackula.app.components.Notice
import trackula.app.components.NoticeKind
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
import trackula.model.MetricsTable
import trackula.model.MetricsWrite
import trackula.model.NumberMetric
import trackula.model.dayScores
import trackula.model.groupOf
import trackula.model.groupScoreMetric
import trackula.model.metricsOf
import trackula.model.pointsByMetric
import trackula.model.pointsOf
import trackula.model.scoreMetric
import trackula.sheets.Snapshot
import trackula.sheets.Store

/** The reload button in the app bar calls [run]. The Today page sets it. */
class ReloadHandle {
    var run: (() -> Unit)? = null
}

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
 * - [managing]: true if the page shows the metrics screen (see [MetricsPage]). The App owns it, and [onManaging]
 *   changes it. The App hides the bottom navigation bar on the metrics screen.
 * - [readPref], [writePref]: the group filter stays in local storage. The filter also selects the score: of all
 *   metrics, or of the metrics of the selected group.
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
    managing: Boolean = false,
    onManaging: (Boolean) -> Unit = {},
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
    val currentOnManaging by rememberUpdatedState(onManaging)
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

    // Writes a change to the Metrics tab. [onDone] runs after a write without an error, for example to close the form.
    fun writeMetrics(plan: (MetricsTable) -> List<MetricsWrite>, onDone: () -> Unit) {
        var saved = false
        val job = run { store.changeMetrics(plan).also { saved = true } } ?: return
        scope.launch {
            job.join()
            if (saved) onDone()
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
    val shown = metricsOf(metrics, selectedGroup)

    // The points of the metrics that the group filter shows, and their scores. They change only with the data, the
    // taps, the day and the filter.
    val points = remember(snapshot, today, pending, selectedGroup) {
        if (snapshot == null) {
            emptyMap()
        } else {
            pointsOf(metrics, selectedGroup, pointsByMetric(metrics, snapshot.log, today, pending))
        }
    }
    val scores = remember(points) { dayScores(points) }
    val score = selectedGroup?.let { groupScoreMetric(it, groupLabel(it)) } ?: scoreMetric

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
            scoreMetrics = shown,
            points = points,
        )
    }

    // The metrics screen replaces the detail screen: a change of a metric can also change its detail screen.
    LaunchedEffect(managing) {
        if (managing && detailId != null) closeDetail()
    }
    if (managing && snapshot != null) {
        MetricsPage(
            data = snapshot,
            busy = busy,
            error = error,
            onWrite = ::writeMetrics,
            onClose = { currentOnManaging(false) },
        )
        return
    }

    // The detail screen of one metric. If the metric is gone from the sheet, the table shows again, with the bottom
    // navigation bar.
    val detailMetric = metrics.firstOrNull { it.id == detailId }
    LaunchedEffect(detailId, detailMetric == null, snapshot == null) {
        if (detailId != null && snapshot != null && detailMetric == null) closeDetail()
    }
    // The Back button of the browser closes the detail screen, as its back button does.
    OnBack(enabled = snapshot != null && detailMetric != null) { closeDetail() }
    if (snapshot != null && detailMetric != null) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            error?.let { Notice(it, kind = NoticeKind.ERROR) }
            detail(detailMetric, ::closeDetail)
        }
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (groups.size > 1) {
            GroupChips(groups, selectedGroup) {
                group = it
                writePref("group", it)
            }
        }
        // Above the content, so that the error of a save shows next to the top of the page. Try again loads the sheet.
        error?.let { Notice(it, kind = NoticeKind.ERROR, action = "Try again", onAction = { run { store.load() } }) }
        if (snapshot == null) {
            if (error == null) Loading()
            return@Column
        }
        if (metrics.isEmpty()) {
            NoMetrics { currentOnManaging(true) }
        } else {
            // A short fade between the views of the navigation.
            Crossfade(view, animationSpec = tween(VIEW_FADE_MILLIS)) { shownView ->
                // The table of 5 days is not wider than TABLE_WIDTH: on a wide screen, the cells stay near the names.
                val width = if (shownView == MainView.SHORT) Modifier.widthIn(max = TABLE_WIDTH) else Modifier
                Column(width, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    when (shownView) {
                        MainView.TODAY -> TodayTiles(
                            metrics = shown,
                            log = snapshot.log,
                            today = today,
                            busy = busy,
                            onWriteAll = ::writeAll,
                            pending = pending,
                        )

                        MainView.SCORE -> detail(score, onBack = null)

                        MainView.SHORT, MainView.MONTH -> {
                            val days = shownView.daysUntil(today)
                            ScoreChart(score, days, scores) { currentOnView(MainView.SCORE) }
                            HabitTable(
                                metrics = shown,
                                log = snapshot.log,
                                today = today,
                                days = days,
                                layout = if (shownView == MainView.MONTH) DayLayout.CALENDARS else DayLayout.TABLE,
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
            }
        }
        if (snapshot.warnings.isNotEmpty()) {
            val onFix = if (snapshot.metricsTable.invalid.isEmpty()) null else ({ currentOnManaging(true) })
            Warnings(snapshot.warnings, onFix)
        }
    }
}

/** The largest width of the "5 days" view. */
private val TABLE_WIDTH = 720.dp

/** The time of the fade between two views of the navigation. */
private const val VIEW_FADE_MILLIS = 150

/** The first load of the sheet: a progress circle in the page. The app bar also shows a small one. */
@Composable
private fun Loading() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 64.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator()
        Text("Loading your data…", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** A sheet without metrics: what the app needs, and the button that opens the metrics screen. */
@Composable
private fun NoMetrics(onAdd: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Symbol("tune", size = 40.dp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("No metrics yet", style = MaterialTheme.typography.titleLarge)
        Text(
            "A metric is a thing that you record each day, for example your weight or a habit.",
            modifier = Modifier.widthIn(max = 360.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Button(onClick = onAdd) { Text("Add a metric") }
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

/** The warnings of the sheet: invalid rows and cells. [onFix] opens the metrics screen. Null: no Fix button. */
@Composable
private fun Warnings(warnings: List<String>, onFix: (() -> Unit)?) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Symbol("warning", color = MaterialTheme.colorScheme.error)
                Text("Sheet warnings", style = MaterialTheme.typography.titleMedium)
            }
            for (w in warnings) Text("• $w")
            if (onFix != null) TextButton(onClick = onFix) { Text("Fix the metric rows") }
        }
    }
}
