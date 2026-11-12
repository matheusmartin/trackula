package trackula.app.components

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.onNodeWithContentDescription
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
}
