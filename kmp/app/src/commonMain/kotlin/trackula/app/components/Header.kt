package trackula.app.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
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
 * The top app bar with the logo, the app name and the session actions, on the logo gradient in both themes.
 *
 * - [onReload] reloads the sheet data. Null: no reload button, for example before a sheet is chosen.
 * - [busy] is true while data loads or saves: a progress circle shows instead of the reload button.
 */
@Composable
fun Header(
    onReload: (() -> Unit)? = null,
    busy: Boolean = false,
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
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp).semantics { contentDescription = "Loading" },
                        color = extra.onAction,
                        strokeWidth = 3.dp,
                    )
                    Spacer(Modifier.width(12.dp))
                } else {
                    AppIconButton(icon = "refresh", title = "Reload", onClick = onReload)
                }
            }
            if (onDisconnect != null) AppIconButton(icon = "swap_horiz", title = "Change sheet", onClick = onDisconnect)
            if (onSignOut != null) AppIconButton(icon = "logout", title = "Sign out", onClick = onSignOut)
        }
    }
}
