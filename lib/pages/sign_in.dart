import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../components/ui.dart';
import '../services/session.dart';

class SignInPage extends StatefulComponent {
  const SignInPage({required this.expired, required this.onSignedIn, super.key});

  /// True if the user was signed out because the 1-hour token expired.
  final bool expired;
  final void Function(Session) onSignedIn;

  @override
  State<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> with BusyState {
  Future<void> _signIn() => runBusy(
    () async => component.onSignedIn(await Session.signIn(selectAccount: !component.expired)),
    describe: (e) => 'Sign-in failed: $e',
  );

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
        button(classes: 'round', disabled: busy, onClick: _signIn, [
          i([.text('login')]),
          span([.text('Sign in with Google')]),
        ]),
        if (error case final e?) errorText(e),
      ]),
    ]);
  }
}
