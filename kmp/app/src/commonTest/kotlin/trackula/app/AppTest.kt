package trackula.app

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.services.Config
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** The longest wait for the UI in a test. The first font and resource load on a cold JVM can take more than 1 second. */
private const val TIMEOUT = 5_000L

@OptIn(ExperimentalTestApi::class)
class AppTest {
    @Test
    fun withoutTheGoogleValuesTheAppAsksForThem() = runComposeUiTest {
        setContent { App(FakePlatform(config = Config("", ""))) }
        onNodeWithText("Set GOOGLE_CLIENT_ID and GOOGLE_API_KEY in config.env. See README.md.").assertExists()
        onNodeWithText("Sign in with Google").assertDoesNotExist()
    }

    @Test
    fun signInThenChooseASheetThenTheTodayPage() = runComposeUiTest {
        val platform = FakePlatform()
        setContent { App(platform) }

        onNodeWithText("Sign in with Google").performClick()
        waitForIdle()
        assertEquals(listOf(true), platform.signIns)
        onNodeWithText("Choose a sheet").assertExists()
        onNodeWithContentDescription("Sign out").assertExists()

        onNodeWithText("Choose sheet").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { platform.savedSpreadsheetId != null }
        assertEquals(listOf("sheet-1"), platform.session.prepared)
        assertEquals("sheet-1", platform.savedSpreadsheetId)
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }
        onNodeWithText("5 days").assertExists()
        onNodeWithContentDescription("Change sheet").assertExists()
    }

    @Test
    fun aSavedSheetOpensAfterTheSignInAndChangeSheetForgetsIt() = runComposeUiTest {
        val platform = FakePlatform(savedSpreadsheetId = "sheet-1")
        setContent { App(platform) }
        onNodeWithText("Sign in with Google").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }

        onNodeWithContentDescription("Change sheet").performClick()
        waitForIdle()
        assertNull(platform.savedSpreadsheetId)
        onNodeWithText("Choose a sheet").assertExists()
    }

    @Test
    fun anExpiredSessionShowsTheSignInPageWithTheReason() = runComposeUiTest {
        val platform = FakePlatform(savedSpreadsheetId = "sheet-1")
        setContent { App(platform) }
        onNodeWithText("Sign in with Google").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }

        platform.session.expired = true
        onNodeWithContentDescription("Reload").performClick()
        waitForIdle()
        onNodeWithText("Google access lasts 1 hour. Sign in again to continue.").assertExists()

        // The second sign-in keeps the account: no account selection. It gives a new token.
        platform.session.expired = false
        onNodeWithText("Sign in with Google").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }
        assertEquals(listOf(true, false), platform.signIns)
    }

    @Test
    fun signOutShowsTheSignInPageWithoutTheExpiryText() = runComposeUiTest {
        val platform = FakePlatform(savedSpreadsheetId = "sheet-1")
        setContent { App(platform) }
        onNodeWithText("Sign in with Google").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }

        onNodeWithContentDescription("Sign out").performClick()
        waitForIdle()
        onNodeWithText("Sign in with Google").assertExists()
        onNodeWithText("Google access lasts 1 hour. Sign in again to continue.").assertDoesNotExist()
        assertEquals("sheet-1", platform.savedSpreadsheetId)
    }

    @Test
    fun theReloadButtonLoadsTheDataAgain() = runComposeUiTest {
        val platform = FakePlatform(savedSpreadsheetId = "sheet-1")
        setContent { App(platform) }
        onNodeWithText("Sign in with Google").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }
        val loads = platform.session.store.loads

        onNodeWithContentDescription("Reload").performClick()
        waitUntil(timeoutMillis = TIMEOUT) { platform.session.store.loads == loads + 1 }
        onNodeWithContentDescription("Reload").assertExists()
    }

    @Test
    fun demoModeShowsTheDataWithoutSignInAndTheViews() = runComposeUiTest {
        setContent { App(FakePlatform(isDemo = true)) }
        onNodeWithText("Sign in with Google").assertDoesNotExist()
        waitUntil(timeoutMillis = TIMEOUT) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }
        for (label in listOf("Today", "5 days", "31 days", "Score")) onAllNodesWithText(label).assertCountEquals(1)
    }
}
