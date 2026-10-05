import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import 'ui.dart';

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
            iconButton('refresh', title: 'Reload', onClick: onReload),
        if (onDisconnect != null) iconButton('swap_horiz', title: 'Change sheet', onClick: onDisconnect),
        if (onSignOut != null) iconButton('logout', title: 'Sign out', onClick: onSignOut),
      ]),
    ]);
  }
}
