package trackula.app.pages

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import trackula.app.Session
import trackula.app.components.AppCard
import trackula.app.components.Symbol
import trackula.app.errorText

/** The page where the user picks a spreadsheet from their Drive with the Google Picker. */
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

    AppCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Choose a sheet", style = MaterialTheme.typography.headlineSmall)
            Text(
                "Pick a Google Sheet from your Drive. If it has no \"Metrics\" and \"Log\" tabs, " +
                    "the app adds them, with example metrics. Other tabs do not change.",
            )
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = ::choose, enabled = !busy) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Symbol("folder_open", size = 20.dp)
                        Text("Choose sheet")
                    }
                }
                if (busy) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 3.dp)
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
}
