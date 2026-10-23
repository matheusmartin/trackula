package trackula.model

import java.math.BigDecimal
import java.math.RoundingMode

// BigDecimal has no negative zero. JavaScript keeps the sign of a negative value that rounds to 0: -0.001 → "-0.00".
internal actual fun toFixed(value: Double, decimals: Int): String {
    if (value.isNaN()) return "NaN"
    if (value.isInfinite()) return if (value > 0) "Infinity" else "-Infinity"
    val text = BigDecimal(value).setScale(decimals, RoundingMode.HALF_UP).toPlainString()
    return if (value < 0 && !text.startsWith("-")) "-$text" else text
}

// Java 19 and later give the shortest digits that read back as the value. This puts them in the JavaScript form:
// ECMAScript Number::toString, with value = 0.digits × 10^n.
internal actual fun numberText(value: Double): String {
    if (value.isNaN()) return "NaN"
    if (value.isInfinite()) return if (value > 0) "Infinity" else "-Infinity"
    if (value == 0.0) return "0"
    val decimal = BigDecimal(value.toString()).stripTrailingZeros()
    val digits = decimal.unscaledValue().abs().toString()
    val k = digits.length
    val n = k - decimal.scale()
    val text = when {
        n in k..21 -> digits + "0".repeat(n - k)

        n in 1..21 -> digits.substring(0, n) + "." + digits.substring(n)

        n in -5..0 -> "0." + "0".repeat(-n) + digits

        else -> {
            val mantissa = if (k == 1) digits else digits[0] + "." + digits.substring(1)
            val exponent = n - 1
            mantissa + "e" + (if (exponent >= 0) "+" else "-") + kotlin.math.abs(exponent)
        }
    }
    return if (value < 0) "-$text" else text
}
