package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import trackula.model.Metric

/** A Material Symbols name: lowercase letters, digits and `_`. */
private val symbolName = Regex("^[a-z0-9_]+$")

/**
 * The icon of [metric] in a chip: a Material Symbol for a lowercase name such as `water_drop`, else the text, such as
 * an emoji. [large] for the title of the detail screen.
 *
 * A white chip with a red icon: emojis keep their own colors, and Material Symbols have a contrast of 6:1. The thin
 * border keeps the chip visible on the card.
 */
@Composable
fun MetricIcon(metric: Metric, large: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(if (large) 10.dp else 8.dp)
    Box(
        modifier = Modifier
            .size(if (large) 44.dp else 32.dp)
            .background(colors.surfaceContainerLowest, shape)
            .border(1.dp, colors.primary.copy(alpha = 0.12f).compositeOver(colors.outlineVariant), shape)
            .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        if (symbolName.matches(metric.icon)) {
            Symbol(metric.icon, size = if (large) 28.dp else 20.dp, color = colors.primary)
        } else {
            Text(metric.icon, fontSize = if (large) 24.sp else 16.sp, maxLines = 1)
        }
    }
}
