package trackula.app.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.painterResource
import trackula.app.LocalExtraColors
import trackula.app.resources.Res
import trackula.app.resources.logo

/**
 * The top app bar with the logo, the app name and the actions, on the header gradient in both themes.
 *
 * - [onReload] reloads the sheet data. Null: no reload button, for example before the user chooses a sheet.
 * - [busy] is true while data loads or saves: a progress circle shows instead of the reload button.
 * - [onMetrics] opens or closes the metrics screen. Null: no metrics button.
 * - [onDisconnect] (Change sheet) and [onSignOut] are in the "More" menu. Both null: no menu.
 */
@Composable
fun Header(
    onReload: (() -> Unit)? = null,
    busy: Boolean = false,
    onMetrics: (() -> Unit)? = null,
    onSignOut: (() -> Unit)? = null,
    onDisconnect: (() -> Unit)? = null,
) {
    val extra = LocalExtraColors.current
    CompositionLocalProvider(LocalContentColor provides extra.onAction) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(extra.headerBrush)
                .windowInsetsPadding(WindowInsets.statusBars)
                .height(64.dp)
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Image(painterResource(Res.drawable.logo), contentDescription = null, modifier = Modifier.size(32.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "Trackula",
                modifier = Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            if (onReload != null) {
                if (busy) {
                    // The size of an icon button, so that the other buttons do not move.
                    Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp).semantics { contentDescription = "Loading" },
                            color = extra.onAction,
                            strokeWidth = 3.dp,
                        )
                    }
                } else {
                    AppIconButton(icon = "refresh", title = "Reload", onClick = onReload)
                }
            }
            if (onMetrics != null) AppIconButton(icon = "tune", title = "Metrics", onClick = onMetrics)
            if (onDisconnect != null || onSignOut != null) AccountMenu(onDisconnect, onSignOut)
        }
    }
}

/**
 * The "More" button with the menu of the actions that the user needs seldom: Change sheet and Sign out. They are not
 * buttons in the bar, so that a wrong tap does not sign the user out.
 */
@Composable
private fun AccountMenu(onDisconnect: (() -> Unit)?, onSignOut: (() -> Unit)?) {
    var open by remember { mutableStateOf(false) }
    Box {
        AppIconButton(icon = "more_vert", title = "More", onClick = { open = true })
        // The menu is on a surface of the theme, not on the gradient: it has the content color of the theme.
        CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onSurface) {
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                if (onDisconnect != null) {
                    MenuItem("swap_horiz", "Change sheet") {
                        open = false
                        onDisconnect()
                    }
                }
                if (onSignOut != null) {
                    MenuItem("logout", "Sign out") {
                        open = false
                        onSignOut()
                    }
                }
            }
        }
    }
}

@Composable
private fun MenuItem(icon: String, text: String, onClick: () -> Unit) {
    DropdownMenuItem(text = { Text(text) }, onClick = onClick, leadingIcon = { Symbol(icon) })
}
