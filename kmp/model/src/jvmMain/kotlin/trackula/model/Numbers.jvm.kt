package trackula.model

import java.math.BigDecimal
import java.math.RoundingMode

// BigDecimal has no negative zero. JavaScript keeps the sign of a negative value that rounds to 0: -0.001 → "-0.00".
internal actual fun toFixed(value: Double, decimals: Int): String {
    val text = BigDecimal(value).setScale(decimals, RoundingMode.HALF_UP).toPlainString()
    return if (value < 0 && !text.startsWith("-")) "-$text" else text
}
