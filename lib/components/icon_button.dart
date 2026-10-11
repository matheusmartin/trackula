import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

/// A round, transparent button with the Material Symbols [icon] and the tooltip [title]. [small] for the tool bars
/// of the detail screen.
Component iconButton({
  required String icon,
  required String title,
  required VoidCallback? onClick,
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
