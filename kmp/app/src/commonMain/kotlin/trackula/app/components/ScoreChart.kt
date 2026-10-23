package trackula.app.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import trackula.app.LocalExtraColors
import trackula.model.Day
import trackula.model.scoreMetric

/** The largest number of days that show the value above each dot. Longer periods have too little space. */
private const val MAX_DAYS_WITH_VALUES = 7

/**
 * The score of [days] as a green line chart from 0, at the top of the 5-day table and of the 31-day calendars. Short
 * periods show the value above each dot. A tap on the title opens the Score view with [onOpen].
 *
 * The score uses the green of done tiles, not the theme red.
 */
@Composable
fun ScoreChart(days: List<Day>, scores: Map<Day, Double>, onOpen: () -> Unit) {
    AppCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(
                scoreMetric.name,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .semantics { contentDescription = "Show the score only" }
                    .clickable(role = Role.Button, onClick = onOpen),
            )
            if (days.any { it in scores }) {
                // Room above the chart for the value labels.
                Column(Modifier.padding(top = 12.dp)) {
                    TrendChart(
                        days = days,
                        values = scores,
                        unit = scoreMetric.unit,
                        fromZero = true,
                        showsValues = days.size <= MAX_DAYS_WITH_VALUES,
                        color = LocalExtraColors.current.done,
                    )
                }
            } else {
                Text("No score in these days.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
