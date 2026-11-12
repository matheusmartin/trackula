package trackula.app.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import trackula.app.LocalExtraColors
import trackula.model.Day
import trackula.model.NumberMetric

/** The largest number of days that show the value above each bar. Longer periods have too little space. */
private const val MAX_DAYS_WITH_VALUES = 7

/**
 * The score of [days] as green bars from 0, one for each day, at the top of the 5-day table and of the 31-day
 * calendars. Short periods show the value above each bar. A tap on the title opens the Score view with [onOpen].
 *
 * [score] is `scoreMetric`, or a `groupScoreMetric` with a group filter. Its name is the title.
 *
 * The score is green, not the theme red.
 */
@Composable
fun ScoreChart(score: NumberMetric, days: List<Day>, scores: Map<Day, Double>, onOpen: () -> Unit) {
    AppCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            // The arrow shows that the title opens the Score view.
            Row(
                modifier = Modifier
                    .outset(8.dp, 4.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .semantics { contentDescription = "Show the score only" }
                    .clickable(role = Role.Button, onClick = onOpen)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(score.name, style = MaterialTheme.typography.titleMedium)
                Symbol("chevron_right", size = 20.dp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (days.any { it in scores }) {
                // Room above the chart for the value labels.
                Column(Modifier.padding(top = 12.dp)) {
                    TrendChart(
                        days = days,
                        values = scores,
                        unit = score.unit,
                        showsBars = true,
                        showsValues = days.size <= MAX_DAYS_WITH_VALUES,
                        color = LocalExtraColors.current.done,
                    )
                }
            } else {
                Text(
                    "No score in these days.",
                    modifier = Modifier.padding(top = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
