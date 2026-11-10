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
import trackula.model.COMPARED_WEEKS
import trackula.model.CountStats
import trackula.model.Day
import trackula.model.MIN_LINK_DAYS
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
import trackula.model.groupWeekdayParts
import trackula.model.habitLinks
import trackula.model.halves
import trackula.model.isScore
import trackula.model.metricTotals
import trackula.model.numberStats
import trackula.model.roundHalfAwayFromZero
import trackula.model.shortDay
import trackula.model.streakLengths
import trackula.model.streakRanges
import trackula.model.weekChanges
import trackula.model.weekdayNames
import trackula.model.weekdaysInRange
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
 * The numbers and charts of the score. Each one answers one question: how the score changes over time, how the week
 * of the window end compares with the weeks before (for each weekday, and for each group or metric), which weekdays
 * are good, which metrics give the points, and which habits go with good days. The month calendar below the charts
 * shows the score of each day (see `ScoreCalendar`). The score of a day does not add up over time, so the charts show
 * averages per day and per weekday, not totals.
 *
 * - [values]: the score of each day. The change compares the first half of the window with the second half.
 * - [groupScores]: the score of each group. With 2 or more groups, the weekday bars show the part of each group, the
 *   week change is by group, and the points by metric have the color of their group. Else the week change is by
 *   metric.
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
    val average = countStats(values, secondHalf).average
    val previous = countStats(values, firstHalf).average
    val best = stats.best
    val weekday = bestWeekday(stats.weekdayAverages)
    KeyNumbers(
        listOf(
            "per day" to (stats.average?.let { withUnit(it, metric) } ?: "–"),
            "change" to
                (if (average != null && previous != null) formatSigned(average - previous, metric.unit) else "–"),
            "best day" to (best?.let { "${formatNumber(it.value)} · ${shortDay(it.day)}" } ?: "–"),
            "best weekday" to (
                weekday?.let { "${weekdayNames[it - 1]} · ${formatNumber(stats.weekdayAverages[it - 1]!!)}" } ?: "–"
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
                fixedScale = true,
            ),
            ChartItem(wide = false) { WeekInRange(values, window, it) },
            ChartItem(wide = false) { WeekChanges(scoreMetrics, points, values, window, groupScores, it) },
            ChartItem(wide = true) { WeekdayAverages(values, window, stats, groupScores, it) },
            ChartItem(wide = true) { PointsByMetric(scoreMetrics, points, window, groupScores, it) },
            ChartItem(wide = true) { HabitLinks(scoreMetrics, points, values, window, it) },
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
 * The change of each group from the [COMPARED_WEEKS] weeks before to the week of the window end, the largest first.
 * With fewer than 2 [groupScores], the change of each metric of [metrics] in [points]. See `weekChanges`.
 */
@Composable
private fun WeekChanges(
    metrics: List<Metric>,
    points: Map<String, Map<Day, Double>>,
    values: Map<Day, Double>,
    window: ZoomWindow,
    groupScores: Map<String, Map<Day, Double>>,
    modifier: Modifier,
) {
    val byGroup = groupScores.size >= 2
    val part = if (byGroup) "group" else "metric"
    val names = if (byGroup) groupScores.keys.associateWith(::groupLabel) else metrics.associate { it.id to it.name }
    val changes = weekChanges(if (byGroup) groupScores else points, values, window.to)
    val cell = LocalExtraColors.current.cell
    val negative = MaterialTheme.colorScheme.tertiary
    HorizontalBarChart(
        title = "Change by $part",
        description = "The points per day of each $part in ${window.weekName()}, minus its points per day on the " +
            "same weekdays of the $COMPARED_WEEKS weeks before.",
        bars = changes.entries
            .sortedByDescending { it.value }
            .map { (id, change) -> HBar(names[id] ?: id, change, if (change >= 0) cell else negative, signed(change)) },
        modifier = modifier,
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
