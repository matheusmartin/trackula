import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import 'components/header.dart';
import 'config.dart';
import 'model/main_view.dart';
import 'pages/setup.dart';
import 'pages/sign_in.dart';
import 'pages/today.dart';
import 'services/session.dart';
import 'sheets/demo_store.dart';
import 'sheets/store.dart';

/// Root component. Shows sign-in, then sheet setup, then the Today page.
final class App extends StatefulComponent {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  Session? _session;
  String? _spreadsheetId = savedSpreadsheetId;
  bool _expired = false;

  /// The view of the Today page. The app always opens on the Today tiles.
  MainView _view = MainView.today;

  /// The reload button in the app bar reloads the Today page with this handle.
  final _reload = ReloadHandle();

  /// True while the Today page loads or writes: the app bar shows a progress circle instead of the reload button.
  bool _busy = false;

  /// True while the Today page shows a metric detail screen: then the bottom navigation bar is hidden.
  bool _showsDetail = false;

  void _setView(MainView v) => setState(() => _view = v);

  void _setDetail({required bool open}) => setState(() => _showsDetail = open);

  void _reloadToday() => _reload.run?.call();

  /// The Today page with the view of the bottom navigation bar.
  TodayPage _todayPage({required Store store, required bool Function() expired, VoidCallback? onExpired, Key? key}) =>
      TodayPage(
        key: key,
        store: store,
        expired: expired,
        onExpired: onExpired ?? () {},
        view: _view,
        onView: _setView,
        onDetail: _setDetail,
        reload: _reload,
        onBusy: ({required busy}) => setState(() => _busy = busy),
      );

  /// The bottom navigation bar: Today, 5 days, 31 days, Score. A direct child of `<body>`, as the BeerCSS layout
  /// expects: BeerCSS keeps it at the bottom of the screen.
  Component _bottomNav() => nav(
    classes: 'bottom',
    attributes: {'aria-label': 'Views'},
    [
      for (final v in MainView.values)
        a(
          href: '#',
          classes: v == _view ? 'active' : null,
          attributes: {if (v == _view) 'aria-current': 'page'},
          events: {
            'click': (e) {
              e.preventDefault();
              _setView(v);
            },
          },
          [
            i([.text(v.icon)]),
            span([.text(v.label)]),
          ],
        ),
    ],
  );

  /// Demo mode: the URL has `?demo`. Sample data in memory, no sign-in. See [DemoStore].
  final DemoStore? _demo = Uri.base.queryParameters.containsKey('demo') ? DemoStore() : null;

  void _signedIn(Session s) => setState(() {
    _session = s;
    _expired = false;
  });

  void _signOut() => setState(() => _session = null);

  void _expire() => setState(() {
    _session = null;
    _expired = true;
  });

  void _connect(String id) => setState(() => savedSpreadsheetId = _spreadsheetId = id);

  void _disconnect() => setState(() => savedSpreadsheetId = _spreadsheetId = null);

  /// The app bar, the main content and the bottom navigation bar. They are direct children of `<body>`, as the
  /// BeerCSS layout expects.
  Component _layout(Header header, List<Component> content, {required bool showsNavigation}) => .fragment([
    header,
    main_(classes: 'responsive', content),
    if (showsNavigation && !_showsDetail) _bottomNav(),
  ]);

  @override
  Component build(BuildContext context) {
    if (_demo case final demo?) {
      return _layout(Header(onReload: _reloadToday, busy: _busy), [
        p(classes: 'secondary-text', [
          .text('Demo mode: sample data in this tab only. Nothing goes to Google Sheets. A reload starts again.'),
        ]),
        _todayPage(store: demo, expired: () => false),
      ], showsNavigation: true);
    }
    final session = _session;
    final spreadsheetId = _spreadsheetId;
    // Signed out: only the full-screen sign-in page, without the top bar.
    if (session == null && hasClientId && hasApiKey) return SignInPage(expired: _expired, onSignedIn: _signedIn);
    final connected = session != null && spreadsheetId != null;
    return _layout(
      Header(
        onReload: connected ? _reloadToday : null,
        busy: _busy,
        onSignOut: session == null ? null : _signOut,
        onDisconnect: connected ? _disconnect : null,
      ),
      [
        if (!hasClientId || !hasApiKey)
          p(classes: 'secondary-text', [.text('Set GOOGLE_CLIENT_ID and GOOGLE_API_KEY in config.env. See README.md.')])
        else if (session == null)
          const .empty()
        else if (spreadsheetId == null)
          SetupPage(session: session, onConnected: _connect)
        else
          _todayPage(
            key: ValueKey(spreadsheetId),
            store: session.store(spreadsheetId),
            expired: () => session.expired,
            onExpired: _expire,
          ),
      ],
      showsNavigation: connected,
    );
  }
}
