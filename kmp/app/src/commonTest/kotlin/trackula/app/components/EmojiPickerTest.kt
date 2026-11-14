package trackula.app.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.app.TrackulaTheme
import kotlin.test.Test
import kotlin.test.assertEquals

/** The longest wait for the emoji list in a test. */
private const val TIMEOUT = 5_000L

/** Taps the emoji with the name [name] in the emoji picker. The page and the grid scroll to it first. */
@OptIn(ExperimentalTestApi::class)
internal fun ComposeUiTest.pickEmoji(name: String) {
    // The grid shows after the list loads.
    waitUntil(timeoutMillis = TIMEOUT) { onAllNodes(hasScrollToIndexAction()).fetchSemanticsNodes().isNotEmpty() }
    onNode(hasScrollToIndexAction()).performScrollTo().performScrollToNode(hasContentDescription(name))
    onNodeWithContentDescription(name).performScrollTo().performClick()
}

@OptIn(ExperimentalTestApi::class)
class EmojiPickerTest {
    private var icon by mutableStateOf("")

    private fun ComposeUiTest.showPicker(initial: String = "") {
        icon = initial
        setContent {
            TrackulaTheme(dark = false) {
                // The page scrolls, as in the form.
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    EmojiPicker(selected = icon, onPick = { icon = it })
                }
            }
        }
    }

    @Test
    fun aTapPicksAnEmojiAndItHasAFrame() = runComposeUiTest {
        showPicker()
        pickEmoji("droplet")
        assertEquals("💧", icon)
        onNodeWithContentDescription("droplet").assertIsSelected()
    }

    @Test
    fun anEmojiWithSkinTonesHasTheDefaultTone() = runComposeUiTest {
        showPicker()
        pickEmoji("waving hand")
        assertEquals("👋", icon)
    }

    @Test
    fun theGridOpensAtTheSelectedEmoji() = runComposeUiTest {
        // The chequered flag is the first flag, near the end of the list.
        showPicker(initial = "🏁")
        waitUntil(timeoutMillis = TIMEOUT) {
            onAllNodesWithContentDescription("chequered flag").fetchSemanticsNodes().isNotEmpty()
        }
        onNodeWithContentDescription("chequered flag").assertIsDisplayed().assertIsSelected()
    }
}
