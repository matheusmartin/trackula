import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import 'components/header.dart';
import 'config.dart';
import 'pages/setup.dart';
import 'pages/sign_in.dart';
import 'pages/today.dart';
import 'services/session.dart';

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
    final session = _session;
    final sheetId = _sheetId;
    // Signed out: only the full-screen sign-in page, without the top bar.
    if (session == null && hasClientId && hasApiKey) return SignInPage(expired: _expired, onSignedIn: _signedIn);
    // Header and main are direct children of <body>, as the BeerCSS main layout expects.
    return .fragment([
      Header(
        sheetId: session == null ? null : sheetId,
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
          TodayPage(key: ValueKey(sheetId), session: session, sheetId: sheetId, onExpired: _expire),
      ]),
    ]);
  }
}
