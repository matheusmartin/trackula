package trackula.app

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor

// The Ember color theme, from the orange-red logo gradient: #F97316 to #BE123C. The same values as web/theme.css of
// the Dart app. The device setting selects the light or the dark theme.
// - Neutrals: one slate blue family in both themes. Blue is opposite to orange, so the orange-red parts stand out.
// - Accents: light uses dark tones and dark uses light tones of the same hues, as in Material Design 3.

private val lightColors = lightColorScheme(
    primary = Color(0xFFB8321A),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFFFDFD4),
    onPrimaryContainer = Color(0xFF4A1300),
    secondary = Color(0xFF87412F),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFF7DDD2),
    onSecondaryContainer = Color(0xFF3F150A),
    tertiary = Color(0xFFB45309),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFFDE7CF),
    onTertiaryContainer = Color(0xFF3D1D00),
    background = Color(0xFFF8F9FB),
    onBackground = Color(0xFF1A1E24),
    surface = Color(0xFFF8F9FB),
    onSurface = Color(0xFF1A1E24),
    surfaceVariant = Color(0xFFE4E8ED),
    onSurfaceVariant = Color(0xFF4D5562),
    outline = Color(0xFF7A8390),
    outlineVariant = Color(0xFFD0D6DE),
    inverseSurface = Color(0xFF2C323B),
    inverseOnSurface = Color(0xFFEEF1F5),
    inversePrimary = Color(0xFFFF8C66),
    surfaceDim = Color(0xFFD9DEE4),
    surfaceBright = Color(0xFFF8F9FB),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF3F5F7),
    surfaceContainer = Color(0xFFEEF1F4),
    surfaceContainerHigh = Color(0xFFE8EBEF),
    surfaceContainerHighest = Color(0xFFE2E6EB),
    // The light error colors of BeerCSS, as in the Dart app.
    error = Color(0xFFBA1A1A),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
)

private val darkColors = darkColorScheme(
    primary = Color(0xFFFF8C66),
    onPrimary = Color(0xFF4A1300),
    primaryContainer = Color(0xFF7A2A14),
    onPrimaryContainer = Color(0xFFFFDBCF),
    secondary = Color(0xFFF0B8A4),
    onSecondary = Color(0xFF4A2214),
    secondaryContainer = Color(0xFF5E2E22),
    onSecondaryContainer = Color(0xFFFFDBCF),
    tertiary = Color(0xFFFFB067),
    onTertiary = Color(0xFF4A2500),
    tertiaryContainer = Color(0xFF7A3D0B),
    onTertiaryContainer = Color(0xFFFFDCC0),
    background = Color(0xFF141A22),
    onBackground = Color(0xFFE8ECF2),
    surface = Color(0xFF141A22),
    onSurface = Color(0xFFE8ECF2),
    surfaceVariant = Color(0xFF27303C),
    onSurfaceVariant = Color(0xFFB7C0CC),
    outline = Color(0xFF8590A0),
    outlineVariant = Color(0xFF36404C),
    inverseSurface = Color(0xFFE8ECF2),
    inverseOnSurface = Color(0xFF141A22),
    inversePrimary = Color(0xFFB8321A),
    surfaceDim = Color(0xFF141A22),
    surfaceBright = Color(0xFF323C49),
    surfaceContainerLowest = Color(0xFF141A22),
    surfaceContainerLow = Color(0xFF1A212B),
    surfaceContainer = Color(0xFF1F2732),
    surfaceContainerHigh = Color(0xFF27303C),
    surfaceContainerHighest = Color(0xFF323C49),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFB4AB),
)

/**
 * The colors of the app that Material Design 3 does not have.
 *
 * @property done The green of done tiles and of the score.
 * @property cell The fill of a day with a value: table cells, calendars, heatmap and bars. The same in both themes.
 * @property cellBrush The logo gradient on the table and calendar cells.
 * @property cellEmpty The fill of a day with no value.
 * @property doneCell The green cell fill of the score.
 * @property actionBrush A darker logo gradient for the main buttons, with [onAction] text (5:1 or more).
 * @property headerBrush The logo gradient of the top bar, in both themes.
 */
@Immutable
data class ExtraColors(
    val done: Color,
    val onDone: Color,
    val doneContainer: Color,
    val onDoneContainer: Color,
    val cell: Color,
    val onCell: Color,
    val cellBrush: Brush,
    val cellEmpty: Color,
    val doneCell: Color,
    val actionBrush: Brush,
    val onAction: Color,
    val headerBrush: Brush,
)

// A linear gradient from the top-left corner to the bottom-right corner. On square cells and buttons, this is the 135°
// of the CSS gradients. On the wide top bar, the color line is a little steeper than 135°.
private val cellBrush = Brush.linearGradient(listOf(Color(0xFFCA4A09), Color(0xFFE41648)))
private val actionBrush = Brush.linearGradient(listOf(Color(0xFFC2410C), Color(0xFF9F1239)))
private val headerBrush = Brush.linearGradient(listOf(Color(0xFFF97316), Color(0xFFBE123C)))

private val lightExtra = ExtraColors(
    done = Color(0xFF2E7D32),
    onDone = Color(0xFFFFFFFF),
    doneContainer = Color(0xFFDCEFDC),
    onDoneContainer = Color(0xFF1B4D1F),
    cell = Color(0xFFDA3625),
    onCell = Color(0xFFFFFFFF),
    cellBrush = cellBrush,
    cellEmpty = Color(0xFFE2E6EB),
    doneCell = Color(0xFF318535),
    actionBrush = actionBrush,
    onAction = Color(0xFFFFFFFF),
    headerBrush = headerBrush,
)

private val darkExtra = lightExtra.copy(
    done = Color(0xFF86D38C),
    onDone = Color(0xFF0F2E13),
    doneContainer = Color(0xFF1E3A22),
    onDoneContainer = Color(0xFFC8ECC9),
    // A lighter slate, so that empty cells show the blue of the theme.
    cellEmpty = Color(0xFF323C49),
)

/** The [ExtraColors] of the current theme. */
val LocalExtraColors = staticCompositionLocalOf { lightExtra }

/** The Ember theme. [dark] selects the dark theme: the device setting by default. */
@Composable
fun TrackulaTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors: ColorScheme = if (dark) darkColors else lightColors
    CompositionLocalProvider(LocalExtraColors provides if (dark) darkExtra else lightExtra) {
        MaterialTheme(colorScheme = colors, content = content)
    }
}

/**
 * The green theme of the score: the charts and the icons use the green of done tiles in place of the theme red, and
 * the day fills use the green cell color without the logo gradient.
 */
@Composable
fun ScoreTheme(content: @Composable () -> Unit) {
    val extra = LocalExtraColors.current
    CompositionLocalProvider(
        LocalExtraColors provides extra.copy(cell = extra.doneCell, cellBrush = SolidColor(extra.doneCell)),
    ) {
        MaterialTheme(colorScheme = MaterialTheme.colorScheme.copy(primary = extra.done), content = content)
    }
}
