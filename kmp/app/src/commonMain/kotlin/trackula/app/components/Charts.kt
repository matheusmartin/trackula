package trackula.app.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.app.LocalExtraColors
import trackula.model.BarUnit
import trackula.model.Day
import trackula.model.ZoomBar
import trackula.model.barLabel
import trackula.model.daysBetween
import trackula.model.formatNumber
import trackula.model.roundHalfAwayFromZero
import trackula.model.shortDay
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/** The height of the bar and line charts, in chart units. */
private const val CHART_HEIGHT = 50f

/** The width of one bar column, in chart units. */
private const val COLUMN_UNITS = 10f

/** The largest number of bars that always fit in the card. A chart with more bars can scroll to the side. */
private const val SCROLL_BARS = 12

/** The smallest width of one bar column in a chart that scrolls. */
private val COLUMN_WIDTH = 41.6.dp

/** The largest width of one bar column. A wide card with few bars shows them centered, not stretched. */
private val MAX_COLUMN_WIDTH = 56.dp

/**
 * The content width of a wide screen: a 640 dp window, as the `min-width: 640px` of the Dart CSS, without the 16 dp
 * page padding on each side.
 */
internal val WIDE_CONTENT = 608.dp

/** The height of a bar or line chart. */
private val PLOT_HEIGHT = 96.dp

/** The text of the chart labels. */
@Composable
private fun labelStyle() =
    TextStyle(fontSize = 11.sp, lineHeight = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

/** The y coordinate of a value from [low] (bottom) to [high] (top), with 2 units of space at the top and the bottom. */
private fun yScale(high: Double, low: Double): (Double) -> Float = { value ->
    if (high == low) CHART_HEIGHT / 2 else (2 + (CHART_HEIGHT - 4) * (high - value) / (high - low)).toFloat()
}

/**
 * A chart card: a title, a one-sentence description, the chart, and labels below it. A wide card takes the full width
 * of the chart grid on wide screens: see [ChartGrid].
 */
@Composable
fun ChartCard(title: String, description: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(12.dp))
            .padding(12.dp),
    ) {
        Text(title, fontSize = 14.sp)
        Text(
            description,
            modifier = Modifier.padding(top = 2.dp, bottom = 8.dp),
            fontSize = 11.sp,
            lineHeight = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        content()
    }
}

/** The text of a chart card with no chart. */
@Composable
private fun NoValues() = Text("No values in this period.", style = labelStyle())

/** A card of a [ChartGrid]: [wide] cards take a full row. */
class ChartItem(val wide: Boolean, val content: @Composable (Modifier) -> Unit)

/**
 * The chart cards of the detail screen: 1 column on phones, 2 on wider screens. Wide cards take the full width. Dense:
 * a small card fills the gap before a wide card.
 */
@Composable
fun ChartGrid(items: List<ChartItem>) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val columns = if (maxWidth >= WIDE_CONTENT) 2 else 1
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            for (row in tileRows(items, columns) { it.wide }) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    for (i in row) items[i].content(Modifier.weight(if (items[i].wide) columns.toFloat() else 1f))
                    val used = row.sumOf { if (items[it].wide) columns else 1 }
                    if (used < columns) Spacer(Modifier.weight((columns - used).toFloat()))
                }
            }
        }
    }
}

/** Key numbers in tiles, as many columns as fit, each at least 144 dp wide. [items] are pairs of label and value. */
@Composable
fun KeyNumbers(items: List<Pair<String, String>>) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        // No empty columns, as the CSS `auto-fit`: few tiles stretch to fill the row.
        val columns = min(items.size, max(1, ((maxWidth + 8.dp) / (144.dp + 8.dp)).toInt()))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (row in items.chunked(columns)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((label, value) in row) {
                        Column(
                            Modifier
                                .weight(1f)
                                .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(12.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                        ) {
                            Text(
                                value,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Text(label, style = labelStyle())
                        }
                    }
                    if (row.size < columns) Spacer(Modifier.weight((columns - row.size).toFloat()))
                }
            }
        }
    }
}

/** One bar of a [BarChart]. A null value draws no bar. */
data class Bar(val label: String, val value: Double?)

/** The labels under a chart: all labels in equal columns if there are few or [all], else the first and the last. */
@Composable
private fun Labels(labels: List<String>, all: Boolean = false) {
    if (labels.isEmpty()) return
    if (all || labels.size <= 12) {
        Row(Modifier.fillMaxWidth()) {
            for (label in labels) {
                Text(
                    label,
                    modifier = Modifier.weight(1f),
                    style = labelStyle(),
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
            }
        }
    } else {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(labels.first(), style = labelStyle())
            Text(labels.last(), style = labelStyle())
        }
    }
}

/**
 * [content] at most [columns] × 56 dp wide, centered. With more than 12 columns, also at least [columns] × 41.6 dp
 * wide. If that is wider than the card, the chart scrolls to the side: with a finger, a trackpad, or the mouse wheel.
 * It starts at the right end, with the newest bars.
 */
@Composable
private fun Scroller(columns: Int, content: @Composable () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        val widest = MAX_COLUMN_WIDTH * columns
        if (columns <= SCROLL_BARS) {
            Box(Modifier.widthIn(max = widest).fillMaxWidth()) { content() }
            return@BoxWithConstraints
        }
        val width = maxOf(minOf(maxWidth, widest), COLUMN_WIDTH * columns)
        val scroll = rememberScrollState()
        LaunchedEffect(scroll.maxValue) { scroll.scrollTo(scroll.maxValue) }
        Box(
            Modifier
                .fillMaxWidth()
                // A vertical mouse wheel scrolls to the side. At an end, the page scrolls as usual.
                .pointerInput(scroll) {
                    awaitPointerEventScope {
                        while (true) {
                            val event = awaitPointerEvent()
                            if (event.type != PointerEventType.Scroll) continue
                            val delta = event.changes.first().scrollDelta
                            if (abs(delta.y) <= abs(delta.x)) continue
                            if (scroll.dispatchRawDelta(delta.y) != 0f) event.changes.forEach { it.consume() }
                        }
                    }
                }
                .horizontalScroll(scroll)
                .padding(bottom = 8.dp),
            contentAlignment = Alignment.TopCenter,
        ) {
            Box(Modifier.width(width)) { content() }
        }
    }
}

/**
 * The value row and the bars of a bar chart, without labels. Bars start at 0. [max] fixes the top of the scale, for
 * example to the highest value of all bars of a zoom chart, so that the scale stays the same while it moves.
 */
@Composable
private fun BarRows(bars: List<Bar>, label: String, max: Double?, format: (Double) -> String, showValues: Boolean) {
    val values = bars.mapNotNull { it.value }
    val top = max ?: values.maxOfOrNull { abs(it) } ?: 1.0
    val scale = if (top == 0.0) 1.0 else top
    val filled = LocalExtraColors.current.cell
    val second = MaterialTheme.colorScheme.tertiary
    if (showValues) {
        // Many values on a phone: smaller text.
        val dense = bars.size > 8
        Row(Modifier.fillMaxWidth().padding(bottom = 3.dp)) {
            for (b in bars) {
                Text(
                    b.value?.let { format(it).replaceFirst('-', '−') }.orEmpty(),
                    modifier = Modifier.weight(1f),
                    fontSize = if (dense) 10.sp else 11.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
            }
        }
    }
    Canvas(Modifier.fillMaxWidth().height(PLOT_HEIGHT).semantics { contentDescription = label }) {
        val sx = size.width / (bars.size * COLUMN_UNITS)
        val sy = size.height / CHART_HEIGHT
        bars.forEachIndexed { i, b ->
            val v = b.value ?: return@forEachIndexed
            val height = max(0.4f, (abs(v) / scale * CHART_HEIGHT).toFloat())
            val top = if (v >= 0) CHART_HEIGHT - height else CHART_HEIGHT
            drawRect(
                if (v >= 0) filled else second,
                topLeft = Offset((i * COLUMN_UNITS + 1.5f) * sx, top * sy),
                size = Size(7 * sx, height * sy),
            )
        }
    }
}

/** Bars from 0 to the highest value. [max] fixes the top of the scale, for example 100 for percentages. */
@Composable
fun BarChart(
    title: String,
    description: String,
    bars: List<Bar>,
    modifier: Modifier = Modifier,
    max: Double? = null,
    format: (Double) -> String = { formatNumber(it) },
) {
    ChartCard(title, description, modifier) {
        Scroller(bars.size) {
            Column {
                BarRows(bars, title, max, format, showValues = true)
                Labels(bars.map { it.label }, all = true)
            }
        }
    }
}

/**
 * Dots for each value, and a line: the [trend] if given, else through the dots. [dots] is false for long series, for
 * example the habit strength. [decimals] are the decimals of the axis labels. [range] fixes the scale, for example
 * (0, 100) for percentages. Null: from the lowest to the highest value.
 */
@Composable
fun LineChart(
    title: String,
    description: String,
    days: List<Day>,
    values: List<Double?>,
    modifier: Modifier = Modifier,
    trend: List<Double?>? = null,
    dots: Boolean = true,
    decimals: Int = 2,
    range: Pair<Double, Double>? = null,
) {
    ChartCard(title, description, modifier) {
        val all = values.filterNotNull() + trend.orEmpty().filterNotNull()
        if (all.isEmpty()) return@ChartCard NoValues()
        val high = range?.second ?: all.max()
        val low = range?.first ?: all.min()
        val primary = MaterialTheme.colorScheme.primary
        val dotColor = if (trend == null) primary else LocalExtraColors.current.cell
        val y = yScale(high, low)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Column(
                Modifier.height(PLOT_HEIGHT),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.End,
            ) {
                Text(formatNumber(high, decimals), style = labelStyle())
                if (high != low) Text(formatNumber(low, decimals), style = labelStyle())
            }
            Column(Modifier.weight(1f)) {
                Canvas(Modifier.fillMaxWidth().height(PLOT_HEIGHT).semantics { contentDescription = title }) {
                    val width = max(1, values.size - 1).toFloat()
                    val sx = size.width / width
                    val sy = size.height / CHART_HEIGHT
                    fun x(i: Int) = (if (values.size == 1) width / 2 else i.toFloat()) * sx
                    val series = trend ?: values
                    val path = Path()
                    var started = false
                    series.forEachIndexed { i, v ->
                        if (v == null) return@forEachIndexed
                        if (started) path.lineTo(x(i), y(v) * sy) else path.moveTo(x(i), y(v) * sy)
                        started = true
                    }
                    drawPath(path, primary, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                    if (dots) {
                        val radius = (if (values.size > 60) 1.5.dp else 2.5.dp).toPx()
                        values.forEachIndexed { i, v ->
                            v?.let { drawCircle(dotColor, radius, Offset(x(i), y(it) * sy)) }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(shortDay(days.first()), style = labelStyle())
                    Text(shortDay(days.last()), style = labelStyle())
                }
            }
        }
    }
}

/** One part of a [DonutChart]. */
data class DonutPart(val label: String, val value: Int, val color: Color)

/** A ring with one arc per part, the [center] text in the middle, and a legend with totals and percentages. */
@Composable
fun DonutChart(
    title: String,
    description: String,
    parts: List<DonutPart>,
    center: String,
    modifier: Modifier = Modifier,
) {
    ChartCard(title, description, modifier) {
        val total = parts.sumOf { it.value }
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(104.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.size(104.dp).semantics { contentDescription = title }) {
                    // The radius of the ring is 40 % of the size, and its width 16 %, as in the Dart chart.
                    val stroke = size.width * 0.16f
                    val radius = size.width * 0.4f
                    val topLeft = Offset(size.width / 2 - radius, size.height / 2 - radius)
                    var start = -90f
                    for (part in parts) {
                        if (part.value == 0 || total == 0) continue
                        val sweep = part.value.toFloat() / total * 360f
                        drawArc(
                            part.color,
                            start,
                            sweep,
                            false,
                            topLeft,
                            Size(2 * radius, 2 * radius),
                            style = Stroke(stroke),
                        )
                        start += sweep
                    }
                }
                Text(
                    center,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for (part in parts) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(11.dp).background(part.color, RoundedCornerShape(3.dp)))
                        val percent = if (total == 0) 0 else roundHalfAwayFromZero(part.value * 100.0 / total).toInt()
                        Text("${part.label}: ${part.value} · $percent%", fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

/** The largest number of bars that show their values above them. */
private const val MAX_BARS_WITH_VALUES = 13

/**
 * Bars over time: one bar for each week, month or quarter of the time window. See `ZoomWindow`.
 *
 * - [max] fixes the top of the scale, for example to all bars of rates and sums, so that the scale does not change
 *   while the window moves. Null: the bars in view.
 * - Values show above the bars when 13 bars or fewer are in view.
 * - With [showsRange], each bar goes from the lowest to the highest value, and a dot shows the average.
 */
@Composable
fun TimeBars(
    title: String,
    description: String,
    bars: List<ZoomBar>,
    barUnit: BarUnit,
    modifier: Modifier = Modifier,
    format: (Double) -> String = { formatNumber(it) },
    max: Double? = null,
    showsRange: Boolean = false,
) {
    ChartCard(title, description, modifier) {
        val highs = bars.mapNotNull { if (showsRange) it.high else it.value }
        val lows = bars.mapNotNull { if (showsRange) it.low else it.value }
        if (highs.isEmpty()) return@ChartCard NoValues()
        val high = max ?: highs.max()
        val low = lows.min()
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            Column(Modifier.widthIn(max = MAX_COLUMN_WIDTH * bars.size).fillMaxWidth()) {
                if (showsRange) {
                    RangeBars(bars, high, low, title)
                } else {
                    BarRows(
                        bars.map { Bar(barLabel(it.start, barUnit), it.value) },
                        title,
                        high,
                        format,
                        showValues = bars.size <= MAX_BARS_WITH_VALUES,
                    )
                }
                Labels(bars.mapIndexed { i, b -> barLabel(b.start, barUnit, first = i == 0) })
            }
        }
    }
}

/** One bar from the lowest to the highest value for each of [bars], and the average as a dot. */
@Composable
private fun RangeBars(bars: List<ZoomBar>, high: Double, low: Double, label: String) {
    val empty = LocalExtraColors.current.cellEmpty
    val primary = MaterialTheme.colorScheme.primary
    val y = yScale(high, low)
    Canvas(Modifier.fillMaxWidth().height(PLOT_HEIGHT).semantics { contentDescription = label }) {
        val sx = size.width / (bars.size * COLUMN_UNITS)
        val sy = size.height / CHART_HEIGHT
        bars.forEachIndexed { i, b ->
            val barLow = b.low ?: return@forEachIndexed
            val barHigh = b.high ?: return@forEachIndexed
            val average = b.value ?: return@forEachIndexed
            val x = (i * COLUMN_UNITS + 5) * sx
            // A stroke with round ends that keeps its width, as in the Dart chart.
            val top = y(barHigh) * sy
            val bottom = max(y(barHigh) + 0.5f, y(barLow)) * sy
            drawLine(empty, Offset(x, top), Offset(x, bottom), strokeWidth = 10.dp.toPx(), cap = StrokeCap.Round)
            drawCircle(primary, 2.5.dp.toPx(), Offset(x, y(average) * sy))
        }
    }
}

/**
 * A small chart of all data in weeks, with a box on the days from [from] to [to]. A tap or a drag calls [onPoint] with
 * the day under the pointer.
 *
 * - [weeks]: one bar for each week of all data, oldest first.
 * - [fromZero]: the bars start at 0, for rates and sums. Else they start a little below the lowest week, so that
 *   changes show.
 */
@Composable
fun Overview(weeks: List<ZoomBar>, fromZero: Boolean, from: Day, to: Day, onPoint: (Day) -> Unit) {
    if (weeks.isEmpty()) return
    val point by rememberUpdatedState(onPoint)
    val filled = LocalExtraColors.current.cell
    val outline = MaterialTheme.colorScheme.outlineVariant
    val primary = MaterialTheme.colorScheme.primary
    val values = weeks.mapNotNull { it.value }
    val high = values.maxOrNull() ?: 1.0
    val lowest = values.minOrNull() ?: 0.0
    val low = if (fromZero) 0.0 else lowest - (high - lowest) * 0.15
    val barHeight = 30f
    val first = weeks.first().start
    val last = weeks.last().start.addDays(6)

    fun dayAt(x: Float, width: Float): Day {
        val fraction = (x / width).coerceIn(0f, 1f)
        return first.addDays(roundHalfAwayFromZero((fraction * (last.serial - first.serial)).toDouble()).toInt())
    }

    Canvas(
        Modifier
            .fillMaxWidth()
            .height(32.dp)
            .semantics { contentDescription = "All data" }
            .pointerInput(first, last) {
                // A press and each move: all moves go to the overview, also vertical ones.
                awaitEachGesture {
                    var event = awaitPointerEvent()
                    while (event.type != PointerEventType.Press) event = awaitPointerEvent()
                    while (true) {
                        val change = event.changes.first()
                        if (!change.pressed) break
                        change.consume()
                        point(dayAt(change.position.x, size.width.toFloat()))
                        event = awaitPointerEvent()
                    }
                }
            },
    ) {
        val sx = size.width / (weeks.size * COLUMN_UNITS)
        val sy = size.height / (barHeight + 2)
        fun x(d: Day) = ((d.serial - first.serial) / 7f * COLUMN_UNITS) * sx
        fun bar(v: Double) = max(0.5f, ((v - low) / (if (high - low == 0.0) 1.0 else high - low) * barHeight).toFloat())
        weeks.forEachIndexed { i, b ->
            val v = b.value ?: return@forEachIndexed
            val inWindow = b.start.addDays(6) >= from && b.start <= to
            drawRect(
                if (inWindow) filled else outline,
                topLeft = Offset((i * COLUMN_UNITS + 1) * sx, (barHeight + 1 - bar(v)) * sy),
                size = Size(8 * sx, bar(v) * sy),
            )
        }
        val left = x(from)
        drawRect(
            primary,
            topLeft = Offset(left, 0.5f * sy),
            size = Size(max(4 * sx, x(to.addDays(1)) - left), (barHeight + 1) * sy),
            style = Stroke(1.5.dp.toPx()),
        )
    }
}

/** The largest number of days that show as single cells. Single days of a longer window are too small. */
private const val MAX_HEATMAP_DAYS = 371

/**
 * The days from [from] to [to] in week columns, Monday at the top. A day that [filled] gives true for is filled. A tap
 * on a day calls [onDay]. Without [onDay], a tap does nothing.
 */
@Composable
fun DayHeatmap(
    title: String,
    from: Day,
    to: Day,
    filled: (Day) -> Boolean,
    today: Day,
    modifier: Modifier = Modifier,
    onDay: ((Day) -> Unit)? = null,
) {
    val description =
        onDay?.let { "Tap a day to show its month in the calendar." } ?: "One cell for each day of the window."
    ChartCard(title, description, modifier) {
        if (to.serial - from.serial + 1 > MAX_HEATMAP_DAYS) {
            return@ChartCard Text("Zoom in to 1 year or less to see single days.", style = labelStyle())
        }
        val offset = from.weekday - 1
        val days = daysBetween(from, to)
        val columns = ceil((offset + days.size) / 7.0).toInt()
        val extra = LocalExtraColors.current
        val ring = MaterialTheme.colorScheme.onSurface
        val tap by rememberUpdatedState(onDay)
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            // Short windows: cells at most about 24 dp, centered, not the full width.
            val width: Dp = min(maxWidth.value, columns * 24f).dp
            val cell = width / columns
            Canvas(
                Modifier
                    .size(width, cell * 7)
                    .semantics { contentDescription = "Days from $from to $to" }
                    .pointerInput(from, to) {
                        detectTapGestures { position ->
                            val step = size.width.toFloat() / columns
                            val index = (position.x / step).toInt() * 7 + (position.y / step).toInt() - offset
                            if (index in days.indices) tap?.invoke(days[index])
                        }
                    },
            ) {
                val step = size.width / columns
                // The gap is 2 of 12 units, as in the Dart chart.
                val side = step * 10 / 12
                days.forEachIndexed { i, d ->
                    val topLeft = Offset((i + offset) / 7 * step, (i + offset) % 7 * step)
                    drawRoundRect(
                        if (filled(d)) extra.cell else extra.cellEmpty,
                        topLeft,
                        Size(side, side),
                        CornerRadius(side / 5),
                    )
                    if (d == today) {
                        drawRoundRect(
                            ring,
                            topLeft,
                            Size(side, side),
                            CornerRadius(side / 5),
                            style = Stroke(1.dp.toPx()),
                        )
                    }
                }
            }
        }
    }
}
