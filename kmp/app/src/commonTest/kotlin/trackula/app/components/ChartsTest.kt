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
import trackula.model.MonthKey
import trackula.model.ValueRange
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
        onNodeWithContentDescription("Values from 0 to 5 points, Sep 29 to Oct 3").assertExists()
    }

    @Test
    fun aHorizontalBarChartShowsEachRowWithItsTextAlsoForNegativeValues() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) {
                HorizontalBarChart(
                    "Links",
                    "Rows.",
                    listOf(HBar("Meditate", 1.5, Color.Green, "+1.5"), HBar("Teeth", -0.5, Color.Red, "−0.5")),
                )
            }
        }
        onNodeWithContentDescription("Meditate: +1.5").assertExists()
        onNodeWithContentDescription("Teeth: −0.5").assertExists()
    }

    @Test
    fun aHorizontalBarChartWithoutRowsSaysSo() = runComposeUiTest {
        setContent { TrackulaTheme(dark = false) { HorizontalBarChart("Links", "Rows.", emptyList()) } }
        onNodeWithText("No values in this period.").assertExists()
    }

    @Test
    fun aRangeBarChartShowsTheValuesOfTheMarksAndALegend() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) {
                RangeBarChart(
                    title = "Week",
                    description = "Weekdays.",
                    labels = listOf("Mo", "Tu"),
                    ranges = listOf(ValueRange(10.0, 14.0, 12.0), ValueRange(3.0, 5.0, 4.0)),
                    marks = listOf(15.0, null),
                    rangeLabel = "4 weeks before",
                    markLabel = "This week",
                )
            }
        }
        onNodeWithText("15").assertExists()
        onNodeWithText("12").assertDoesNotExist()
        onNodeWithText("4 weeks before").assertExists()
        onNodeWithText("Average").assertExists()
        onNodeWithText("This week").assertExists()
    }

    @Test
    fun aRangeBarChartWithoutRangesAndMarksSaysSo() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) {
                RangeBarChart("Week", "Weekdays.", listOf("Mo"), listOf(null), listOf(null), "Before", "Now")
            }
        }
        onNodeWithText("No values in this period.").assertExists()
    }

    @Test
    fun theScoreCalendarShowsTheScoresOfTheMonthAndStopsAtTheMonthOfToday() = runComposeUiTest {
        var month = MonthKey(2026, 9)
        setContent {
            TrackulaTheme(dark = false) {
                ScoreCalendar(mapOf(days[0] to 12.0), days.last(), MonthKey(2026, 9)) { month = it }
            }
        }
        onNodeWithText("September 2026").assertExists()
        onNodeWithContentDescription("Sep 29: 12").assertExists()
        onNodeWithContentDescription("Sep 28: no score").assertExists()
        onNodeWithContentDescription("Next month").performClick()
        assertEquals(MonthKey(2026, 10), month)
    }
}
