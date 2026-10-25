package trackula.app.pages

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.click
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeRight
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.app.CountingStore
import trackula.app.TrackulaTheme
import trackula.model.Day
import trackula.model.MainView
import trackula.model.formatDateRange
import trackula.model.monthOf
import trackula.model.monthTitle
import trackula.sheets.DemoStore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration

/** The longest wait for the UI in a test. */
private const val TIMEOUT = 5_000L

@OptIn(ExperimentalTestApi::class)
class MetricDetailTest {
    private val today = Day(2026, 10, 3)
    private val store = CountingStore(DemoStore(today, delay = Duration.ZERO))
    private var view by mutableStateOf(MainView.SHORT)
    private var detail by mutableStateOf(false)

    private fun ComposeUiTest.showPage(start: MainView = MainView.SHORT) {
        view = start
        setContent {
            TrackulaTheme(dark = false) {
                // The detail screen is taller than the test window: the tests scroll to a cell before a click.
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    TodayPage(
                        store = store,
                        today = today,
                        expired = { false },
                        onExpired = {},
                        view = view,
                        onView = { view = it },
                        reload = ReloadHandle(),
                        onBusy = {},
                        onDetail = { detail = it },
                        readPref = { null },
                        writePref = { _, _ -> },
                    )
                }
            }
        }
        waitUntil(timeoutMillis = TIMEOUT) { store.last != null }
    }

    private fun ComposeUiTest.openDetail(name: String) {
        onNodeWithContentDescription("Show all data of $name").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Edit days").fetchSemanticsNodes().isNotEmpty() }
    }

    @Test
    fun aMetricNameOpensItsDetailScreenAndBackCloses() = runComposeUiTest {
        showPage()
        openDetail("Meditate")
        assertEquals(true, detail)
        onNodeWithText("Yes rate").assertExists()
        onNodeWithText("Habit strength (%)").assertExists()
        onNodeWithText("Yes days").assertExists()

        onNodeWithContentDescription("Back").performClick()
        waitForIdle()
        assertEquals(false, detail)
        onNodeWithText("Edit days").assertDoesNotExist()
    }

    @Test
    fun theDetailScreenOfANumberAndOfACountHasTheirCharts() = runComposeUiTest {
        showPage()
        openDetail("Weight")
        onNodeWithText("Averages and range").assertExists()
        onNodeWithText("Values and 7-day trend").assertExists()
        onNodeWithContentDescription("Back").performClick()
        waitForIdle()
        openDetail("Water")
        onNodeWithText("Totals").assertExists()
        onNodeWithText("Running total").assertExists()
        onNodeWithText("total").assertExists()
    }

    @Test
    fun theZoomButtonsChangeTheWindowAndTheLabelGoesToAllAndBack() = runComposeUiTest {
        showPage()
        openDetail("Weight")
        // The demo data has 120 days: the window opens at 3 months, and All is 6 months.
        onNodeWithText("3 months").assertExists()
        onNodeWithContentDescription("Show all").performClick()
        waitForIdle()
        onNodeWithText("All").assertExists()
        onNodeWithContentDescription("Zoom out").assertIsNotEnabled()
        onNodeWithContentDescription("Back to 3 months").performClick()
        waitForIdle()
        onNodeWithText("3 months").assertExists()
        onNodeWithContentDescription("Zoom in").performClick()
        waitForIdle()
        onNodeWithText("1 month").assertExists()
    }

    @Test
    fun theArrowsMoveTheWindowByItsSpanAndTheCalendarFollowsIt() = runComposeUiTest {
        showPage()
        openDetail("Weight")
        onNodeWithContentDescription("Zoom in").performClick()
        waitForIdle()
        // 1 month: 5 weeks from Monday 2026-08-31 to today, Saturday 2026-10-03.
        onNodeWithText(formatDateRange(Day(2026, 8, 31), today)).assertExists()
        onNodeWithContentDescription("Later").assertIsNotEnabled()
        onNodeWithText(monthTitle(monthOf(today)), substring = true).assertExists()

        onNodeWithContentDescription("Earlier").performClick()
        waitForIdle()
        onNodeWithText(formatDateRange(Day(2026, 7, 27), Day(2026, 8, 30))).assertExists()
        onNodeWithText(monthTitle(monthOf(Day(2026, 8, 30))), substring = true).assertExists()
    }

    @Test
    fun theCalendarArrowsChangeTheMonthButNotAfterThisMonth() = runComposeUiTest {
        showPage()
        openDetail("Meditate")
        onNodeWithContentDescription("Next month").assertIsNotEnabled()
        onNodeWithContentDescription("Previous month").performScrollTo().performClick()
        waitForIdle()
        // A narrow window shows "September 2026", a wide one "August – September 2026".
        onNodeWithText("September 2026", substring = true).assertExists()
        onNodeWithText("October 2026", substring = true).assertDoesNotExist()
    }

    @Test
    fun aCellInTheCalendarOfTheDetailScreenWrites() = runComposeUiTest {
        showPage()
        openDetail("Meditate")
        val cell = onAllNodesWithContentDescription("Meditate, $today", substring = true)[0]
        cell.performScrollTo()
        cell.performClick()
        waitUntil(timeoutMillis = TIMEOUT) { store.last?.log?.valueAt("meditate", today) == 1.0 }
    }

    @Test
    fun theScoreViewHasTheChartsOfACountAndNoCalendar() = runComposeUiTest {
        showPage(MainView.SCORE)
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Totals").fetchSemanticsNodes().isNotEmpty() }
        onNodeWithText("Score").assertExists()
        onNodeWithText("Edit days").assertDoesNotExist()
        onNodeWithContentDescription("Back").assertDoesNotExist()
    }

    /** Zooms the detail screen of Weight to 1 month: 5 weeks, from Monday 2026-08-31 to today. */
    private fun ComposeUiTest.weightAtOneMonth() {
        showPage()
        openDetail("Weight")
        onNodeWithContentDescription("Zoom in").performClick()
        waitForIdle()
        onNodeWithText(formatDateRange(Day(2026, 8, 31), today)).assertExists()
    }

    @Test
    fun aTapOnTheOverviewMovesTheWindowThere() = runComposeUiTest {
        weightAtOneMonth()
        // The overview starts at the first week of the data, 2026-06-01: a tap at the left end shows the oldest weeks.
        onNodeWithContentDescription("All data").performTouchInput { click(centerLeft) }
        waitForIdle()
        onNodeWithContentDescription("Earlier").assertIsNotEnabled()
        onNodeWithContentDescription("Later").assertIsEnabled()
    }

    @Test
    fun aSideDragOnTheChartsMovesTheWindowByBarsFromThePress() = runComposeUiTest {
        weightAtOneMonth()
        // 5 bars on the width of the charts: a drag to the right of 0.55 bar moves the window 1 week back. From the end
        // of the touch slop (18 px), the drag is less than half a bar: then it does not move the window.
        // The charts area has the width of the test window.
        val bar = onRoot().fetchSemanticsNode().size.width / 5f
        onNodeWithText("Averages and range").performTouchInput {
            down(center)
            moveBy(Offset(bar * 0.275f, 0f))
            moveBy(Offset(bar * 0.275f, 0f))
            up()
        }
        waitForIdle()
        onNodeWithText(formatDateRange(Day(2026, 8, 24), Day(2026, 9, 27))).assertExists()
    }

    @Test
    fun aHeatmapTapShowsItsMonthAndAMoveOfTheWindowGoesBackToTheWindowEnd() = runComposeUiTest {
        weightAtOneMonth()
        // The heatmap of 1 month starts on Monday 2026-08-31, in the top left corner.
        val heatmap = onNodeWithContentDescription("Days from 2026-08-31 to $today")
        heatmap.performScrollTo()
        heatmap.performTouchInput { click(Offset(2f, 2f)) }
        waitForIdle()
        onNodeWithText("August 2026", substring = true).assertExists()
        onNodeWithText("October 2026", substring = true).assertDoesNotExist()

        onNodeWithContentDescription("Earlier").performScrollTo().performClick()
        waitForIdle()
        // The window now ends on 2026-08-30: the calendar shows its month.
        onNodeWithText("August 2026", substring = true).assertExists()
        onNodeWithContentDescription("Next month").assertIsEnabled()
    }

    @Test
    fun aSwipeOnTheCalendarShowsTheMonthBeforeButNotAMonthAfterThisMonth() = runComposeUiTest {
        showPage()
        openDetail("Meditate")
        val calendar = onAllNodesWithContentDescription("Meditate, $today", substring = true)[0]
        calendar.performScrollTo()
        // To the left: the next month. This month is the newest: nothing changes.
        calendar.performTouchInput { swipeLeft(startX = centerX + 100f, endX = centerX - 100f) }
        waitForIdle()
        onNodeWithContentDescription("Next month").assertIsNotEnabled()
        // To the right: the month before.
        calendar.performTouchInput { swipeRight(startX = centerX - 100f, endX = centerX + 100f) }
        waitForIdle()
        onNodeWithContentDescription("Next month").assertIsEnabled()
    }

    @Test
    fun aZoomAwayFromTheNewestBarKeepsTheSameEnd() = runComposeUiTest {
        weightAtOneMonth()
        onNodeWithContentDescription("Earlier").performClick()
        waitForIdle()
        onNodeWithText(formatDateRange(Day(2026, 7, 27), Day(2026, 8, 30))).assertExists()
        // 2 weeks: the 14 days that end on 2026-08-30.
        onNodeWithContentDescription("Zoom in").performClick()
        waitForIdle()
        onNodeWithText(formatDateRange(Day(2026, 8, 17), Day(2026, 8, 30))).assertExists()
    }
}
