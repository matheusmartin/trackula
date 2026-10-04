import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

/// Material top app bar with the app name and the session actions.
class Header extends StatelessComponent {
  const Header({this.onReload, this.busy = false, this.onSignOut, this.onDisconnect, super.key});

  /// Reloads the sheet data. Null: no reload button, for example before a sheet is chosen.
  final VoidCallback? onReload;

  /// True while data loads or saves: a progress circle shows instead of the reload button.
  final bool busy;
  final VoidCallback? onSignOut;
  final VoidCallback? onDisconnect;

  @override
  Component build(BuildContext context) {
    return header(classes: 'fixed primary', [
      nav([
        img(classes: 'app-logo', src: 'images/logo.svg', alt: ''),
        h6(classes: 'max', [.text('Trackula')]),
        if (onReload != null)
          if (busy)
            progress(classes: 'circle small', attributes: {'aria-label': 'Loading'}, [])
          else
            button(
              classes: 'circle transparent',
              attributes: {'title': 'Reload'},
              onClick: onReload,
              [
                i([.text('refresh')]),
              ],
            ),
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
