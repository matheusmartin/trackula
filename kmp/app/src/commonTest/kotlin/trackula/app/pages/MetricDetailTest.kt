package trackula.app.pages

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
}
