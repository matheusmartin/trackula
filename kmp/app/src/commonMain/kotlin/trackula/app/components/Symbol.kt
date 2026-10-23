package trackula.app.components

import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.Font
import trackula.app.resources.Res
import trackula.app.resources.symbols

/**
 * The Material Symbols icon [name] of the app buttons, for example `refresh`. The font has only the icons of the app:
 * see design/symbols/make.py. The icon is decoration only: the button gives the name for screen readers.
 */
@Composable
fun Symbol(name: String, modifier: Modifier = Modifier, size: Dp = 24.dp, color: Color = LocalContentColor.current) {
    val fontSize = with(LocalDensity.current) { size.toSp() }
    Text(
        text = name,
        modifier = modifier.clearAndSetSemantics {},
        color = color,
        fontSize = fontSize,
        lineHeight = fontSize,
        fontFamily = FontFamily(Font(Res.font.symbols)),
        maxLines = 1,
    )
}
