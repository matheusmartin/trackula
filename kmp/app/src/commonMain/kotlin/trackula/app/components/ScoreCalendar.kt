package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.app.LocalExtraColors
import trackula.model.Day
import trackula.model.MonthKey
import trackula.model.addMonths
import trackula.model.daysOfMonth
import trackula.model.formatNumber
import trackula.model.monthOf
import trackula.model.monthTitle
import trackula.model.shortDay
import trackula.model.weekdayNames

/** The text on a light day cell. */
private val DARK_INK = Color(0xFF1A1E24)

/** The text on a dark day cell. */
private val LIGHT_INK = Color(0xFFF4F6F9)

/** The highest share of the full color in a calendar day, so that the number on it stays readable. */
private const val MAX_FILL = 0.7f

/**
 * The score of each day of one [month]: a read-only month calendar with the score of each day, Monday first. A day
 * with a higher score has a darker color: the best day of the month has the most color. A day without a score has the
 * empty color and no number. [onMonth] is called when the arrows change the month. The arrow to the next month stops
 * at the month of [today].
 */
@Composable
fun ScoreCalendar(scores: Map<Day, Double>, today: Day, month: MonthKey, onMonth: (MonthKey) -> Unit) {
    val extra = LocalExtraColors.current
    val days = daysOfMonth(month)
    val high = days.mapNotNull { scores[it] }.maxOrNull() ?: 0.0
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Score by month", style = MaterialTheme.typography.titleMedium)
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppIconButton("chevron_left", "Previous month", { onMonth(addMonths(month, -1)) })
            Text(monthTitle(month), modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            AppIconButton(
                "chevron_right",
                "Next month",
                { onMonth(addMonths(month, 1)) },
                enabled =
                month != monthOf(today),
            )
        }
        Column(
            Modifier.widthIn(max = 480.dp).fillMaxWidth().align(Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                for (name in weekdayNames) {
                    Text(name, modifier = Modifier.weight(1f), style = labelStyle(), textAlign = TextAlign.Center)
                }
            }
            // Empty cells before the first day, so that each column is one weekday.
            val cells = List<Day?>(days.first().weekday - 1) { null } + days
            for (week in cells.chunked(7)) {
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    for (i in 0 until 7) {
                        val d = week.getOrNull(i)
                        val score = d?.let { scores[it] }
                        val fill = when {
                            d == null -> Color.Transparent

                            score == null -> extra.cellEmpty

                            else -> lerp(
                                extra.cellEmpty,
                                extra.cell,
                                if (high <=
                                    0
                                ) {
                                    0f
                                } else {
                                    MAX_FILL * (score / high).toFloat()
                                },
                            )
                        }
                        // The text color with the best contrast on the fill, in both themes.
                        val ink = if (fill.luminance() > 0.3f) DARK_INK else LIGHT_INK
                        Box(
                            Modifier
                                .weight(1f)
                                .height(44.dp)
                                .background(fill, RoundedCornerShape(6.dp))
                                .clearAndSetSemantics {
                                    if (d != null) {
                                        contentDescription =
                                            "${shortDay(d)}: ${score?.let { formatNumber(it) } ?: "no score"}"
                                    }
                                },
                        ) {
                            if (d != null) {
                                Text(
                                    "${d.day}",
                                    modifier = Modifier.padding(start = 4.dp, top = 2.dp),
                                    fontSize = 10.sp,
                                    color = if (score == null) MaterialTheme.colorScheme.onSurfaceVariant else ink,
                                )
                                if (score != null) {
                                    Text(
                                        formatNumber(score),
                                        modifier = Modifier.align(Alignment.Center).padding(top = 6.dp),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = ink,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
