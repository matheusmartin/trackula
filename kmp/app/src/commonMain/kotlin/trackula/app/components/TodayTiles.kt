package trackula.app.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.model.CountStep
import trackula.model.Day
import trackula.model.GoalMark
import trackula.model.LogTable
import trackula.model.LogWrite
import trackula.model.Metric
import trackula.model.MetricDay
import trackula.model.NumberMetric
import trackula.model.YesNoMetric
import trackula.model.applyCountSteps
import trackula.model.dayValues
import trackula.model.formatNumber
import trackula.model.formatStep
import trackula.model.goalMark
import trackula.model.goalSummary
import trackula.model.nearestDay
import trackula.model.planClear
import trackula.model.planNumber
import trackula.model.planYesNo
import trackula.model.withUnit
import trackula.services.CountInput

/**
 * Today input mode: one tile for each metric, for today only. The fewest taps for each input.
 *
 * No tile writes at once. Each input makes the value of its tile unsaved, and the Save button saves all unsaved values
 * in one task. The Save button is the [ActionBar] of the page: the App shows it above the bottom navigation bar, and
 * only while there are values to save. Without the App, it shows at the end of the page. Unsaved values are lost when the user leaves the screen. An input that gives
 * the saved value again is not unsaved.
 *
 * - Yes/no: a tap on the tile sets done. A second tap goes back: to empty, or to `no` if the day was saved as `yes`.
 * - Count: as the table cells. See [CountInput].
 * - Number: a full-width tile with the ruler of the [NumberEditor]. An empty day starts at the latest earlier value.
 *   A drag, a typed value, or a press on the ruler (to confirm the same value) makes the value unsaved.
 *
 * A tile with a value (saved or not) has the soft app color. A tile without a value has a thin outline. A yes/no or
 * count tile also shows the mark of its goal: a check mark for a target that it reaches (`yes`, `at least`), a warning
 * sign for a limit that it goes over (`no`, `at most`). See [goalMark]. A yes/no tile that is not done shows an empty
 * circle, so that it shows as a toggle. A count tile shows the target below its counter. An unsaved tile has a frame
 * of the app color. Phones: 2 columns. Wider screens: 4
 * columns. Number tiles take a full row.
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

    // The latest parameters for save: Compose can keep a function reference of an earlier composition, with its
    // values. Example: after a tap on another group chip, the tiles of the new group.
    val latestMetrics by rememberUpdatedState(metrics)
    val latestToday by rememberUpdatedState(today)
    val writeAll by rememberUpdatedState(onWriteAll)

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
        val metrics = latestMetrics
        val today = latestToday
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
        writeAll(plans) { saving.clear() }
    }

    val unsaved = metrics.filter { it.id in drafts }.map { it.name }
    // The day values of each metric. Each move of a ruler changes a draft and composes the tiles again: the values
    // change only with new data.
    val valuesById = remember(metrics, log, pending) { metrics.associate { it.id to dayValues(it, log, pending) } }
    Column {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val columns = if (maxWidth >= WIDE_CONTENT) 4 else 2
            val isWide = { m: Metric -> m is NumberMetric && !m.isCount }
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                for (row in tileRows(metrics, columns, isWide)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        for (i in row) {
                            val m = metrics[i]
                            val values = valuesById.getValue(m.id)
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
                                        filled = shown(m, saved) != null,
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
        // In the App, the button shows only with values to save: it does not cover the page without a reason.
        val hosted = LocalActionBarHost.current != null
        if (!hosted || unsaved.isNotEmpty() || saving.isNotEmpty()) {
            ActionBar {
                PrimaryButton(
                    text = if (saving.isNotEmpty()) "Saving…" else "Save",
                    onClick = ::save,
                    // In the page: space above, after the tiles, and below. The App gives the space of its bar.
                    modifier = (if (hosted) Modifier else Modifier.padding(top = 24.dp, bottom = 16.dp)).fillMaxWidth(),
                    enabled = !busy && unsaved.isNotEmpty(),
                    description = if (unsaved.isEmpty()) "No changes" else "Save: ${unsaved.joinToString(", ")}",
                )
            }
        }
    }
}

/** The time of the color change of a tile, in milliseconds. */
private const val FILL_MILLIS = 150

/** The size of a [Mark] and of the empty circle of a yes/no tile. */
private val MARK_SIZE = 24.dp

/**
 * A tile: in the soft app color when [filled], with a frame of the app color when [unsaved]. A tile that is not filled
 * has a thin outline, so that it shows on the page. The fill color changes smoothly. The tiles are not green: a value
 * is not always good. The [Mark] shows the goal.
 */
@Composable
private fun Tile(modifier: Modifier, filled: Boolean, unsaved: Boolean, content: @Composable () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(16.dp)
    val fill by animateColorAsState(
        if (filled) colors.primaryContainer else colors.surfaceContainer,
        tween(FILL_MILLIS),
    )
    val frame = when {
        unsaved -> Modifier.border(2.dp, colors.primary, shape)
        filled -> Modifier
        else -> Modifier.border(1.dp, colors.outlineVariant, shape)
    }
    Box(modifier = modifier.clip(shape).background(fill).then(frame)) {
        CompositionLocalProvider(
            LocalContentColor provides if (filled) colors.onPrimaryContainer else colors.onSurface,
        ) { content() }
    }
}

/** The icon of [mark]: a check mark for [GoalMark.REACHED], a warning sign for [GoalMark.OVER_LIMIT]. */
@Composable
private fun Mark(mark: GoalMark) {
    when (mark) {
        GoalMark.NONE -> {}
        GoalMark.REACHED -> Symbol("check_circle", size = MARK_SIZE)
        GoalMark.OVER_LIMIT -> Symbol("warning", size = MARK_SIZE)
    }
}

/**
 * The text of [mark] for screen readers, after the value. Empty for [GoalMark.NONE]. Examples: ", goal reached",
 * ", over the limit of the goal at most 2".
 */
private fun markText(m: Metric, mark: GoalMark): String = when (mark) {
    GoalMark.NONE -> ""
    GoalMark.REACHED -> ", goal reached"
    GoalMark.OVER_LIMIT -> ", over the limit of the goal ${goalSummary(m)}"
}

/** The name of [m] in a tile. */
@Composable
private fun TileName(m: Metric) {
    Text(m.name, fontSize = 16.sp, lineHeight = 20.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
}

/** The top row of a small tile: the icon of [m] on the left, and [end] in the top right corner. */
@Composable
private fun TileTop(m: Metric, end: @Composable () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        MetricIcon(m)
        end()
    }
}

@Composable
private fun YesNoTile(m: YesNoMetric, modifier: Modifier, value: Double?, unsaved: Boolean, onClick: () -> Unit) {
    val done = value == 1.0
    val mark = goalMark(m, value)
    Tile(modifier, done, unsaved) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 96.dp)
                .semantics {
                    toggleableState = ToggleableState(done)
                    // A screen reader says "checked" for a done tile. Over the limit, it says the limit.
                    if (mark == GoalMark.OVER_LIMIT) stateDescription = "Yes${markText(m, mark)}"
                }
                .clickable(role = Role.Checkbox, onClick = onClick)
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            TileTop(m) {
                if (done) {
                    Mark(mark)
                } else {
                    // Not done: an empty circle shows that a tap marks the tile.
                    Symbol("radio_button_unchecked", size = MARK_SIZE, color = MaterialTheme.colorScheme.outline)
                }
            }
            TileName(m)
        }
    }
}

/**
 * The target of a count tile, below its counter: "of 8 glasses" for the goal `at least`, "max 2 glasses" for the goal
 * `at most`.
 */
private fun targetText(m: NumberMetric): String {
    val target = withUnit(formatNumber(m.goal.target, 3), m.unit)
    return if (m.goal.isMaximum) "max $target" else "of $target"
}

/**
 * A tile with a counter: the value of today, 0 when empty, with the [Mark] and the target of the goal, in the top
 * right corner.
 */
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
    val mark = goalMark(m, value)
    Tile(modifier, value != null, unsaved) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 96.dp)
                .semantics {
                    contentDescription = m.name
                    stateDescription =
                        "$counter${markText(m, mark)}. Tap or click: +$step. Double-tap or right-click: −$step."
                }
                .countInput(input, m.id, add = add)
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TileTop(m) {
                Column(Modifier.padding(start = 8.dp), horizontalAlignment = Alignment.End) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Mark(mark)
                        Text(
                            counter,
                            fontSize = 22.sp,
                            lineHeight = 24.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                        )
                    }
                    Text(
                        targetText(m),
                        fontSize = SMALL_TEXT,
                        lineHeight = 16.sp,
                        color = LocalContentColor.current.copy(alpha = 0.75f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            TileName(m)
        }
    }
}

/** A full-width tile with the ruler. On an empty day, a press on the ruler at the start value confirms that value. */
@Composable
private fun NumberTile(
    metric: NumberMetric,
    modifier: Modifier,
    filled: Boolean,
    unsaved: Boolean,
    saved: Double?,
    start: Double?,
    today: Day,
    busy: Boolean,
    onChange: (Double?) -> Unit,
) {
    // A number is a measurement: its tile has no mark. A trend goal does not use the value of the day.
    Tile(modifier, filled, unsaved) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                MetricIcon(metric)
                TileName(metric)
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
