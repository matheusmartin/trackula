package trackula.app.pages

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.click
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performMouseInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.rightClick
import androidx.compose.ui.test.v2.runComposeUiTest
import kotlinx.coroutines.runBlocking
import trackula.app.CountingStore
import trackula.app.TrackulaTheme
import trackula.model.Day
import trackula.model.MainView
import trackula.sheets.DemoStore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.Duration

/** The longest wait for the UI in a test. */
private const val TIMEOUT = 5_000L

@OptIn(ExperimentalTestApi::class)
class TodayPageTest {
    private val today = Day(2026, 10, 3)
    private val store = CountingStore(DemoStore(today, delay = Duration.ZERO))
    private val prefs = mutableMapOf<String, String>()
    private var view by mutableStateOf(MainView.TODAY)

    private fun ComposeUiTest.showPage(start: MainView = MainView.TODAY) {
        view = start
        setContent {
            TrackulaTheme(dark = false) {
                TodayPage(
                    store = store,
                    today = today,
                    expired = { false },
                    onExpired = {},
                    view = view,
                    onView = { view = it },
                    reload = ReloadHandle(),
                    onBusy = {},
                    readPref = { prefs[it] },
                    writePref = { key, value -> if (value == null) prefs.remove(key) else prefs[key] = value },
                )
            }
        }
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }
    }

    /** The value of [metricId] today in the store. */
    private fun valueToday(metricId: String): Double? = runBlocking { store.load().log.valueAt(metricId, today) }

    @Test
    fun aYesNoTileIsUnsavedUntilSaveAndSaveShowsTheTable() = runComposeUiTest {
        showPage()
        onNodeWithContentDescription("No changes").assertIsNotEnabled()

        onNodeWithText("Meditate").performClick()
        onNodeWithContentDescription("Save: Meditate").assertIsEnabled()
        assertNull(valueToday("meditate"))

        onNodeWithContentDescription("Save: Meditate").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { view == MainView.SHORT }
        assertEquals(1.0, valueToday("meditate"))
    }

    @Test
    fun aSecondTapOnAYesNoTileGoesBackAndTheSavedValueAgainIsNotUnsaved() = runComposeUiTest {
        showPage()
        onNodeWithText("Meditate").performClick()
        onNodeWithText("Meditate").performClick()
        onNodeWithContentDescription("No changes").assertExists()
    }

    @Test
    fun aMouseClickOnACountTileAddsAStepAndARightClickSubtracts() = runComposeUiTest {
        showPage()
        onNodeWithContentDescription("Water").performMouseInput { click() }
        onNodeWithContentDescription("Water").performMouseInput { click() }
        onNodeWithContentDescription("Water").performMouseInput { rightClick() }
        onNodeWithContentDescription("Save: Water").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { view == MainView.SHORT }
        assertEquals(1.0, valueToday("water"))
    }

    @Test
    fun aClickOnAYesNoCellWritesYesAndASecondClickWritesNo() = runComposeUiTest {
        showPage(MainView.SHORT)
        onAllNodesWithContentDescription("Meditate, $today", substring = true)[0].performClick()
        waitUntil(timeoutMillis = TIMEOUT) { valueToday("meditate") == 1.0 }
        onAllNodesWithContentDescription("Meditate, $today: yes", substring = true)[0].performClick()
        waitUntil(timeoutMillis = TIMEOUT) { valueToday("meditate") == 0.0 }
    }

    @Test
    fun countClicksOnACellShowAtOnceAndGoToTheSheet() = runComposeUiTest {
        showPage(MainView.SHORT)
        val cell = onAllNodesWithContentDescription("Water, $today", substring = true)[0]
        cell.performMouseInput { click() }
        cell.performMouseInput { click() }
        waitUntil(timeoutMillis = TIMEOUT) { valueToday("water") == 2.0 }
        onAllNodesWithContentDescription("Water, $today: 2 glasses", substring = true)[0].assertExists()
    }

    @Test
    fun aClickOnANumberCellOpensTheEditorAndSaveWritesTheTypedValue() = runComposeUiTest {
        showPage(MainView.SHORT)
        onAllNodesWithContentDescription("Weight, $today", substring = true)[0].performClick()
        onNodeWithContentDescription("Weight ruler").assertExists()
        onNodeWithContentDescription("Weight kg").performTextReplacement("81,9")
        onNodeWithText("Save").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { valueToday("weight") == 81.9 }
        onNodeWithContentDescription("Weight ruler").assertDoesNotExist()
    }

    @Test
    fun aGroupChipShowsOnlyItsMetricsAndStaysInLocalStorage() = runComposeUiTest {
        showPage(MainView.SHORT)
        onNodeWithText("Hygiene").performClick()
        waitForIdle()
        onNodeWithText("Weight").assertDoesNotExist()
        onNodeWithText("Morning teeth").assertExists()
        assertEquals("Hygiene", prefs["group"])

        onNodeWithText("All").performClick()
        waitForIdle()
        onNodeWithText("Weight").assertExists()
        assertNull(prefs["group"])
    }
}
