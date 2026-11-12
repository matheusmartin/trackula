package trackula.app.components

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import trackula.app.TrackulaTheme
import trackula.model.NumberGoal
import trackula.model.NumberMetric
import kotlin.test.Test
import kotlin.test.assertEquals

@OptIn(ExperimentalTestApi::class)
class NumberEditorTest {
    private val weight = NumberMetric(
        id = "weight",
        name = "Weight",
        icon = "monitor_weight",
        goal = NumberGoal(80.0, isMaximum = true),
        unit = "kg",
        step = 0.1,
    )

    @Test
    fun aDragMovesOneStepForEachTickWithoutAJumpAtTheStart() = runComposeUiTest {
        val values = mutableListOf<Double?>()
        setContent {
            TrackulaTheme(dark = false) {
                NumberEditor(
                    metric = weight,
                    label = "Weight · today",
                    current = 82.0,
                    start = null,
                    busy = false,
                    onSave = {},
                    onClear = {},
                    onClose = {},
                    autofocus = false,
                    onChange = { values.add(it) },
                )
            }
        }
        val ruler = onNodeWithContentDescription("Weight ruler")
        ruler.performTouchInput {
            down(center)
            // The touch slop and 1 pixel: the drag starts, and the value does not change.
            moveBy(Offset(-(viewConfiguration.touchSlop + 1f), 0f))
            moveBy(Offset(-3 * 9.dp.toPx(), 0f))
            up()
        }
        // The press confirms 82.0. Then 3 ticks to the left give 82.3.
        assertEquals(listOf<Double?>(82.0, 82.3), values.distinct())
        ruler.assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "82.3 kg"))
    }

    /** Shows the editor of a table cell: with its own buttons. Returns the names of the calls of the buttons. */
    private fun ComposeUiTest.showCellEditor(current: Double?): List<String> {
        val calls = mutableListOf<String>()
        setContent {
            TrackulaTheme(dark = false) {
                NumberEditor(
                    metric = weight,
                    label = "Weight · today",
                    current = current,
                    start = 82.0,
                    busy = false,
                    onSave = { calls.add("save") },
                    onClear = { calls.add("clear") },
                    onClose = { calls.add("close") },
                    autofocus = false,
                )
            }
        }
        return calls
    }

    @Test
    fun cancelClosesTheEditorAndClearClearsADayWithAValue() = runComposeUiTest {
        val calls = showCellEditor(current = 82.0)
        onNodeWithText("Cancel").performClick()
        onNodeWithText("Clear").performClick()
        assertEquals(listOf("close", "clear"), calls)
    }

    @Test
    fun anEmptyDayHasNoClearButton() = runComposeUiTest {
        showCellEditor(current = null)
        onNodeWithText("Save").assertExists()
        onNodeWithText("Cancel").assertExists()
        onNodeWithText("Clear").assertDoesNotExist()
    }
}
