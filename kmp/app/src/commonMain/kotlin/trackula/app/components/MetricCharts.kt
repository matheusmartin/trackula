package trackula.app.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.unit.dp
import trackula.app.LocalExtraColors
import trackula.model.Aggregate
import trackula.model.BarUnit
import trackula.model.COMPARED_MONTHS
import trackula.model.COMPARED_WEEKS
import trackula.model.CountStats
import trackula.model.Day
import trackula.model.Metric
import trackula.model.NumberMetric
import trackula.model.NumberStats
import trackula.model.YesNoMetric
import trackula.model.YesNoStats
import trackula.model.ZoomWindow
import trackula.model.barStart
import trackula.model.bestWeekday
import trackula.model.countStats
import trackula.model.formatNumber
import trackula.model.formatPercent
import trackula.model.formatSigned
import trackula.model.groupOf
import trackula.model.groupParts
import trackula.model.groupScores
import trackula.model.groupWeekdayParts
import trackula.model.halves
import trackula.model.isScore
import trackula.model.monthOf
import trackula.model.monthTitle
import trackula.model.monthlyAverages
import trackula.model.monthsUntil
import trackula.model.numberStats
import trackula.model.roundHalfAwayFromZero
import trackula.model.shortDay
import trackula.model.shortMonth
import trackula.model.streakLengths
import trackula.model.streakRanges
import trackula.model.weekMondays
import trackula.model.weekdayNames
import trackula.model.weekdaysInRange
import trackula.model.weeklyAverages
import trackula.model.withUnit
import trackula.model.withoutFloatNoise
import trackula.model.yesNoStats
import trackula.model.zoomBars

/**
 * The key numbers and the charts of one metric in the time [window] of the detail screen. The score has its own
 * numbers and charts: see [ScoreCharts].
 *
 * - [values]: the value of each day with a value. For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
 * - [states]: the yes/no states of a yes/no metric: true for `yes`, false for `no`. Empty for other metrics.
 * - [scoreMetrics], [points]: for the score, the metrics of the score, and the points of each metric by metric id (see
 *   `pointsByMetric`). Empty for other metrics.
 */
@Composable
fun MetricCharts(
    metric: Metric,
    window: ZoomWindow,
    values: Map<Day, Double>,
    states: Map<Day, Boolean>,
    scoreMetrics: List<Metric> = emptyList(),
    points: Map<String, Map<Day, Double>> = emptyMap(),
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when {
            metric is YesNoMetric -> YesNoCharts(window, values, yesNoStats(states, window.days, window.to))

            metric is NumberMetric && isScore(metric) ->
                ScoreCharts(metric, window, values, scoreMetrics, points)

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

/**
 * The numbers and charts of the score. Each one answers one question: how the score changes over time, how the week
 * of the window end compares with the 4 weeks before (for each weekday, and for each group or metric), how its month
 * compares with the 3 months before (for each group or metric), and which weekdays are good.
 * The month calendar below the charts shows the score of each day (see `ScoreCalendar`). The score of a day is a
 * percentage from 0 to 100, so the charts show averages, not totals.
 *
 * - [values]: the score of each day. The change compares the first half of the window with the second half.
 * - [scoreMetrics], [points]: the metrics of the score, and the points of each metric. With metrics of 2 or more
 *   groups, the week and month tables are by group, and the weekday bars show the part of each group. Else the tables
 *   are by metric.
 */
@Composable
private fun ScoreCharts(
    metric: NumberMetric,
    window: ZoomWindow,
    values: Map<Day, Double>,
    scoreMetrics: List<Metric>,
    points: Map<String, Map<Day, Double>>,
) {
    val stats = countStats(values, window.days)
    val (firstHalf, secondHalf) = halves(window.days)
    val average = countStats(values, secondHalf).average
    val previous = countStats(values, firstHalf).average
    val best = stats.best
    val weekday = bestWeekday(stats.weekdayAverages)
    val groups = scoreMetrics.filter { it.id in points }.map(::groupOf).distinct()
    val parts = scoreParts(scoreMetrics, groups, points)
    KeyNumbers(
        listOf(
            "per day" to (stats.average?.let { withUnit(it, metric) } ?: "–"),
            "change" to
                (if (average != null && previous != null) formatSigned(average - previous, metric.unit) else "–"),
            "best day" to (best?.let { "${withUnit(it.value, metric)} · ${shortDay(it.day)}" } ?: "–"),
            "best weekday" to (
                weekday?.let { "${weekdayNames[it - 1]} · ${withUnit(stats.weekdayAverages[it - 1]!!, metric)}" }
                    ?: "–"
                ),
        ),
    )
    ChartGrid(
        listOf(
            timeBarItem(
                "Average per day",
                "The average score of the days with a score in each ${window.unitName()}.",
                window,
                values,
                Aggregate.AVERAGE,
                max = 100.0,
                format = { formatPercent(it / 100) },
            ),
            ChartItem(wide = true) { WeekInRange(values, window, it) },
            ChartItem(wide = false) { WeeklyScores(parts, window, it) },
            ChartItem(wide = false) { MonthlyScores(parts, window, it) },
            ChartItem(wide = true) {
                val groupParts = if (groups.size >= 2) groupParts(scoreMetrics, groups, points) else emptyMap()
                WeekdayAverages(values, window, stats, groupParts, it)
            },
        ),
    )
}

/** The week of the window end: "this week" if the window ends today, else for example "the week of Oct 5". */
private fun ZoomWindow.weekName(): String =
    if (atEnd) "this week" else "the week of ${shortDay(barStart(to, BarUnit.WEEK))}"

/** [text] with a capital first letter. Example: "this week" → "This week". */
private fun capitalized(text: String): String = text.replaceFirstChar { it.uppercase() }

/**
 * The score of each weekday of the week of the window end, in the range of that weekday in the [COMPARED_WEEKS] weeks
 * before. See `weekdaysInRange`.
 */
@Composable
private fun WeekInRange(values: Map<Day, Double>, window: ZoomWindow, modifier: Modifier) {
    val week = window.weekName()
    val weekdays = weekdaysInRange(values, window.to)
    RangeBarChart(
        title = "${capitalized(week)} and the $COMPARED_WEEKS weeks before",
        description = "For each weekday: the score of $week (diamond), and the lowest to the highest score of the " +
            "$COMPARED_WEEKS weeks before (bar), with their average (dot).",
        labels = weekdayNames,
        ranges = weekdays.map { it.range },
        marks = weekdays.map { it.score },
        rangeLabel = "$COMPARED_WEEKS weeks before",
        markLabel = capitalized(week),
        modifier = modifier,
    )
}

/**
 * The parts of the score in the week and month tables: the groups with 2 or more groups, else the metrics. [noun]:
 * "group" or "metric". [scores]: the score of each part by day, from 0 to 100, by part id. [names]: the name of each
 * part, by part id.
 */
private class ScoreParts(val noun: String, val scores: Map<String, Map<Day, Double>>, val names: Map<String, String>) {
    /** The name of the part [id]. */
    fun name(id: String): String = names[id] ?: id
}

/**
 * The score of each of [groups] if there are 2 or more, else the score of each metric of [metrics]: its [points] as a
 * percentage.
 */
private fun scoreParts(
    metrics: List<Metric>,
    groups: List<String>,
    points: Map<String, Map<Day, Double>>,
): ScoreParts = if (groups.size >= 2) {
    ScoreParts("group", groupScores(metrics, groups, points), groups.associateWith(::groupLabel))
} else {
    val scores = points.mapValues { (_, byDay) -> byDay.mapValues { (_, p) -> withoutFloatNoise(100 * p) } }
    ScoreParts("metric", scores, metrics.associate { it.id to it.name })
}

/**
 * The average score of each part of the score in the week of the window end and in each of the [COMPARED_WEEKS] weeks
 * before, on the same weekdays. The color of a cell shows the change from the week before. See `weeklyAverages`.
 */
@Composable
private fun WeeklyScores(parts: ScoreParts, window: ZoomWindow, modifier: Modifier) {
    val weekly = weeklyAverages(parts.scores, window.to, COMPARED_WEEKS)
    ChangeTable(
        title = "Score by ${parts.noun} and week",
        description = "The average score of each ${parts.noun} in ${window.weekName()} (last column) and in the " +
            "$COMPARED_WEEKS weeks before, on the same weekdays. The color shows the change from the week before.",
        columns = weekMondays(window.to, COMPARED_WEEKS).map(::shortDay),
        rows = weekly.entries.map { (id, perWeek) -> parts.name(id) to perWeek },
        upLabel = "More than the week before",
        downLabel = "Less than the week before",
        modifier = modifier,
    )
}

/**
 * The average score of each part of the score in the month of the window end, up to the window end, and in each of
 * the [COMPARED_MONTHS] months before. The color of a cell shows the change from the month before. See
 * `monthlyAverages`.
 */
@Composable
private fun MonthlyScores(parts: ScoreParts, window: ZoomWindow, modifier: Modifier) {
    val monthly = monthlyAverages(parts.scores, window.to, COMPARED_MONTHS)
    val month = if (window.atEnd) "this month" else monthTitle(monthOf(window.to))
    ChangeTable(
        title = "Score by ${parts.noun} and month",
        description = "The average score of each ${parts.noun} in $month (last column, up to " +
            "${shortDay(window.to)}) and in the $COMPARED_MONTHS months before. The color shows the change from the " +
            "month before.",
        columns = monthsUntil(window.to, COMPARED_MONTHS).map { shortMonth(it.month) },
        rows = monthly.entries.map { (id, perMonth) -> parts.name(id) to perMonth },
        upLabel = "More than the month before",
        downLabel = "Less than the month before",
        modifier = modifier,
    )
}

/**
 * The average score on each weekday. With 2 or more [groupParts] (see `groupParts`), each bar stacks the parts of the
 * groups, each in the color of its group with a soft tone, with a legend. See `groupWeekdayParts`.
 */
@Composable
private fun WeekdayAverages(
    values: Map<Day, Double>,
    window: ZoomWindow,
    stats: CountStats,
    groupParts: Map<String, Map<Day, Double>>,
    modifier: Modifier,
) {
    val title = "Weekday averages"
    if (groupParts.size < 2) {
        BarChart(
            title = title,
            description = "The average score on each weekday, from the days with a score.",
            bars = stats.weekdayAverages.mapIndexed { i, average -> Bar(weekdayNames[i], average) },
            modifier = modifier,
        )
        return
    }
    val extra = LocalExtraColors.current
    val parts = groupWeekdayParts(values, groupParts, window.days)
    StackedBarChart(
        title = title,
        description = "The average score on each weekday, from the days with a score. Each color is a group.",
        labels = weekdayNames,
        parts = parts.entries.mapIndexed { i, (group, averages) ->
            // The soft tone of the strongest table and calendar cells, so that the colors match the other charts.
            val color = lerp(extra.cellEmpty, extra.groups[i % extra.groups.size], MAX_FILL)
            StackPart(groupLabel(group), color, averages)
        },
        modifier = modifier,
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
