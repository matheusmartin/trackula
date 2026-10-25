package trackula.model

import kotlin.math.max

/**
 * Reads a number that the user typed. A period and a comma both work as decimal mark: "81.9" and "81,9" are 81.9.
 *
 * A dot at the end is allowed while the user types: "81." is 81.
 * Returns null if [text] is empty, is not a number, or is below 0.
 */
fun parseDecimal(text: String): Double? {
    val t = text.trim().replace(',', '.').removeSuffix(".")
    return if (decimal.matches(t)) t.toDouble() else null
}

private val decimal = Regex("""^(\d+(\.\d+)?|\.\d+)$""")

/** The number of decimals of [step], at most 6. Examples: 0.1 → 1, 0.25 → 2, 5 → 0. */
fun stepDecimals(step: Double): Int = (0..6).firstOrNull { toFixed(step, it).toDouble() == step } ?: 6

/**
 * Rounds [value] to the decimals of [step]. With [snap], also to the nearest multiple of [step]. Never below 0.
 *
 * This removes float noise, for example 0.1 + 0.2 = 0.30000000000000004.
 */
fun roundToStep(value: Double, step: Double, snap: Boolean = false): Double {
    val x = if (snap) roundHalfAwayFromZero(value / step) * step else value
    return toFixed(max(0.0, x), stepDecimals(step)).toDouble()
}

/** [value] with the decimals of [step]. Examples: (82, 0.1) → "82.0", (1250, 250) → "1250". */
fun formatStep(value: Double, step: Double): String = toFixed(value, stepDecimals(step))
