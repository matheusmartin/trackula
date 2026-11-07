package trackula.app.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import trackula.app.LocalExtraColors
import trackula.model.Aggregate
import trackula.model.BarUnit
import trackula.model.CountStats
import trackula.model.Day
import trackula.model.MIN_LINK_DAYS
import trackula.model.Metric
import trackula.model.NumberMetric
import trackula.model.NumberStats
import trackula.model.YesNoMetric
import trackula.model.YesNoStats
import trackula.model.ZoomBar
import trackula.model.ZoomWindow
import trackula.model.bestWeekday
import trackula.model.countStats
import trackula.model.differencesFromAverage
import trackula.model.formatNumber
import trackula.model.formatPercent
import trackula.model.formatSigned
import trackula.model.groupOf
import trackula.model.groupWeekdayParts
import trackula.model.habitLinks
import trackula.model.halves
import trackula.model.isScore
import trackula.model.lastDays
import trackula.model.metricTotals
import trackula.model.metricWeekdayAverages
import trackula.model.numberStats
import trackula.model.roundHalfAwayFromZero
import trackula.model.shortDay
import trackula.model.streakLengths
import trackula.model.streakRanges
import trackula.model.thisAndLastWeek
import trackula.model.weekdayChanges
import trackula.model.weekdayNames
import trackula.model.weekdayRanges
import trackula.model.withUnit
import trackula.model.yesNoStats
import trackula.model.zoomBars

/**
 * The key numbers and the charts of one metric in the time [window] of the detail screen. The score has its own
 * numbers and charts: see [ScoreCharts].
 *
 * - [values]: the value of each day with a value. For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
 * - [states]: the yes/no states of a yes/no metric: true for `yes`, false for `no`. Empty for other metrics.
 * - [groupScores]: for the score of all metrics, the score of each group, in the order of the groups. Empty for other
 *   metrics, and if there is only one group.
 * - [scoreMetrics], [points]: for the score, the metrics that give its points, and their points by metric id (see
 *   `pointsByMetric`). Empty for other metrics.
 */
@Composable
fun MetricCharts(
    metric: Metric,
    window: ZoomWindow,
    values: Map<Day, Double>,
    states: Map<Day, Boolean>,
    groupScores: Map<String, Map<Day, Double>> = emptyMap(),
    scoreMetrics: List<Metric> = emptyList(),
    points: Map<String, Map<Day, Double>> = emptyMap(),
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when {
            metric is YesNoMetric -> YesNoCharts(window, values, yesNoStats(states, window.days, window.to))

            metric is NumberMetric && isScore(metric) ->
                ScoreCharts(metric, window, values, groupScores, scoreMetrics, points)

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
 * The numbers and charts of the score, all with bars. The score of a day does not add up over time, so they show
 * averages per day and per weekday, not totals.
 *
 * - [values]: the score of each day. The changes compare the first half of the window with the second half.
 * - [groupScores]: the score of each group. With 2 or more groups, the weekday bars and the days by group show the part
 *   of each group, and the points by metric have the color of their group.
 * - [scoreMetrics], [points]: the metrics that give the points, and their points by metric id.
 */
@Composable
private fun ScoreCharts(
    metric: NumberMetric,
    window: ZoomWindow,
    values: Map<Day, Double>,
    groupScores: Map<String, Map<Day, Double>>,
    scoreMetrics: List<Metric>,
    points: Map<String, Map<Day, Double>>,
) {
    val stats = countStats(values, window.days)
    val (firstHalf, secondHalf) = halves(window.days)
    val before = countStats(values, firstHalf)
    val after = countStats(values, secondHalf)
    val best = stats.best
    val weekday = bestWeekday(stats.weekdayAverages)
    val average = after.average
    val previous = before.average
    KeyNumbers(
        listOf(
            "per day" to (stats.average?.let { withUnit(it, metric) } ?: "–"),
            "per day, change" to
                (if (average != null && previous != null) formatSigned(average - previous, metric.unit) else "–"),
            "best day" to (best?.let { "${formatNumber(it.value)} · ${shortDay(it.day)}" } ?: "–"),
            "best weekday" to (
                weekday?.let { "${weekdayNames[it - 1]} · ${formatNumber(stats.weekdayAverages[it - 1]!!)}" } ?: "–"
                ),
            "days with a score" to "${stats.logged}",
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
                fixedScale = true,
            ),
            ChartItem(wide = true) { WeekPair(values, window, it) },
            ChartItem(wide = true) { AboveAndBelowAverage(values, window, it) },
            ChartItem(wide = true) { DaysByGroup(window, groupScores, it) },
            ChartItem(wide = true) { WeekdayAverages(values, window, stats, groupScores, it) },
            ChartItem(wide = true) {
                RangeBarChart(
                    title = "Weekday range",
                    description = "For each weekday: the lowest to the highest score (bar) and the average (dot).",
                    labels = weekdayNames,
                    ranges = weekdayRanges(values, window.days),
                    modifier = it,
                )
            },
            ChartItem(wide = true) {
                BarChart(
                    title = "Weekday change",
                    description = "The change of each weekday average from the first half to the second half.",
                    bars = weekdayChanges(after.weekdayAverages, before.weekdayAverages)
                        .mapIndexed { i, change -> Bar(weekdayNames[i], change) },
                    modifier = it,
                    format = { v -> if (v > 0) "+${formatNumber(v)}" else formatNumber(v) },
                )
            },
            ChartItem(wide = true) { MetricsByWeekday(scoreMetrics, points, window, it) },
            ChartItem(wide = true) { PointsByMetric(scoreMetrics, points, window, groupScores, it) },
            ChartItem(wide = true) { HabitLinks(scoreMetrics, points, values, window, it) },
            ChartItem(wide = true) {
                BarChart(
                    title = "Distribution (days)",
                    description = "The number of days with each score.",
                    bars = stats.distribution.map { Bar("${it.value}", it.days.toDouble()) },
                    modifier = it,
                )
            },
        ),
    )
}

/**
 * The average score on each weekday. With 2 or more [groupScores], each bar stacks the parts of the groups, with a
 * legend. See `groupWeekdayParts`.
 */
@Composable
private fun WeekdayAverages(
    values: Map<Day, Double>,
    window: ZoomWindow,
    stats: CountStats,
    groupScores: Map<String, Map<Day, Double>>,
    modifier: Modifier,
) {
    val title = "Weekday averages"
    if (groupScores.size < 2) {
        BarChart(
            title = title,
            description = "The average score on each weekday, from the days with a score.",
            bars = stats.weekdayAverages.mapIndexed { i, average -> Bar(weekdayNames[i], average) },
            modifier = modifier,
        )
        return
    }
    val colors = LocalExtraColors.current.groups
    val parts = groupWeekdayParts(values, groupScores, window.days)
    StackedBarChart(
        title = title,
        description = "The average score on each weekday, from the days with a score. Each color is a group.",
        labels = weekdayNames,
        parts = parts.entries.mapIndexed { i, (group, averages) ->
            StackPart(groupLabel(group), colors[i % colors.size], averages)
        },
        modifier = modifier,
    )
}

/** The number of days of [DaysByGroup]. */
private const val GROUP_DAYS = 14

/** The number of days of [AboveAndBelowAverage]. */
private const val AVERAGE_DAYS = 28

/** [value] with its sign, and a minus sign, not a hyphen. Examples: 1.5 → "+1.5", −2 → "−2", 0 → "0". */
private fun signed(value: Double): String = when {
    formatNumber(value) == "0" -> "0"
    value > 0 -> "+${formatNumber(value)}"
    else -> "−${formatNumber(-value)}"
}

/** The color of [group] in the score charts: the colors of the groups follow the order of [groups]. */
@Composable
private fun groupColor(group: String, groups: List<String>): Color {
    val colors = LocalExtraColors.current.groups
    return colors[groups.indexOf(group).coerceAtLeast(0) % colors.size]
}

/** The legend of the groups of [groups], in their colors. */
@Composable
private fun groupLegend(groups: List<String>): List<StackPart> =
    groups.map { StackPart(groupLabel(it), groupColor(it, groups), emptyList()) }

/** The score of each day of this week, Monday to today, next to the same weekday of last week. */
@Composable
private fun WeekPair(values: Map<Day, Double>, window: ZoomWindow, modifier: Modifier) {
    val (thisWeek, lastWeek) = thisAndLastWeek(values, window.today)
    val cell = LocalExtraColors.current.cell
    GroupedBarChart(
        title = "This week and last week",
        description = "Each day of this week next to the same weekday of last week. The numbers are this week.",
        labels = weekdayNames,
        series = listOf(
            StackPart("Last week", cell.copy(alpha = 0.4f), lastWeek),
            StackPart("This week", cell, thisWeek),
        ),
        modifier = modifier,
    )
}

/** How far the score of each of the last 28 days of the window is above or below the average of these days. */
@Composable
private fun AboveAndBelowAverage(values: Map<Day, Double>, window: ZoomWindow, modifier: Modifier) {
    val days = lastDays(window.days, AVERAGE_DAYS)
    val result = differencesFromAverage(values, days)
    TimeBars(
        title = "Above and below your average",
        description = "The last ${days.size} days: how far each score is above or below the average of these days" +
            (result?.let { ", ${formatNumber(it.first)}." } ?: "."),
        bars = days.map { ZoomBar(it, result?.second?.get(it), null, null) },
        barUnit = BarUnit.DAY,
        modifier = modifier,
        format = ::signed,
    )
}

/** The score of each of the last 14 days of the window, as stacked bars of the groups. Only with 2 or more groups. */
@Composable
private fun DaysByGroup(window: ZoomWindow, groupScores: Map<String, Map<Day, Double>>, modifier: Modifier) {
    if (groupScores.size < 2) return
    val days = lastDays(window.days, GROUP_DAYS)
    val groups = groupScores.keys.toList()
    StackedBarChart(
        title = "Days by group",
        description = "The score of each of the last ${days.size} days, split by group. The label is the day of " +
            "the month.",
        labels = days.map { "${it.day}" },
        parts = groups.map { g ->
            StackPart(groupLabel(g), groupColor(g, groups), days.map { groupScores.getValue(g)[it] })
        },
        modifier = modifier,
    )
}

/** The average points of each metric on each weekday, in the window. */
@Composable
private fun MetricsByWeekday(
    metrics: List<Metric>,
    points: Map<String, Map<Day, Double>>,
    window: ZoomWindow,
    modifier: Modifier,
) {
    val averages = metricWeekdayAverages(points, window.days)
    CellGrid(
        title = "Metrics by weekday",
        description = "The average points of each metric on each weekday. Each row has its own scale: its darkest " +
            "cell is the best weekday of that metric.",
        columns = weekdayNames,
        rows = metrics.mapNotNull { m ->
            averages[m.id]?.takeIf { row -> row.any { (it ?: 0.0) > 0 } }?.let { m.name to it }
        },
        modifier = modifier,
    )
}

/** The points of each metric in the window, and its share of the score, the most points first. */
@Composable
private fun PointsByMetric(
    metrics: List<Metric>,
    points: Map<String, Map<Day, Double>>,
    window: ZoomWindow,
    groupScores: Map<String, Map<Day, Double>>,
    modifier: Modifier,
) {
    val totals = metricTotals(points, window.days)
    val sum = totals.values.sum()
    val groups = groupScores.keys.toList()
    val cell = LocalExtraColors.current.cell
    HorizontalBarChart(
        title = "Points by metric",
        description = "The points of each metric in this period, and its share of the score.",
        bars = metrics.mapNotNull { m -> totals[m.id]?.takeIf { it > 0 }?.let { m to it } }
            .sortedByDescending { it.second }
            .map { (m, total) ->
                HBar(
                    label = m.name,
                    value = total,
                    color = if (groups.size >= 2) groupColor(groupOf(m), groups) else cell,
                    text = "${formatNumber(total)} · ${formatPercent(total / sum)}",
                )
            },
        modifier = modifier,
        legend = if (groups.size >= 2) groupLegend(groups) else emptyList(),
    )
}

/** For each metric, how many more points the other metrics give on the days when it gives points. */
@Composable
private fun HabitLinks(
    metrics: List<Metric>,
    points: Map<String, Map<Day, Double>>,
    values: Map<Day, Double>,
    window: ZoomWindow,
    modifier: Modifier,
) {
    val links = habitLinks(points, values, window.days)
    val cell = LocalExtraColors.current.cell
    val negative = MaterialTheme.colorScheme.tertiary
    HorizontalBarChart(
        title = "Habits that go with good days",
        description = "On the days when a metric gives points, how many more points the other metrics give. " +
            "This shows a link, not a cause. A metric needs $MIN_LINK_DAYS days with points and $MIN_LINK_DAYS " +
            "without.",
        bars = metrics.mapNotNull { m -> links[m.id]?.let { m to it } }
            .sortedByDescending { it.second }
            .map { (m, link) -> HBar(m.name, link, if (link >= 0) cell else negative, signed(link)) },
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
