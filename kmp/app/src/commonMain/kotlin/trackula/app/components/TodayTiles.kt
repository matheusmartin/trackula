package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.app.LocalExtraColors
import trackula.model.CountStep
import trackula.model.Day
import trackula.model.LogTable
import trackula.model.LogWrite
import trackula.model.Metric
import trackula.model.MetricDay
import trackula.model.NumberMetric
import trackula.model.YesNoMetric
import trackula.model.applyCountSteps
import trackula.model.dayValuesWithPending
import trackula.model.formatStep
import trackula.model.nearestDay
import trackula.model.planClear
import trackula.model.planNumber
import trackula.model.planYesNo
import trackula.services.CountInput

/**
 * Today input mode: one tile for each metric, for today only. The fewest taps for each input.
 *
 * No tile writes at once. Each input makes the value of its tile unsaved, and the Save button at the end of the page
 * saves all unsaved values in one task. Unsaved values are lost when the user leaves the screen. An input that gives
 * the saved value again is not unsaved.
 *
 * - Yes/no: a tap on the tile sets done. A second tap goes back: to empty, or to `no` if the day was saved as `yes`.
 * - Count: as the table cells. See [CountInput].
 * - Number: a full-width tile with the ruler of the [NumberEditor]. An empty day starts at the latest earlier value.
 *   A drag, a typed value, or a press on the ruler (to confirm the same value) makes the value unsaved.
 *
 * A tile with a value (saved or not) is green. An unsaved tile also has a green frame. Phones: 2 columns. Wider
 * screens: 4 columns. Number tiles take a full row.
 *
 * - [onWriteAll]: saves several values in one task, in order, for the Save button. It calls its `onDone` when the
 *   write ends, also after an error.
 * - [pending]: count taps of the table views that are not written yet. The tiles show them.
 */
@Composable
fun TodayTiles(
    metrics: List<Metric>,
    log: LogTable,
    today: Day,
    busy: Boolean,
    onWriteAll: (plans: List<(LogTable) -> LogWrite?>, onDone: () -> Unit) -> Unit,
    pending: Map<MetricDay, List<CountStep>>,
) {
    // Unsaved values, by metric id. Yes/no: 1 for `yes`, 0 for `no`. Null clears the day.
    val drafts = remember { mutableStateMapOf<String, Double?>() }
    // Values that the Save button sends now, by metric id. The tiles show them until the write ends.
    val saving = remember { mutableStateMapOf<String, Double?>() }
    val scope = rememberCoroutineScope()
    val countInput = remember(scope) { CountInput<String>(scope) }

    // The value that a tile shows: unsaved, then being saved, then saved.
    fun shown(m: Metric, saved: Double?): Double? = when (m.id) {
        in drafts -> drafts[m.id]
        in saving -> saving[m.id]
        else -> saved
    }

    // Makes [value] the unsaved value of [m]. The saved value again is not unsaved.
    fun set(m: Metric, value: Double?, saved: Double?) {
        if (value == saved) drafts.remove(m.id) else drafts[m.id] = value
    }

    fun save() {
        val plans = metrics.filter { it.id in drafts }.map { m ->
            val v = drafts[m.id]
            val plan: (LogTable) -> LogWrite? = when {
                v == null -> { log -> planClear(m, today, log) }
                m is YesNoMetric -> { log -> planYesNo(m, today, log, done = v == 1.0) }
                else -> { log -> planNumber(m as NumberMetric, today, v, log) }
            }
            plan
        }
        // The number editors keep their values: the new data shows the same values.
        saving.putAll(drafts)
        drafts.clear()
        // The write ended: the new data has the saved values, or the error shows.
        onWriteAll(plans) { saving.clear() }
    }

    val unsaved = metrics.filter { it.id in drafts }.map { it.name }
    Column {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val columns = if (maxWidth >= 640.dp) 4 else 2
            val isWide = { m: Metric -> m is NumberMetric && !m.isCount }
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                for (row in tileRows(metrics, columns, isWide)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        for (i in row) {
                            val m = metrics[i]
                            val values = dayValuesWithPending(m, log.entries, pending)
                            val saved = values[today]
                            val tileModifier = Modifier.weight(if (isWide(m)) columns.toFloat() else 1f)
                            key(m.id) {
                                when {
                                    m is YesNoMetric -> YesNoTile(m, tileModifier, shown(m, saved), m.id in drafts) {
                                        val done = shown(m, saved) == 1.0
                                        // Back from done: to empty, or to `no` if the day was saved as `yes`.
                                        set(m, if (done) (if (saved == 1.0) 0.0 else null) else 1.0, saved)
                                    }

                                    m is NumberMetric && m.isCount -> CountTile(
                                        m,
                                        tileModifier,
                                        shown(m, saved),
                                        m.id in drafts,
                                        countInput,
                                    ) { sign ->
                                        // Reads the value when it runs: a touch tap runs after the double-tap wait.
                                        set(
                                            m,
                                            applyCountSteps(shown(m, saved), listOf(CountStep(sign * m.step))),
                                            saved,
                                        )
                                    }

                                    m is NumberMetric -> NumberTile(
                                        metric = m,
                                        modifier = tileModifier,
                                        done = shown(m, saved) != null,
                                        unsaved = m.id in drafts,
                                        saved = saved,
                                        start = nearestDay(values.keys, today)?.let { values[it] },
                                        today = today,
                                        busy = busy,
                                        onChange = { set(m, it, saved) },
                                    )
                                }
                            }
                        }
                        // Empty columns keep the width of the tiles in a row that is not full.
                        val used = row.sumOf { if (isWide(metrics[it])) columns else 1 }
                        if (used < columns) Spacer(Modifier.weight((columns - used).toFloat()))
                    }
                }
            }
        }
        SaveButton(
            enabled = !busy && unsaved.isNotEmpty(),
            saving = saving.isNotEmpty(),
            description = if (unsaved.isEmpty()) "No changes" else "Save: ${unsaved.joinToString(", ")}",
            onClick = ::save,
        )
    }
}

/** A tile: green when [done], with a green frame when [unsaved]. */
@Composable
private fun Tile(modifier: Modifier, done: Boolean, unsaved: Boolean, content: @Composable () -> Unit) {
    val extra = LocalExtraColors.current
    val shape = RoundedCornerShape(16.dp)
    val frame = if (unsaved) Modifier.border(2.dp, extra.done, shape) else Modifier
    Box(
        modifier = modifier
            .clip(shape)
            .background(if (done) extra.doneContainer else MaterialTheme.colorScheme.surfaceContainer)
            .then(frame),
    ) {
        CompositionLocalProvider(
            LocalContentColor provides if (done) extra.onDoneContainer else MaterialTheme.colorScheme.onSurface,
        ) { content() }
    }
}

/** The icon and the name of [m]. */
@Composable
private fun TileHead(m: Metric) {
    MetricIcon(m)
    Text(m.name, fontSize = 16.sp, lineHeight = 21.sp)
}

@Composable
private fun YesNoTile(m: YesNoMetric, modifier: Modifier, value: Double?, unsaved: Boolean, onClick: () -> Unit) {
    val done = value == 1.0
    Tile(modifier, done, unsaved) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 96.dp)
                .semantics { toggleableState = ToggleableState(done) }
                .clickable(role = Role.Checkbox, onClick = onClick)
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) { TileHead(m) }
    }
}

/** A tile with a counter: the value of today, 0 when empty, in the top right corner. */
@Composable
private fun CountTile(
    m: NumberMetric,
    modifier: Modifier,
    value: Double?,
    unsaved: Boolean,
    input: CountInput<String>,
    add: (Int) -> Unit,
) {
    val step = formatStep(m.step, m.step)
    val counter = if (value == null) "0" else formatStep(value, m.step)
    Tile(modifier, value != null, unsaved) {
        Box(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 96.dp)
                .semantics {
                    contentDescription = m.name
                    stateDescription = "$counter. Tap or click: +$step. Double-tap or right-click: −$step."
                }
                .countInput(input, m.id, add)
                .padding(12.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { TileHead(m) }
            Text(
                counter,
                modifier = Modifier.align(Alignment.TopEnd),
                fontSize = 16.sp,
                color = LocalContentColor.current.copy(alpha = 0.7f),
            )
        }
    }
}

/** A full-width tile with the ruler. On an empty day, a press on the ruler at the start value confirms that value. */
@Composable
private fun NumberTile(
    metric: NumberMetric,
    modifier: Modifier,
    done: Boolean,
    unsaved: Boolean,
    saved: Double?,
    start: Double?,
    today: Day,
    busy: Boolean,
    onChange: (Double?) -> Unit,
) {
    Tile(modifier, done, unsaved) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                TileHead(metric)
            }
            key("${metric.id} $today") {
                NumberEditor(
                    metric = metric,
                    label = "${metric.name} · today",
                    current = saved,
                    start = start,
                    busy = busy,
                    // The Save button saves. These run only without onChange.
                    onSave = {},
                    onClear = {},
                    onClose = {},
                    autofocus = false,
                    onChange = onChange,
                    compact = true,
                )
            }
        }
    }
}

/**
 * The Save button of the Today tiles: at the end of the page, below the tiles, as wide as the tiles. With changes to
 * save: the darker logo gradient with white text in both themes. No changes: a quiet grey button with readable text.
 */
@Composable
private fun SaveButton(enabled: Boolean, saving: Boolean, description: String, onClick: () -> Unit) {
    val extra = LocalExtraColors.current
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(16.dp)
    val background = if (enabled) {
        Modifier.background(
            extra.actionBrush,
        )
    } else {
        Modifier.background(colors.surfaceContainerHighest)
    }
    Box(
        modifier = Modifier
            .padding(top = 24.dp, bottom = 16.dp)
            .fillMaxWidth()
            .height(52.dp)
            .clip(shape)
            .then(background)
            .semantics { contentDescription = description }
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            if (saving) "Saving…" else "Save",
            color = if (enabled) extra.onAction else colors.onSurfaceVariant,
            fontSize = 16.sp,
        )
    }
}
