package trackula.app.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/**
 * A round, transparent button with the Material Symbols [icon]. [title] is its name for screen readers and tests, and
 * the text of its tooltip: the tooltip shows when the mouse is on the button, or after a long press.
 * [small] for the tool bars of the detail screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppIconButton(icon: String, title: String, onClick: () -> Unit, enabled: Boolean = true, small: Boolean = false) {
    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Below),
        tooltip = { PlainTooltip { Text(title) } },
        state = rememberTooltipState(),
    ) {
        IconButton(
            onClick = onClick,
            enabled = enabled,
            modifier = Modifier.semantics { contentDescription = title }.then(
                if (small) Modifier.size(32.dp) else Modifier,
            ),
        ) {
            Symbol(icon, size = if (small) 20.dp else 24.dp)
        }
    }
}
