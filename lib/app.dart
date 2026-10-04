import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import 'components/habit_table.dart';
import 'components/header.dart';
import 'config.dart';
import 'pages/setup.dart';
import 'pages/sign_in.dart';
import 'pages/today.dart';
import 'services/session.dart';
import 'sheets/demo_store.dart';
import 'sheets/store.dart';

/// Root component. Shows sign-in, then sheet setup, then the Today page.
class App extends StatefulComponent {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  Session? _session;
  String? _sheetId = SavedSheet.id;
  bool _expired = false;

  /// The view of the Today page. The app always opens on the Today tiles.
  DayRange _range = DayRange.today;

  /// The reload button in the app bar reloads the Today page with this handle.
  final _reload = ReloadHandle();

  /// True while the Today page loads or writes: the app bar shows a progress circle instead of the reload button.
  bool _busy = false;

  /// True while the Today page shows a metric detail screen: then the bottom navigation bar is hidden.
  bool _detail = false;

  void _setRange(DayRange r) => setState(() => _range = r);

  void _setDetail(bool open) => setState(() => _detail = open);

  /// The Today page with the range of the bottom navigation bar.
  TodayPage _today({required Store store, required bool Function() expired, VoidCallback? onExpired, Key? key}) =>
      TodayPage(
        key: key,
        store: store,
        expired: expired,
        onExpired: onExpired ?? () {},
        range: _range,
        onRange: _setRange,
        onDetail: _setDetail,
        reload: _reload,
        onBusy: (busy) => setState(() => _busy = busy),
      );

  /// The bottom navigation bar: Today, 5 days, 31 days. A direct child of `<body>`, as the BeerCSS layout expects:
  /// BeerCSS keeps it at the bottom of the screen.
  Component _bottomNav() => nav(
    classes: 'bottom',
    attributes: {'aria-label': 'Views'},
    [
      for (final r in DayRange.values)
        a(
          href: '#',
          classes: r == _range ? 'active' : null,
          attributes: {if (r == _range) 'aria-current': 'page'},
          events: {
            'click': (e) {
              e.preventDefault();
              _setRange(r);
            },
          },
          [
            i([.text(r.icon)]),
            span([.text(r.label)]),
          ],
        ),
    ],
  );

  /// Demo mode: the URL has `?demo`. Sample data in memory, no sign-in. See DemoStore.
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

  void _connect(String id) => setState(() => SavedSheet.id = _sheetId = id);

  void _disconnect() => setState(() => SavedSheet.id = _sheetId = null);

  @override
  Component build(BuildContext context) {
    if (_demo case final demo?) {
      return .fragment([
        Header(onReload: () => _reload.run?.call(), busy: _busy),
        main_(classes: 'responsive', [
          p(classes: 'secondary-text', [
            .text('Demo mode: sample data in this tab only. Nothing goes to Google Sheets. A reload starts again.'),
          ]),
          _today(store: demo, expired: () => false),
        ]),
        if (!_detail) _bottomNav(),
      ]);
    }
    final session = _session;
    final sheetId = _sheetId;
    // Signed out: only the full-screen sign-in page, without the top bar.
    if (session == null && hasClientId && hasApiKey) return SignInPage(expired: _expired, onSignedIn: _signedIn);
    // Header and main are direct children of <body>, as the BeerCSS main layout expects.
    return .fragment([
      Header(
        onReload: session == null || sheetId == null ? null : () => _reload.run?.call(),
        busy: _busy,
        onSignOut: session == null ? null : _signOut,
        onDisconnect: session == null || sheetId == null ? null : _disconnect,
      ),
      main_(classes: 'responsive', [
        if (!hasClientId || !hasApiKey)
          p(classes: 'secondary-text', [.text('Set GOOGLE_CLIENT_ID and GOOGLE_API_KEY in config.env. See README.md.')])
        else if (session == null)
          const .empty()
        else if (sheetId == null)
          SetupPage(session: session, onConnected: _connect)
        else
          _today(
            key: ValueKey(sheetId),
            store: session.store(sheetId),
            expired: () => session.expired,
            onExpired: _expire,
          ),
      ]),
      if (session != null && sheetId != null && !_detail) _bottomNav(),
    ]);
  }
}
