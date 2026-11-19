import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { MainView } from '../model/MainView.js';
import { DemoStore } from '../sheets/DemoStore.js';
import { BackDispatcher, LocalBackDispatcher, useOnBack } from './Back.js';
import { ActionBarHost, LocalActionBarHost } from './components/ActionBar.jsx';
import { Header } from './components/Header.jsx';
import { Notice } from './components/Notice.jsx';
import { RAIL_WIDTH } from './components/Sizes.js';
import { Symbol } from './components/Symbol.jsx';
import { SetupPage } from './pages/SetupPage.jsx';
import { SignInPage } from './pages/SignInPage.jsx';
import { ReloadHandle, TodayPage } from './pages/TodayPage.jsx';
import { saveSpreadsheetId, savedSpreadsheetId } from './Platform.js';
import './App.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Store } from '../sheets/Store.js' */
/** @import { Platform, Session } from './Platform.js' */

/**
 * The root of the UI. Shows sign-in, then sheet setup, then the Today page. In demo mode, only the Today page.
 * @param {object} props
 * @param {Platform} props.platform
 * @returns {JSX.Element}
 */
export function App({ platform }) {
  const back = useMemo(() => new BackDispatcher(platform.history), [platform]);
  return (
    <LocalBackDispatcher.Provider value={back}>
      <AppContent platform={platform} />
    </LocalBackDispatcher.Provider>
  );
}

/**
 * The screens of the app: see {@link App}.
 * @param {object} props
 * @param {Platform} props.platform
 * @returns {JSX.Element}
 */
function AppContent({ platform }) {
  const [session, setSession] = useState(/** @type {Session | null} */ (null));
  const [spreadsheetId, setSpreadsheetId] = useState(() => savedSpreadsheetId(platform));
  const [expired, setExpired] = useState(false);

  // The view of the Today page. The app always opens on the Today tiles.
  const [view, setView] = useState(MainView.TODAY);
  const reload = useMemo(() => new ReloadHandle(), []);

  // True while the Today page loads or writes: the app bar shows a progress circle instead of the reload button.
  const [busy, setBusy] = useState(false);

  // True while the Today page shows a metric detail screen: then the navigation is hidden.
  const [showsDetail, setShowsDetail] = useState(false);

  // True while the Today page shows the metrics screen. The navigation is hidden there too.
  const [managing, setManaging] = useState(false);

  const demo = useMemo(() => (platform.isDemo ? new DemoStore(platform.today(), DEMO_DELAY) : null), [platform]);
  const config = platform.config;

  // The screen in the page area. Each screen has its own scroll position: see Layout.
  const screen = managing ? 'metrics' : showsDetail ? 'detail' : view.name;

  // The Back button of the browser closes the metrics screen. The Today page does the same for its detail screen.
  useOnBack(managing, () => setManaging(false));

  /**
   * The Today page with the state of the App.
   * @param {Store} store
   * @param {() => boolean} isExpired
   * @param {() => void} onExpired
   * @returns {JSX.Element}
   */
  const todayPage = (store, isExpired, onExpired) => (
    <TodayPage
      store={store}
      today={platform.today()}
      expired={isExpired}
      onExpired={onExpired}
      view={view}
      onView={setView}
      reload={reload}
      onBusy={setBusy}
      onDetail={setShowsDetail}
      managing={managing}
      onManaging={setManaging}
      hasMouse={platform.hasMouse}
      readPref={(key) => platform.readPref(key)}
      writePref={(key, value) => platform.writePref(key, value)}
    />
  );

  if (demo != null) {
    return (
      <Layout
        header={<Header onReload={() => reload.run?.()} busy={busy} onMetrics={() => setManaging(true)} />}
        showsNavigation={!showsDetail && !managing}
        view={view}
        onView={setView}
        screen={screen}
      >
        {/* Only on the main views: a detail screen and a form have their own title at the top. */}
        {!showsDetail && !managing && <Notice text="Demo mode: sample data. Nothing goes to Google Sheets." />}
        {todayPage(
          demo,
          () => false,
          () => {},
        )}
      </Layout>
    );
  }

  // Signed out: only the full-screen sign-in page, without the top bar.
  if (session == null && config.hasClientId && config.hasApiKey) {
    return (
      <SignInPage
        platform={platform}
        expired={expired}
        onSignedIn={(signedIn) => {
          setSession(signedIn);
          setExpired(false);
        }}
      />
    );
  }
  const connected = session != null && spreadsheetId != null;

  /** @returns {ComponentChildren} */
  function content() {
    if (!config.hasClientId || !config.hasApiKey) {
      return (
        <div class="app-centered">
          <Notice text="Set GOOGLE_CLIENT_ID and GOOGLE_API_KEY in config.env. See README.md." class="app-form-width" />
        </div>
      );
    }
    if (session == null) return null;
    if (spreadsheetId == null) {
      return (
        <SetupPage
          session={session}
          onConnected={(id) => {
            saveSpreadsheetId(platform, id);
            setSpreadsheetId(id);
          }}
        />
      );
    }
    return (
      <SheetPage key={spreadsheetId} session={session} spreadsheetId={spreadsheetId}>
        {(store) =>
          todayPage(
            store,
            () => session.expired,
            () => {
              setSession(null);
              setExpired(true);
            },
          )
        }
      </SheetPage>
    );
  }

  return (
    <Layout
      header={
        <Header
          onReload={connected ? () => reload.run?.() : null}
          busy={busy}
          onMetrics={connected ? () => setManaging(true) : null}
          onSignOut={
            session == null
              ? null
              : () => {
                  setSession(null);
                  setManaging(false);
                }
          }
          onDisconnect={
            connected
              ? () => {
                  saveSpreadsheetId(platform, null);
                  setSpreadsheetId(null);
                  setManaging(false);
                }
              : null
          }
        />
      }
      showsNavigation={connected && !showsDetail && !managing}
      view={view}
      onView={setView}
      screen={connected ? screen : 'setup'}
    >
      {content()}
    </Layout>
  );
}

/**
 * The time of each call of the demo store, in milliseconds, as a network call: the app bar shows its progress circle.
 * The KMP app waits 400 ms.
 */
const DEMO_DELAY = 400;

/**
 * Keeps the store of one spreadsheet while the page shows. The App gives it a new key for each spreadsheet.
 * @param {object} props
 * @param {Session} props.session
 * @param {string} props.spreadsheetId
 * @param {(store: Store) => JSX.Element} props.children
 * @returns {JSX.Element}
 */
function SheetPage({ session, spreadsheetId, children }) {
  // The first store: the Today page keeps it.
  const [store] = useState(() => session.store(spreadsheetId));
  return children(store);
}

/**
 * The app bar, the main content and the navigation: Today, 5 days, 31 days, Score. A narrow window has a bottom
 * navigation bar. A window of {@link RAIL_WIDTH} or more has a navigation rail on the left.
 *
 * - The page scrolls as a normal web page. The app bar stays at the top, and the navigation bar at the bottom.
 * - `screen`: the name of the screen in the page area. Each main view keeps its scroll position while the app runs. A
 *   detail screen, the metrics screen and the setup page start at the top each time.
 * - The main action of the page (see {@link ActionBarHost}) shows below the content and above the bottom navigation
 *   bar.
 * @param {object} props
 * @param {JSX.Element} props.header
 * @param {boolean} props.showsNavigation
 * @param {MainView} props.view
 * @param {(view: MainView) => void} props.onView
 * @param {string} props.screen
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
function Layout({ header, showsNavigation, view, onView, screen, children }) {
  const [actionElement, setActionElement] = useState(/** @type {HTMLElement | null} */ (null));
  const actionBar = useMemo(() => new ActionBarHost(actionElement), [actionElement]);
  const hasRail = useWideWindow(RAIL_WIDTH);
  const bottom = useRef(/** @type {HTMLDivElement | null} */ (null));
  useScrollPerScreen(screen);
  useBottomHeight(bottom);
  return (
    <div class="app">
      {header}
      <div class="app-body">
        {showsNavigation && hasRail && <Navigation kind="rail" view={view} onView={onView} />}
        <main class="app-main">
          <LocalActionBarHost.Provider value={actionBar}>{children}</LocalActionBarHost.Provider>
        </main>
      </div>
      <div class="app-bottom" ref={bottom}>
        <div class="action-bar" ref={setActionElement} />
        {showsNavigation && !hasRail && <Navigation kind="bar" view={view} onView={onView} />}
      </div>
    </div>
  );
}

/**
 * The bottom navigation bar or the navigation rail of Compose Material 3: one item for each view.
 * @param {object} props
 * @param {'bar' | 'rail'} props.kind
 * @param {MainView} props.view
 * @param {(view: MainView) => void} props.onView
 * @returns {JSX.Element}
 */
function Navigation({ kind, view, onView }) {
  return (
    <nav class={kind === 'rail' ? 'navigation-rail' : 'navigation-bar'} aria-label="Views">
      {MainView.entries.map((v) => (
        <button
          key={v.name}
          type="button"
          class="navigation-item"
          aria-current={v === view ? 'page' : undefined}
          onClick={() => onView(v)}
        >
          <span class="navigation-indicator">
            <Symbol name={v.icon} />
          </span>
          <span class="navigation-label label-medium">{v.label}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * True while the window is `width` CSS pixels wide or wider.
 * @param {number} width
 * @returns {boolean}
 */
function useWideWindow(width) {
  const query = `(min-width: ${width}px)`;
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setWide(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return wide;
}

/**
 * Keeps the height of the bottom area (the action bar and the navigation bar) in the CSS variable
 * `--app-bottom-height` of the page. `App.css` uses it as the scroll padding, so the browser does not put a focused
 * element below the bottom area. Example: the Tab key moves the focus to a tile below the Save button.
 * @param {{ current: HTMLElement | null }} ref
 */
function useBottomHeight(ref) {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--app-bottom-height', `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--app-bottom-height');
    };
  }, [ref]);
}

/**
 * Keeps the scroll position of the page for each main view, and puts it back when the view shows again. Other screens
 * start at the top.
 * @param {string} screen
 */
function useScrollPerScreen(screen) {
  const positions = useRef(/** @type {Map<string, number>} */ (new Map()));
  const shown = useRef(screen);
  useEffect(() => {
    const onScroll = () => positions.current.set(shown.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    const isMainView = MainView.entries.some((v) => v.name === screen);
    window.scrollTo(0, isMainView ? (positions.current.get(screen) ?? 0) : 0);
  }, [screen]);
}
