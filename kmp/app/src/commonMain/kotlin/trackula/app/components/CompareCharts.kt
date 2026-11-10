package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.app.LocalExtraColors
import trackula.model.ValueRange
import trackula.model.formatNumber
import trackula.model.formatSigned
import trackula.model.stepChanges
import kotlin.math.abs
import kotlin.math.max

/** The width of the row labels of a [ChangeTable]. */
private val ROW_LABEL_WIDTH = 112.dp

/**
 * For each of [labels], a bar from the lowest to the highest value of [ranges], a dot at their average, and a diamond
 * at the value of [marks]. The values of [marks] are above the bars. A null range has no bar, and a null mark has no
 * diamond and no value. The scale goes from a little below the lowest value to the highest value, but not below 0, so
 * that the bars are tall enough to compare. The legend names the bar [rangeLabel], the dot "Average" and the diamond
 * [markLabel]. Example: the score of each weekday of this week in the range of the 4 weeks before.
 */
@Composable
fun RangeBarChart(
    title: String,
    description: String,
    labels: List<String>,
    ranges: List<ValueRange?>,
    marks: List<Double?>,
    rangeLabel: String,
    markLabel: String,
    modifier: Modifier = Modifier,
    format: (Double) -> String = { formatNumber(it) },
) {
    ChartCard(title, description, modifier) {
        val values = ranges.flatMap { listOfNotNull(it?.low, it?.high) } + marks.filterNotNull()
        val high = values.maxOrNull() ?: return@ChartCard NoValues()
        val lowest = values.min()
        // Space below the lowest value, so that its bar or diamond is not on the bottom line.
        val low = max(0.0, lowest - max(high - lowest, 1.0) * 0.25)
        val extra = LocalExtraColors.current
        val bar = extra.cell.copy(alpha = 0.3f)
        // Not the primary color: in the score view, it is the green of the diamonds.
        val dot = MaterialTheme.colorScheme.onSurfaceVariant
        Scroller(labels.size) {
            Column {
                ValueRow(marks, format)
                RangeBars(ranges, max(high, low + 1.0), low, title, bar, dot, marks)
                Labels(labels, all = true)
            }
        }
        Legend(
            listOf(
                StackPart(rangeLabel, bar, emptyList()),
                StackPart("Average", dot, emptyList()),
                StackPart(markLabel, extra.cell, emptyList()),
            ),
        )
    }
}

/** The lowest share of the full color in a cell of a [ChangeTable] with a change, so that a small change shows. */
private const val MIN_CHANGE_FILL = 0.2f

/**
 * A table of numbers: one row for each of [rows], one column for each of [columns]. A row is a label and one value for
 * each column. The color of a cell shows the change from the cell on its left (see `stepChanges`): the cell color for
 * more, the tertiary color for less. A larger change has a stronger color, up to the largest change of the table. A
 * cell without change has the empty color: a cell of the first column, a cell with the same value as the cell on its
 * left, and a cell with no value on it or on its left. A null value shows "–". The legend names the 2 colors [upLabel]
 * and [downLabel]. If [rows] is empty, the card says that there are no values.
 *
 * Example: the points per day of each group in each of the last 5 weeks.
 */
@Composable
fun ChangeTable(
    title: String,
    description: String,
    columns: List<String>,
    rows: List<Pair<String, List<Double?>>>,
    upLabel: String,
    downLabel: String,
    modifier: Modifier = Modifier,
    format: (Double) -> String = { formatNumber(it) },
) {
    ChartCard(title, description, modifier) {
        if (rows.isEmpty()) return@ChartCard NoValues()
        val extra = LocalExtraColors.current
        val up = extra.cell
        val down = MaterialTheme.colorScheme.tertiary
        val changes = rows.map { (_, values) -> stepChanges(values) }
        val largest = changes.flatten().maxOfOrNull { abs(it ?: 0.0) } ?: 0.0
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Box(Modifier.width(ROW_LABEL_WIDTH))
                for (c in columns) {
                    Text(
                        c,
                        modifier = Modifier.weight(1f),
                        style = labelStyle(),
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                    )
                }
            }
            rows.forEachIndexed { r, (label, values) ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        label,
                        modifier = Modifier.width(ROW_LABEL_WIDTH).padding(end = 5.dp),
                        style = labelStyle().copy(color = MaterialTheme.colorScheme.onSurface),
                        textAlign = TextAlign.End,
                        maxLines = 2,
                    )
                    values.forEachIndexed { i, v ->
                        val change = changes[r][i]
                        val fill = if (change == null || change == 0.0 || largest == 0.0) {
                            extra.cellEmpty
                        } else {
                            val share = MIN_CHANGE_FILL + (MAX_FILL - MIN_CHANGE_FILL) * (abs(change) / largest)
                            lerp(extra.cellEmpty, if (change > 0) up else down, share.toFloat())
                        }
                        // The text color with the best contrast on the fill, in both themes.
                        val ink = if (fill.luminance() > 0.3f) DARK_INK else LIGHT_INK
                        val text = v?.let(format)
                        // Example: "Habits, Nov 9: 6.8, +2.1 from Nov 2".
                        val spoken = "$label, ${columns[i]}: ${text ?: "no value"}" +
                            change?.let { ", ${formatSigned(it, null)} from ${columns[i - 1]}" }.orEmpty()
                        Box(
                            Modifier
                                .weight(1f)
                                .height(26.dp)
                                .background(fill, RoundedCornerShape(4.dp))
                                .clearAndSetSemantics { contentDescription = spoken },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(text ?: "–", color = ink, fontSize = 12.sp, maxLines = 1)
                        }
                    }
                }
            }
        }
        Legend(listOf(StackPart(upLabel, up, emptyList()), StackPart(downLabel, down, emptyList())))
    }
}
