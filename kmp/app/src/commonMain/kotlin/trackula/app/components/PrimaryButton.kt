package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import trackula.app.LocalExtraColors

/**
 * The main button of a screen, for example Save or Sign in. Enabled: the darker logo gradient with white text, in both
 * themes. Disabled: a quiet grey button with readable text. Use one on a screen. Give it the width with [modifier].
 *
 * - [icon]: a Material Symbols name before the text. Null: no icon.
 * - [description]: the name for screen readers and tests, when it says more than [text]. Example: "Save: Water".
 */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: String? = null,
    description: String? = null,
) {
    val extra = LocalExtraColors.current
    val colors = MaterialTheme.colorScheme
    val background = if (enabled) {
        Modifier.background(extra.actionBrush)
    } else {
        Modifier.background(colors.surfaceContainerHighest)
    }
    val content = if (enabled) extra.onAction else colors.onSurfaceVariant
    Box(
        modifier = modifier
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(16.dp))
            .then(background)
            .then(if (description == null) Modifier else Modifier.semantics { contentDescription = description })
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) Symbol(icon, size = 20.dp, color = content)
            Text(text, color = content, style = MaterialTheme.typography.labelLarge.copy(fontSize = BUTTON_TEXT))
        }
    }
}
