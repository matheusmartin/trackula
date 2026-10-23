package trackula.app.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import trackula.app.LocalExtraColors
import trackula.model.Aggregate
import trackula.model.CountStats
import trackula.model.Day
import trackula.model.Metric
import trackula.model.NumberMetric
import trackula.model.NumberStats
import trackula.model.YesNoMetric
import trackula.model.YesNoStats
import trackula.model.ZoomWindow
import trackula.model.countStats
import trackula.model.formatNumber
import trackula.model.formatPercent
import trackula.model.formatSigned
import trackula.model.numberStats
import trackula.model.roundHalfAwayFromZero
import trackula.model.shortDay
import trackula.model.streakLengths
import trackula.model.streakRanges
import trackula.model.weekdayNames
import trackula.model.withUnit
import trackula.model.yesNoStats
import trackula.model.zoomBars

/**
 * The key numbers and the charts of one metric in the time [window] of the detail screen.
 *
 * - [values]: the value of each day with a value. For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
 * - [states]: the yes/no states of a yes/no metric: true for `yes`, false for `no`. Empty for other metrics.
 */
@Composable
fun MetricCharts(metric: Metric, window: ZoomWindow, values: Map<Day, Double>, states: Map<Day, Boolean>) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when {
            metric is YesNoMetric -> YesNoCharts(window, values, yesNoStats(states, window.days, window.to))

            metric is NumberMetric && metric.isCount -> CountCharts(
                metric,
                window,
                values,
                countStats(values, window.days),
            )

            metric is NumberMetric -> NumberCharts(metric, window, values, numberStats(values, window.days))
        }
    }
}

/** The name of a bar unit in a description, for example "week". */
private fun ZoomWindow.unitName(): String = unit.name.lowercase()

/**
 * The bars of the window. With [fixedScale], the top of the scale comes from all bars, so that it does not change
 * while the window moves: for sums.
 */
private fun timeBarItem(
    title: String,
    description: String,
    window: ZoomWindow,
    values: Map<Day, Double>,
    aggregate: Aggregate,
    fixedScale: Boolean = false,
    showsRange: Boolean = false,
    max: Double? = null,
    format: (Double) -> String = { formatNumber(it) },
): ChartItem = ChartItem(wide = true) { modifier ->
    val bars = zoomBars(values, aggregate, window.allStarts, window.unit, window.first, window.today)
    val all = bars.mapNotNull { it.value }
    val firstInView = window.allStarts.indexOf(window.starts.first())
    TimeBars(
        title = title,
        description = description,
        bars = bars.subList(firstInView, firstInView + window.starts.size),
        barUnit = window.unit,
        modifier = modifier,
        format = format,
        max = max ?: if (fixedScale && all.isNotEmpty()) all.max() else null,
        showsRange = showsRange,
    )
}

@Composable
private fun YesNoCharts(window: ZoomWindow, values: Map<Day, Double>, stats: YesNoStats) {
    val extra = LocalExtraColors.current
    KeyNumbers(
        listOf(
            "done days" to "${stats.yes}",
            "rate" to formatPercent(stats.rate),
            "missed (no)" to "${stats.no}",
            "no entry" to "${stats.none}",
            (if (window.atEnd) "current streak" else "streak on ${shortDay(window.to)}") to "${stats.currentStreak} d",
            "longest streak" to "${stats.longestStreak} d",
        ),
    )
    val tertiary = MaterialTheme.colorScheme.tertiary
    ChartGrid(
        listOf(
            timeBarItem(
                "Yes rate",
                "The percentage of yes days in each ${window.unitName()}.",
                window,
                values,
                Aggregate.RATE,
                max = 1.0,
                format = ::formatPercent,
            ),
            ChartItem(wide = true) {
                LineChart(
                    title = "Habit strength (%)",
                    description = "It goes up on yes days and down on all other days.",
                    days = window.days,
                    values = stats.strength.map { it * 100 },
                    modifier = it,
                    dots = false,
                    decimals = 0,
                    range = 0.0 to 100.0,
                )
            },
            ChartItem(wide = false) {
                DonutChart(
                    title = "Yes, no and no entry",
                    description = "The share of days with yes, with no and with no entry.",
                    center = formatPercent(stats.rate),
                    parts = listOf(
                        DonutPart("Yes", stats.yes, extra.cell),
                        DonutPart("No", stats.no, tertiary),
                        DonutPart("No entry", stats.none, extra.cellEmpty),
                    ),
                    modifier = it,
                )
            },
            ChartItem(wide = false) {
                BarChart(
                    title = "Weekday pattern",
                    description = "The percentage of yes days on each weekday.",
                    bars = stats.weekdayRates.mapIndexed { i, rate -> Bar(weekdayNames[i].take(1), rate?.times(100)) },
                    modifier = it,
                    max = 100.0,
                    format = { v -> "${roundHalfAwayFromZero(v).toLong()}%" },
                )
            },
            ChartItem(wide = true) {
                BarChart(
                    title = "Streak lengths",
                    description = "The number of runs of yes days in a row, for each length in days.",
                    bars = streakLengths(stats.streaks).mapIndexed { i, count ->
                        val (from, to) = streakRanges[i]
                        Bar(
                            if (to == null) {
                                "$from+"
                            } else if (from == to) {
                                "$from"
                            } else {
                                "$from–$to"
                            },
                            count.toDouble(),
                        )
                    },
                    modifier = it,
                )
            },
        ),
    )
}

/** [value] with at most [decimals] decimals and the unit of [metric]. Example: "82.1 kg". */
private fun withUnit(value: Double, metric: NumberMetric, decimals: Int = 1): String =
    withUnit(formatNumber(value, decimals), metric.unit)

@Composable
private fun CountCharts(metric: NumberMetric, window: ZoomWindow, values: Map<Day, Double>, stats: CountStats) {
    val best = stats.best
    KeyNumbers(
        listOf(
            "total" to withUnit(stats.total, metric),
            "per day" to (stats.average?.let { withUnit(it, metric) } ?: "–"),
            "best day" to (best?.let { "${formatNumber(it.value)} · ${shortDay(it.day)}" } ?: "–"),
            "days logged" to "${stats.logged}",
        ),
    )
    ChartGrid(
        listOf(
            timeBarItem(
                "Totals",
                "The total of each ${window.unitName()}.",
                window,
                values,
                Aggregate.SUM,
                fixedScale = true,
            ),
            ChartItem(wide = true) {
                LineChart(
                    title = "Running total",
                    description = "The sum of all values from the start of the window.",
                    days = window.days,
                    values = stats.running,
                    modifier = it,
                    dots = false,
                    decimals = 0,
                    range = 0.0 to stats.total,
                )
            },
            ChartItem(wide = false) {
                BarChart(
                    title = "Weekday averages",
                    description = "The average on each weekday, from the days with a value.",
                    bars = stats.weekdayAverages.mapIndexed { i, average -> Bar(weekdayNames[i].take(1), average) },
                    modifier = it,
                )
            },
            ChartItem(wide = false) {
                BarChart(
                    title = "Distribution (days)",
                    description = "The number of days with each value.",
                    bars = stats.distribution.map { Bar("${it.value}", it.days.toDouble()) },
                    modifier = it,
                )
            },
        ),
    )
}

/** The value of [dayValue] with the unit of [metric], or "–" if there is no value. */
private fun dayValue(dayValue: trackula.model.DayValue?, metric: NumberMetric): String =
    dayValue?.let { withUnit(it.value, metric, 2) } ?: "–"

/** [label] and the day of [dayValue]. Example: "latest · Oct 10". */
private fun dayLabel(label: String, dayValue: trackula.model.DayValue?): String =
    "$label · ${dayValue?.let { shortDay(it.day) }.orEmpty()}"

@Composable
private fun NumberCharts(metric: NumberMetric, window: ZoomWindow, values: Map<Day, Double>, stats: NumberStats) {
    KeyNumbers(
        listOf(
            dayLabel("latest", stats.latest) to dayValue(stats.latest, metric),
            "change" to (stats.change?.let { formatSigned(it, metric.unit) } ?: "–"),
            dayLabel("lowest", stats.low) to dayValue(stats.low, metric),
            dayLabel("highest", stats.high) to dayValue(stats.high, metric),
            "average" to (stats.average?.let { withUnit(it, metric, 2) } ?: "–"),
            "days logged" to "${stats.logged}",
        ),
    )
    ChartGrid(
        listOf(
            timeBarItem(
                "Averages and range",
                "Each bar goes from the lowest to the highest value of a ${window.unitName()}. The dot is the average.",
                window,
                values,
                Aggregate.AVERAGE,
                showsRange = true,
            ),
            ChartItem(wide = true) {
                LineChart(
                    title = "Values and 7-day trend",
                    description = "Dots are the values. The line is a smooth average that ignores small daily changes.",
                    days = window.days,
                    values = stats.values,
                    modifier = it,
                    trend = stats.trend,
                )
            },
            ChartItem(wide = true) {
                BarChart(
                    title = "Distribution (days)",
                    description = "The number of days in each value range. The label is the start of the range.",
                    bars = stats.histogram.map { Bar(formatNumber(it.from), it.days.toDouble()) },
                    modifier = it,
                )
            },
        ),
    )
}
