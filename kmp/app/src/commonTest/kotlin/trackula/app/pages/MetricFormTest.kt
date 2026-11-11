package trackula.app.pages

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.app.TrackulaTheme
import trackula.model.GoalDirection
import trackula.model.Metric
import trackula.model.MetricDraft
import trackula.model.MetricKind
import trackula.model.NumberGoal
import trackula.model.NumberMetric
import kotlin.test.Test
import kotlin.test.assertEquals

@OptIn(ExperimentalTestApi::class)
class MetricFormTest {
    private val saved = mutableListOf<Metric>()
    private var deletes = 0

    private val weight = MetricDraft(
        name = "Weight",
        icon = "monitor_weight",
        kind = MetricKind.NUMBER,
        unit = "kg",
        step = "0.1",
        direction = GoalDirection.AT_MOST,
        target = "80",
        start = "84",
    )

    private fun ComposeUiTest.showForm(setup: FormSetup, takenIds: Set<String> = emptySet()) {
        setContent {
            TrackulaTheme(dark = false) {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    MetricForm(
                        setup = setup,
                        takenIds = takenIds,
                        groups = listOf("Health", "Hygiene"),
                        busy = false,
                        error = null,
                        onSave = { saved.add(it) },
                        onDelete = { deletes++ },
                        onClose = {},
                    )
                }
            }
        }
    }

    @Test
    fun aNewMetricGetsAnIdFromItsNameThatIsNotTaken() = runComposeUiTest {
        showForm(FormSetup("Add metric", MetricDraft()), takenIds = setOf("read"))
        onNode(hasSetTextAction() and hasText("Name")).performTextReplacement("Read")
        onNodeWithText("Sheet column: read_2").performScrollTo().assertExists()
    }

    @Test
    fun theFormShowsThePointsOfTheGoalAndTheTrendOnlyForANumberMetric() = runComposeUiTest {
        showForm(FormSetup("Edit metric", weight, id = "weight"))
        onNodeWithText("In the sheet: at most 80 from 84").performScrollTo().assertExists()
        onNodeWithText("• 82 kg: 0.5 points").performScrollTo().assertExists()
        onNodeWithText("Use the trend").performScrollTo().performClick()
        onNodeWithText("In the sheet: at most 80 from 84 trend").performScrollTo().assertExists()

        onNodeWithText("Count").performScrollTo().performClick()
        onNodeWithText("Only for a number metric.").performScrollTo().assertExists()
        onNodeWithText("In the sheet: at most 80 from 84").performScrollTo().assertExists()
    }

    @Test
    fun aGroupChipSetsTheGroupAndSaveGivesTheMetric() = runComposeUiTest {
        showForm(FormSetup("Edit metric", weight, id = "weight"))
        onNodeWithText("Health").performScrollTo().performClick()
        onNodeWithText("Save").performScrollTo().performClick()
        assertEquals(
            listOf<Metric>(
                NumberMetric(
                    id = "weight",
                    name = "Weight",
                    icon = "monitor_weight",
                    unit = "kg",
                    step = 0.1,
                    goal = NumberGoal(80.0, isMaximum = true, from = 84.0),
                    group = "Health",
                ),
            ),
            saved,
        )
    }

    @Test
    fun aMetricWithYesNoValuesCanOnlyStayYesNo() = runComposeUiTest {
        showForm(FormSetup("Edit metric", MetricDraft("Read", "menu_book"), id = "read", valueKind = MetricKind.YES_NO))
        onNodeWithText("Yes/no").assertIsEnabled()
        onNodeWithText("Number").assertIsNotEnabled()
        onNodeWithText("Count").assertIsNotEnabled()
    }

    @Test
    fun deleteAsksFirst() = runComposeUiTest {
        showForm(FormSetup("Edit metric", weight, id = "weight", deleteQuestion = "Delete \"Weight\"?"))
        onNodeWithText("Delete metric").performScrollTo().performClick()
        onNodeWithText("Delete \"Weight\"?").assertExists()
        onNodeWithText("Delete").performClick()
        waitForIdle()
        assertEquals(1, deletes)
        onNodeWithContentDescription("Close without saving").assertExists()
    }
}
