import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../model/metric.dart';

/// The icon of [m] in a chip: a Material Symbol for a lowercase name such as `water_drop`, else the text, such as an
/// emoji. [large] for the title of the detail screen. Styles: `.icon` in theme.dart.
Component metricIcon(Metric m, {bool large = false}) => span(classes: large ? 'icon large' : 'icon', [
  if (_symbolName.hasMatch(m.icon)) i([.text(m.icon)]) else .text(m.icon),
]);

final _symbolName = RegExp(r'^[a-z0-9_]+$');
