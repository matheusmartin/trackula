/// Small building blocks that many screens use.
library;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

/// A round, transparent button with only an icon. [title] is its tooltip. [small]: the small BeerCSS size.
Component iconButton(
  String icon, {
  required String title,
  VoidCallback? onClick,
  bool disabled = false,
  bool small = false,
}) => button(
  classes: small ? 'circle transparent small' : 'circle transparent',
  attributes: {'title': title},
  disabled: disabled,
  onClick: onClick,
  [
    i([.text(icon)]),
  ],
);

/// An error message in the error color.
Component errorText(String message) => p(classes: 'error-text', [.text(message)]);

/// A busy flag and an error message for a page that runs one task at a time, such as a sign-in.
mixin BusyState<T extends StatefulComponent> on State<T> {
  /// True while [runBusy] runs.
  bool busy = false;

  /// The error of the last task, or null.
  String? error;

  /// Runs [task]: [busy] is true until it ends, and an error shows in [error]. [describe] makes the error text.
  /// After the page is gone, nothing changes.
  Future<void> runBusy(Future<void> Function() task, {String Function(Object e)? describe}) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await task();
    } catch (e) {
      if (mounted) setState(() => error = describe?.call(e) ?? '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}
