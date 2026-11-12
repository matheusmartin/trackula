package trackula.app.components

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.app.TrackulaTheme
import trackula.model.Day
import trackula.model.LogTable
import trackula.model.Metric
import trackula.model.NumberGoal
import trackula.model.NumberMetric
import trackula.model.YesNoMetric
import kotlin.test.Test

@OptIn(ExperimentalTestApi::class)
class TodayTilesTest {
    private val today = Day(2026, 10, 3)
    private val meditate = YesNoMetric(id = "meditate", name = "Meditate", icon = "self_improvement")
    private val water = NumberMetric(
        id = "water",
        name = "Water",
        icon = "water_drop",
        goal = NumberGoal(8.0),
        unit = "glasses",
        isCount = true,
    )
    private val coffee = water.copy(
        id = "coffee",
        name = "Coffee",
        goal = NumberGoal(2.5, isMaximum = true),
        unit = null,
    )

    /** Shows the tiles of [metrics] on an empty log. With [host], the App place of the Save button, below the tiles. */
    private fun ComposeUiTest.showTiles(metrics: List<Metric>, host: ActionBarHost? = null) = setContent {
        TrackulaTheme(dark = false) {
            CompositionLocalProvider(LocalActionBarHost provides host) {
                Column {
                    TodayTiles(
                        metrics = metrics,
                        log = LogTable(emptyList(), emptyMap(), emptyMap()),
                        today = today,
                        busy = false,
                        onWriteAll = { _, onDone -> onDone() },
                        pending = emptyMap(),
                    )
                    host?.content?.invoke()
                }
            }
        }
    }

    @Test
    fun aCountTileShowsTheTargetOfItsGoalBelowTheCounter() = runComposeUiTest {
        showTiles(listOf(water, coffee))
        onNodeWithText("of 8 glasses").assertExists()
        onNodeWithText("max 2.5").assertExists()
    }

    @Test
    fun withoutAnActionBarHostTheSaveButtonAlwaysShowsInThePage() = runComposeUiTest {
        showTiles(listOf(meditate))
        onNodeWithContentDescription("No changes").assertIsNotEnabled()
    }

    @Test
    fun withAnActionBarHostTheSaveButtonShowsThereOnlyWithValuesToSave() = runComposeUiTest {
        showTiles(listOf(meditate), ActionBarHost())
        onNodeWithText("Save").assertDoesNotExist()

        onNodeWithText("Meditate").performClick()
        onNodeWithContentDescription("Save: Meditate").assertIsEnabled()

        // The saved value again: nothing to save.
        onNodeWithText("Meditate").performClick()
        onNodeWithText("Save").assertDoesNotExist()
    }
}
