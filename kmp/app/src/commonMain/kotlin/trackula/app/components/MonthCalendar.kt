package trackula.app.components

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import trackula.model.CountStep
import trackula.model.Day
import trackula.model.LogTable
import trackula.model.LogWrite
import trackula.model.Metric
import trackula.model.MetricDay
import trackula.model.MonthKey
import trackula.model.NumberMetric
import trackula.model.addMonths
import trackula.model.daysOfMonth
import trackula.model.monthOf
import trackula.model.monthPairTitle
import trackula.model.monthTitle
import kotlin.math.abs

/** The smallest side move of a swipe, in pixels. A swipe also moves more to the side than up or down. */
private const val SWIPE_DISTANCE = 50f

/**
 * The calendar of the detail screen, to edit the days of one metric in any month. It has the same day cells and
 * inputs as the Today page, and its own month arrows and swipes. Wide screens also show the month before on the left.
 *
 * [month] is the month in view. [onMonth] is called when the arrows or a swipe change the month.
 */
@Composable
fun MonthCalendar(
    metric: Metric,
    log: LogTable,
    today: Day,
    busy: Boolean,
    onWrite: ((LogTable) -> LogWrite?) -> Unit,
    pending: Map<MetricDay, List<CountStep>>,
    onCount: (NumberMetric, Day, CountStep) -> Unit,
    month: MonthKey,
    onMonth: (MonthKey) -> Unit,
) {
    val before = addMonths(month, -1)
    val isThisMonth = month == monthOf(today)
    val move by rememberUpdatedState { delta: Int -> onMonth(addMonths(month, delta)) }
    val canGoNext by rememberUpdatedState(!isThisMonth)

    @Composable
    fun calendar(days: List<Day>, modifier: Modifier) = Column(modifier) {
        HabitTable(
            metrics = listOf(metric),
            log = log,
            today = today,
            days = days,
            layout = DayLayout.CALENDARS,
            busy = busy,
            onWrite = onWrite,
            pending = pending,
            onCount = onCount,
            showsTitle = false,
            calendarColumns = 1,
            calendarCellSize = 34.dp,
        )
    }

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        // Phones: one month. Wider screens: the month before on the left, and a title with both months.
        val two = maxWidth >= 640.dp
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Edit days", style = MaterialTheme.typography.titleMedium)
            Row(verticalAlignment = Alignment.CenterVertically) {
                AppIconButton("chevron_left", "Previous month", { move(-1) })
                Text(
                    if (two) monthPairTitle(before, month) else monthTitle(month),
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                AppIconButton("chevron_right", "Next month", { move(1) }, enabled = !isThisMonth)
            }
            // A swipe to the left shows the next month, a swipe to the right the month before. The cells still get
            // their taps: the swipe only reads the pointer positions.
            Row(
                modifier = Modifier.pointerInput(Unit) {
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        var last = down.position
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            last = change.position
                            if (!change.pressed) break
                        }
                        val dx = last.x - down.position.x
                        val dy = last.y - down.position.y
                        if (abs(dx) < SWIPE_DISTANCE || abs(dx) < 2 * abs(dy)) return@awaitEachGesture
                        if (dx < 0) {
                            if (canGoNext) move(1)
                        } else {
                            move(-1)
                        }
                    }
                },
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (two) calendar(daysOfMonth(before), Modifier.weight(1f))
                calendar(daysOfMonth(month), Modifier.weight(1f))
            }
        }
    }
}
