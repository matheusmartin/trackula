package trackula.app.pages

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import trackula.app.Session
import trackula.app.components.AppCard
import trackula.app.components.FORM_WIDTH
import trackula.app.components.Notice
import trackula.app.components.NoticeKind
import trackula.app.components.PrimaryButton
import trackula.app.errorText

/**
 * The page where the user picks a spreadsheet from their Drive with the Google Picker. Wide screens: the card is at
 * most [FORM_WIDTH] wide and centered. While the Picker is open or the app prepares the sheet, the button is disabled
 * and a progress circle shows.
 */
@Composable
fun SetupPage(session: Session, onConnected: (spreadsheetId: String) -> Unit) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    // The latest parameters: Compose can keep a function reference of an earlier composition, with its values.
    val currentSession by rememberUpdatedState(session)
    val connected by rememberUpdatedState(onConnected)

    fun choose() {
        busy = true
        error = null
        scope.launch {
            try {
                val spreadsheetId = currentSession.pickSpreadsheet() ?: return@launch
                currentSession.prepare(spreadsheetId)
                connected(spreadsheetId)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = errorText(e)
            } finally {
                busy = false
            }
        }
    }

    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        AppCard(Modifier.widthIn(max = FORM_WIDTH).fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    "Choose a sheet",
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineSmall,
                )
                Text(
                    "Pick a Google Sheet from your Drive. If it has no \"Metrics\" and \"Log\" tabs, " +
                        "the app adds them, with example metrics. Other tabs do not change.",
                    style = MaterialTheme.typography.bodyLarge,
                )
                error?.let { Notice(it, kind = NoticeKind.ERROR) }
                if (busy) Progress("Pick a sheet in the Google window. Then the app prepares it.")
                PrimaryButton(
                    text = "Choose sheet",
                    onClick = ::choose,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy,
                    icon = "folder_open",
                )
            }
        }
    }
}
