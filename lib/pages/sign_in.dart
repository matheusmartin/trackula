import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../services/session.dart';

class SignInPage extends StatefulComponent {
  const SignInPage({required this.expired, required this.onSignedIn, super.key});

  /// True if the user was signed out because the 1-hour token expired.
  final bool expired;
  final void Function(Session) onSignedIn;

  @override
  State<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> {
  bool _busy = false;
  String? _error;

  Future<void> _signIn() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      component.onSignedIn(await Session.signIn(selectAccount: !component.expired));
    } catch (e) {
      setState(() => _error = 'Sign-in failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Full-screen page: a large logo in the center and the sign-in button at the bottom. Styles: web/theme.css.
  @override
  Component build(BuildContext context) {
    return main_(classes: 'splash', [
      div(classes: 'splash-logo', [
        img(src: 'images/logo.svg', alt: ''),
        h1([.text('Trackula')]),
      ]),
      div(classes: 'splash-actions', [
        if (component.expired) p([.text('Google access lasts 1 hour. Sign in again to continue.')]),
        button(classes: 'round', disabled: _busy, onClick: _signIn, [
          i([.text('login')]),
          span([.text('Sign in with Google')]),
        ]),
        if (_error case final e?) p(classes: 'error-text', [.text(e)]),
      ]),
    ]);
  }
}
