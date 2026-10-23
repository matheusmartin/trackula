package trackula.model

import kotlin.math.abs
import kotlin.math.sign
import kotlin.math.truncate

/**
 * [value] as text with exactly [decimals] decimals, as `Number.prototype.toFixed` in JavaScript and `toStringAsFixed`
 * in Dart. The function rounds the exact binary value, and a half rounds away from zero. Examples: (81.25, 1) → "81.3",
 * (82.0, 1) → "82.0", (2.675, 2) → "2.67", because 2.675 is stored as 2.67499….
 *
 * NaN and the infinities give "NaN", "Infinity" and "-Infinity". For 1e21 and more, JavaScript gives the exponent
 * form, for example "1e+21", and the JVM gives all digits. The app has no such values.
 */
internal expect fun toFixed(value: Double, decimals: Int): String

/**
 * [value] as text, as `String(value)` in JavaScript and `'$value'` in Dart compiled to JavaScript: the shortest digits
 * that read back as [value], and no ".0" for a whole number. Examples: 8.0 → "8", 0.1234567 → "0.1234567",
 * 1e-7 → "1e-7", 1e21 → "1e+21".
 */
internal expect fun numberText(value: Double): String

/** [value] rounded to a whole number. A half rounds away from zero, as `round()` in Dart. Example: -2.5 → -3.0. */
internal fun roundHalfAwayFromZero(value: Double): Double {
    val whole = truncate(value)
    return if (abs(value - whole) >= 0.5) whole + sign(value) else whole
}

/** A cell value as a number. Null if [cell] is not a [Number]. */
internal fun numberOf(cell: Any?): Double? = (cell as? Number)?.toDouble()

/** A decimal number in text: an optional sign, digits with an optional period, and an optional exponent. */
private val decimalNumber = Regex("""^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$""")

/** The number in [text]. Null if [text] is not a decimal number. Examples: "8" → 8.0, "-1.5e3" → -1500.0. */
internal fun parseNumber(text: String): Double? = if (decimalNumber.matches(text)) text.toDouble() else null
