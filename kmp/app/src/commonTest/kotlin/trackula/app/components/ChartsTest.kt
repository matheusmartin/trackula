package trackula.app.components

import androidx.compose.ui.graphics.Color
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
import trackula.model.scoreMetric
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
    fun aStackedBarChartShowsTheSumOfEachBarAndALegend() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) {
                StackedBarChart(
                    title = "Stack",
                    description = "Parts.",
                    labels = listOf("A", "B", "C"),
                    parts = listOf(
                        StackPart("Habits", Color.Green, listOf(3.0, null, null)),
                        StackPart("Body", Color.Blue, listOf(1.5, 2.0, null)),
                    ),
                )
            }
        }
        onNodeWithText("4.5").assertExists()
        onNodeWithText("2").assertExists()
        onNodeWithText("Habits").assertExists()
        onNodeWithText("Body").assertExists()
    }

    @Test
    fun aStackedBarChartWithoutValuesSaysSo() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) {
                StackedBarChart("Stack", "Parts.", listOf("A"), listOf(StackPart("Habits", Color.Green, listOf(null))))
            }
        }
        onNodeWithText("No values in this period.").assertExists()
    }

    @Test
    fun aBarChartWithoutValuesSaysSo() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) { BarChart("Change", "Changes.", listOf(Bar("A", null), Bar("B", null))) }
        }
        onNodeWithText("No values in this period.").assertExists()
    }

    @Test
    fun aBarChartShowsNegativeValuesWithAMinusSign() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) { BarChart("Change", "Changes.", listOf(Bar("A", 1.5), Bar("B", -2.0))) }
        }
        onNodeWithText("1.5").assertExists()
        onNodeWithText("−2").assertExists()
    }

    @Test
    fun aHeatmapWithLevelsHasWeekdayLabels() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) {
                DayHeatmap("Goals met by day", days.first(), days.last(), { true }, days.last(), level = { 0.5 })
            }
        }
        onNodeWithText("Mo").assertExists()
        onNodeWithText("Su").assertExists()
    }

    @Test
    fun aHeatmapWithoutLevelsHasNoWeekdayLabels() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) { DayHeatmap("Days", days.first(), days.last(), { true }, days.last()) }
        }
        onNodeWithText("Mo").assertDoesNotExist()
    }

    @Test
    fun aTrendChartWithoutValuesShowsNothing() = runComposeUiTest {
        setContent { TrackulaTheme(dark = false) { TrendChart(days, emptyMap()) } }
        onAllNodesWithContentDescription("Values from", substring = true).assertCountEquals(0)
    }

    @Test
    fun theScoreChartOpensTheScoreViewAndSaysWhenThereIsNoScore() = runComposeUiTest {
        var opens = 0
        setContent { TrackulaTheme(dark = false) { ScoreChart(scoreMetric, days, emptyMap()) { opens++ } } }
        onNodeWithText("No score in these days.").assertExists()
        onNodeWithContentDescription("Show the score only").performClick()
        assertEquals(1, opens)
    }

    @Test
    fun theScoreChartGoesFromZeroInPoints() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) { ScoreChart(scoreMetric, days, mapOf(days[0] to 3.0, days[4] to 5.0)) {} }
        }
        onNodeWithContentDescription("Values from 0 to 5%, Sep 29 to Oct 3").assertExists()
    }
}
