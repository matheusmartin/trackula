package trackula.app.components

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.app.TrackulaTheme
import kotlin.test.Test
import kotlin.test.assertEquals

/** The longest wait for the emoji list in a test. */
private const val TIMEOUT = 5_000L

@OptIn(ExperimentalTestApi::class)
class EmojiPickerTest {
    private var icon by mutableStateOf("")

    private fun ComposeUiTest.showPicker(initial: String = "") {
        icon = initial
        setContent {
            TrackulaTheme(dark = false) {
                EmojiPicker(selected = icon, onPick = { icon = it })
            }
        }
        waitUntil(timeoutMillis = TIMEOUT) {
            onAllNodesWithContentDescription("grinning face").fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun ComposeUiTest.search(query: String) =
        onNode(hasSetTextAction() and hasText("Search emoji")).performTextReplacement(query)

    @Test
    fun theSearchFindsAnEmojiByAKeywordAndATapPicksIt() = runComposeUiTest {
        showPicker()
        search("water")
        onNodeWithContentDescription("droplet").performClick()
        assertEquals("💧", icon)
        onNodeWithContentDescription("droplet").assertIsSelected()
    }

    @Test
    fun theSelectedSkinToneGoesToThePickedEmoji() = runComposeUiTest {
        showPicker()
        onNodeWithContentDescription("Medium skin tone").performClick()
        search("waving")
        onNodeWithContentDescription("waving hand").performClick()
        assertEquals("👋🏽", icon)
    }

    @Test
    fun theSkinToneOfTheIconIsSelectedAtTheStart() = runComposeUiTest {
        showPicker(initial = "👋🏿")
        onNodeWithContentDescription("Dark skin tone").assertIsSelected()
    }

    @Test
    fun aGroupChipGoesToItsGroup() = runComposeUiTest {
        showPicker()
        onNodeWithText("🏁 Flags").performScrollTo().performClick()
        waitUntil(timeoutMillis = TIMEOUT) {
            onAllNodesWithContentDescription("chequered flag").fetchSemanticsNodes().isNotEmpty()
        }
        onNodeWithContentDescription("chequered flag").assertIsDisplayed()
        onNodeWithText("🏁 Flags").assertIsSelected()
    }

    @Test
    fun aSearchWithoutResultsSaysSo() = runComposeUiTest {
        showPicker()
        search("xyzzy")
        onNodeWithText("No emoji for \"xyzzy\".").assertExists()
        onNode(hasContentDescription("grinning face")).assertDoesNotExist()
    }
}
