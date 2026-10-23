package trackula.app.pages

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
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
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performMouseInput
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.rightClick
import androidx.compose.ui.test.v2.runComposeUiTest
import kotlinx.coroutines.CompletableDeferred
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

    /** The value of [metricId] today in the last data that the page loaded. */
    private fun valueToday(metricId: String): Double? = store.last?.log?.valueAt(metricId, today)

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

    @Test
    fun aFailedSaveShowsTheErrorKeepsTheTilesAndTheSaveButtonWorksAgain() = runComposeUiTest {
        showPage()
        store.failWrites = true
        onNodeWithText("Meditate").performClick()
        onNodeWithContentDescription("Save: Meditate").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("No network.").fetchSemanticsNodes().isNotEmpty() }
        assertEquals(MainView.TODAY, view)
        // The failed value is not saved: the tile goes back, and the button is not "Saving…".
        onNodeWithText("Save").assertExists()
        onNodeWithContentDescription("No changes").assertExists()

        store.failWrites = false
        onNodeWithText("Meditate").performClick()
        onNodeWithContentDescription("Save: Meditate").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { view == MainView.SHORT }
        assertEquals(1.0, valueToday("meditate"))
    }

    @Test
    fun tapsDuringAWriteWaitAndGoToTheSheetInOneWriteForTheCell() = runComposeUiTest {
        showPage(MainView.SHORT)
        val gate = CompletableDeferred<Unit>()
        store.gate = gate
        val cell = onAllNodesWithContentDescription("Water, $today", substring = true)[0]
        cell.performMouseInput { click() }
        cell.performMouseInput { click() }
        cell.performMouseInput { click() }
        // All taps show at once, before the writes end.
        waitUntil(timeoutMillis = TIMEOUT) {
            onAllNodesWithContentDescription(
                "Water, $today: 3 glasses",
                substring = true,
            ).fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(0, store.writes.size)

        gate.complete(Unit)
        waitUntil(timeoutMillis = TIMEOUT) { valueToday("water") == 3.0 }
        // The first write has the first tap. The second write has the two taps that came during the first write.
        assertEquals(2, store.writes.size)
    }

    @Test
    fun theKeysAddAndSubtractOnAFocusedCountTile() = runComposeUiTest {
        showPage()
        val tile = onNodeWithContentDescription("Water")
        tile.performSemanticsAction(SemanticsActions.RequestFocus)
        tile.performKeyInput { pressKey(Key.Equals) }
        tile.performKeyInput { pressKey(Key.Equals) }
        tile.performKeyInput { pressKey(Key.Minus) }
        onNodeWithContentDescription("Save: Water").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { view == MainView.SHORT }
        assertEquals(1.0, valueToday("water"))
    }

    @Test
    fun aTouchTapAddsAfterTheWaitAndATouchDoubleTapSubtracts() = runComposeUiTest {
        showPage()
        val tile = onNodeWithContentDescription("Water")
        tile.performTouchInput { click() }
        waitUntil(timeoutMillis = TIMEOUT) {
            onAllNodesWithContentDescription("Save: Water").fetchSemanticsNodes().isNotEmpty()
        }
        tile.performTouchInput {
            click()
            advanceEventTime(50)
            click()
        }
        // 1 − 1 is the saved value again (empty): no change.
        waitUntil(timeoutMillis = TIMEOUT) {
            onAllNodesWithContentDescription("No changes").fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun aScreenReaderClickOnACountCellAddsAStep() = runComposeUiTest {
        showPage(MainView.SHORT)
        onAllNodesWithContentDescription(
            "Water, $today",
            substring = true,
        )[0].performSemanticsAction(SemanticsActions.OnClick)
        waitUntil(timeoutMillis = TIMEOUT) { valueToday("water") == 1.0 }
    }
}
