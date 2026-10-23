package trackula.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import trackula.app.components.Header
import trackula.app.components.Symbol
import trackula.app.pages.ReloadHandle
import trackula.app.pages.SetupPage
import trackula.app.pages.SignInPage
import trackula.app.pages.TodayPage
import trackula.model.MainView
import trackula.sheets.DemoStore
import trackula.sheets.Store

/** The root of the UI. Shows sign-in, then sheet setup, then the Today page. In demo mode, only the Today page. */
@Composable
fun App(platform: Platform) {
    TrackulaTheme {
        AppContent(platform)
    }
}

@Composable
private fun AppContent(platform: Platform) {
    var session by remember { mutableStateOf<Session?>(null) }
    var spreadsheetId by remember { mutableStateOf(platform.savedSpreadsheetId) }
    var expired by remember { mutableStateOf(false) }

    // The view of the Today page. The app always opens on the Today tiles.
    var view by remember { mutableStateOf(MainView.TODAY) }
    val reload = remember { ReloadHandle() }

    // True while the Today page loads or writes: the app bar shows a progress circle instead of the reload button.
    var busy by remember { mutableStateOf(false) }

    // True while the Today page shows a metric detail screen: then the bottom navigation bar is hidden. Step 5.4 of the
    // port adds the detail screen, which sets it.
    var showsDetail by remember { mutableStateOf(false) }

    val demo = remember { if (platform.isDemo) DemoStore(platform.today()) else null }
    val config = platform.config

    @Composable
    fun todayPage(store: Store, isExpired: () -> Boolean, onExpired: () -> Unit) = TodayPage(
        store = store,
        today = platform.today(),
        expired = isExpired,
        onExpired = onExpired,
        view = view,
        onView = { view = it },
        reload = reload,
        onBusy = { busy = it },
        readPref = platform::readPref,
        writePref = platform::writePref,
    )

    if (demo != null) {
        Layout(
            header = { Header(onReload = { reload.run?.invoke() }, busy = busy) },
            showsNavigation = !showsDetail,
            view = view,
            onView = { view = it },
        ) {
            Text(
                "Demo mode: sample data in this tab only. Nothing goes to Google Sheets. A reload starts again.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            todayPage(demo, { false }, {})
        }
        return
    }

    val currentSession = session
    val currentId = spreadsheetId
    // Signed out: only the full-screen sign-in page, without the top bar.
    if (currentSession == null && config.hasClientId && config.hasApiKey) {
        SignInPage(platform, expired) {
            session = it
            expired = false
        }
        return
    }
    val connected = currentSession != null && currentId != null
    Layout(
        header = {
            Header(
                onReload = if (connected) ({ reload.run?.invoke() }) else null,
                busy = busy,
                onSignOut = if (currentSession == null) null else ({ session = null }),
                onDisconnect = if (connected) {
                    {
                        platform.savedSpreadsheetId = null
                        spreadsheetId = null
                    }
                } else {
                    null
                },
            )
        },
        showsNavigation = connected && !showsDetail,
        view = view,
        onView = { view = it },
    ) {
        when {
            !config.hasClientId || !config.hasApiKey -> Text(
                "Set GOOGLE_CLIENT_ID and GOOGLE_API_KEY in config.env. See README.md.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            currentSession == null -> Unit

            currentId == null -> SetupPage(currentSession) { id ->
                platform.savedSpreadsheetId = id
                spreadsheetId = id
            }

            else -> key(currentId) {
                val store = remember { currentSession.store(currentId) }
                todayPage(store, { currentSession.expired }) {
                    session = null
                    expired = true
                }
            }
        }
    }
}

/** The app bar, the main content and the bottom navigation bar: Today, 5 days, 31 days, Score. */
@Composable
private fun Layout(
    header: @Composable () -> Unit,
    showsNavigation: Boolean,
    view: MainView,
    onView: (MainView) -> Unit,
    content: @Composable () -> Unit,
) {
    Scaffold(
        topBar = header,
        bottomBar = {
            if (showsNavigation) {
                NavigationBar {
                    for (v in MainView.entries) {
                        NavigationBarItem(
                            selected = v == view,
                            onClick = { onView(v) },
                            icon = { Symbol(v.icon) },
                            label = { Text(v.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            Column(
                modifier = Modifier
                    .widthIn(max = 1200.dp)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                content()
            }
        }
    }
}
