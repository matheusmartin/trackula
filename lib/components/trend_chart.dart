import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../model/chart.dart';
import '../model/day.dart';

/// A small chart of one number metric over [days], with the first and last day below it.
/// The SVG stretches to the card width.
///
/// - Line (default): the Y axis goes from the lowest to the highest value. Lines and dots keep their size.
/// - Bars ([bars] true, for `count` metrics): the Y axis goes from 0 to the highest value.
class TrendChart extends StatelessComponent {
  const TrendChart({required this.days, required this.values, this.unit, this.bars = false, super.key});

  final List<Day> days;
  final Map<Day, num> values;
  final String? unit;
  final bool bars;

  static const _w = 100.0;
  static const _h = 40.0;

  @override
  Component build(BuildContext context) {
    final points = chartPoints(days, values, width: _w, height: _h);
    if (points.isEmpty) return .fragment([]);
    final high = points.map((pt) => pt.value).reduce((x, y) => x > y ? x : y);
    final low = bars ? 0 : points.map((pt) => pt.value).reduce((x, y) => x < y ? x : y);

    return div(classes: 'chart', styles: _chart, [
      div(styles: _yAxis, [
        small(styles: _text, [.text(_format(high))]),
        if (high != low) small(styles: _text, [.text(_format(low))]),
      ]),
      svg(
        viewBox: '0 0 ${_n(_w)} ${_n(_h)}',
        styles: _svg,
        attributes: {'preserveAspectRatio': 'none', 'role': 'img', 'aria-label': _label(low, high)},
        bars ? _bars() : _line(points),
      ),
      div(styles: _xAxis, [
        small(styles: _text, [.text(_short(days.first))]),
        small(styles: _text, [.text(_short(days.last))]),
      ]),
    ]);
  }

  // Inline styles, not @css rules: the chart must render correctly even when the browser has an old main.css.
  // The line and dots use the theme color (--primary). The SVG stretches, so they use non-scaling strokes.
  static const _chart = Styles(
    raw: {
      'display': 'grid',
      'grid-template-columns': 'auto 1fr',
      'column-gap': '0.4rem',
      'margin-top': '0.75rem',
      'color': 'var(--primary)',
    },
  );
  static const _yAxis = Styles(
    raw: {
      'grid-row': '1',
      'display': 'flex',
      'flex-direction': 'column',
      'justify-content': 'space-between',
      'text-align': 'right',
    },
  );
  static const _xAxis = Styles(raw: {'grid-column': '2', 'display': 'flex', 'justify-content': 'space-between'});
  static const _svg = Styles(raw: {'display': 'block', 'width': '100%', 'height': '4.5rem', 'overflow': 'visible'});
  static const _text = Styles(
    raw: {'font-size': '0.65rem', 'line-height': '1.2', 'color': 'var(--on-surface-variant)'},
  );
  static const _lineStyle = Styles(
    raw: {
      'fill': 'none',
      'stroke': 'currentColor',
      'stroke-width': '2',
      'stroke-linejoin': 'round',
      'vector-effect': 'non-scaling-stroke',
    },
  );
  static const _barStyle = Styles(raw: {'fill': 'currentColor'});
  // A zero-length path with a round cap draws a round dot of stroke-width size.
  static const _dotStyle = Styles(
    raw: {
      'fill': 'none',
      'stroke': 'currentColor',
      'stroke-width': '6',
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke',
    },
  );

  List<Component> _line(List<ChartPoint> points) => [
    path(
      d: [for (final (i, pt) in points.indexed) '${i == 0 ? 'M' : 'L'}${_n(pt.x)} ${_n(pt.y)}'].join(' '),
      styles: _lineStyle,
      [],
    ),
    for (final pt in points) path(d: 'M${_n(pt.x)} ${_n(pt.y)} h0', styles: _dotStyle, [_title(pt.day, pt.value)]),
  ];

  List<Component> _bars() => [
    for (final b in chartBars(days, values, width: _w, height: _h))
      path(
        d: 'M${_n(b.x)} ${_n(_h)} V${_n(b.y)} h${_n(b.w)} V${_n(_h)} Z',
        styles: _barStyle,
        [_title(b.day, b.value)],
      ),
  ];

  /// Tooltip with the date and value.
  Component _title(Day day, num value) =>
      Component.element(tag: 'title', children: [.text('$day: ${_format(value)} ${unit ?? ''}'.trim())]);

  String _label(num low, num high) =>
      'Values from ${_format(low)} to ${_format(high)} ${unit ?? ''}, ${_short(days.first)} to ${_short(days.last)}';

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  static String _short(Day d) => '${_months[d.month - 1]} ${d.day}';

  static String _n(double v) => v.toStringAsFixed(2);

  /// Removes float noise, for example 82.10000000000001.
  static String _format(num v) =>
      v == v.roundToDouble() ? v.toInt().toString() : double.parse(v.toStringAsFixed(3)).toString();
}
