import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../model/chart.dart';
import '../../model/date_format.dart';
import '../../model/day.dart';
import '../../model/format.dart';
import 'chart_parts.dart';

/// A small chart of one number metric over [days], with the first and last day below it. It has no card: it goes
/// below the habit table. The SVG stretches to the width. Styles: chart_parts.dart, as the detail charts.
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

    return chartWithAxes(
      chartSvg(_w, _h, height: '4.5rem', label: _label(low, high), bars ? _bars() : _line(points)),
      high: formatNumber(high, 3),
      low: high == low ? null : formatNumber(low, 3),
      first: shortDay(days.first),
      last: shortDay(days.last),
      marginTop: '0.75rem',
    );
  }

  static const _barStyle = Styles(raw: {'fill': chartPrimary});

  List<Component> _line(List<ChartPoint> points) => [
    path(
      d: [for (final (i, pt) in points.indexed) '${i == 0 ? 'M' : 'L'}${_n(pt.x)} ${_n(pt.y)}'].join(' '),
      styles: chartLineStyle,
      [],
    ),
    for (final pt in points)
      path(d: 'M${_n(pt.x)} ${_n(pt.y)} h0', styles: chartDotStyle(chartPrimary), [_title(pt.day, pt.value)]),
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
  Component _title(Day day, num value) => svgTooltip('$day: ${withUnit(value, unit, 3)}');

  String _label(num low, num high) =>
      'Values from ${formatNumber(low, 3)} to ${withUnit(high, unit, 3)}, ${shortDay(days.first)} to ${shortDay(days.last)}';

  static String _n(double v) => v.toStringAsFixed(2);
}
