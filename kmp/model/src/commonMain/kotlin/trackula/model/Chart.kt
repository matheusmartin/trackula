package trackula.model

import kotlin.math.max

/** A point of a line chart, in chart units: x from 0 to the chart width, y from 0 (top) to the chart height. */
data class ChartPoint(val day: Day, val value: Double, val x: Double, val y: Double)

/**
 * Places each day of [days] that has a value in [values] on a [width] × [height] chart.
 *
 * - x: the position of the day in [days]. The first day is at 0, the last at [width].
 * - y: the value between the lowest and highest value. The highest is at [padding], the lowest at
 *   [height] − [padding]. If all values are equal, they are in the middle. With [fromZero], the lowest is 0: 0 is
 *   always at [height] − [padding].
 * - Days without a value get no point, so the line connects the days before and after them.
 */
fun chartPoints(
    days: List<Day>,
    values: Map<Day, Double>,
    width: Double = 100.0,
    height: Double = 40.0,
    padding: Double = 4.0,
    fromZero: Boolean = false,
): List<ChartPoint> {
    val present = present(days, values)
    if (present.isEmpty()) return emptyList()
    val low = present.fold(if (fromZero) 0.0 else Double.POSITIVE_INFINITY) { low, p -> minOf(low, p.value) }
    val high = present.maxOf { it.value }
    val span = max(1, days.size - 1)
    return present.map { p ->
        val y = when {
            high != low -> padding + (height - 2 * padding) * (high - p.value) / (high - low)
            fromZero -> height - padding
            else -> height / 2
        }
        ChartPoint(p.day, p.value, width * p.index / span, y)
    }
}

/** A bar of a bar chart, in chart units: from x to x + w, and from y (top) to the chart height. */
data class ChartBar(val day: Day, val value: Double, val x: Double, val w: Double, val y: Double)

/**
 * Places a bar for each day of [days] that has a value in [values] on a [width] × [height] chart.
 *
 * - Each day gets an equal slot. The bar fills [fill] of its slot, in the middle.
 * - Bars start at 0 at the bottom. The highest value reaches [padding] from the top.
 * - Negative values count as 0.
 */
fun chartBars(
    days: List<Day>,
    values: Map<Day, Double>,
    width: Double = 100.0,
    height: Double = 40.0,
    padding: Double = 4.0,
    fill: Double = 0.6,
): List<ChartBar> {
    val present = present(days, values)
    if (present.isEmpty()) return emptyList()
    val high = present.fold(0.0) { high, b -> max(high, b.value) }
    val slot = width / days.size
    return present.map { b ->
        val y = if (high <= 0) height else height - (height - padding) * max(0.0, b.value) / high
        ChartBar(b.day, b.value, slot * b.index + slot * (1 - fill) / 2, slot * fill, y)
    }
}

/** A day of a chart that has a value, and its index in the days of the chart. */
private data class Present(val index: Int, val day: Day, val value: Double)

/** The days of [days] that have a value in [values], with their index in [days]. */
private fun present(days: List<Day>, values: Map<Day, Double>): List<Present> =
    days.mapIndexedNotNull { i, d -> values[d]?.let { Present(i, d, it) } }
