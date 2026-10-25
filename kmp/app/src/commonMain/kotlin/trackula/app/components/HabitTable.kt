package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
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
import trackula.model.dayValuesWithPending
import trackula.model.formatCompact
import trackula.model.formatNumber
import trackula.model.nearestDay
import trackula.model.planClear
import trackula.model.planNumber
import trackula.model.planYesNo
import trackula.model.weekLabels
import trackula.model.weekRows
import trackula.model.weekdayNames
import trackula.model.withUnit
import trackula.services.CountInput

/** How [HabitTable] shows its days. */
enum class DayLayout {
    /** One row per metric, one column per day. */
    TABLE,

    /** One small calendar per metric, Monday to Sunday. */
    CALENDARS,
}

/**
 * HabitKit-style input table: one row per metric, one column per day, today on the right.
 *
 * - Yes/no: a cell click writes `yes`, or `no` if the day is `yes`. A `no` day shows like an empty day.
 * - Count: see [CountInput]. A count has no reset: it goes to empty with subtractions.
 * - Number: a cell click opens the [NumberEditor] for that metric and day, below the metric. A second click closes
 *   it.
 *
 * - [days]: the days of the table or of the calendars, oldest first.
 * - [pending]: count taps that are not written yet. The table shows them at once.
 * - [onOpen]: opens the detail screen of a metric. Null: the metric names are not links.
 * - [calendarExtra]: more content below each calendar, for example a chart of the metric. The table has none.
 * - [calendarColumns]: a fixed number of calendar columns. Null: as many as fit, each at least 280 dp wide.
 * - [calendarCellSize]: the size of a calendar cell. The detail screen has larger cells than the Today page.
 */
@Composable
fun HabitTable(
    metrics: List<Metric>,
    log: LogTable,
    today: Day,
    days: List<Day>,
    layout: DayLayout,
    busy: Boolean,
    onWrite: ((LogTable) -> LogWrite?) -> Unit,
    pending: Map<MetricDay, List<CountStep>>,
    onCount: (NumberMetric, Day, CountStep) -> Unit,
    onOpen: ((Metric) -> Unit)? = null,
    showsTitle: Boolean = true,
    calendarExtra: @Composable (Metric, Map<Day, Double>) -> Unit = { _, _ -> },
    calendarColumns: Int? = null,
    calendarCellSize: Dp = 26.dp,
) {
    // The metric and day open in the editor.
    var editing by remember { mutableStateOf<MetricDay?>(null) }
    val scope = rememberCoroutineScope()
    val countInput = remember(scope) { CountInput<MetricDay>(scope) }

    fun addCount(m: NumberMetric, d: Day, sign: Int) = onCount(m, d, CountStep(sign * m.step))

    fun click(m: Metric, d: Day, values: Map<Day, Double>) {
        when {
            m is YesNoMetric -> onWrite { planYesNo(m, d, it, done = values[d] == null) }

            m is NumberMetric && !m.isCount -> {
                val cell = MetricDay(m.id, d)
                editing = if (editing == cell) null else cell
            }
        }
    }

    @Composable
    fun cell(m: Metric, d: Day, values: Map<Day, Double>, size: Dp) = DayCell(
        metric = m,
        day = d,
        today = today,
        value = values[d],
        selected = editing == MetricDay(m.id, d),
        enabled = !(busy && m is YesNoMetric),
        size = size,
        countInput = if (m is NumberMetric && m.isCount) countInput else null,
        onAdd = { sign -> if (m is NumberMetric) addCount(m, d, sign) },
        onClick = { click(m, d, values) },
    )

    @Composable
    fun editor(m: NumberMetric, d: Day, values: Map<Day, Double>) = key("${m.id} $d") {
        val near = nearestDay(values.keys, d)
        NumberEditor(
            metric = m,
            label = "${m.name} · ${if (d == today) "today" else "$d"}",
            current = values[d],
            start = near?.let { values[it] },
            busy = busy,
            onSave = { value ->
                onWrite { planNumber(m, d, value, it) }
                editing = null
            },
            onClear = {
                onWrite { planClear(m, d, it) }
                editing = null
            },
            onClose = { editing = null },
        )
    }

    when (layout) {
        DayLayout.TABLE -> BoxWithConstraints(Modifier.fillMaxWidth()) {
            // Phones: smaller cells, so the 5 days and the metric icons fit without scrolling.
            val narrow = maxWidth <= 480.dp
            val cellSize = if (narrow) 30.dp else 34.dp
            val columnWidth = cellSize + 4.dp
            // The name column takes the space that the day columns leave, but at least 120 dp: the table scrolls
            // sideways on very narrow screens.
            val nameWidth = maxOf(120.dp, maxWidth - columnWidth * days.size - 8.dp)
            val rowWidth = nameWidth + columnWidth * days.size
            AppCard(Modifier.fillMaxWidth()) {
                Column(Modifier.horizontalScroll(rememberScrollState())) {
                    Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Spacer(Modifier.width(nameWidth))
                        for (d in days) DayHeader(d, d == today, columnWidth)
                    }
                    for (m in metrics) {
                        key(m.id) {
                            val values = dayValuesWithPending(m, log.entries, pending)
                            HorizontalDivider(
                                Modifier.width(rowWidth),
                                color = MaterialTheme.colorScheme.outlineVariant,
                            )
                            Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    Modifier.width(nameWidth).padding(start = if (narrow) 12.dp else 16.dp, end = 4.dp),
                                ) {
                                    MetricName(m, onOpen)
                                }
                                for (d in days) {
                                    Box(Modifier.width(columnWidth), contentAlignment = Alignment.Center) {
                                        cell(m, d, values, cellSize)
                                    }
                                }
                            }
                            val open = editing
                            if (m is NumberMetric && open != null && open.metricId == m.id) {
                                Box(
                                    Modifier
                                        .width(rowWidth)
                                        .background(MaterialTheme.colorScheme.surfaceContainer)
                                        .padding(12.dp),
                                ) { editor(m, open.day, values) }
                            }
                        }
                    }
                }
            }
        }

        DayLayout.CALENDARS -> BoxWithConstraints(Modifier.fillMaxWidth()) {
            // As many columns as fit, each at least 280 dp wide.
            val columns = calendarColumns ?: maxOf(1, ((maxWidth + 12.dp) / (280.dp + 12.dp)).toInt())
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                for (row in metrics.chunked(columns)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        for (m in row) {
                            key(m.id) {
                                val values = dayValuesWithPending(m, log.entries, pending)
                                AppCard(Modifier.weight(1f)) {
                                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        if (showsTitle) MetricName(m, onOpen)
                                        MonthGrid(days) { d -> cell(m, d, values, calendarCellSize) }
                                        calendarExtra(m, values)
                                        val open = editing
                                        if (m is NumberMetric && open != null && open.metricId == m.id) {
                                            editor(m, open.day, values)
                                        }
                                    }
                                }
                            }
                        }
                        if (row.size < columns) Spacer(Modifier.weight((columns - row.size).toFloat()))
                    }
                }
            }
        }
    }
}

/** The weekday and the day number of a table column. Today is bold. */
@Composable
private fun DayHeader(day: Day, isToday: Boolean, width: Dp) {
    Column(Modifier.width(width), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(weekdayNames[day.weekday - 1], fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("${day.day}", fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal)
    }
}

/**
 * The days of a month calendar: weekday letters on top, and the first day of each week row on the left, with the month
 * when it changes. Columns are Monday to Sunday.
 */
@Composable
fun MonthGrid(days: List<Day>, cell: @Composable (Day) -> Unit) {
    val weeks = weekRows(days)
    val labels = weekLabels(weeks)
    val small = MaterialTheme.colorScheme.onSurfaceVariant
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Spacer(Modifier.width(48.dp))
            for (name in weekdayNames) {
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(name.take(1), fontSize = 11.sp, color = small)
                }
            }
        }
        weeks.forEachIndexed { i, week ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(48.dp).padding(end = 4.dp), contentAlignment = Alignment.CenterEnd) {
                    Text(labels[i], fontSize = 11.sp, color = small, maxLines = 1)
                }
                for (day in week) {
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { if (day != null) cell(day) }
                }
            }
        }
    }
}

/** The icon and the name of [m]. With [onOpen], a link to its detail screen. */
@Composable
fun MetricName(m: Metric, onOpen: ((Metric) -> Unit)?, modifier: Modifier = Modifier) {
    val link = if (onOpen == null) {
        Modifier
    } else {
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .semantics { contentDescription = "Show all data of ${m.name}" }
            .clickable(role = Role.Button) { onOpen(m) }
    }
    Row(
        modifier = modifier.then(link),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MetricIcon(m)
        Text(m.name, maxLines = 2)
    }
}

/**
 * A day cell. A cell with a value has one fixed color, whatever the value: the logo gradient. A day after today is a
 * faded cell that does nothing. Today has a soft ring, and the cell of the open editor has a frame.
 *
 * With [countInput], the cell is a count cell: it is not disabled during a write, because taps queue and show at once.
 */
@Composable
fun DayCell(
    metric: Metric,
    day: Day,
    today: Day,
    value: Double?,
    selected: Boolean,
    enabled: Boolean,
    size: Dp,
    countInput: CountInput<MetricDay>?,
    onAdd: (Int) -> Unit,
    onClick: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val extra = LocalExtraColors.current
    val shape = RoundedCornerShape(8.dp)
    if (day > today) {
        Box(
            Modifier.size(size).background(extra.cellEmpty.copy(alpha = 0.4f), shape).semantics {
                contentDescription =
                    "$day"
            },
        )
        return
    }
    val fill = if (value !=
        null
    ) {
        Modifier.background(extra.cellBrush, shape)
    } else {
        Modifier.background(extra.cellEmpty, shape)
    }
    val ring = colors.onSurface.copy(alpha = 0.4f)
    val input = when {
        countInput != null -> Modifier.countInput(countInput, MetricDay(metric.id, day), onAdd)
        else -> Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick)
    }
    Box(
        modifier = Modifier
            .then(
                if (selected) {
                    Modifier.border(
                        2.dp,
                        colors.tertiary,
                        RoundedCornerShape(10.dp),
                    ).padding(3.dp)
                } else {
                    Modifier
                },
            )
            .size(size)
            .clip(shape)
            .then(fill)
            .drawBehind {
                if (day == today) {
                    val inset = 1.dp.toPx()
                    drawRoundRect(
                        ring,
                        topLeft = Offset(inset, inset),
                        size = Size(this.size.width - 2 * inset, this.size.height - 2 * inset),
                        cornerRadius = CornerRadius(7.dp.toPx()),
                        style = Stroke(2.dp.toPx()),
                    )
                }
            }
            .semantics { contentDescription = "${metric.name}, $day${valueText(metric, value)}${hint(metric)}" }
            .then(input),
        contentAlignment = Alignment.Center,
    ) {
        if (metric is NumberMetric && value != null) {
            Text(formatCompact(value), color = extra.onCell, fontSize = 11.sp, maxLines = 1)
        }
    }
}

/** The input help in the cell description of count metrics. */
private fun hint(m: Metric): String = if (m is NumberMetric && m.isCount) {
    " · Click or tap: +${formatNumber(m.step, 3)}. Right-click or double-tap: −${formatNumber(m.step, 3)}."
} else {
    ""
}

/** The value part of the cell description. Example: ": 82.1 kg". */
private fun valueText(m: Metric, v: Double?): String = when {
    v == null -> ""
    m is YesNoMetric -> ": yes"
    m is NumberMetric -> ": ${withUnit(formatNumber(v, 3), m.unit)}"
    else -> ""
}
