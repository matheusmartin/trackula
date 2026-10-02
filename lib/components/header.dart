import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

/// Material top app bar with the app name and the session actions.
class Header extends StatelessComponent {
  const Header({this.onSignOut, this.onDisconnect, super.key});

  final VoidCallback? onSignOut;
  final VoidCallback? onDisconnect;

  @override
  Component build(BuildContext context) {
    return header(classes: 'fixed primary', [
      nav([
        img(classes: 'app-logo', src: 'images/logo.svg', alt: ''),
        h6(classes: 'max', [.text('Trackula')]),
        if (onDisconnect != null)
          button(
            classes: 'circle transparent',
            attributes: {'title': 'Change sheet'},
            onClick: onDisconnect,
            [
              i([.text('swap_horiz')]),
            ],
          ),
        if (onSignOut != null)
          button(
            classes: 'circle transparent',
            attributes: {'title': 'Sign out'},
            onClick: onSignOut,
            [
              i([.text('logout')]),
            ],
          ),
      ]),
    ]);
  }
}
