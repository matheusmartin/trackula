package trackula.app.pages

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.app.CountingStore
import trackula.app.TrackulaTheme
import trackula.model.Day
import trackula.model.MainView
import trackula.model.MetricsWrite
import trackula.model.NumberGoal
import trackula.model.NumberMetric
import trackula.model.SetMetricCells
import trackula.sheets.DemoStore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.Duration

/** The longest wait for the UI in a test. */
private const val TIMEOUT = 5_000L

@OptIn(ExperimentalTestApi::class)
class MetricsPageTest {
    private val today = Day(2026, 10, 3)
    private val store = CountingStore(DemoStore(today, delay = Duration.ZERO))
    private var managing by mutableStateOf(true)

    /** Shows the Today page with the metrics screen open. [before] writes to the store before the first load. */
    private fun ComposeUiTest.showPage(before: MetricsWrite? = null) {
        setContent {
            var ready by remember { mutableStateOf(before == null) }
            LaunchedEffect(Unit) {
                if (before != null) store.applyMetrics(before)
                ready = true
            }
            if (ready) {
                TrackulaTheme(dark = false) {
                    // The page scrolls as in the App.
                    Column(Modifier.verticalScroll(rememberScrollState())) {
                        TodayPage(
                            store = store,
                            today = today,
                            expired = { false },
                            onExpired = {},
                            view = MainView.TODAY,
                            onView = {},
                            reload = ReloadHandle(),
                            onBusy = {},
                            onDetail = {},
                            readPref = { null },
                            writePref = { _, _ -> },
                            managing = managing,
                            onManaging = { managing = it },
                        )
                    }
                }
            }
        }
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }
    }

    private fun ComposeUiTest.field(label: String) = onNode(hasSetTextAction() and hasText(label))

    private fun ComposeUiTest.waitFor(text: String) =
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun addAMetricThenTheTodayPageShowsIt() = runComposeUiTest {
        showPage()
        onNodeWithText("Add metric").performClick()
        field("Name").performTextReplacement("Pages")
        field("Icon").performTextReplacement("menu_book")
        onNodeWithText("Count").performClick()
        onNodeWithText("At least").performScrollTo().performClick()
        field("Target").performScrollTo().performTextReplacement("20")
        onNodeWithText("Sheet column: pages").performScrollTo().assertExists()
        onNodeWithText("In the sheet: at least 20").performScrollTo().assertExists()

        onNodeWithText("Save").performScrollTo().performClick()
        waitFor("Add metric")
        assertEquals(
            NumberMetric(id = "pages", name = "Pages", icon = "menu_book", goal = NumberGoal(20.0), isCount = true),
            store.last!!.metrics.last(),
        )

        managing = false
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Add metric").fetchSemanticsNodes().isEmpty() }
        onNodeWithText("Pages").assertExists()
    }

    @Test
    fun saveWithEmptyFieldsShowsTheErrorsAndWritesNothing() = runComposeUiTest {
        showPage()
        onNodeWithText("Add metric").performClick()
        onNodeWithText("Save").performScrollTo().performClick()
        onNodeWithText("Enter a name.").performScrollTo().assertExists()
        onNodeWithText("Enter an icon: a Material Symbols name or an emoji.").performScrollTo().assertExists()
        assertEquals(emptyList(), store.metricsWrites)

        // The errors follow the changes.
        field("Name").performScrollTo().performTextReplacement("Read")
        onNodeWithText("Enter a name.").assertDoesNotExist()
    }

    @Test
    fun editAMetricWithValuesKeepsItsKindGroupAndRenamesIt() = runComposeUiTest {
        showPage()
        onNodeWithText("Water").performClick()
        onNodeWithText("Edit metric").assertExists()
        onNodeWithText("Yes/no").assertIsNotEnabled()
        onNodeWithText("Sheet column: water").performScrollTo().assertExists()

        field("Name").performScrollTo().performTextReplacement("Drinks")
        onNodeWithText("Save").performScrollTo().performClick()
        waitFor("Drinks")
        val water = store.last!!.metrics.first { it.id == "water" }
        assertEquals("Drinks", water.name)
        assertEquals("Nutrition", water.group)
    }

    @Test
    fun aMoveChangesTheOrderOfTheSheet() = runComposeUiTest {
        showPage()
        onNodeWithContentDescription("Move Weight up").assertIsNotEnabled()
        onNodeWithContentDescription("Move Waist up").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { store.last?.metrics?.first()?.id == "waist" }
        assertEquals(listOf("waist", "weight"), store.last!!.metrics.take(2).map { it.id })
    }

    @Test
    fun deleteAMetricThenRestoreItWithItsValues() = runComposeUiTest {
        showPage()
        onNodeWithText("Water").performClick()
        onNodeWithText("Delete metric").performScrollTo().performClick()
        onNode(hasText("Delete metric") and hasAnyAncestor(isDialog())).performClick()
        waitFor("Deleted metrics")
        assertTrue(store.last!!.metrics.none { it.id == "water" })

        onNodeWithText("Restore").performScrollTo().performClick()
        onNodeWithText("Restore metric").assertExists()
        field("Icon").performTextReplacement("water_drop")
        onNodeWithText("Count").performClick()
        // A restored metric needs a goal.
        onNodeWithText("Save").performScrollTo().performClick()
        onNodeWithText("Enter a number.").performScrollTo().assertExists()
        field("Target").performScrollTo().performTextReplacement("8")
        onNodeWithText("Save").performScrollTo().performClick()
        waitFor("Add metric")
        val water = store.last!!.metrics.last()
        assertEquals("water", water.id)
        assertEquals("Water", water.name)
        assertTrue(store.last!!.log.entries.any { it.metricId == "water" })
    }

    @Test
    fun fixARowWithoutIcon() = runComposeUiTest {
        showPage(before = SetMetricCells(11, mapOf(0 to "stretch", 1 to "Stretch", 2 to "yesno")))
        onNodeWithText("Row 11 · stretch").performScrollTo().assertExists()
        onNodeWithText("Fix").performScrollTo().performClick()
        onNodeWithText("Fix row 11").assertExists()

        field("Icon").performTextReplacement("self_improvement")
        onNodeWithText("Save").performScrollTo().performClick()
        waitFor("Add metric")
        assertEquals("stretch", store.last!!.metrics.last().id)
        assertEquals(emptyList(), store.last!!.metricsTable.invalid)
    }

    @Test
    fun fixARowWithoutGoal() = runComposeUiTest {
        showPage(before = SetMetricCells(11, mapOf(0 to "steps", 1 to "Steps", 2 to "count", 6 to "footprint")))
        onNodeWithText("Fix").performScrollTo().performClick()
        onNodeWithText("Fix row 11").assertExists()
        onNodeWithText("No goal. Use for example at least 8, at most 80, or at most 80 from 83 trend.").assertExists()

        onNodeWithText("Save").performScrollTo().performClick()
        onNodeWithText("Enter a number.").performScrollTo().assertExists()
        field("Target").performScrollTo().performTextReplacement("8000")
        onNodeWithText("Save").performScrollTo().performClick()
        waitFor("Add metric")
        assertEquals(NumberGoal(8000.0), (store.last!!.metrics.last() as NumberMetric).goal)
        assertEquals(emptyList(), store.last!!.metricsTable.invalid)
    }

    @Test
    fun cancelOfAChangedFormAsksAndDiscardGoesBackToTheList() = runComposeUiTest {
        showPage()
        onNodeWithText("Water").performClick()
        field("Name").performTextReplacement("Drinks")
        onNodeWithText("Cancel").performScrollTo().performClick()
        onNodeWithText("Discard").performClick()
        waitFor("Add metric")
        onNodeWithText("Drinks").assertDoesNotExist()
        assertEquals(emptyList(), store.metricsWrites)
    }

    @Test
    fun backClosesTheScreen() = runComposeUiTest {
        showPage()
        onNodeWithContentDescription("Back").performClick()
        waitForIdle()
        assertEquals(false, managing)
    }
}
