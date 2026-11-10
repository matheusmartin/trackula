package trackula.app.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.max

/** The width of the row labels of a [HorizontalBarChart]. */
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
