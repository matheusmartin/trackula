package trackula.app.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.model.Day
import trackula.model.chartBars
import trackula.model.chartPoints
import trackula.model.formatNumber
import trackula.model.shortDay
import trackula.model.withUnit

/** The size of the chart, in chart units. */
private const val CHART_WIDTH = 100.0
private const val CHART_HEIGHT = 40.0

/** The text of a value on the chart: at most 3 decimals. */
private fun format(value: Double): String = formatNumber(value, 3)

/**
 * A small chart of one number metric or of the score over [days], with the first and last day below it. The chart
 * stretches to the card width, in [color]: the theme primary color by default.
 *
 * - Line (default): the Y axis goes from the lowest to the highest value, or from 0 with [fromZero]. Lines and dots
 *   keep their size.
 * - Bars ([showsBars] true, for `count` metrics): the Y axis goes from 0 to the highest value.
 * - [showsValues]: each dot of the line has its value above it. For short series only, for example 5 days.
 */
@Composable
fun TrendChart(
    days: List<Day>,
    values: Map<Day, Double>,
    unit: String? = null,
    showsBars: Boolean = false,
    fromZero: Boolean = false,
    showsValues: Boolean = false,
    color: Color = MaterialTheme.colorScheme.primary,
) {
    val points = chartPoints(days, values, CHART_WIDTH, CHART_HEIGHT, fromZero = fromZero)
    if (points.isEmpty()) return
    val high = points.maxOf { it.value }
    val low = if (showsBars || fromZero) 0.0 else points.minOf { it.value }
    val textStyle = TextStyle(fontSize = 10.sp, lineHeight = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    val valueStyle = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = color)
    val measurer = rememberTextMeasurer()
    val bars = if (showsBars) chartBars(days, values, CHART_WIDTH, CHART_HEIGHT) else emptyList()
    val sidePadding = if (showsValues) 12.dp else 0.dp
    val label = "Values from ${format(low)} to ${withUnit(format(high), unit)}, " +
        "${shortDay(days.first())} to ${shortDay(days.last())}"

    // A grid as in the Dart app: the Y axis labels on the left of the plot, and the first and last day below it.
    Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        // All values 0 on a scale from 0: the only label is at the bottom, with the line or the bars.
        val onlyBottom = high == 0.0 && (showsBars || fromZero)
        Column(
            modifier = Modifier.height(72.dp),
            verticalArrangement = if (onlyBottom) Arrangement.Bottom else Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.End,
        ) {
            Text(format(high), style = textStyle)
            if (high != low) Text(format(low), style = textStyle)
        }
        Column(Modifier.weight(1f)) {
            Canvas(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = sidePadding)
                    .height(72.dp)
                    .semantics { contentDescription = label },
            ) {
                val sx = size.width / CHART_WIDTH.toFloat()
                val sy = size.height / CHART_HEIGHT.toFloat()
                if (showsBars) {
                    for (b in bars) {
                        val top = (b.y * sy).toFloat()
                        drawRect(
                            color,
                            topLeft = Offset((b.x * sx).toFloat(), top),
                            size = Size((b.w * sx).toFloat(), size.height - top),
                        )
                    }
                    return@Canvas
                }
                val path = Path()
                points.forEachIndexed { i, p ->
                    val x = (p.x * sx).toFloat()
                    val y = (p.y * sy).toFloat()
                    if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }
                drawPath(path, color, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                for (p in points) {
                    val center = Offset((p.x * sx).toFloat(), (p.y * sy).toFloat())
                    drawCircle(color, radius = 3.dp.toPx(), center = center)
                    if (showsValues) {
                        // Above the dot, as the HTML labels on top of the SVG of the Dart app.
                        val layout = measurer.measure(format(p.value), valueStyle)
                        val topLeft = Offset(center.x - layout.size.width / 2f, center.y - layout.size.height * 1.5f)
                        drawText(layout, topLeft = topLeft)
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(horizontal = sidePadding),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(shortDay(days.first()), style = textStyle)
                Text(shortDay(days.last()), style = textStyle)
            }
        }
    }
}
