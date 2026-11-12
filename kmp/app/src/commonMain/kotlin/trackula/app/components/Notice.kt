package trackula.app.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** The kind of a [Notice]. It selects the icon and the colors. */
enum class NoticeKind { INFO, ERROR }

/**
 * A message for the user in a soft box with an icon: an error of a load or a save, or a note such as demo mode. A
 * screen reader says an error when it shows.
 *
 * [action] and [onAction]: a text button at the end, for example "Try again". Null: no button.
 */
@Composable
fun Notice(
    text: String,
    modifier: Modifier = Modifier,
    kind: NoticeKind = NoticeKind.INFO,
    action: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = MaterialTheme.colorScheme
    val isError = kind == NoticeKind.ERROR
    val content = if (isError) colors.onErrorContainer else colors.onSurfaceVariant
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(if (isError) colors.errorContainer else colors.surfaceContainerHigh, RoundedCornerShape(12.dp))
            .then(if (isError) Modifier.semantics { liveRegion = LiveRegionMode.Polite } else Modifier)
            .padding(start = 12.dp, end = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Symbol(if (isError) "error" else "info", size = 20.dp, color = content)
        Text(
            text,
            modifier = Modifier.weight(1f).padding(vertical = 10.dp),
            color = content,
            style = MaterialTheme.typography.bodyMedium,
        )
        if (action != null && onAction != null) {
            TextButton(onClick = onAction) { Text(action, color = content) }
        } else {
            // The same space at the end as at the start.
            Row(Modifier.padding(end = 8.dp)) {}
        }
    }
}
