package trackula.app

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.services.Config
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

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
        assertEquals(1, platform.signIns)
        onNodeWithText("Choose a sheet").assertExists()
        onNodeWithContentDescription("Sign out").assertExists()

        onNodeWithText("Choose sheet").performClick()
        waitUntil { platform.savedSpreadsheetId != null }
        assertEquals(listOf("sheet-1"), platform.session.prepared)
        assertEquals("sheet-1", platform.savedSpreadsheetId)
        waitUntil { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }
        onNodeWithText("5 days").assertExists()
        onNodeWithContentDescription("Change sheet").assertExists()
    }

    @Test
    fun aSavedSheetOpensAfterTheSignInAndChangeSheetForgetsIt() = runComposeUiTest {
        val platform = FakePlatform(savedSpreadsheetId = "sheet-1")
        setContent { App(platform) }
        onNodeWithText("Sign in with Google").performClick()
        waitUntil { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }

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
        waitUntil { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }

        platform.session.expired = true
        onNodeWithContentDescription("Reload").performClick()
        waitForIdle()
        onNodeWithText("Google access lasts 1 hour. Sign in again to continue.").assertExists()
    }

    @Test
    fun demoModeShowsTheDataWithoutSignInAndTheViews() = runComposeUiTest {
        setContent { App(FakePlatform(isDemo = true)) }
        onNodeWithText("Sign in with Google").assertDoesNotExist()
        waitUntil(timeoutMillis = 5_000) { onAllNodesWithText("Weight").fetchSemanticsNodes().isNotEmpty() }
        for (label in listOf("Today", "5 days", "31 days", "Score")) onAllNodesWithText(label).assertCountEquals(1)
    }
}
