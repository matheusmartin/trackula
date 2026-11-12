package trackula.app.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import kotlin.test.Test
import kotlin.test.assertEquals

@OptIn(ExperimentalTestApi::class)
class OutsetTest {
    @Test
    fun theElementKeepsItsSizeAndPositionAndTheContentIsLargerOnEachSide() = runComposeUiTest {
        setContent {
            Box(Modifier.padding(20.dp).testTag("element").outset(8.dp, 4.dp)) {
                Box(Modifier.testTag("highlight").padding(horizontal = 8.dp, vertical = 4.dp).size(30.dp, 20.dp))
            }
        }
        assertEquals(DpRect(20.dp, 20.dp, 50.dp, 40.dp), onNodeWithTag("element").getUnclippedBoundsInRoot())
        assertEquals(DpRect(12.dp, 16.dp, 58.dp, 44.dp), onNodeWithTag("highlight").getUnclippedBoundsInRoot())
    }
}
