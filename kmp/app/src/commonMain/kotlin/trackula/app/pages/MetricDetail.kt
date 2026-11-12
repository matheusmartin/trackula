package trackula.app.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitHorizontalTouchSlopOrCancellation
import androidx.compose.foundation.gestures.horizontalDrag
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import trackula.app.ScoreTheme
import trackula.app.components.AppIconButton
import trackula.app.components.DayHeatmap
import trackula.app.components.MetricCharts
import trackula.app.components.MetricIcon
import trackula.app.components.MonthCalendar
import trackula.app.components.Overview
import trackula.app.components.ScoreCalendar
import trackula.app.components.WIDE_CONTENT
import trackula.model.Aggregate
import trackula.model.BarUnit
import trackula.model.CountStep
import trackula.model.Day
import trackula.model.LogTable
import trackula.model.LogWrite
import trackula.model.Metric
import trackula.model.MetricDay
import trackula.model.MonthKey
import trackula.model.NumberMetric
import trackula.model.YesNoMetric
import trackula.model.ZoomStep
import trackula.model.ZoomWindow
import trackula.model.barStarts
import trackula.model.dayValues
import trackula.model.defaultStepIndex
import trackula.model.earliestDay
import trackula.model.formatDateRange
import trackula.model.isScore
import trackula.model.monthOf
import trackula.model.roundHalfAwayFromZero
import trackula.model.threeMonthsStepIndex
import trackula.model.yesNoStates
import trackula.model.zoomBars
import trackula.model.zoomSteps
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.truncate

/** The side wheel movement for one bar, in pixels. */
private const val WHEEL_STEP = 40f

/** The smallest width of the zoom label on wide screens. The longest label, "3 months", fits. */
private val ZOOM_LABEL_WIDTH = 96.dp

/**
 * All data of one metric: key numbers, charts and a day heatmap for one time window, and a month calendar to edit
 * days.
 *
 * - Time window: the zoom buttons set its span and the bar size (see [ZoomStep]). It opens at All for a metric of kind
 *   `number` and for the score, and at 3 months for the other kinds (see [defaultStepIndex]). A tap on the zoom label
 *   goes to All, and a second tap goes back. At All without an earlier step, the tap goes to 3 months. The arrows move
 *   the window by its full span. A tap or a drag on the overview moves it there. When the window shows all data, there
 *   is no overview: it shows the same bars as the first chart. A side drag or a side wheel on the
 *   charts moves it by bars. All numbers and charts show the same window.
 * - Day heatmap: the days of the window. A tap on a day shows its month in the calendar.
 * - Edit days: any month, with the same day cells and inputs as the Today page. It shows the month of the window end
 *   until the arrows, a swipe or a heatmap tap change it. Wide screens also show the month before.
 * - Score (`scoreMetric` or a `groupScoreMetric`): key numbers and charts over time, by weekday, by group and by
 *   metric, from [scores], in green. [scoreMetrics] and [points]: the metrics of the score and the points of each
 *   metric (see `pointsByMetric`), for the charts by group and by metric. In place of the heatmap and Edit days, a
 *   read-only month calendar shows the score of each day: the app calculates the scores.
 *
 * [onBack] closes the screen. Null: the screen has no back button, for example the Score view.
 */
@Composable
fun MetricDetail(
    metric: Metric,
    log: LogTable,
    today: Day,
    busy: Boolean,
    onWrite: ((LogTable) -> LogWrite?) -> Unit,
    pending: Map<MetricDay, List<CountStep>>,
    onCount: (NumberMetric, Day, CountStep) -> Unit,
    scores: Map<Day, Double>,
    onBack: (() -> Unit)? = null,
    scoreMetrics: List<Metric> = emptyList(),
    points: Map<String, Map<Day, Double>> = emptyMap(),
) {
    val content = @Composable {
        DetailContent(metric, log, today, busy, onWrite, pending, onCount, scores, scoreMetrics, points, onBack)
    }
    if (isScore(metric)) ScoreTheme(content) else content()
}

@Composable
private fun DetailContent(
    metric: Metric,
    log: LogTable,
    today: Day,
    busy: Boolean,
    onWrite: ((LogTable) -> LogWrite?) -> Unit,
    pending: Map<MetricDay, List<CountStep>>,
    onCount: (NumberMetric, Day, CountStep) -> Unit,
    scores: Map<Day, Double>,
    scoreMetrics: List<Metric>,
    points: Map<String, Map<Day, Double>>,
    onBack: (() -> Unit)?,
) {
    // The index in zoomSteps. Null: defaultStepIndex.
    var stepIndex by remember(metric.id) { mutableStateOf<Int?>(null) }
    // The step index before a tap on the zoom label went to All. A second tap goes back to it.
    var beforeAll by remember(metric.id) { mutableStateOf<Int?>(null) }
    // A day in the newest bar of the window. Null: the newest bar of all. A day, not an index, so that a zoom keeps
    // the same time in view.
    var end by remember(metric.id) { mutableStateOf<Day?>(null) }
    // The month in the calendar. Null: the month of the window end.
    var month by remember(metric.id) { mutableStateOf<MonthKey?>(null) }

    val states = if (metric is YesNoMetric) yesNoStates(metric, log) else emptyMap()
    // For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
    val values = when {
        metric is YesNoMetric -> states.mapValues { (_, yes) -> if (yes) 1.0 else 0.0 }
        isScore(metric) -> scores
        else -> dayValues(metric, log, pending)
    }
    val first = earliestDay(values.keys) ?: today
    val steps = zoomSteps(first, today)
    val index = min(stepIndex ?: defaultStepIndex(metric, steps), steps.lastIndex)
    val window = ZoomWindow(steps[index], first, today, end)
    // The latest window: Compose can keep a function reference of an earlier composition, with its values.
    val currentWindow by rememberUpdatedState(window)

    fun moveTo(newEnd: Day?) {
        if (newEnd == end) return
        end = newEnd
        month = null
    }

    // Zooms to the step [to]. At the newest bar, the window stays at the newest bar. Else it keeps the same time in
    // view. [all]: the step that a tap on the All label goes back to.
    fun zoom(to: Int, all: Int? = null) {
        if (!currentWindow.atEnd) end = currentWindow.to
        stepIndex = to
        beforeAll = all
    }

    // The full width of the page, as the group chips above the Score view. On wide screens, the chart grid has
    // more columns, so that the cards keep their shape.
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (onBack != null) AppIconButton("arrow_back", "Back", onBack)
            if (!isScore(metric)) MetricIcon(metric, large = true)
            Text(
                metric.name,
                modifier = Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                maxLines = 2,
            )
        }
        WindowBar(metric, window, steps, index, beforeAll, values, ::zoom, ::moveTo)
        ChartsArea(window, ::moveTo) {
            MetricCharts(
                metric = metric,
                window = window,
                values = values,
                states = states,
                scoreMetrics = scoreMetrics,
                points = points,
            )
            // The score has no heatmap: its month calendar shows the same days, with the score of each day.
            if (!isScore(metric)) {
                DayHeatmap(
                    title = if (metric is YesNoMetric) "Yes days" else "Days with a value",
                    from = window.from,
                    to = window.to,
                    today = today,
                    filled = { d -> if (metric is YesNoMetric) states[d] == true else d in values },
                    onDay = { d -> month = monthOf(d) },
                )
            }
        }
        if (isScore(metric)) {
            ScoreCalendar(values, today, month ?: monthOf(window.to)) { month = it }
        } else {
            MonthCalendar(
                metric = metric,
                log = log,
                today = today,
                busy = busy,
                onWrite = onWrite,
                pending = pending,
                onCount = onCount,
                month = month ?: monthOf(window.to),
                onMonth = { month = it },
            )
        }
    }
}

/**
 * The zoom buttons, the dates of the window with arrows, and the overview of all data. When the window shows all data,
 * there is no overview: the first chart shows the same bars, and there is no other part of the data to move to.
 */
@Composable
private fun WindowBar(
    metric: Metric,
    window: ZoomWindow,
    steps: List<ZoomStep>,
    index: Int,
    beforeAll: Int?,
    values: Map<Day, Double>,
    zoom: (Int, Int?) -> Unit,
    moveTo: (Day?) -> Unit,
) {
    val aggregate = when {
        metric is YesNoMetric -> Aggregate.RATE
        metric is NumberMetric && metric.isCount -> Aggregate.SUM
        else -> Aggregate.AVERAGE
    }
    // The last step shows all data. See zoomSteps.
    val last = steps.lastIndex
    val atAll = index == last
    // The window can open at All (see defaultStepIndex): then the tap goes to 3 months.
    val back = min(beforeAll ?: threeMonthsStepIndex(steps), last)
    val count = window.starts.size
    val box = window.boxOn(BarUnit.WEEK)
    val zoomButtons: @Composable RowScope.(Modifier) -> Unit = { label ->
        AppIconButton("zoom_in", "Zoom in", { zoom(index - 1, null) }, enabled = index > 0)
        TextButton(
            onClick = { if (atAll) zoom(back, null) else zoom(last, index) },
            modifier = label.semantics {
                contentDescription = if (atAll) "Back to ${steps[back].label}" else "Show all"
            },
        ) { Text(if (atAll) "All" else steps[index].label, maxLines = 1) }
        AppIconButton("zoom_out", "Zoom out", { zoom(index + 1, null) }, enabled = !atAll)
    }
    val dateButtons: @Composable RowScope.(Modifier) -> Unit = { label ->
        AppIconButton("chevron_left", "Earlier", { moveTo(window.endMovedBy(-count)) }, enabled = !window.atStart)
        Text(
            formatDateRange(window.from, window.to),
            modifier = label,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            maxLines = 1,
        )
        AppIconButton("chevron_right", "Later", { moveTo(window.endMovedBy(count)) }, enabled = !window.atEnd)
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // One tool bar in a soft color. Wide screens: the zoom buttons on the left and the dates on the right, in one
        // row. Phones: 2 rows, each with its buttons at the edges and its label in the center.
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val bar = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(12.dp))
                .padding(horizontal = 4.dp)
            if (maxWidth >= WIDE_CONTENT) {
                Row(bar, verticalAlignment = Alignment.CenterVertically) {
                    // A fixed width, so that the zoom buttons do not move when the label changes.
                    zoomButtons(Modifier.widthIn(min = ZOOM_LABEL_WIDTH))
                    Spacer(Modifier.weight(1f))
                    dateButtons(Modifier.padding(horizontal = 4.dp))
                }
            } else {
                Column(bar) {
                    Row(verticalAlignment = Alignment.CenterVertically) { zoomButtons(Modifier.weight(1f)) }
                    Row(verticalAlignment = Alignment.CenterVertically) { dateButtons(Modifier.weight(1f)) }
                }
            }
        }
        if (!window.showsAll) {
            Overview(
                weeks = zoomBars(
                    values,
                    aggregate,
                    barStarts(window.first, window.today, BarUnit.WEEK),
                    BarUnit.WEEK,
                    window.first,
                    window.today,
                ),
                fromZero = aggregate != Aggregate.AVERAGE,
                from = box.from,
                to = box.to,
                onPoint = { d -> moveTo(window.endCenteredOn(d)) },
            )
        }
    }
}

/**
 * [content] with side drags and side wheel moves that move the window by bars. A drag starts only after the touch
 * slop, so that a tap on a heatmap day still works. A vertical drag scrolls the page.
 */
@Composable
private fun ChartsArea(window: ZoomWindow, moveTo: (Day?) -> Unit, content: @Composable () -> Unit) {
    val currentWindow by rememberUpdatedState(window)
    val move by rememberUpdatedState(moveTo)
    // Side wheel movement that is less than one bar, in pixels.
    var wheel by remember { mutableFloatStateOf(0f) }
    Column(
        modifier = Modifier
            .pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    // A drag starts after the touch slop, so that a tap on a heatmap day still works.
                    val start = currentWindow

                    // The distance from the press, as in the Dart app: not from the end of the touch slop.
                    fun dragTo(x: Float) {
                        // No bars, for example with a value after today: nothing to move.
                        if (start.starts.isEmpty()) return
                        val barWidth = size.width.toFloat() / start.starts.size
                        val bars = roundHalfAwayFromZero(((x - down.position.x) / barWidth).toDouble())
                        move(start.endMovedBy(-bars.toInt()))
                    }
                    // Also the move that crosses the touch slop moves the window: a fast swipe can have only one move.
                    awaitHorizontalTouchSlopOrCancellation(down.id) { change, _ ->
                        change.consume()
                        dragTo(change.position.x)
                    } ?: return@awaitEachGesture
                    horizontalDrag(down.id) { change ->
                        change.consume()
                        dragTo(change.position.x)
                    }
                }
            }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        if (event.type != PointerEventType.Scroll) continue
                        val delta = event.changes.first().scrollDelta
                        // Vertical wheel moves scroll the page.
                        if (abs(delta.x) <= abs(delta.y)) continue
                        event.changes.forEach { it.consume() }
                        wheel += delta.x
                        val bars = truncate(wheel / WHEEL_STEP).toInt()
                        if (bars == 0) continue
                        wheel -= bars * WHEEL_STEP
                        move(currentWindow.endMovedBy(bars))
                    }
                }
            },
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) { content() }
}
