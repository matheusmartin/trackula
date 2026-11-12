package trackula.app

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import trackula.app.components.ActionBarHost
import trackula.app.components.FORM_WIDTH
import trackula.app.components.Header
import trackula.app.components.LocalActionBarHost
import trackula.app.components.Notice
import trackula.app.components.RAIL_WIDTH
import trackula.app.components.Symbol
import trackula.app.pages.ReloadHandle
import trackula.app.pages.SetupPage
import trackula.app.pages.SignInPage
import trackula.app.pages.TodayPage
import trackula.model.MainView
import trackula.sheets.DemoStore
import trackula.sheets.Store

/**
 * The scroll position of the page that shows. Null without the App, for example in a test of one page. A page that
 * shows a new screen in the same place, for example a form in place of a list, scrolls it to the top.
 */
val LocalPageScroll = staticCompositionLocalOf<ScrollState?> { null }

/** The root of the UI. Shows sign-in, then sheet setup, then the Today page. In demo mode, only the Today page. */
@Composable
fun App(platform: Platform) {
    TrackulaTheme {
        val back = remember(platform) { BackDispatcher(platform.history) }
        CompositionLocalProvider(LocalBackDispatcher provides back) {
            AppContent(platform)
        }
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

    // True while the Today page shows a metric detail screen: then the navigation is hidden.
    var showsDetail by remember { mutableStateOf(false) }

    // True while the Today page shows the metrics screen. The navigation is hidden there too.
    var managing by remember { mutableStateOf(false) }

    val demo = remember { if (platform.isDemo) DemoStore(platform.today()) else null }
    val config = platform.config

    // The screen in the page area. Each screen has its own scroll position: see Layout.
    val screen = when {
        managing -> "metrics"
        showsDetail -> "detail"
        else -> view.name
    }

    // The Back button of the browser closes the metrics screen. The Today page does the same for its detail screen.
    OnBack(enabled = managing) { managing = false }

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
        onDetail = { showsDetail = it },
        managing = managing,
        onManaging = { managing = it },
        readPref = platform::readPref,
        writePref = platform::writePref,
    )

    if (demo != null) {
        Layout(
            header = { Header(onReload = { reload.run?.invoke() }, busy = busy, onMetrics = { managing = true }) },
            showsNavigation = !showsDetail && !managing,
            view = view,
            onView = { view = it },
            screen = screen,
        ) {
            // Only on the main views: a detail screen and a form have their own title at the top.
            if (!showsDetail && !managing) {
                Notice("Demo mode: sample data in this tab only. Nothing goes to Google Sheets. A reload starts again.")
            }
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
                onMetrics = if (connected) ({ managing = true }) else null,
                onSignOut = if (currentSession == null) {
                    null
                } else {
                    {
                        session = null
                        managing = false
                    }
                },
                onDisconnect = if (connected) {
                    {
                        platform.savedSpreadsheetId = null
                        spreadsheetId = null
                        managing = false
                    }
                } else {
                    null
                },
            )
        },
        showsNavigation = connected && !showsDetail && !managing,
        view = view,
        onView = { view = it },
        screen = if (connected) screen else "setup",
    ) {
        when {
            !config.hasClientId || !config.hasApiKey -> Box(Modifier.fillMaxWidth(), Alignment.TopCenter) {
                Notice(
                    "Set GOOGLE_CLIENT_ID and GOOGLE_API_KEY in config.env. See README.md.",
                    Modifier.widthIn(max = FORM_WIDTH),
                )
            }

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

/**
 * The app bar, the main content and the navigation: Today, 5 days, 31 days, Score. A narrow window has a bottom
 * navigation bar. A window of [RAIL_WIDTH] or more has a navigation rail on the left, so that the content keeps the
 * height of the window.
 *
 * - [screen]: the name of the screen in the page area. Each main view keeps its scroll position while the app runs. A
 *   detail screen, the metrics screen and the setup page start at the top each time.
 * - The main action of the page (see [ActionBarHost]) shows below the content and above the bottom navigation bar.
 */
@Composable
private fun Layout(
    header: @Composable () -> Unit,
    showsNavigation: Boolean,
    view: MainView,
    onView: (MainView) -> Unit,
    screen: String,
    content: @Composable () -> Unit,
) {
    val actionBar = remember { ActionBarHost() }
    val scrolls = remember { mutableMapOf<String, ScrollState>() }
    val scroll = remember(screen) {
        if (MainView.entries.any { it.name == screen }) scrolls.getOrPut(screen) { ScrollState(0) } else ScrollState(0)
    }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val hasRail = maxWidth >= RAIL_WIDTH
        Scaffold(
            topBar = header,
            bottomBar = {
                Column {
                    actionBar.content?.let { action ->
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .background(MaterialTheme.colorScheme.surface)
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Box(Modifier.widthIn(max = FORM_WIDTH).fillMaxWidth()) { action() }
                        }
                    }
                    if (showsNavigation && !hasRail) {
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
                }
            },
        ) { padding ->
            Row(Modifier.fillMaxSize().padding(padding)) {
                if (showsNavigation && hasRail) {
                    NavigationRail(Modifier.fillMaxHeight()) {
                        Spacer(Modifier.height(8.dp))
                        for (v in MainView.entries) {
                            NavigationRailItem(
                                selected = v == view,
                                onClick = { onView(v) },
                                icon = { Symbol(v.icon) },
                                label = { Text(v.label) },
                            )
                        }
                    }
                }
                Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.TopCenter) {
                    Column(
                        modifier = Modifier
                            .widthIn(max = 1200.dp)
                            .fillMaxWidth()
                            .verticalScroll(scroll)
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        CompositionLocalProvider(
                            LocalActionBarHost provides actionBar,
                            LocalPageScroll provides scroll,
                        ) {
                            content()
                        }
                    }
                }
            }
        }
    }
}
