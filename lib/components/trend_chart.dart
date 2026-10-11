import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../model/chart.dart';
import '../model/day.dart';
import '../model/format.dart';

/// A small chart of one number metric or of the score over [days], with the first and last day below it.
/// The SVG stretches to the card width. The chart uses the theme color `--primary`.
///
/// - Line (default): the Y axis goes from the lowest to the highest value, or from 0 with [fromZero]. Lines and dots
///   keep their size.
/// - Bars ([showsBars] true, for `count` metrics): the Y axis goes from 0 to the highest value.
final class TrendChart extends StatelessComponent {
  const TrendChart({
    required this.days,
    required this.values,
    this.unit,
    this.showsBars = false,
    this.fromZero = false,
    this.showsValues = false,
    super.key,
  });

  final List<Day> days;
  final Map<Day, num> values;
  final String? unit;

  /// True if the chart shows bars from 0, for `count` metrics. Else it shows a line.
  final bool showsBars;

  /// True if the Y axis of the line starts at 0, as for bars.
  final bool fromZero;

  /// True if each dot of the line has its value above it. For short series only, for example 5 days.
  final bool showsValues;

  /// The size of the chart, in chart units.
  static const _width = 100.0, _height = 40.0;

  @override
  Component build(BuildContext context) {
    final points = chartPoints(days, values, width: _width, height: _height, fromZero: fromZero);
    if (points.isEmpty) return .fragment([]);
    final high = points.map((pt) => pt.value).reduce(math.max);
    final low = showsBars || fromZero ? 0 : points.map((pt) => pt.value).reduce(math.min);

    return div(classes: 'chart', styles: _chart, [
      div(styles: _yAxis, [
        small(styles: _text, [.text(_format(high))]),
        if (high != low) small(styles: _text, [.text(_format(low))]),
      ]),
      div(styles: showsValues ? _plot.combine(_valuePadding) : _plot, [
        svg(
          viewBox: '0 0 ${_coordinate(_width)} ${_coordinate(_height)}',
          styles: _svg,
          attributes: {'preserveAspectRatio': 'none', 'role': 'img', 'aria-label': _label(low, high)},
          showsBars ? _bars() : _line(points),
        ),
        if (showsValues && !showsBars) ..._valueLabels(points),
      ]),
      div(styles: showsValues ? _xAxis.combine(_valuePadding) : _xAxis, [
        small(styles: _text, [.text(shortDay(days.first))]),
        small(styles: _text, [.text(shortDay(days.last))]),
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
  // The value labels are HTML on top of the SVG, so that the stretched SVG does not stretch the text.
  static const _plot = Styles(raw: {'grid-row': '1', 'grid-column': '2', 'position': 'relative'});
  // Room at the sides for the labels of the first and the last dot. The X axis gets the same room, so that the dates
  // stay below the dots.
  static const _valuePadding = Styles(raw: {'padding-inline': '0.75rem'});
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
      d: [
        for (final (i, pt) in points.indexed) '${i == 0 ? 'M' : 'L'}${_coordinate(pt.x)} ${_coordinate(pt.y)}',
      ].join(' '),
      styles: _lineStyle,
      [],
    ),
    for (final pt in points)
      path(d: 'M${_coordinate(pt.x)} ${_coordinate(pt.y)} h0', styles: _dotStyle, [_title(pt.day, pt.value)]),
  ];

  List<Component> _bars() => [
    for (final b in chartBars(days, values, width: _width, height: _height))
      path(
        d: 'M${_coordinate(b.x)} ${_coordinate(_height)} V${_coordinate(b.y)} h${_coordinate(b.w)} V${_coordinate(_height)} Z',
        styles: _barStyle,
        [_title(b.day, b.value)],
      ),
  ];

  /// The value of each point, above its dot.
  List<Component> _valueLabels(List<ChartPoint> points) => [
    for (final pt in points)
      small(
        styles: Styles(
          raw: {
            'position': 'absolute',
            // The left side of the padding box is the start of the padding: see _valuePadding.
            'left': 'calc(0.75rem + (100% - 1.5rem) * ${(pt.x / _width).toStringAsFixed(4)})',
            'top': '${(100 * pt.y / _height).toStringAsFixed(2)}%',
            'transform': 'translate(-50%, -150%)',
            'font-size': '0.7rem',
            'font-weight': '600',
            'line-height': '1',
            'white-space': 'nowrap',
            'pointer-events': 'none',
          },
        ),
        [.text(_format(pt.value))],
      ),
  ];

  /// Tooltip with the date and value.
  Component _title(Day day, num value) =>
      Component.element(tag: 'title', children: [.text('$day: ${withUnit(_format(value), unit)}')]);

  String _label(num low, num high) =>
      'Values from ${_format(low)} to ${withUnit(_format(high), unit)}, ${shortDay(days.first)} to ${shortDay(days.last)}';

  /// A coordinate in the SVG path.
  static String _coordinate(double value) => value.toStringAsFixed(2);

  static String _format(num value) => formatNumber(value, 3);
}
