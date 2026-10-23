package trackula.app.components

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import trackula.app.TrackulaTheme
import trackula.model.Day
import trackula.model.daysBetween
import kotlin.test.Test
import kotlin.test.assertEquals

@OptIn(ExperimentalTestApi::class)
class ChartsTest {
    private val days = daysBetween(Day(2026, 9, 29), Day(2026, 10, 3))

    @Test
    fun aTrendChartGivesItsRangeAndItsDaysToScreenReaders() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) {
                TrendChart(days, mapOf(days[0] to 82.5, days[3] to 81.25), unit = "kg")
            }
        }
        onNodeWithContentDescription("Values from 81.25 to 82.5 kg, Sep 29 to Oct 3").assertExists()
        // One text for the whole chart: the axis labels are not read again.
        onAllNodesWithText("Sep 29").assertCountEquals(0)
    }

    @Test
    fun aBarChartWithOnlyZerosGoesFromZeroToZero() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) { TrendChart(days, mapOf(days[1] to 0.0), showsBars = true) }
        }
        onNodeWithContentDescription("Values from 0 to 0, Sep 29 to Oct 3").assertExists()
    }

    @Test
    fun aTrendChartWithoutValuesShowsNothing() = runComposeUiTest {
        setContent { TrackulaTheme(dark = false) { TrendChart(days, emptyMap()) } }
        onAllNodesWithContentDescription("Values from", substring = true).assertCountEquals(0)
    }

    @Test
    fun theScoreChartOpensTheScoreViewAndSaysWhenThereIsNoScore() = runComposeUiTest {
        var opens = 0
        setContent { TrackulaTheme(dark = false) { ScoreChart(days, emptyMap()) { opens++ } } }
        onNodeWithText("No score in these days.").assertExists()
        onNodeWithContentDescription("Show the score only").performClick()
        assertEquals(1, opens)
    }

    @Test
    fun theScoreChartGoesFromZeroInPoints() = runComposeUiTest {
        setContent { TrackulaTheme(dark = false) { ScoreChart(days, mapOf(days[0] to 3.0, days[4] to 5.0)) {} } }
        onNodeWithContentDescription("Values from 0 to 5 points, Sep 29 to Oct 3").assertExists()
    }
}
