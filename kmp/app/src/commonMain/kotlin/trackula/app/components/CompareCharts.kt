package trackula.app.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import trackula.app.LocalExtraColors
import trackula.model.ValueRange
import trackula.model.formatNumber
import kotlin.math.abs
import kotlin.math.max

/** The width of the row labels of a [HorizontalBarChart] and a [CellGrid]. */
private val ROW_LABEL_WIDTH = 112.dp

/** The width of the values after the bars of a [HorizontalBarChart]. */
private val ROW_VALUE_WIDTH = 72.dp

/**
 * One row of a [HorizontalBarChart]: the [label] on the left, a bar for [value] in [color], and [text] on the right.
 * A negative [value] draws its bar to the left of the 0 line.
 */
data class HBar(val label: String, val value: Double, val color: Color, val text: String)

/**
 * One horizontal bar for each of [bars], in their order. Without negative values the bars start at the left. With
 * negative values the 0 line moves to the right, so that the bars to the left and to the right have the same scale.
 * With [legend], a legend is below the bars. If [bars] is empty, the card says that there are no values.
 */
@Composable
fun HorizontalBarChart(
    title: String,
    description: String,
    bars: List<HBar>,
    modifier: Modifier = Modifier,
    legend: List<StackPart> = emptyList(),
) {
    ChartCard(title, description, modifier) {
        if (bars.isEmpty()) return@ChartCard NoValues()
        val above = bars.maxOf { max(0.0, it.value) }
        val below = bars.maxOf { max(0.0, -it.value) }
        val scale = if (above + below == 0.0) 1.0 else above + below
        // The x of the 0 line, as a part of the bar area.
        val zero = (below / scale).toFloat()
        val line = MaterialTheme.colorScheme.outlineVariant
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for (b in bars) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        b.label,
                        modifier = Modifier.width(ROW_LABEL_WIDTH),
                        style = labelStyle().copy(color = MaterialTheme.colorScheme.onSurface),
                        textAlign = TextAlign.End,
                        maxLines = 2,
                    )
                    Canvas(
                        Modifier
                            .weight(1f)
                            .height(14.dp)
                            .semantics { contentDescription = "${b.label}: ${b.text}" },
                    ) {
                        val zeroX = size.width * zero
                        val width = max(1f, (abs(b.value) / scale * size.width).toFloat())
                        val left = if (b.value >= 0) zeroX else zeroX - width
                        drawRoundRect(
                            b.color,
                            topLeft = Offset(left, 1f),
                            size = Size(width, size.height - 2f),
                            cornerRadius = CornerRadius(4.dp.toPx()),
                        )
                        if (below > 0) drawLine(line, Offset(zeroX, 0f), Offset(zeroX, size.height), 1.dp.toPx())
                    }
                    Text(b.text, modifier = Modifier.width(ROW_VALUE_WIDTH), style = labelStyle(), maxLines = 1)
                }
            }
        }
        if (legend.isNotEmpty()) Legend(legend)
    }
}

/**
 * Bars from 0 side by side: for each of [labels], one bar for each of [series], in their order, with a legend. The
 * values of the last series are above the bars. Example: last week and this week on each weekday.
 */
@Composable
fun GroupedBarChart(
    title: String,
    description: String,
    labels: List<String>,
    series: List<StackPart>,
    modifier: Modifier = Modifier,
    format: (Double) -> String = { formatNumber(it) },
) {
    ChartCard(title, description, modifier) {
        val high = series.flatMap { it.values }.filterNotNull().maxOrNull() ?: return@ChartCard NoValues()
        val scale = if (high <= 0.0) 1.0 else high
        Scroller(labels.size) {
            Column {
                ValueRow(series.last().values, format)
                Canvas(Modifier.fillMaxWidth().height(PLOT_HEIGHT).semantics { contentDescription = title }) {
                    val sx = size.width / (labels.size * COLUMN_UNITS)
                    val sy = size.height / PLOT_UNITS
                    // 8 of the 10 units of a column hold the bars, with a gap of 0.5 unit between them.
                    val gap = 0.5f
                    val barUnits = (8f - gap * (series.size - 1)) / series.size
                    for (i in labels.indices) {
                        series.forEachIndexed { k, part ->
                            val v = max(0.0, part.values[i] ?: return@forEachIndexed)
                            val height = max(0.4f, (v / scale * PLOT_UNITS).toFloat())
                            val x = i * COLUMN_UNITS + 1f + k * (barUnits + gap)
                            drawRect(
                                part.color,
                                topLeft = Offset(x * sx, (PLOT_UNITS - height) * sy),
                                size = Size(barUnits * sx, height * sy),
                            )
                        }
                    }
                }
                Labels(labels, all = true)
            }
        }
        Legend(series)
    }
}

/**
 * For each of [labels], a bar from the lowest to the highest value of [ranges] and a dot at the average, on a scale
 * from 0. The averages are above the bars. A null range has no bar. Example: the scores of each weekday.
 */
@Composable
fun RangeBarChart(
    title: String,
    description: String,
    labels: List<String>,
    ranges: List<ValueRange?>,
    modifier: Modifier = Modifier,
    format: (Double) -> String = { formatNumber(it) },
) {
    ChartCard(title, description, modifier) {
        val high = ranges.mapNotNull { it?.high }.maxOrNull() ?: return@ChartCard NoValues()
        Scroller(labels.size) {
            Column {
                ValueRow(ranges.map { it?.average }, format)
                RangeBars(ranges, max(high, 1.0), 0.0, title)
                Labels(labels, all = true)
            }
        }
    }
}

/**
 * A grid of cells: one row for each of [rows], one column for each of [columns]. A row is a label and one value for
 * each column. Each row has its own scale: its highest value has the full color, 0 the empty color. A null value has
 * the empty color. Example: the average points of each metric on each weekday.
 */
@Composable
fun CellGrid(
    title: String,
    description: String,
    columns: List<String>,
    rows: List<Pair<String, List<Double?>>>,
    modifier: Modifier = Modifier,
    format: (Double) -> String = { formatNumber(it) },
) {
    ChartCard(title, description, modifier) {
        if (rows.isEmpty()) return@ChartCard NoValues()
        val extra = LocalExtraColors.current
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Box(Modifier.width(ROW_LABEL_WIDTH))
                for (c in columns) {
                    Text(c, modifier = Modifier.weight(1f), style = labelStyle(), textAlign = TextAlign.Center)
                }
            }
            for ((label, values) in rows) {
                val high = values.filterNotNull().maxOrNull() ?: 0.0
                Row(
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        label,
                        modifier = Modifier.width(ROW_LABEL_WIDTH),
                        style = labelStyle().copy(color = MaterialTheme.colorScheme.onSurface),
                        textAlign = TextAlign.End,
                        maxLines = 1,
                    )
                    values.forEachIndexed { i, v ->
                        val level = if (v == null || high <= 0) null else (max(0.0, v) / high).toFloat()
                        val color =
                            level?.let { lerp(extra.cellEmpty, extra.cell, 0.15f + 0.85f * it) } ?: extra.cellEmpty
                        Box(
                            Modifier
                                .weight(1f)
                                .height(18.dp)
                                .background(color, RoundedCornerShape(4.dp))
                                .semantics {
                                    contentDescription = "$label, ${columns[i]}: ${v?.let(format) ?: "no value"}"
                                },
                        )
                    }
                }
            }
        }
    }
}
