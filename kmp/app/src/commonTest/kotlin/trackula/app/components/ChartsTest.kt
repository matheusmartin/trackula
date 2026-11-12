package trackula.app.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import trackula.app.TrackulaTheme
import trackula.model.Day
import trackula.model.MonthKey
import trackula.model.ValueRange
import trackula.model.YesNoMetric
import trackula.model.ZoomStep
import trackula.model.ZoomWindow
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
    fun theScoreChartGoesFromZeroInPercent() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) { ScoreChart(scoreMetric, days, mapOf(days[0] to 30.0, days[4] to 50.0)) {} }
        }
        onNodeWithContentDescription("Values from 0 to 50%, Sep 29 to Oct 3").assertExists()
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
    fun aChangeTableShowsTheValuesAndGivesTheChangeToScreenReaders() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) {
                ChangeTable(
                    title = "Weeks",
                    description = "Points per day.",
                    columns = listOf("Nov 2", "Nov 9"),
                    rows = listOf("Habits" to listOf(4.7, 6.8), "Body" to listOf(null, 1.5)),
                    upLabel = "More",
                    downLabel = "Less",
                )
            }
        }
        // The cells give their own text to screen readers: the numbers are only in the unmerged tree.
        onNodeWithText("6.8", useUnmergedTree = true).assertExists()
        onNodeWithText("–", useUnmergedTree = true).assertExists()
        onNodeWithContentDescription("Habits, Nov 2: 4.7").assertExists()
        onNodeWithContentDescription("Habits, Nov 9: 6.8, +2.1 from Nov 2").assertExists()
        onNodeWithContentDescription("Body, Nov 2: no value").assertExists()
        onNodeWithContentDescription("Body, Nov 9: 1.5").assertExists()
        onNodeWithText("More").assertExists()
        onNodeWithText("Less").assertExists()
    }

    @Test
    fun aChangeTableWithoutRowsSaysSo() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) { ChangeTable("Weeks", "Points.", listOf("Nov 9"), emptyList(), "Up", "Down") }
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

    @Test
    fun aBarChartGivesItsValuesToScreenReaders() = runComposeUiTest {
        setContent {
            TrackulaTheme(dark = false) { BarChart("Change", "Changes.", listOf(Bar("A", 1.5), Bar("B", null))) }
        }
        onNodeWithContentDescription("Change: A 1.5").assertExists()
    }

    @Test
    fun aNarrowBarChartShowsOnlyTheValuesAndLabelsThatFit() = runComposeUiTest {
        val bars = (1..12).map { Bar("Label $it", 1000.0 + it) }
        setContent {
            TrackulaTheme(dark = false) { Box(Modifier.width(240.dp)) { BarChart("Change", "Changes.", bars) } }
        }
        // 12 columns of 17 dp: a value and a label do not fit in each column. The newest value and the first label show.
        onNodeWithText("1012").assertExists()
        onNodeWithText("1011").assertDoesNotExist()
        onNodeWithText("Label 1").assertExists()
        onNodeWithText("Label 2").assertDoesNotExist()
        // Screen readers get all values.
        onNodeWithContentDescription("Change: Label 1 1001", substring = true).assertExists()
    }

    @Test
    fun theTextOnACellHasTheBestContrast() {
        assertEquals(DARK_INK, inkOn(Color.White))
        assertEquals(LIGHT_INK, inkOn(Color.Black))
        // The strongest green of the score calendar in the light theme: dark text has more contrast than light text.
        assertEquals(DARK_INK, inkOn(Color(0xFF62A064)))
    }

    @Test
    fun theChartsOfAMetricWithoutValuesSayWhatToDo() = runComposeUiTest {
        val today = days.last()
        setContent {
            TrackulaTheme(dark = false) {
                MetricCharts(
                    metric = YesNoMetric("read", "Read", icon = "menu_book"),
                    window = ZoomWindow(ZoomStep.entries.first(), today, today),
                    values = emptyMap(),
                    states = emptyMap(),
                )
            }
        }
        onNodeWithText("No values yet").assertExists()
        onNodeWithText("Yes rate").assertDoesNotExist()
    }
}
